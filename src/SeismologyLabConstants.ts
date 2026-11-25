/** Screen layout in pixels, distances in km, angles in degrees and arrival times in seconds. */
import { Range } from "scenerystack/dot";
import SeismologyLabNamespace from "./SeismologyLabNamespace.js";

export const SCREEN_VIEW_MARGIN = 20;
export const PANEL_CORNER_RADIUS = 6;
export const EARTH_RADIUS_KM = 6371;
export const KM_PER_DEGREE = 111.195;
export const REGIONAL_VP_KM_S = 6.1;
export const REGIONAL_VS_KM_S = 3.5;
export const VP_RANGE = new Range(5.0, 8.0);
export const VS_RANGE = new Range(2.8, 4.6);
export const CHECK_GOOD_KM = { regional: 25, global: 300 } as const;
export const CHECK_FAIR_KM = { regional: 75, global: 800 } as const;
export const REQUIRED_CIRCLES = 3;
export const MIN_PICK_SEPARATION_SECONDS = 0.1;

SeismologyLabNamespace.register("SeismologyLabConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  EARTH_RADIUS_KM,
  KM_PER_DEGREE,
  REGIONAL_VP_KM_S,
  REGIONAL_VS_KM_S,
  VP_RANGE,
  VS_RANGE,
  CHECK_GOOD_KM,
  CHECK_FAIR_KM,
});
