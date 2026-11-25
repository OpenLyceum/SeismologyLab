/** Number formatting shared by readouts, feedback and accessible responses. */
import { toFixed } from "scenerystack/dot";

/** Fill `{{key}}` placeholders in a localized pattern. */
export function fillPattern(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** Seconds with a precision that suits the screen: tenths regionally, whole seconds globally. */
export function formatSeconds(seconds: number, isGlobal: boolean): string {
  return toFixed(seconds, isGlobal ? 0 : 1);
}

export function formatKm(km: number): string {
  return toFixed(km, 0);
}

export function formatDegrees(degrees: number, decimals = 1): string {
  return toFixed(degrees, decimals);
}

/** A tick spacing (in seconds) that gives about `targetTicks` ticks across `span`. */
export function niceTimeSpacing(span: number, targetTicks = 6): number {
  const candidates = [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600];
  return candidates.find((spacing) => span / spacing <= targetTicks) ?? 600;
}
