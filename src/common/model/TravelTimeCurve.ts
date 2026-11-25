/** Interpolates first P and S arrivals from a fixed IASP91 travel-time table. */
import type { TravelTimeTableData } from "../data/dataTypes.js";

function bracket(grid: readonly number[], value: number): { lo: number; hi: number; fraction: number } | null {
  const hi = grid.findIndex((sample) => sample >= value);
  const upper = grid[hi];
  if (upper === undefined) {
    return null;
  }
  if (upper === value) {
    return { lo: hi, hi, fraction: 0 };
  }
  const lo = hi - 1;
  const lower = grid[lo];
  return lower === undefined ? null : { lo, hi, fraction: (value - lower) / (upper - lower) };
}

export class TravelTimeCurve {
  private readonly table: TravelTimeTableData;

  public constructor(table: TravelTimeTableData) {
    this.table = table;
  }

  private interpolate(rows: TravelTimeTableData["p"], distDeg: number, depthKm: number): number {
    const distance = bracket(this.table.distancesDeg, distDeg);
    const depth = bracket(this.table.depthsKm, depthKm);
    if (!(distance && depth)) {
      return Number.NaN;
    }
    const atDepth = (index: number) => {
      const left = rows[index]?.[distance.lo];
      const right = rows[index]?.[distance.hi];
      return typeof left !== "number" || typeof right !== "number"
        ? Number.NaN
        : left + (right - left) * distance.fraction;
    };
    const near = atDepth(depth.lo);
    return near + (atDepth(depth.hi) - near) * depth.fraction;
  }

  public pTime(distDeg: number, depthKm: number): number {
    return this.interpolate(this.table.p, distDeg, depthKm);
  }

  public sTime(distDeg: number, depthKm: number): number {
    return this.interpolate(this.table.s, distDeg, depthKm);
  }

  public sMinusP(distDeg: number, depthKm: number): number {
    return this.sTime(distDeg, depthKm) - this.pTime(distDeg, depthKm);
  }

  public distanceForSMinusP(dt: number, depthKm: number): number {
    let low = 1;
    let high = 100;
    if (!(dt >= this.sMinusP(low, depthKm) && dt <= this.sMinusP(high, depthKm))) {
      return Number.NaN;
    }
    for (let index = 0; index < 32; index++) {
      const mid = (low + high) / 2;
      const interval = this.sMinusP(mid, depthKm);
      if (!Number.isFinite(interval)) {
        return Number.NaN;
      }
      if (interval < dt) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  /**
   * The epicentral distance (°) at which the first P- or S-family arrival reaches the
   * surface `seconds` after the origin: where that wavefront meets the surface. NaN
   * before the wave first surfaces above the source, and beyond the table's 100°.
   */
  public distanceForTime(phase: "p" | "s", seconds: number, depthKm: number): number {
    const time = (distDeg: number) => (phase === "p" ? this.pTime(distDeg, depthKm) : this.sTime(distDeg, depthKm));
    let low = 0;
    let high = 100;
    if (!(seconds >= time(low) && seconds <= time(high))) {
      return Number.NaN;
    }
    for (let index = 0; index < 32; index++) {
      const mid = (low + high) / 2;
      if (time(mid) < seconds) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }
}
