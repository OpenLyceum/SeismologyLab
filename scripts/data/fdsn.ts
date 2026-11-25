/** Fetches catalog origins, channel metadata and waveforms from FDSN services. */
import { fetchBinary, fetchText } from "./fetchCache.js";
import { decodeMiniSeed } from "./miniseed.js";

const COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const EARTHSCOPE = "https://service.earthscope.org";
const DATA_CENTERS = new Map([
  ["NC", "https://service.ncedc.org"],
  ["BK", "https://service.ncedc.org"],
  ["CI", "https://service.scedc.caltech.edu"],
]);

export function dataCenter(network: string): string {
  return DATA_CENTERS.get(network) ?? EARTHSCOPE;
}

function serviceUrl(network: string, service: "station" | "dataselect"): string {
  return `${dataCenter(network)}/fdsnws/${service}/1/query`;
}

type GeoJsonEvent = {
  id: string;
  geometry: { coordinates: [lon: number, lat: number, depthKm: number] };
  properties: { time: number; mag: number; magType: string; place: string };
};

function query(endpoint: string, params: Record<string, string | number>): string {
  return `${endpoint}?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`;
}

/** The ComCat preferred origin and magnitude for a single event. */
export async function fetchComCatEvent(eventId: string) {
  const url = query(COMCAT, { eventid: eventId, format: "geojson" });
  const event = JSON.parse(await fetchText(url, `${eventId}.json`)) as GeoJsonEvent;
  const [lon, lat, depthKm] = event.geometry.coordinates;
  const { time, mag, magType, place } = event.properties;
  return { id: event.id, timeIso: new Date(time).toISOString(), lat, lon, depthKm, mag, magType, place };
}

/** Find the largest catalog event for a known time and region. */
export async function findComCatEvent(q: {
  startIso: string;
  endIso: string;
  minMag: number;
  lat: number;
  lon: number;
  maxRadiusDeg: number;
}): Promise<string> {
  const url = query(COMCAT, {
    starttime: q.startIso,
    endtime: q.endIso,
    minmagnitude: q.minMag,
    latitude: q.lat,
    longitude: q.lon,
    maxradius: q.maxRadiusDeg,
    format: "geojson",
    orderby: "magnitude",
    limit: 1,
  });
  const raw = await fetchText(url, "comcat-search.json");
  const match = raw && (JSON.parse(raw) as { features: GeoJsonEvent[] }).features[0];
  if (!match) {
    throw new Error(`No ComCat match for ${url}`);
  }
  return match.id;
}

export type StationMeta = {
  net: string;
  sta: string;
  loc: string;
  cha: string;
  lat: number;
  lon: number;
  scale: number;
  scaleFrequency: number;
  scaleUnits: string;
  sampleRate: number;
};

/** Find operating broadband and high-rate channels in the requested annulus. */
export async function fetchStations(q: {
  network: string;
  station?: string;
  lat: number;
  lon: number;
  minRadiusDeg: number;
  maxRadiusDeg: number;
  startIso: string;
}): Promise<StationMeta[]> {
  const url = query(serviceUrl(q.network, "station"), {
    level: "channel",
    format: "text",
    channel: "BH?,HH?",
    network: q.network,
    station: q.station ?? "*",
    latitude: q.lat,
    longitude: q.lon,
    minradius: q.minRadiusDeg,
    maxradius: q.maxRadiusDeg,
    startbefore: q.startIso,
    endafter: q.startIso,
  });
  const rows = await fetchText(url, `stations-${q.network}.txt`);
  return rows
    .trim()
    .split(/\r?\n/)
    .flatMap((line) => {
      if (line.startsWith("#") || line.length === 0) {
        return [];
      }
      const [net, sta, loc, cha, lat, lon, , , , , , scale, scaleFrequency, scaleUnits, sampleRate] = line.split("|");
      if (
        !(net && sta) ||
        loc === undefined ||
        !cha ||
        !lat ||
        !lon ||
        !scale ||
        !scaleFrequency ||
        !scaleUnits ||
        !sampleRate
      ) {
        return [];
      }
      return [
        {
          net,
          sta,
          loc,
          cha,
          lat: Number(lat),
          lon: Number(lon),
          scale: Number(scale),
          scaleFrequency: Number(scaleFrequency),
          scaleUnits,
          sampleRate: Number(sampleRate),
        },
      ];
    });
}

/** Fetch one channel. Dataselect's HTTP 204 response has an empty body. */
export async function fetchTrace(q: {
  net: string;
  sta: string;
  loc: string;
  cha: string;
  startIso: string;
  endIso: string;
}): Promise<{ sampleRate: number; startIso: string; startMs: number; samples: Float64Array } | null> {
  const url = query(serviceUrl(q.net, "dataselect"), {
    net: q.net,
    sta: q.sta,
    loc: q.loc || "--",
    cha: q.cha,
    starttime: q.startIso,
    endtime: q.endIso,
  });
  const raw = await fetchBinary(url, `${q.net}.${q.sta}.${q.loc}.${q.cha}.mseed`);
  if (raw.length === 0) {
    return null;
  }

  const result = decodeMiniSeed(raw);
  return { ...result, startIso: new Date(result.startMs).toISOString() };
}
