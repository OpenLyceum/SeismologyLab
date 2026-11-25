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

/** Split a sampled circle at the map seam, closing each resulting piece along the seam. */
export function smallCircle(center: LonLat, radiusKm: number, segments = 180): LonLat[][] {
  const first = destinationPoint(center, 0, radiusKm);
  const pieces = [[first]];
  let previous = first;
  let piece = pieces[0] as LonLat[];
  for (let index = 1; index <= segments; index++) {
    const point = index === segments ? first : destinationPoint(center, (360 * index) / segments, radiusKm);
    const delta = point[0] - previous[0];
    if (Math.abs(delta) > 180) {
      const edge = delta < 0 ? 180 : -180;
      const fraction = (edge - previous[0]) / (delta + 2 * edge);
      const latitude = previous[1] + (point[1] - previous[1]) * fraction;
      piece.push([edge, latitude]);
      piece = [[-edge, latitude]];
      pieces.push(piece);
    }
    piece.push(point);
    previous = point;
  }

  if (pieces.length > 1) {
    const tail = pieces.pop();
    const head = pieces[0];
    if (tail && head) {
      head.unshift(...tail.slice(0, -1));
    }
  }
  return pieces.map((points) => {
    const start = points[0];
    return start && start !== points.at(-1) ? [...points, start] : points;
  });
}
