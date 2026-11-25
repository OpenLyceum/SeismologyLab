/** Select usable FDSN stations and package two conditioned traces per station. */
import type { ScreenKind, SeismicEventData, StationData } from "../../src/common/data/dataTypes.js";
import { butterBandpass, cosineTaper, decimate, demean, detrendLinear } from "./dsp.js";
import { round } from "./emit.js";
import { dataCenter, fetchComCatEvent, fetchStations, fetchTrace, findComCatEvent, type StationMeta } from "./fdsn.js";
import { greatCircleDistanceKm, type LonLat } from "./geo.js";
import { encodeLand } from "./land.js";
import { MiniSeedGapError } from "./miniseed.js";
import { travelTimes } from "./taup.js";

export type EventSpec = {
  key: string;
  eventId?: string;
  networks: string[];
  distKm?: readonly [number, number];
  distDeg?: readonly [number, number];
  stations: number;
  window: readonly [number, number];
  band: readonly [number, number];
  sps: number;
};

const catalogSearches: Record<string, readonly [date: string, lat: number, lon: number, mag: number]> = {
  ridgecrest2019: ["2019-07-04", 35.7, -117.5, 6.3],
  napa2014: ["2014-08-24", 38.2, -122.3, 5.8],
  anchorage2018: ["2018-11-30", 61.35, -150, 7],
  tohoku2011: ["2011-03-11", 38.3, 142.4, 9],
  nepal2015: ["2015-04-25", 28.2, 84.7, 7.7],
  chile2010: ["2010-02-27", -36.1, -72.9, 8.7],
};
type CatalogEvent = Awaited<ReturnType<typeof fetchComCatEvent>>;

async function getEvent(spec: EventSpec): Promise<CatalogEvent> {
  if (spec.eventId) {
    try {
      return await fetchComCatEvent(spec.eventId);
    } catch (error) {
      console.warn(`${spec.key}: ${String(error)}`);
    }
  }
  const search = catalogSearches[spec.key];
  if (!search) {
    throw new Error(`No catalog search configured for ${spec.key}`);
  }
  const [date, lat, lon, minMag] = search;
  spec.eventId = await findComCatEvent({
    startIso: `${date}T00:00:00Z`,
    endIso: `${date}T23:59:59Z`,
    minMag,
    lat,
    lon,
    maxRadiusDeg: 2,
  });
  console.log(`${spec.key}: resolved ComCat ID ${spec.eventId}`);
  return fetchComCatEvent(spec.eventId);
}

type Candidate = {
  vertical: StationMeta;
  horizontals: StationMeta[];
  distanceKm: number;
  azimuth: number;
};
type TimedCandidate = Candidate & { p: number; s: number };
type ProcessedTrace = { channel: string; start: number; rate: number; values: Float64Array };
type Selected = TimedCandidate & { z: ProcessedTrace; horizontal: ProcessedTrace };
type Screening = { tried: number; continuous: number; unclipped: number; snr: number; horizontal: number };

const KM_PER_DEGREE = 111.195;
const PAD_SECONDS = 60;

function azimuth(event: CatalogEvent, station: StationMeta): number {
  const radians = Math.PI / 180;
  const src = event.lat * radians;
  const dst = station.lat * radians;
  const lon = (station.lon - event.lon) * radians;
  return (
    (Math.atan2(
      Math.sin(lon) * Math.cos(dst),
      Math.cos(src) * Math.sin(dst) - Math.sin(src) * Math.cos(dst) * Math.cos(lon),
    ) /
      radians +
      360) %
    360
  );
}

function hasVelocityScale(row: StationMeta): boolean {
  return row.scale > 0 && row.scaleUnits.trim().toLowerCase() === "m/s";
}

function combinations(event: CatalogEvent, rows: StationMeta[], preferred: string): Candidate[] {
  const locations = ["00", "", "10"];
  const channels = rows.filter(hasVelocityScale);
  const groups = new Map<string, StationMeta[]>();
  for (const row of channels) {
    const key = `${row.net}.${row.sta}.${row.loc}.${row.cha.slice(0, 2)}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  const candidates: Candidate[] = [];
  for (const group of groups.values()) {
    const vertical = group.find((row) => row.cha.endsWith("Z"));
    const horizontals = group.filter((row) => /[EN12]$/.test(row.cha));
    if (vertical && locations.includes(vertical.loc)) {
      candidates.push({
        vertical,
        horizontals,
        azimuth: azimuth(event, vertical),
        distanceKm: greatCircleDistanceKm([event.lon, event.lat], [vertical.lon, vertical.lat]),
      });
    }
  }
  const priority = (row: StationMeta) => Number(row.cha !== preferred) * locations.length + locations.indexOf(row.loc);
  return candidates.sort(
    (a, b) =>
      a.azimuth - b.azimuth ||
      priority(a.vertical) - priority(b.vertical) ||
      stationKey(a).localeCompare(stationKey(b), "en"),
  );
}

function stationKey(candidate: Candidate): string {
  return `${candidate.vertical.net}.${candidate.vertical.sta}`;
}

function rms(trace: ProcessedTrace, first: number, last: number): number {
  const from = Math.ceil((first - trace.start) * trace.rate);
  const to = Math.floor((last - trace.start) * trace.rate) + 1;
  if (from < 0 || to > trace.values.length || to <= from) {
    return Number.NaN;
  }
  const sum = trace.values.subarray(from, to).reduce((total, value) => total + value ** 2, 0);
  return Math.sqrt(sum / (to - from));
}

function peak(samples: Float64Array): number {
  return samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

async function download(
  channel: StationMeta,
  origin: number,
  start: number,
  end: number,
  spec: EventSpec,
  screening?: Screening,
): Promise<ProcessedTrace | null> {
  const iso = (seconds: number) => new Date(origin + seconds * 1000).toISOString();
  let raw: Awaited<ReturnType<typeof fetchTrace>>;
  try {
    raw = await fetchTrace({ ...channel, startIso: iso(start - PAD_SECONDS), endIso: iso(end + PAD_SECONDS) });
  } catch (error) {
    if (error instanceof MiniSeedGapError) {
      return null;
    }
    throw error;
  }
  if (!raw || raw.sampleRate < spec.sps) {
    return null;
  }
  const { samples, sampleRate: rate } = raw;
  const startSeconds = (raw.startMs - origin) / 1000;
  if (startSeconds > start || startSeconds + samples.length / rate < end) {
    return null;
  }
  if (screening) {
    screening.continuous++;
  }
  const max = peak(samples);
  const clipped = samples.reduce((count, value) => count + Number(Math.abs(value) === max), 0);
  if (!(max > 0) || clipped > samples.length * 0.01) {
    return null;
  }
  if (screening) {
    screening.unclipped++;
  }
  const velocity = samples.map((value) => value / channel.scale);
  const hi = Math.min(spec.band[1], (spec.sps / 2) * (1 - 1e-6));
  return {
    channel: channel.cha,
    start: startSeconds,
    rate,
    values: butterBandpass(cosineTaper(detrendLinear(demean(velocity))), rate, spec.band[0], hi),
  };
}

async function testCandidate(
  candidate: TimedCandidate,
  origin: number,
  start: number,
  end: number,
  spec: EventSpec,
  screening: Screening,
): Promise<Selected | null> {
  screening.tried++;
  const z = await download(candidate.vertical, origin, start, end, spec, screening);
  if (!z) {
    return null;
  }
  const { p, s } = candidate;
  const noise = rms(z, p - 30, p - 5);
  const signal = rms(z, s - 5, s + 15);
  if (!(noise > 0 && signal / noise >= 3)) {
    return null;
  }
  screening.snr++;
  const horizontalRms = (trace: ProcessedTrace) => rms(trace, s - 5, s + 15);
  const horizontals = await Promise.all(
    candidate.horizontals.map((channel) => download(channel, origin, start, end, spec)),
  );
  const horizontal = horizontals
    .filter((trace): trace is ProcessedTrace => trace !== null && horizontalRms(trace) > 0)
    .sort((a, b) => horizontalRms(b) - horizontalRms(a))[0];
  if (horizontal) {
    screening.horizontal++;
  }
  return { ...candidate, z, horizontal: horizontal ?? z };
}

function angularSeparation(a: number, b: number): number {
  const separation = Math.abs(a - b);
  return Math.min(separation, 360 - separation);
}

async function select(
  candidates: TimedCandidate[],
  spec: EventSpec,
  origin: number,
  start: number,
  end: number,
): Promise<Selected[]> {
  const selected: Selected[] = [];
  const screening: Screening = { tried: 0, continuous: 0, unclipped: 0, snr: 0, horizontal: 0 };
  const keys = [...new Set(candidates.map(stationKey))];
  while (selected.length < spec.stations && keys.length > 0) {
    const score = (candidate: TimedCandidate) =>
      selected.length === 0
        ? 0
        : Math.min(...selected.map((other) => angularSeparation(other.azimuth, candidate.azimuth)));
    keys.sort((a, b) => {
      const firstA = candidates.find((candidate) => stationKey(candidate) === a);
      const firstB = candidates.find((candidate) => stationKey(candidate) === b);
      if (!(firstA && firstB)) {
        return 0;
      }
      const hasHorizontal = (code: string) =>
        candidates.some((candidate) => stationKey(candidate) === code && candidate.horizontals.length > 0);
      return (
        score(firstB) - score(firstA) ||
        Number(hasHorizontal(b)) - Number(hasHorizontal(a)) ||
        firstA.azimuth - firstB.azimuth ||
        a.localeCompare(b, "en")
      );
    });
    const key = keys.shift();
    const options = candidates.filter((candidate) => stationKey(candidate) === key);
    let fallback: Selected | null = null;
    for (const candidate of options) {
      const result = await testCandidate(candidate, origin, start, end, spec, screening);
      if (result && result.horizontal !== result.z) {
        fallback = result;
        break;
      }
      fallback ??= result;
    }
    if (fallback) {
      selected.push(fallback);
    }
  }
  const quadrants = new Set(selected.map((candidate) => Math.floor(candidate.azimuth / 90))).size;
  console.log(
    `${spec.key}: waveform options tested ${screening.tried}, continuous ${screening.continuous}, unclipped ${screening.unclipped}, SNR ≥ 3 ${screening.snr}, usable horizontal ${screening.horizontal}; selected ${selected.length} across ${quadrants} quadrants`,
  );
  if (selected.length < 4 || quadrants < 2) {
    throw new Error(
      `${spec.key}: only ${selected.length} quality stations across ${quadrants} quadrants (${keys.length} untested)`,
    );
  }
  return selected;
}

function pack(candidate: Selected, start: number, end: number, rate: number): StationData {
  const count = Math.round((end - start) * rate);
  const trim = (trace: ProcessedTrace) =>
    decimate(trace.values, trace.rate / rate, (start - trace.start) * trace.rate, count);
  const vertical = trim(candidate.z);
  const horizontal = trim(candidate.horizontal);
  const max = Math.max(peak(vertical), peak(horizontal));
  const encode = (values: Float64Array) => {
    const bytes = Buffer.alloc(values.length * 2);
    for (const [index, value] of values.entries()) {
      bytes.writeInt16LE(Math.round((32767 * value) / max), index * 2);
    }
    return bytes.toString("base64");
  };
  const { net, sta, loc, lat, lon } = candidate.vertical;
  return {
    network: net,
    code: sta,
    location: loc,
    lat,
    lon,
    sampleRate: rate,
    startSeconds: start,
    verticalChannel: candidate.z.channel,
    horizontalChannel: candidate.horizontal.channel,
    vertical: encode(vertical),
    horizontal: encode(horizontal),
    distanceKm: round(candidate.distanceKm, 4),
    pTheoSeconds: round(candidate.p, 5),
    sTheoSeconds: round(candidate.s, 5),
  };
}

export async function buildEvent(spec: EventSpec, kind: ScreenKind, land: LonLat[][]): Promise<SeismicEventData> {
  const event = await getEvent(spec);
  const { id, timeIso, lat, lon, depthKm, mag, magType, place } = event;
  const [minRadiusDeg, maxRadiusDeg] = spec.distDeg ?? [
    (spec.distKm?.[0] ?? 0) / KM_PER_DEGREE,
    (spec.distKm?.[1] ?? 0) / KM_PER_DEGREE,
  ];
  const mapBox: SeismicEventData["mapBox"] =
    kind === "regional" ? [lon - 8, lat - 6, lon + 8, lat + 6] : [-180, -90, 180, 90];
  const rows = (
    await Promise.all(
      spec.networks.map((network) =>
        fetchStations({ network, lat, lon, minRadiusDeg, maxRadiusDeg, startIso: timeIso }),
      ),
    )
  ).flat();
  const candidates = combinations(event, rows, kind === "regional" ? "HHZ" : "BHZ");
  console.log(
    `${spec.key}: station service returned ${rows.length} channel rows across ${new Set(rows.map((row) => `${row.net}.${row.sta}`)).size} stations; ${rows.filter(hasVelocityScale).length} rows have a velocity scale, ${candidates.length} vertical channel options remain`,
  );
  const distances = candidates.map((candidate) => round(candidate.distanceKm / KM_PER_DEGREE, 5));
  const results = await travelTimes(depthKm, distances);
  const timed = candidates.flatMap((candidate, index) => {
    const result = results[index];
    return result && result.p !== null && result.s !== null ? [{ ...candidate, p: result.p, s: result.s }] : [];
  });
  console.log(`${spec.key}: ${timed.length} options have P and S predictions`);
  const provisionalStart =
    kind === "regional"
      ? spec.window[0]
      : Math.floor(Math.min(...timed.map((candidate) => candidate.p)) + spec.window[0]);
  const selected = await select(timed, spec, Date.parse(timeIso), provisionalStart, spec.window[1]);
  const ordered = selected.sort((a, b) => a.distanceKm - b.distanceKm);
  const start = kind === "regional" ? spec.window[0] : Math.floor((ordered[0]?.p ?? 0) + spec.window[0]);
  const end =
    kind === "regional" ? spec.window[1] : Math.min(spec.window[1], Math.ceil((ordered.at(-1)?.s ?? 0) + 300));
  const stations = ordered.map((candidate) => pack(candidate, start, end, spec.sps));
  for (const { network, code, location, verticalChannel, horizontalChannel } of stations) {
    const stationId = [network, code, location || "--"].join(".");
    console.log([spec.key, stationId, `${verticalChannel}/${horizontalChannel}`, dataCenter(network)].join(" "));
  }
  return {
    key: spec.key,
    kind,
    comcatId: id,
    originIso: timeIso,
    lat,
    lon,
    depthKm,
    magnitude: mag,
    magType,
    place,
    mapBox,
    regionalLand: kind === "regional" ? encodeLand(land, mapBox) : [],
    stations,
  };
}
