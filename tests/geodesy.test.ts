import { expect, it } from "vitest";
import { azimuthDeg, destinationPoint, greatCircleKm, smallCircle } from "../src/common/model/geodesy.js";

it("measures the great-circle path from LAX to JFK", () => {
  expect(Math.abs(greatCircleKm([-118.4085, 33.9416], [-73.7781, 40.6413]) - 3983)).toBeLessThan(10);
});

it("returns closed rings and splits a circle through the antimeridian", () => {
  const center = [179, 25] as const;
  const rings = smallCircle(center, 500);
  expect(rings).toHaveLength(2);
  for (const ring of rings) {
    expect(ring.at(0)).toEqual(ring.at(-1));
    for (const point of ring) {
      expect(Math.abs(greatCircleKm(center, point) - 500)).toBeLessThan(0.5);
    }
  }
  expect(azimuthDeg(center, destinationPoint(center, 90, 100))).toBeCloseTo(90);
});
