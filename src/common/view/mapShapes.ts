/**
 * mapShapes.ts
 *
 * Projection choice and the coastline, small-circle and clip shapes the station maps draw.
 */
import { Shape } from "scenerystack/kite";
import type { SeismicEventSummary } from "../data/dataTypes.js";
import { destinationPoint, type LonLat } from "../model/geodesy.js";
import { type LonLatBox, MapProjection, regionalViewBox, worldCenterLon } from "./MapProjection.js";

/**
 * The projection for one event's map. Regional maps frame the stations padded by the
 * largest station distance; the world map puts its seam in the widest station gap.
 */
export function projectionForEvent(event: SeismicEventSummary, width: number, height: number): MapProjection {
  if (event.kind === "global") {
    const center = worldCenterLon(event.stations.map(({ lon }) => lon));
    return new MapProjection([center - 180, -90, center + 180, 90], width, height, true);
  }
  const box = regionalViewBox(event.stations.map(({ lon, lat, distanceKm }) => ({ lonLat: [lon, lat], distanceKm })));
  return new MapProjection(box, width, height, false);
}

/** Longitude copies to draw: the world map repeats land and circles one turn either side of the seam. */
export function lonOffsets(isGlobal: boolean): readonly number[] {
  return isGlobal ? [-360, 0, 360] : [0];
}

export function ringsShape(
  rings: readonly (readonly number[])[],
  projection: MapProjection,
  offsets: readonly number[],
): Shape {
  const shape = new Shape();
  for (const offset of offsets) {
    for (const ring of rings) {
      appendRing(shape, ring, projection, offset);
    }
  }
  return shape;
}

function appendRing(shape: Shape, ring: readonly number[], projection: MapProjection, offset: number): void {
  for (let index = 0; index + 1 < ring.length; index += 2) {
    const x = projection.toViewX((ring[index] ?? 0) + offset);
    const y = projection.toViewY(ring[index + 1] ?? 0);
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.close();
}

/**
 * A small circle on the sphere (a distance circle or a wavefront) as one continuous
 * polyline whose longitude is unwrapped (it may run past ±180°), drawn at each offset.
 */
export function circleShape(
  center: LonLat,
  radiusKm: number,
  projection: MapProjection,
  offsets: readonly number[],
): Shape {
  const points: LonLat[] = [];
  let previousLon = projection.wrapLon(center[0]);
  for (let bearing = 0; bearing <= 360; bearing += 2) {
    const [lon, lat] = destinationPoint(center, bearing, radiusKm);
    const unwrapped = previousLon + ((((lon - previousLon + 180) % 360) + 360) % 360) - 180;
    points.push([unwrapped, lat]);
    previousLon = unwrapped;
  }
  const shape = new Shape();
  for (const offset of offsets) {
    points.forEach(([lon, lat], index) => {
      const x = projection.toViewX(lon + offset);
      const y = projection.toViewY(lat);
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });
  }
  return shape;
}

/** Everything outside `box`, used to clip the coarse world coastline around a regional one. */
export function outsideBoxShape(projection: MapProjection, box: LonLatBox): Shape {
  const { width, height } = projection.viewBounds;
  const [west, south, east, north] = box;
  const left = projection.toViewX(west);
  const right = projection.toViewX(east);
  const top = projection.toViewY(north);
  const bottom = projection.toViewY(south);
  // Outer rectangle clockwise, inner one counter-clockwise: a hole under the non-zero rule.
  return new Shape()
    .moveTo(0, 0)
    .lineTo(width, 0)
    .lineTo(width, height)
    .lineTo(0, height)
    .close()
    .moveTo(left, top)
    .lineTo(left, bottom)
    .lineTo(right, bottom)
    .lineTo(right, top)
    .close();
}
