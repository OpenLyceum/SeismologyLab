import { expect, it } from "vitest";
import { butterBandpass, cosineTaper, decimate, demean, detrendLinear } from "../scripts/data/dsp.js";

it("passes 1 Hz within five percent and suppresses 0.01 Hz by more than 20 dB", () => {
  const rate = 40;
  const sine = (frequency: number) =>
    Float64Array.from({ length: rate * 600 }, (_, i) => Math.sin((2 * Math.PI * i * frequency) / rate));
  const middleRms = (samples: Float64Array) => {
    const values = samples.slice(rate * 100, -rate * 100);
    return Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
  };
  const passed = sine(1);
  const blocked = sine(0.01);
  expect(middleRms(butterBandpass(passed, rate, 0.5, 8)) / middleRms(passed)).toBeGreaterThanOrEqual(0.95);
  expect(middleRms(butterBandpass(passed, rate, 0.5, 8)) / middleRms(passed)).toBeLessThanOrEqual(1.05);
  expect(middleRms(butterBandpass(blocked, rate, 0.5, 8)) / middleRms(blocked)).toBeLessThan(0.1);
});

it("detrends, tapers and averages fractional output blocks", () => {
  expect([...demean(Float64Array.of(2, 4))]).toEqual([-1, 1]);
  expect([...detrendLinear(Float64Array.of(1, 3, 5))]).toEqual([0, 0, 0]);
  expect([...cosineTaper(Float64Array.of(1, 1, 1))]).toEqual([0, 1, 0]);
  expect([...decimate(Float64Array.of(0, 0, 10, 10, 10), 2.5)]).toEqual([2, 10]);
});
