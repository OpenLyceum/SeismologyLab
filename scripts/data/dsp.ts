/** Waveform conditioning and block averaging for build-time data. */

export function demean(samples: Float64Array): Float64Array {
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return samples.map((value) => value - mean);
}

export function detrendLinear(samples: Float64Array): Float64Array {
  const centered = demean(samples);
  const midpoint = (centered.length - 1) / 2;
  const covariance = centered.reduce((sum, value, index) => sum + (index - midpoint) * value, 0);
  const variance = (centered.length * (centered.length ** 2 - 1)) / 12;
  const slope = variance > 0 ? covariance / variance : 0;
  return centered.map((value, index) => value - slope * (index - midpoint));
}

export function cosineTaper(samples: Float64Array, fraction = 0.05): Float64Array {
  const width = fraction * samples.length;
  return samples.map((value, index) => {
    const fromEdge = Math.min(index, samples.length - 1 - index);
    return fromEdge < width ? (value * (1 - Math.cos((Math.PI * fromEdge) / width))) / 2 : value;
  });
}

function biquad(samples: Float64Array, rate: number, cutoff: number, q: number, highPass: boolean): Float64Array {
  const omega = (2 * Math.PI * cutoff) / rate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * q);
  const a0 = 1 + alpha;
  const a1 = (-2 * cosine) / a0;
  const a2 = (1 - alpha) / a0;
  const b0 = (highPass ? 1 + cosine : 1 - cosine) / (2 * a0);
  const b1 = (highPass ? -2 : 2) * b0;

  let state1 = 0;
  let state2 = 0;
  return samples.map((value) => {
    const output = b0 * value + state1;
    state1 = b1 * value - a1 * output + state2;
    state2 = b0 * value - a2 * output;
    return output;
  });
}

/** Cascaded bilinear Butterworth high-pass and low-pass sections, applied in both directions. */
export function butterBandpass(
  samples: Float64Array,
  sampleRate: number,
  lo: number,
  hi: number,
  order = 4,
): Float64Array {
  if (!(0 < lo && lo < hi && hi < sampleRate / 2) || order < 2 || order % 2 !== 0) {
    throw new Error("Expected increasing cutoffs below Nyquist and a positive even Butterworth order");
  }
  const pass = (input: Float64Array): Float64Array => {
    let output = input;
    for (let section = 0; section < order / 2; section++) {
      const q = 1 / (2 * Math.cos((Math.PI * (2 * section + 1)) / (2 * order)));
      output = biquad(output, sampleRate, lo, q, true);
      output = biquad(output, sampleRate, hi, q, false);
    }
    return output;
  };
  return pass(pass(samples).reverse()).reverse();
}

/** Average adjacent sample blocks. Fractional boundaries weight the intersected sample cells. */
export function decimate(
  samples: Float64Array,
  factor: number,
  offset = 0,
  length = Math.floor((samples.length - offset) / factor),
): Float64Array {
  if (!(factor >= 1 && Number.isFinite(factor))) {
    throw new Error("Decimation factor must be finite and at least one");
  }
  return Float64Array.from({ length }, (_, index) => {
    const from = offset + index * factor;
    const to = offset + (index + 1) * factor;
    let sum = 0;
    for (let cell = Math.floor(from); cell < Math.ceil(to); cell++) {
      const overlap = Math.min(to, cell + 1) - Math.max(from, cell);
      sum += (samples[cell] ?? 0) * overlap;
    }
    return sum / factor;
  });
}
