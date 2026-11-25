import { expect, it } from "vitest";
import { TRAVEL_TIME_TABLE } from "../src/common/data/generated/travelTimeData.js";
import { TravelTimeCurve } from "../src/common/model/TravelTimeCurve.js";

const curve = new TravelTimeCurve(TRAVEL_TIME_TABLE);

it.each(TRAVEL_TIME_TABLE.depthsKm)("is monotonic at %s km depth", (depth) => {
  let last = -1;
  for (const degrees of TRAVEL_TIME_TABLE.distancesDeg) {
    const value = curve.sMinusP(degrees, depth);
    expect(value).toBeGreaterThan(last);
    last = value;
  }
});

it("inverts interpolated times and rejects out-of-range intervals", () => {
  for (const depth of [0, 20, 80, 150, 480, 600]) {
    for (const distance of [1, 16.4, 55.8, 92.7, 100]) {
      expect(curve.distanceForSMinusP(curve.sMinusP(distance, depth), depth)).toBeCloseTo(distance, 1);
    }
  }
  expect(curve.distanceForSMinusP(-1, 33)).toBeNaN();
  expect(curve.distanceForSMinusP(10_000, 33)).toBeNaN();
});
