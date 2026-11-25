/** Uniform regional crust approximation and its inverse. */
export function regionalDistanceKm(sMinusP: number, vp: number, vs: number): number {
  return sMinusP > 0 && vp > vs && vs > 0 ? (sMinusP * vp * vs) / (vp - vs) : Number.NaN;
}

export function regionalSMinusP(distanceKm: number, vp: number, vs: number): number {
  return distanceKm >= 0 && vp > vs && vs > 0 ? (distanceKm * (vp - vs)) / (vp * vs) : Number.NaN;
}
