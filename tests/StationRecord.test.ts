import { NumberProperty } from "scenerystack/axon";
import { expect, it } from "vitest";
import { EVENTS } from "../src/common/data/generated/eventData.js";
import { RegionalDistanceModel } from "../src/common/model/DistanceModel.js";
import { StationRecord } from "../src/common/model/StationRecord.js";
import { listenerCount } from "./helpers/memoryLeak.js";

it("reacts to picks and wave speeds and unlinks on dispose", () => {
  const vpProperty = new NumberProperty(6.1);
  const vsProperty = new NumberProperty(3.5);
  const baseline = listenerCount(vpProperty);
  const station = new StationRecord(EVENTS[0]!.stations[0]!, new RegionalDistanceModel(vpProperty, vsProperty));
  station.pPickProperty.value = 20;
  expect(station.distanceKmProperty.value).toBeNull();
  station.sPickProperty.value = 30;
  expect(station.sMinusPProperty.value).toBe(10);
  expect(station.distanceKmProperty.value).toBeCloseTo(82.1, 1);
  vpProperty.value = 3;
  expect(station.distanceKmProperty.value).toBeNull();
  station.reset();
  expect(station.pPickProperty.value).toBeNull();
  station.dispose();
  expect(listenerCount(vpProperty)).toBe(baseline);
  vpProperty.dispose();
  vsProperty.dispose();
});
