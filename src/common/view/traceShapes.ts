/**
 * traceShapes.ts
 *
 * Seismogram drawing shared by the lab rows and the Waves screen: a min/max envelope
 * per pixel column, so a long record costs the same to draw as a short one at any zoom.
 */
import type { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";

/** Largest |sample| in a channel, so each trace fills its row. */
export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
  }
  return peak > 0 ? peak : 1;
}

/** Normalized low and high sample in each pixel column of `window`; NaN where the record has no samples. */
export type ColumnEnvelope = { readonly low: Float32Array; readonly high: Float32Array };

export function columnEnvelope(
  samples: Float32Array,
  sampleRate: number,
  startSeconds: number,
  window: Range,
  columns: number,
  peak: number,
): ColumnEnvelope {
  const low = new Float32Array(columns).fill(Number.NaN);
  const high = new Float32Array(columns).fill(Number.NaN);
  const secondsPerColumn = window.getLength() / columns;
  for (let column = 0; column < columns; column++) {
    const t0 = window.min + column * secondsPerColumn;
    const first = Math.max(0, Math.floor((t0 - startSeconds) * sampleRate));
    const last = Math.min(samples.length - 1, Math.ceil((t0 + secondsPerColumn - startSeconds) * sampleRate));
    if (last < 0 || first > samples.length - 1 || last < first) {
      continue;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = first; index <= last; index++) {
      const value = (samples[index] ?? 0) / peak;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    low[column] = min;
    high[column] = max;
  }
  return { low, high };
}

/** The envelope as one zig-zag path through columns [0, endColumn), with y from `toViewY`. */
export function envelopePath(
  envelope: ColumnEnvelope,
  toViewY: (value: number) => number,
  endColumn = envelope.low.length,
): Shape {
  const shape = new Shape();
  let started = false;
  const end = Math.min(endColumn, envelope.low.length);
  for (let column = 0; column < end; column++) {
    const low = envelope.low[column] ?? Number.NaN;
    const high = envelope.high[column] ?? Number.NaN;
    if (Number.isNaN(low) || Number.isNaN(high)) {
      continue;
    }
    if (started) {
      shape.lineTo(column, toViewY(high));
    } else {
      shape.moveTo(column, toViewY(high));
      started = true;
    }
    shape.lineTo(column, toViewY(low));
  }
  return shape;
}
