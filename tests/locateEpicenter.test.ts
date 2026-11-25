import { expect, it } from "vitest";
import { destinationPoint, greatCircleKm } from "../src/common/model/geodesy.js";
import { locateEpicenter } from "../src/common/model/locateEpicenter.js";

it("recovers an epicenter from independent distances", () => {
  const center = [179.3, 34] as const;
  const observations = [70, 150, 250].map((bearing, index) => {
    const distanceKm = 100 + 50 * index;
    return { station: destinationPoint(center, bearing, distanceKm), distanceKm };
  });
  const result = locateEpicenter(observations);
  expect(result).not.toBeNull();
  expect(greatCircleKm(result!.lonLat, center)).toBeLessThan(1);
  expect(locateEpicenter(observations.slice(0, 2))).toBeNull();
});
