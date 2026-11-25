import { Tandem } from "scenerystack/tandem";
import { expect, it } from "vitest";
import { EVENTS } from "../src/common/data/generated/eventData.js";
import { destinationPoint } from "../src/common/model/geodesy.js";
import { SeismologyLabModel } from "../src/common/model/SeismologyLabModel.js";
import { CHECK_FAIR_KM, CHECK_GOOD_KM, REGIONAL_VP_KM_S, REGIONAL_VS_KM_S } from "../src/SeismologyLabConstants.js";

it("rebuilds and disposes stations, clears the guess and resets all controls", () => {
  const model = new SeismologyLabModel("regional", EVENTS, Tandem.OPT_OUT);
  const old = model.stationsProperty.value[0]!;
  old.pPickProperty.value = 15;
  model.guessProperty.value = [0, 0];
  model.reveal();
  model.eventProperty.value = model.events[1]!;
  expect(old.pPickProperty.isDisposed).toBe(true);
  expect(model.stationsProperty.value[0]!.pPickProperty.value).toBeNull();
  expect(model.guessProperty.value).toBeNull();
  expect(model.revealedProperty.value).toBe(false);
  model.showHorizontalProperty.value = true;
  model.showCirclesProperty.value = false;
  model.vpProperty.value = 7;
  model.vsProperty.value = 4;
  model.reset();
  expect(model.eventProperty.value).toBe(model.events[0]);
  expect(model.vpProperty.value).toBe(REGIONAL_VP_KM_S);
  expect(model.vsProperty.value).toBe(REGIONAL_VS_KM_S);
  expect(model.showHorizontalProperty.value).toBe(false);
  expect(model.showCirclesProperty.value).toBe(true);
  expect(model.timeWindowProperty.value.equals(model.fullTimeWindow)).toBe(true);
  model.dispose();
});

it.each(["regional", "global"] as const)(
  "checks each %s threshold only when three circles and a guess exist",
  (kind) => {
    const model = new SeismologyLabModel(kind, EVENTS, Tandem.OPT_OUT);
    const { lon, lat } = model.eventProperty.value;
    model.guessProperty.value = [lon, lat];
    model.check();
    expect(model.checkResultProperty.value).toBe("none");
    for (const station of model.stationsProperty.value.slice(0, 3)) {
      station.pPickProperty.value = station.data.pTheoSeconds;
      station.sPickProperty.value = station.data.sTheoSeconds;
    }
    for (const [distance, expected] of [
      [CHECK_GOOD_KM[kind] - 1, "good"],
      [CHECK_GOOD_KM[kind] + 1, "fair"],
      [CHECK_FAIR_KM[kind] + 1, "far"],
    ] as const) {
      model.guessProperty.value = destinationPoint([lon, lat], 30, distance);
      model.check();
      expect(model.checkResultProperty.value).toBe(expected);
    }
    expect(model.revealedProperty.value).toBe(false);
    model.dispose();
  },
);
