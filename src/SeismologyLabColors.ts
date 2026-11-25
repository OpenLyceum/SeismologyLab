/**
 * SeismologyLabColors.ts
 *
 * Defines all dynamic colors for the simulation using ProfileColorProperty.
 *
 * Each color has two profiles:
 *   - "default"   — used in standard (dark) mode
 *   - "projector" — used when the user enables Projector Mode in Preferences
 *
 * SceneryStack switches profiles automatically; no manual toggling is needed.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 * Import SeismologyLabColors and pass properties directly to Node's fillProperty or
 * strokeProperty options:
 *
 *   import SeismologyLabColors from "../../SeismologyLabColors.js";
 *
 *   new Rectangle( 0, 0, 100, 50, {
 *     fillProperty: SeismologyLabColors.backgroundColorProperty,
 *   });
 *
 * ── How to add a color ────────────────────────────────────────────────────────
 * Add a new ProfileColorProperty entry to the SeismologyLabColors object below.
 * Always provide both "default" and "projector" values.
 */
import { ProfileColorProperty } from "scenerystack/scenery";
import SeismologyLabNamespace from "./SeismologyLabNamespace.js";

const SeismologyLabColors = {
  /**
   * Background color for the simulation screen.
   * Deep navy in default mode; white in projector mode.
   */
  backgroundColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "background", {
    default: "#1a1a2e",
    projector: "#ffffff",
  }),

  /**
   * Primary accent color for highlights, selected items, and key UI elements.
   * Sky blue in default mode; dark navy in projector mode.
   */
  accentColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "accent", {
    default: "#4fc3f7",
    projector: "#1a1a2e",
  }),

  /**
   * Background fill for control panels and dialogs.
   * Deep blue in default mode; light gray in projector mode.
   */
  panelBackgroundColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "panelBackground", {
    default: "#16213e",
    projector: "#f5f5f5",
  }),

  /**
   * Border/stroke color for control panels and dialogs.
   * Teal-navy in default mode; medium gray in projector mode.
   */
  panelBorderColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "panelBorder", {
    default: "#0f3460",
    projector: "#999999",
  }),

  /**
   * Text color for labels, readouts, and general UI text.
   * Near-white in default mode; near-black in projector mode.
   */
  textColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "text", {
    default: "#e0e0e0",
    projector: "#1a1a1a",
  }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark. Same values in default and projector mode,
  // but defined here so every color lives in one themeable place.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Fill of a disabled control surface (grayed-out editable input field). */
  controlSurfaceDisabledColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "controlSurfaceDisabled", {
    default: "#cccccc",
    projector: "#cccccc",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),

  /** Secondary text: channel codes, axis titles, hints. */
  mutedTextColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "mutedText", {
    default: "#9aa5b1",
    projector: "#555555",
  }),

  // ── Seismograms and charts ───────────────────────────────────────────────────

  chartBackgroundColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "chartBackground", {
    default: "#0d1b2a",
    projector: "#ffffff",
  }),
  chartStrokeColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "chartStroke", {
    default: "#3a506b",
    projector: "#999999",
  }),
  chartGridColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "chartGrid", {
    default: "#1f3247",
    projector: "#e3e3e3",
  }),
  traceColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "trace", {
    default: "#e0e0e0",
    projector: "#1a1a1a",
  }),
  /** P-wave pick marker, theoretical P tick and the P travel-time curve. */
  pWaveColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "pWave", {
    default: "#4fc3f7",
    projector: "#0277bd",
  }),
  /** S-wave pick marker, theoretical S tick and the S travel-time curve. */
  sWaveColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "sWave", {
    default: "#ff8a65",
    projector: "#d84315",
  }),
  /** Waves screen: the shaded S–P gap on a trace, once both waves have arrived. */
  sMinusPBandColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "sMinusPBand", {
    default: "rgba(255,235,59,0.14)",
    projector: "rgba(106,27,154,0.12)",
  }),
  /** Waves screen: the time cursor sweeping across every trace. */
  timeCursorColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "timeCursor", {
    default: "#ffeb3b",
    projector: "#6a1b9a",
  }),
  /** Readout backdrop drawn over a seismogram. */
  readoutBackgroundColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "readoutBackground", {
    default: "rgba(13,27,42,0.85)",
    projector: "rgba(255,255,255,0.85)",
  }),

  // ── Map ──────────────────────────────────────────────────────────────────────

  oceanColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "ocean", {
    default: "#10263f",
    projector: "#dceefb",
  }),
  landColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "land", {
    default: "#34473a",
    projector: "#d3dcc4",
  }),
  coastColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "coast", {
    default: "#6b8f71",
    projector: "#7a9a6e",
  }),
  guessColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "guess", {
    default: "#ffeb3b",
    projector: "#6a1b9a",
  }),
  truthColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "truth", {
    default: "#ff5252",
    projector: "#c62828",
  }),
  bestFitColorProperty: new ProfileColorProperty(SeismologyLabNamespace, "bestFit", {
    default: "#b39ddb",
    projector: "#4527a0",
  }),

  /** One color per station, shared by its trace label, map triangle and distance circle. */
  stationColorProperties: [
    new ProfileColorProperty(SeismologyLabNamespace, "station0", { default: "#81c784", projector: "#2e7d32" }),
    new ProfileColorProperty(SeismologyLabNamespace, "station1", { default: "#ba68c8", projector: "#7b1fa2" }),
    new ProfileColorProperty(SeismologyLabNamespace, "station2", { default: "#4dd0e1", projector: "#00838f" }),
    new ProfileColorProperty(SeismologyLabNamespace, "station3", { default: "#ffb74d", projector: "#e65100" }),
    new ProfileColorProperty(SeismologyLabNamespace, "station4", { default: "#f06292", projector: "#ad1457" }),
    new ProfileColorProperty(SeismologyLabNamespace, "station5", { default: "#aed581", projector: "#558b2f" }),
  ] as const,
};

/** Station color by display index (wraps if an event ever has more than six stations). */
export function stationColorProperty(index: number): ProfileColorProperty {
  const palette = SeismologyLabColors.stationColorProperties;
  return palette[index % palette.length] ?? palette[0];
}

export default SeismologyLabColors;
