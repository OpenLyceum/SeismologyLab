import { Tandem } from "scenerystack/tandem";
import { expect, it } from "vitest";
import { catalogEvents, loadEvent, loadedEvent } from "../src/common/data/eventLibrary.js";
import { SeismologyLabModel } from "../src/common/model/SeismologyLabModel.js";

// This file deliberately does not preload, so it sees the app's lazy path.
it("splits the catalog by screen and merges waveforms into station order", async () => {
  expect(catalogEvents("regional").length).toBeGreaterThanOrEqual(8);
  expect(catalogEvents("global").length).toBeGreaterThanOrEqual(8);
  const summary = catalogEvents("global")[0]!;
  expect(loadedEvent(summary)).toBeUndefined();
  const [first, second] = await Promise.all([loadEvent(summary), loadEvent(summary)]);
  expect(second).toBe(first);
  expect(loadedEvent(summary)).toBe(first);
  first.stations.forEach((station, index) => {
    expect(station.code).toBe(summary.stations[index]!.code);
    expect(station.vertical.length).toBeGreaterThan(0);
  });
});

it("shows stations once an unloaded event arrives and ignores a load that resolves late", async () => {
  const [first, second, third] = catalogEvents("regional");
  await loadEvent(first!);
  const model = new SeismologyLabModel("regional", catalogEvents(), Tandem.OPT_OUT);
  expect(model.stationsProperty.value).toHaveLength(6);
  expect(model.loadingProperty.value).toBe(false);

  model.eventProperty.value = second!;
  expect(model.loadingProperty.value).toBe(true);
  expect(model.stationsProperty.value).toHaveLength(0);
  // Switch again before the second event's waveforms arrive.
  model.eventProperty.value = third!;
  await loadEvent(second!);
  await loadEvent(third!);
  await Promise.resolve();
  expect(model.loadingProperty.value).toBe(false);
  expect(model.stationsProperty.value.map(({ data }) => data.code)).toEqual(
    [...third!.stations].sort((a, b) => a.distanceKm - b.distanceKm).map(({ code }) => code),
  );
  model.dispose();
});
