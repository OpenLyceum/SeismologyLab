import { expect, it } from "vitest";
import { decodeSamples } from "../src/common/model/decodeSamples.js";

it("decodes signed little-endian samples to normalized amplitudes", () => {
  const base64 = Buffer.from([0, 128, 0, 0, 255, 127]).toString("base64");
  expect([...decodeSamples(base64)]).toEqual([-1, 0, 1]);
  expect(() => decodeSamples("AA==")).toThrow("Incomplete");
});
