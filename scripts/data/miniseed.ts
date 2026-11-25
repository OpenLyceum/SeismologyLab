/** Reads SEED 2.4 waveform records and verifies each Steim integration. */

type RecordHeader = {
  readonly sequence: string;
  readonly channel: string;
  readonly startMs: number;
  readonly sampleRate: number;
  readonly sampleCount: number;
  readonly bytes: number;
  readonly dataOffset: number;
  readonly encoding: number;
  readonly littleEndian: boolean;
};

const FIXED_HEADER_BYTES = 48;
const FRAME_BYTES = 64;
const textDecoder = new TextDecoder("ascii");

export class MiniSeedGapError extends Error {}

function readHeader(bytes: Uint8Array, offset: number): RecordHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
  const text = (start: number, end: number) => textDecoder.decode(bytes.subarray(offset + start, offset + end)).trim();
  const yearBigEndian = view.getUint16(20);
  const littleHeader = yearBigEndian < 1900 || yearBigEndian > 2200;
  const short = (index: number) => view.getUint16(index, littleHeader);
  const year = short(20);
  const day = short(22);
  const sequence = text(0, 6);
  if (year < 1900 || year > 2200 || day < 1 || day > 366 || !"DRQM".includes(text(6, 7))) {
    throw new Error(`Invalid miniSEED header at byte ${offset}`);
  }

  const factor = view.getInt16(32, littleHeader);
  const multiplier = view.getInt16(34, littleHeader);
  let sampleRate = (factor < 0 ? -1 / factor : factor) * (multiplier < 0 ? -1 / multiplier : multiplier);
  const sampleCount = short(30);
  const blocks = view.getUint8(39);
  const dataOffset = short(44);
  // A calibration-only record carries blockettes without a waveform data offset.
  const blocketteLimit = sampleCount === 0 && dataOffset === 0 ? view.byteLength : dataOffset;
  let next = short(46);
  let encoding = -1;
  let recordBytes = 0;
  let littleEndian = false;
  let microseconds = 0;
  for (let index = 0; next !== 0 && index < blocks; index++) {
    if (next < FIXED_HEADER_BYTES || next + 4 > blocketteLimit) {
      throw new Error(`Invalid blockette pointer in miniSEED record ${sequence}`);
    }
    const blockType = short(next);
    if (blockType === 1000) {
      encoding = view.getUint8(next + 4);
      littleEndian = view.getUint8(next + 5) === 0;
      recordBytes = 2 ** view.getUint8(next + 6);
    } else if (blockType === 1001) {
      microseconds = view.getInt8(next + 5);
    } else if (blockType === 100) {
      sampleRate = view.getFloat32(next + 4, littleHeader);
    }
    next = short(next + 2);
  }

  if (
    encoding < 0 ||
    recordBytes > view.byteLength ||
    dataOffset > recordBytes ||
    (sampleCount > 0 && !(sampleRate > 0))
  ) {
    throw new Error(`Invalid miniSEED record length, encoding or sample rate in record ${sequence}`);
  }

  const correctionApplied = (view.getUint8(36) & 2) !== 0;
  const correctionMs = correctionApplied ? 0 : view.getInt32(40, littleHeader) / 10;
  const startMs =
    Date.UTC(year, 0, day, view.getUint8(24), view.getUint8(25), view.getUint8(26)) +
    short(28) / 10 +
    correctionMs +
    microseconds / 1000;
  return {
    sequence,
    channel: [text(18, 20), text(8, 13), text(13, 15), text(15, 18)].join("."),
    startMs,
    sampleRate,
    sampleCount,
    bytes: recordBytes,
    dataOffset,
    encoding,
    littleEndian,
  };
}

function steimPacking(word: number, control: number, steim2: boolean): [count: number, width: number] {
  if (control === 1) {
    return [4, 8];
  }
  if (!steim2) {
    return control === 2 ? [2, 16] : [1, 32];
  }
  const code = word >>> 30;
  if (control === 2 && code > 0) {
    return [code, 30 / code];
  }
  if (control === 3 && code < 3) {
    return [code + 5, 6 - code];
  }
  throw new Error("Invalid Steim-2 packing code");
}

function decodeSteim(data: DataView, header: RecordHeader): Float64Array {
  const samples = new Float64Array(header.sampleCount);
  if (samples.length === 0) {
    return samples;
  }
  let value = data.getInt32(4);
  const last = data.getInt32(8);
  let differences = 0;

  for (let frame = 0; frame + FRAME_BYTES <= data.byteLength; frame += FRAME_BYTES) {
    const controls = data.getUint32(frame);
    for (let index = frame === 0 ? 3 : 1; index < 16 && differences < samples.length; index++) {
      const control = (controls >>> (30 - 2 * index)) & 3;
      if (control === 0) {
        continue;
      }
      const word = data.getInt32(frame + index * 4);
      const [count, width] = steimPacking(word, control, header.encoding === 11);
      for (let item = 0; item < count && differences < samples.length; item++) {
        const leftShift = 32 - (count - item) * width;
        const difference = (word << leftShift) >> (32 - width);

        // The first compressed difference links to the previous record. X0 already gives this record's first sample.
        if (differences > 0) {
          value = (value + difference) | 0;
        }
        samples[differences++] = value;
      }
    }
  }

  if (differences !== samples.length || value !== last) {
    throw new Error(`Steim Xn verification failed in record ${header.sequence}: expected ${last}, decoded ${value}`);
  }
  return samples;
}

function decodeRecord(view: DataView, header: RecordHeader): Float64Array {
  const { encoding, littleEndian, sampleCount } = header;
  switch (encoding) {
    case 1:
      return Float64Array.from({ length: sampleCount }, (_, i) => view.getInt16(i * 2, littleEndian));
    case 3:
      return Float64Array.from({ length: sampleCount }, (_, i) => view.getInt32(i * 4, littleEndian));
    case 4:
      return Float64Array.from({ length: sampleCount }, (_, i) => view.getFloat32(i * 4, littleEndian));
    case 10:
    case 11:
      if (littleEndian) {
        throw new Error("Expected big-endian Steim");
      }
      return decodeSteim(view, header);
    default:
      throw new Error(`Unsupported miniSEED encoding ${encoding}`);
  }
}

/** Decode one channel, sorting records chronologically and dropping duplicated overlap samples. */
export function decodeMiniSeed(bytes: Uint8Array): { sampleRate: number; startMs: number; samples: Float64Array } {
  const records: { header: RecordHeader; samples: Float64Array }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const header = readHeader(bytes, offset);
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset + header.dataOffset,
      header.bytes - header.dataOffset,
    );
    const samples = header.sampleCount > 0 ? decodeRecord(view, header) : new Float64Array();
    if (samples.length > 0) {
      records.push({ header, samples });
    }
    offset += header.bytes;
  }
  records.sort((a, b) => a.header.startMs - b.header.startMs);
  const first = records[0];
  if (!first) {
    throw new Error("No samples in miniSEED response");
  }

  const { channel, startMs, sampleRate } = first.header;
  const samples = new Float64Array(records.reduce((total, record) => total + record.samples.length, 0));
  let length = 0;
  for (const record of records) {
    if (record.header.channel !== channel || record.header.sampleRate !== sampleRate) {
      throw new MiniSeedGapError(`Channel or sample rate changed in ${channel}`);
    }
    const index = ((record.header.startMs - startMs) * sampleRate) / 1000;
    if (index - (length - 1) > 1.5 && length > 0) {
      throw new MiniSeedGapError(`Gap in ${channel} at ${new Date(record.header.startMs).toISOString()}`);
    }
    const tail = record.samples.subarray(Math.max(0, length - Math.round(index)));
    samples.set(tail, length);
    length += tail.length;
  }
  return { sampleRate, startMs, samples: samples.subarray(0, length) };
}
