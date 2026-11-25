/** Mean Earth radius (km). */
const EARTH_RADIUS_KM = 6371.0;

export type LonLat = readonly [number, number];

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ── Simplification ────────────────────────────────────────────────────────────

/** Perpendicular distance from `p` to the segment `a`–`b`, in degrees. */
function perpendicularDistance(p: LonLat, a: LonLat, b: LonLat): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Ramer–Douglas–Peucker simplification in plain lon/lat space. `tolerance` is in
 * degrees; endpoints are always kept.
 */
export function simplify(points: readonly LonLat[], tolerance: number): LonLat[] {
  if (points.length <= 2) {
    return [...points];
  }

  const first = points[0] as LonLat;
  const last = points[points.length - 1] as LonLat;

  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i] as LonLat, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) {
    return [first, last];
  }

  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}
// ── Spherical math ────────────────────────────────────────────────────────────

/** Unit vector (ECEF, x through 0°E/0°N, z through the north pole). */
export function toUnitVector(lon: number, lat: number): [number, number, number] {
  const phi = lat * DEG_TO_RAD;
  const lambda = lon * DEG_TO_RAD;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

/** Inverse of {@link toUnitVector}. */
export function toLonLat(v: readonly [number, number, number]): LonLat {
  const [x, y, z] = v;
  const length = Math.hypot(x, y, z);
  return [Math.atan2(y, x) * RAD_TO_DEG, Math.asin(z / length) * RAD_TO_DEG];
}

function cross(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Great-circle distance between two points, in km. */
export function greatCircleDistanceKm(a: LonLat, b: LonLat): number {
  const va = toUnitVector(a[0], a[1]);
  const vb = toUnitVector(b[0], b[1]);
  const angle = Math.atan2(Math.hypot(...cross(va, vb)), dot(va, vb));
  return angle * EARTH_RADIUS_KM;
}
