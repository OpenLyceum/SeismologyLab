import { expect, it } from "vitest";
import { regionalDistanceKm } from "../src/common/model/DistanceRule.js";

it("converts the uniform-crust S–P interval and reproduces it from the travel times", () => {
  const distance = regionalDistanceKm(10, 6.1, 3.5);
  expect(distance).toBeCloseTo(82.1, 1);
  expect(distance / 3.5 - distance / 6.1).toBeCloseTo(10);
});

it("rejects invalid picks and wave speed order", () => {
  expect(regionalDistanceKm(10, 3, 4)).toBeNaN();
  expect(regionalDistanceKm(0, 6.1, 3.5)).toBeNaN();
});
