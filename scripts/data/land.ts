/** Fetch Natural Earth land and clip regional rings to each map box. */
import type { SeismicEventData } from "../../src/common/data/dataTypes.js";
import { round } from "./emit.js";
import { fetchJson } from "./fetchCache.js";
import { type LonLat, simplify } from "./geo.js";

const LAND_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";

type Polygon = LonLat[][];
type GeoJson = {
  features: {
    geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
  }[];
};

export async function fetchLand(resolution: 50 | 110): Promise<LonLat[][]> {
  const url = LAND_URL.replace("110m", `${resolution}m`);
  const collection = await fetchJson<GeoJson>(url, `ne_${resolution}m_land.geojson`);
  return collection.features.flatMap(({ geometry }) =>
    geometry.type === "Polygon"
      ? geometry.coordinates.slice(0, 1)
      : geometry.coordinates.flatMap((polygon) => polygon.slice(0, 1)),
  );
}

function clipEdge(ring: LonLat[], axis: 0 | 1, edge: number, sign: number): LonLat[] {
  const output: LonLat[] = [];
  let previous = ring.at(-1);
  if (!previous) {
    return output;
  }
  const inside = (point: LonLat) => sign * (point[axis] - edge) >= 0;
  for (const point of ring) {
    if (inside(point) !== inside(previous)) {
      const cross = (edge - previous[axis]) / (point[axis] - previous[axis]);
      const other = (1 - axis) as 0 | 1;
      const position = previous[other] + cross * (point[other] - previous[other]);
      output.push(axis === 0 ? [edge, position] : [position, edge]);
    }
    if (inside(point)) {
      output.push(point);
    }
    previous = point;
  }
  return output;
}

export function encodeLand(rings: LonLat[][], mapBox?: SeismicEventData["mapBox"]): number[][] {
  return rings.flatMap((source) => {
    const ring = mapBox
      ? clipEdge(
          clipEdge(clipEdge(clipEdge(source, 0, mapBox[0], 1), 0, mapBox[2], -1), 1, mapBox[1], 1),
          1,
          mapBox[3],
          -1,
        )
      : source;
    const first = ring[0];
    if (!first || ring.length < 3) {
      return [];
    }
    const points = simplify([...ring, first], mapBox ? 0.05 : 0.15);
    return points.length > 3 ? [points.flatMap((point) => point.map((value) => round(value, 4)))] : [];
  });
}
