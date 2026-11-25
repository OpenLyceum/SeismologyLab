import { NumberProperty } from "scenerystack/axon";
import { expect, it } from "vitest";
import { TRAVEL_TIME_TABLE } from "../src/common/data/generated/travelTimeData.js";
import { GlobalDistanceModel, RegionalDistanceModel } from "../src/common/model/DistanceModel.js";
import { TravelTimeCurve } from "../src/common/model/TravelTimeCurve.js";

it("uses the current regional wave speeds and the global depth", () => {
  const vpProperty = new NumberProperty(6.1);
  const vsProperty = new NumberProperty(3.5);
  const regional = new RegionalDistanceModel(vpProperty, vsProperty);
  expect(regional.distanceKm(10)).toBeCloseTo(82.1, 1);
  vpProperty.value = 3;
  expect(regional.distanceKm(10)).toBeNull();
  const curve = new TravelTimeCurve(TRAVEL_TIME_TABLE);
  const global = new GlobalDistanceModel(curve, 33);
  expect(global.distanceKm(curve.sMinusP(20, 33))).toBeCloseTo(2223.9, 2);
  expect(global.distanceKm(-10)).toBeNull();
  vpProperty.dispose();
  vsProperty.dispose();
});
