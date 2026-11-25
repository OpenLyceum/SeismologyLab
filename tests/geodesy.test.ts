import { expect, it } from "vitest";
import { azimuthDeg, destinationPoint, greatCircleKm } from "../src/common/model/geodesy.js";

it("measures the great-circle path from LAX to JFK", () => {
  expect(Math.abs(greatCircleKm([-118.4085, 33.9416], [-73.7781, 40.6413]) - 3983)).toBeLessThan(10);
});

it("places destination points on a circle of the requested radius, across the antimeridian", () => {
  const center = [179, 25] as const;
  for (let bearing = 0; bearing < 360; bearing += 15) {
    const point = destinationPoint(center, bearing, 500);
    expect(point[0]).toBeGreaterThanOrEqual(-180);
    expect(point[0]).toBeLessThan(180);
    expect(Math.abs(greatCircleKm(center, point) - 500)).toBeLessThan(0.5);
  }
  expect(azimuthDeg(center, destinationPoint(center, 90, 100))).toBeCloseTo(90);
});
