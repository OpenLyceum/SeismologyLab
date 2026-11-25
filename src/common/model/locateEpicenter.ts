/** Solve the station-distance least-squares problem on a sphere. */
import { azimuthDeg, destinationPoint, greatCircleKm, type LonLat } from "./geodesy.js";

type Observation = { station: LonLat; distanceKm: number };
type Solution = { lonLat: LonLat; rmsKm: number };
const ITERATIONS = 50;
const STEP_TOLERANCE_KM = 0.01;
const DERIVATIVE_STEP_KM = 0.1;

function centroid(observations: readonly Observation[]): LonLat {
  const rad = Math.PI / 180;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const {
    station: [lon, lat],
    distanceKm,
  } of observations) {
    const weight = 1 / Math.max(distanceKm, STEP_TOLERANCE_KM);
    x += weight * Math.cos(lat * rad) * Math.cos(lon * rad);
    y += weight * Math.cos(lat * rad) * Math.sin(lon * rad);
    z += weight * Math.sin(lat * rad);
  }
  return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
}

function residuals(position: LonLat, observations: readonly Observation[]): number[] {
  return observations.map(({ station, distanceKm }) => greatCircleKm(position, station) - distanceKm);
}

function cost(values: readonly number[]): number {
  return values.reduce((sum, error) => sum + error * error, 0);
}

function gaussNewtonStep(position: LonLat, current: number[], observations: readonly Observation[]): LonLat | null {
  const derivatives = [0, 90].map((bearing) => {
    const forward = residuals(destinationPoint(position, bearing, DERIVATIVE_STEP_KM), observations);
    const backward = residuals(destinationPoint(position, bearing + 180, DERIVATIVE_STEP_KM), observations);
    return forward.map((error, index) => (error - (backward[index] ?? 0)) / (2 * DERIVATIVE_STEP_KM));
  });
  const [north, east] = derivatives;
  if (!(north && east)) {
    return null;
  }
  let nn = 0;
  let ne = 0;
  let ee = 0;
  let nr = 0;
  let er = 0;
  for (let index = 0; index < current.length; index++) {
    const n = north[index] ?? 0;
    const e = east[index] ?? 0;
    const error = current[index] ?? 0;
    nn += n * n;
    ne += n * e;
    ee += e * e;
    nr += n * error;
    er += e * error;
  }
  const determinant = nn * ee - ne * ne;
  if (determinant <= 1e-12) {
    return null;
  }
  return [(ne * nr - nn * er) / determinant, (ne * er - ee * nr) / determinant];
}

function solve(start: LonLat, observations: readonly Observation[]): Solution {
  let point = start;
  let errors = residuals(point, observations);
  let squared = cost(errors);
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const step = gaussNewtonStep(point, errors, observations);
    if (!step) {
      break;
    }
    let length = Math.hypot(...step);
    const bearing = (Math.atan2(step[0], step[1]) * 180) / Math.PI;
    let improved = false;
    while (length > STEP_TOLERANCE_KM) {
      const trial = destinationPoint(point, bearing, length);
      const trialErrors = residuals(trial, observations);
      const trialCost = cost(trialErrors);
      if (trialCost < squared) {
        point = trial;
        squared = trialCost;
        errors = trialErrors;
        improved = true;
        break;
      }
      length /= 2;
    }
    if (!improved) {
      break;
    }
  }
  return { lonLat: point, rmsKm: Math.sqrt(squared / observations.length) };
}

export function locateEpicenter(observations: readonly Observation[]): Solution | null {
  if (observations.length < 3) {
    return null;
  }
  const start = centroid(observations);
  const radius = (0.5 * observations.reduce((sum, obs) => sum + obs.distanceKm, 0)) / observations.length;
  const first = observations[0];
  const firstBearing = first ? azimuthDeg(start, first.station) : 0;
  let best = solve(start, observations);
  for (let direction = 0; direction < 8; direction++) {
    const result = solve(destinationPoint(start, firstBearing + 45 * direction, radius), observations);
    if (result.rmsKm < best.rmsKm) {
      best = result;
    }
  }
  return best;
}
