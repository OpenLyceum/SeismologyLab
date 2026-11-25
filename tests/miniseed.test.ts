import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decodeMiniSeed } from "../scripts/data/miniseed.js";

it("decodes 1200 Steim-2 samples from an EarthScope fixture and verifies Xn", () => {
  const fixture = readFileSync("tests/fixtures/IU.ANMO.00.BHZ.mseed");
  const decoded = decodeMiniSeed(fixture);
  expect(decoded.samples).toHaveLength(1200);
  expect(decoded.sampleRate).toBe(20);
  const dataOffset = fixture.readUInt16BE(44);
  const xnOffset = dataOffset + 8;
  fixture.writeInt32BE(fixture.readInt32BE(xnOffset) + 1, xnOffset);
  expect(() => decodeMiniSeed(fixture)).toThrow(/Xn verification/);
});

it("uses blockette 1000 record lengths and decodes Steim-1", () => {
  const record = Buffer.alloc(4096);
  record.write("000001D TEST 00BHZXX", 0, "ascii");
  record.writeUInt16BE(2020, 20);
  record.writeUInt16BE(1, 22);
  record.writeUInt16BE(4, 30);
  record.writeInt16BE(20, 32);
  record.writeInt16BE(1, 34);
  record.writeUInt8(1, 39);
  record.writeUInt16BE(64, 44);
  record.writeUInt16BE(48, 46);
  record.writeUInt16BE(1000, 48);
  record.writeUInt8(10, 52);
  record.writeUInt8(1, 53);
  record.writeUInt8(12, 54);
  record.writeUInt32BE(1 << 24, 64);
  record.writeInt32BE(100, 68);
  record.writeInt32BE(107, 72);
  record.set([123, 4, 255, 4], 76);
  expect([...decodeMiniSeed(record).samples]).toEqual([100, 104, 103, 107]);
});
