import { expect, it } from "vitest";
import { regionalDistanceKm, regionalSMinusP } from "../src/common/model/DistanceRule.js";

it("converts and round-trips the uniform crust S–P interval", () => {
  const distance = regionalDistanceKm(10, 6.1, 3.5);
  expect(distance).toBeCloseTo(82.1, 1);
  expect(regionalSMinusP(distance, 6.1, 3.5)).toBeCloseTo(10);
});

it("rejects invalid picks and wave speed order", () => {
  expect(regionalDistanceKm(10, 3, 4)).toBeNaN();
  expect(regionalDistanceKm(0, 6.1, 3.5)).toBeNaN();
  expect(regionalSMinusP(10, 4, 4)).toBeNaN();
});
