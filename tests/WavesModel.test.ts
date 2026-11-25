import { expect, it } from "vitest";
import { catalogEvents, loadEvent } from "../src/common/data/eventLibrary.js";
import { WAVES_ARRIVAL_PAUSE_SECONDS, WAVES_PLAYBACK_RATE } from "../src/SeismologyLabConstants.js";
import { frontRadiusKm, WavesModel } from "../src/waves/model/WavesModel.js";

await Promise.all(catalogEvents().map(loadEvent));

/** Plays at 60 frames per second until `done` or a frame budget runs out. */
function play(model: WavesModel, done: () => boolean, maxFrames = 20_000): number {
  let frames = 0;
  while (!done() && frames < maxFrames) {
    model.step(1 / 60);
    frames++;
  }
  return frames;
}

it("holds once at each P arrival and never at S", () => {
  const model = new WavesModel();
  const holds: number[] = [];
  const pArrivals: number[] = [];
  const sArrivals: number[] = [];
  model.holdingProperty.lazyLink((holding) => holding && holds.push(model.timer.timeProperty.value));
  model.arrivalEmitter.addListener((phase, index) => (phase === "p" ? pArrivals : sArrivals).push(index));
  model.timer.isPlayingProperty.value = true;
  play(model, () => !model.timer.isPlayingProperty.value);
  const stations = model.stationsProperty.value;
  const pTimes = [...new Set(stations.map(({ pTheoSeconds }) => pTheoSeconds))].sort((a, b) => a - b);
  expect(holds).toEqual(pTimes);
  expect(pArrivals.sort((a, b) => a - b)).toEqual(stations.map((_, index) => index));
  expect(sArrivals.sort((a, b) => a - b)).toEqual(stations.map((_, index) => index));
  expect(model.isFinished).toBe(true);
  expect(model.pArrivedCountProperty.value).toBe(stations.length);
  model.dispose();
});

it("pauses for about the hold time, and skips holds when auto-pause is off", () => {
  const model = new WavesModel();
  model.timer.isPlayingProperty.value = true;
  play(model, () => model.holdingProperty.value);
  const arrival = model.timer.timeProperty.value;
  const held = play(model, () => !model.holdingProperty.value);
  expect(held / 60).toBeCloseTo(WAVES_ARRIVAL_PAUSE_SECONDS, 1);
  expect(model.timer.timeProperty.value).toBeGreaterThan(arrival);

  model.restart();
  model.autoPauseProperty.value = false;
  const holds: boolean[] = [];
  model.holdingProperty.lazyLink((holding) => holds.push(holding));
  play(model, () => !model.timer.isPlayingProperty.value);
  expect(holds).toEqual([]);
  model.dispose();
});

it("step-forward goes through arrivals, and play at the end replays from the origin", () => {
  const model = new WavesModel();
  for (let index = 0; index < 400 && !model.isFinished; index++) {
    model.stepForward();
    expect(model.holdingProperty.value).toBe(false);
  }
  expect(model.isFinished).toBe(true);
  model.timer.isPlayingProperty.value = true;
  expect(model.timer.timeProperty.value).toBe(0);
  model.reset();
  expect(model.timer.isPlayingProperty.value).toBe(false);
  expect(model.eventProperty.value).toBe(model.events[0]);
  model.dispose();
});

it("spreads each front so it reaches every station as that station's arrival flag appears", () => {
  for (const event of catalogEvents()) {
    expect(frontRadiusKm(event, "p", 0)).toBeNull();
    // Regional stations are within 20 km (the 1° table is coarse there), global within 100 km.
    const tolerance = event.kind === "regional" ? 20 : 100;
    for (const station of event.stations) {
      for (const [phase, time] of [
        ["p", station.pTheoSeconds],
        ["s", station.sTheoSeconds],
      ] as const) {
        expect(Math.abs(frontRadiusKm(event, phase, time)! - station.distanceKm)).toBeLessThan(tolerance);
      }
    }
  }
  expect(WAVES_PLAYBACK_RATE.global).toBeGreaterThan(WAVES_PLAYBACK_RATE.regional);
});

it("switching earthquakes rewinds and pauses", () => {
  const model = new WavesModel();
  model.timer.isPlayingProperty.value = true;
  play(model, () => model.timer.timeProperty.value > 10);
  model.eventProperty.value = model.events.at(-1)!;
  expect(model.timer.timeProperty.value).toBe(0);
  expect(model.timer.isPlayingProperty.value).toBe(false);
  expect(model.eventDataProperty.value?.key).toBe(model.events.at(-1)!.key);
  model.dispose();
});
