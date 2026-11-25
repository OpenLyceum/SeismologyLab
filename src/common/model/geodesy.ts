/** Spherical geographic operations over longitude/latitude pairs in degrees. */
import { EARTH_RADIUS_KM } from "../../SeismologyLabConstants.js";

export type LonLat = readonly [lon: number, lat: number];
const RAD = Math.PI / 180;

export function greatCircleKm(a: LonLat, b: LonLat): number {
  const deltaLat = (b[1] - a[1]) * RAD;
  const deltaLon = (b[0] - a[0]) * RAD;
  const hav = Math.sin(deltaLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, hav)));
}

export function destinationPoint(origin: LonLat, bearingDeg: number, distKm: number): LonLat {
  const lat = origin[1] * RAD;
  const bearing = bearingDeg * RAD;
  const arc = distKm / EARTH_RADIUS_KM;
  const targetLat = Math.asin(
    Math.max(-1, Math.min(1, Math.sin(lat) * Math.cos(arc) + Math.cos(lat) * Math.sin(arc) * Math.cos(bearing))),
  );
  const deltaLon = Math.atan2(
    Math.sin(bearing) * Math.sin(arc) * Math.cos(lat),
    Math.cos(arc) - Math.sin(lat) * Math.sin(targetLat),
  );
  return [((origin[0] + deltaLon / RAD + 540) % 360) - 180, targetLat / RAD];
}

export function azimuthDeg(from: LonLat, to: LonLat): number {
  const delta = (to[0] - from[0]) * RAD;
  const first = from[1] * RAD;
  const second = to[1] * RAD;
  const y = Math.sin(delta) * Math.cos(second);
  const x = Math.cos(first) * Math.sin(second) - Math.sin(first) * Math.cos(second) * Math.cos(delta);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
