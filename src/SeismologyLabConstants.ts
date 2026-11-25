/**
 * SeismologyLabConstants.ts
 *
 * Named constants for Seismology Lab. Layout values are screen pixels; distances are
 * kilometres, angles degrees and arrival times seconds after the origin time.
 */
import { Range } from "scenerystack/dot";
import SeismologyLabNamespace from "./SeismologyLabNamespace.js";

// ── Layout / chrome (screen pixels) ───────────────────────────────────────────

export const SCREEN_VIEW_MARGIN = 16;
export const PANEL_CORNER_RADIUS = 6;

/** Seismogram stack, left column. */
export const STACK = {
  X: 16,
  Y: 52,
  LABEL_WIDTH: 70,
  /** Parking area for unplaced P and S markers, between the label and the chart. */
  TRAY_WIDTH: 34,
  CHART_WIDTH: 428,
  CHART_HEIGHT: 62,
  ROW_SPACING: 10,
} as const;

/** Right column: map, screen-specific panel, check panel. */
export const RIGHT_COLUMN = {
  X: STACK.X + STACK.LABEL_WIDTH + STACK.TRAY_WIDTH + STACK.CHART_WIDTH + 20,
  WIDTH: 1024 - SCREEN_VIEW_MARGIN - (STACK.X + STACK.LABEL_WIDTH + STACK.TRAY_WIDTH + STACK.CHART_WIDTH + 20),
  MAP_HEIGHT_REGIONAL: 250,
  MAP_HEIGHT_GLOBAL: 222,
} as const;

/** Most zoomed-in seismogram window, as a power of two of the full record. */
export const MAX_ZOOM_LEVEL = 5;

// ── Physics / model defaults ──────────────────────────────────────────────────

export const EARTH_RADIUS_KM = 6371;
export const KM_PER_DEGREE = 111.195;
/** Average crustal P and S speeds (km/s): ≈ 8.2 km of distance per second of S–P. */
export const REGIONAL_VP_KM_S = 6.1;
export const REGIONAL_VS_KM_S = 3.5;
export const VP_RANGE = new Range(5.0, 8.0);
export const VS_RANGE = new Range(2.8, 4.6);
/** Feedback thresholds for the student's epicenter (km from the ComCat solution). */
export const CHECK_GOOD_KM = { regional: 25, global: 300 } as const;
export const CHECK_FAIR_KM = { regional: 75, global: 800 } as const;
/** Circles needed before the location can be checked. */
export const REQUIRED_CIRCLES = 3;
/** S must stay at least this far after P (s). */
export const MIN_PICK_SEPARATION_SECONDS = 0.1;
/** Keyboard steps for a pick marker (s): coarse with arrows, fine with Shift. */
export const PICK_KEYBOARD_STEP_SECONDS = {
  regional: { coarse: 0.5, fine: 0.05 },
  global: { coarse: 5, fine: 0.5 },
} as const;

SeismologyLabNamespace.register("SeismologyLabConstants", {
  SCREEN_VIEW_MARGIN,
  PANEL_CORNER_RADIUS,
  STACK,
  RIGHT_COLUMN,
  MAX_ZOOM_LEVEL,
  EARTH_RADIUS_KM,
  KM_PER_DEGREE,
  REGIONAL_VP_KM_S,
  REGIONAL_VS_KM_S,
  VP_RANGE,
  VS_RANGE,
  CHECK_GOOD_KM,
  CHECK_FAIR_KM,
  REQUIRED_CIRCLES,
  MIN_PICK_SEPARATION_SECONDS,
  PICK_KEYBOARD_STEP_SECONDS,
});
