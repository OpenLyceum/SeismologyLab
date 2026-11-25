import { NumberProperty } from "scenerystack/axon";
import { expect, it } from "vitest";
import { catalogEvents, loadEvent } from "../src/common/data/eventLibrary.js";
import { TRAVEL_TIME_TABLE } from "../src/common/data/generated/travelTimeData.js";
import { GlobalDistanceModel, RegionalDistanceModel } from "../src/common/model/DistanceModel.js";
import { decodeSamples } from "../src/common/model/decodeSamples.js";
import { greatCircleKm, type LonLat } from "../src/common/model/geodesy.js";
import { locateEpicenter } from "../src/common/model/locateEpicenter.js";
import { TravelTimeCurve } from "../src/common/model/TravelTimeCurve.js";
import { REGIONAL_VP_KM_S, REGIONAL_VS_KM_S } from "../src/SeismologyLabConstants.js";

// Waveforms load lazily in the app; load them all up front so models rebuild synchronously.
const EVENTS = await Promise.all(catalogEvents().map(loadEvent));

it.each(EVENTS)("$key has complete traces and supports a location from the answer-key picks", (event) => {
  expect(event.stations.length).toBeGreaterThanOrEqual(4);
  const vpProperty = new NumberProperty(REGIONAL_VP_KM_S);
  const vsProperty = new NumberProperty(REGIONAL_VS_KM_S);
  const distanceModel =
    event.kind === "regional"
      ? new RegionalDistanceModel(vpProperty, vsProperty)
      : new GlobalDistanceModel(new TravelTimeCurve(TRAVEL_TIME_TABLE), event.depthKm);
  const farthest = event.stations.reduce((a, b) => (a.distanceKm > b.distanceKm ? a : b));
  const end =
    event.kind === "regional"
      ? event.key === "anchorage2018"
        ? 200
        : 160
      : Math.min(1800, Math.ceil(farthest.sTheoSeconds + 300));
  const observations = event.stations.map((data) => {
    const expected = (end - data.startSeconds) * data.sampleRate;
    expect(decodeSamples(data.vertical)).toHaveLength(expected);
    expect(decodeSamples(data.horizontal)).toHaveLength(expected);
    expect(data.pTheoSeconds).toBeGreaterThanOrEqual(data.startSeconds);
    expect(data.sTheoSeconds).toBeLessThan(end);
    expect(data.sTheoSeconds).toBeGreaterThan(data.pTheoSeconds);
    const distanceKm = distanceModel.distanceKm(data.sTheoSeconds - data.pTheoSeconds);
    expect(distanceKm).not.toBeNull();
    const station: LonLat = [data.lon, data.lat];
    return { station, distanceKm: distanceKm! };
  });
  const result = locateEpicenter(observations);
  expect(result).not.toBeNull();
  expect(greatCircleKm(result!.lonLat, [event.lon, event.lat])).toBeLessThanOrEqual(
    event.kind === "regional" ? 30 : 250,
  );
  vpProperty.dispose();
  vsProperty.dispose();
});
