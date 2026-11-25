/**
 * MapProjection.ts
 *
 * Equirectangular lon/lat ↔ view mapping for one map rectangle. A regional map is
 * scaled by cos(central latitude) in longitude so shapes are not stretched; the world
 * map uses the plain 2:1 plate carrée.
 */
import { Bounds2, Vector2 } from "scenerystack/dot";
import { KM_PER_DEGREE } from "../../SeismologyLabConstants.js";
import type { LonLat } from "../model/geodesy.js";

export type LonLatBox = readonly [west: number, south: number, east: number, north: number];

export class MapProjection {
  public readonly viewBounds: Bounds2;
  public readonly box: LonLatBox;
  private readonly scale: number;
  private readonly lonScale: number;
  private readonly offsetX: number;
  private readonly offsetY: number;

  public constructor(box: LonLatBox, viewWidth: number, viewHeight: number, isWorld: boolean) {
    const [west, south, east, north] = box;
    const lonScale = isWorld ? 1 : Math.cos((((south + north) / 2) * Math.PI) / 180);
    const scale = Math.min(viewWidth / ((east - west) * lonScale), viewHeight / (north - south));
    this.scale = scale;
    this.lonScale = lonScale;
    // Centre the box in the view rectangle; the spare band stays ocean.
    const centerLon = (west + east) / 2;
    const centerLat = (south + north) / 2;
    this.offsetX = viewWidth / 2 - centerLon * lonScale * scale;
    this.offsetY = viewHeight / 2 + centerLat * scale;
    this.viewBounds = new Bounds2(0, 0, viewWidth, viewHeight);
    const halfLon = viewWidth / 2 / (lonScale * scale);
    const halfLat = viewHeight / 2 / scale;
    this.box = [centerLon - halfLon, centerLat - halfLat, centerLon + halfLon, centerLat + halfLat];
  }

  public toViewX(lon: number): number {
    return this.offsetX + lon * this.lonScale * this.scale;
  }

  public toViewY(lat: number): number {
    return this.offsetY - lat * this.scale;
  }

  public toView(lonLat: LonLat): Vector2 {
    return new Vector2(this.toViewX(lonLat[0]), this.toViewY(lonLat[1]));
  }

  /** A longitude moved by whole turns into the visible box, for point features. */
  public wrapLon(lon: number): number {
    const west = this.box[0];
    return west + ((((lon - west) % 360) + 360) % 360);
  }

  /** A point feature (station, marker) in view coordinates, wrapped onto the map. */
  public toViewWrapped(lonLat: LonLat): Vector2 {
    return new Vector2(this.toViewX(this.wrapLon(lonLat[0])), this.toViewY(lonLat[1]));
  }

  /** Inverse mapping, clamped to the visible map; longitude normalized to [−180, 180). */
  public toLonLat(point: Vector2): LonLat {
    const clamped = this.viewBounds.closestPointTo(point);
    const lon = (clamped.x - this.offsetX) / (this.lonScale * this.scale);
    return [((((lon + 180) % 360) + 360) % 360) - 180, (this.offsetY - clamped.y) / this.scale];
  }
}

/**
 * Central meridian for the world map: the seam goes in the middle of the widest
 * longitude gap between stations, so no station sits on the map's edge.
 */
export function worldCenterLon(stationLons: readonly number[]): number {
  const sorted = [...stationLons].sort((a, b) => a - b);
  let bestGap = -1;
  let seam = 180;
  sorted.forEach((lon, index) => {
    const next = index + 1 < sorted.length ? (sorted[index + 1] ?? lon) : (sorted[0] ?? lon) + 360;
    if (next - lon > bestGap) {
      bestGap = next - lon;
      seam = (lon + next) / 2;
    }
  });
  return seam - 180;
}

/**
 * The view box for a regional event: the stations' extent padded by the largest station
 * distance, so every true distance circle (and therefore the epicenter) is on the map.
 * Framing on stations rather than on the epicenter keeps the answer off the map's centre.
 */
export function regionalViewBox(stations: readonly { lonLat: LonLat; distanceKm: number }[]): LonLatBox {
  const lons = stations.map(({ lonLat }) => lonLat[0]);
  const lats = stations.map(({ lonLat }) => lonLat[1]);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const reachDeg = (1.1 * Math.max(...stations.map(({ distanceKm }) => distanceKm))) / KM_PER_DEGREE;
  const lonReachDeg = reachDeg / Math.cos((((south + north) / 2) * Math.PI) / 180);
  return [Math.min(...lons) - lonReachDeg, south - reachDeg, Math.max(...lons) + lonReachDeg, north + reachDeg];
}
