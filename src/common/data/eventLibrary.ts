/**
 * eventLibrary.ts
 *
 * The bundled earthquake catalog plus on-demand waveforms. The catalog (origins,
 * stations, theoretical arrivals) ships in the main chunk; each event's samples are
 * a separate chunk that `loadEvent` imports the first time the event is chosen and
 * caches afterwards. The service worker precaches every chunk, so this works offline
 * once the sim has been installed.
 */
import type { ScreenKind, SeismicEventData, SeismicEventSummary, StationSummary } from "./dataTypes.js";
import { EVENT_CATALOG } from "./generated/eventCatalog.js";
import { WAVEFORM_LOADERS } from "./generated/waveformLoaders.js";

const loaded = new Map<string, SeismicEventData>();
const pending = new Map<string, Promise<SeismicEventData>>();

/** Catalog events for one screen kind, or every event when `kind` is omitted. */
export function catalogEvents(kind?: ScreenKind): readonly SeismicEventSummary[] {
  return kind ? EVENT_CATALOG.filter((event) => event.kind === kind) : EVENT_CATALOG;
}

/** An event's stations nearest first: the order every screen lists and colors them in. */
export function stationsByDistance<T extends StationSummary>(event: { readonly stations: readonly T[] }): T[] {
  return [...event.stations].sort((a, b) => a.distanceKm - b.distanceKm);
}

/** The event with its waveforms, if they have already been loaded. */
export function loadedEvent(summary: SeismicEventSummary): SeismicEventData | undefined {
  return loaded.get(summary.key);
}

/** Loads (once) and returns the event with its waveforms. */
export function loadEvent(summary: SeismicEventSummary): Promise<SeismicEventData> {
  const cached = loaded.get(summary.key);
  if (cached) {
    return Promise.resolve(cached);
  }
  const inFlight = pending.get(summary.key);
  if (inFlight !== undefined) {
    return inFlight;
  }
  const loader = WAVEFORM_LOADERS[summary.key];
  if (!loader) {
    return Promise.reject(new Error(`No waveforms bundled for ${summary.key}`));
  }
  const promise = loader()
    .then((waveforms) => {
      if (waveforms.length !== summary.stations.length) {
        throw new Error(`${summary.key}: ${waveforms.length} waveforms for ${summary.stations.length} stations`);
      }
      const event: SeismicEventData = {
        ...summary,
        stations: summary.stations.map((station, index) => {
          const samples = waveforms[index];
          if (!samples) {
            throw new Error(`${summary.key}: missing waveforms for ${station.code}`);
          }
          return { ...station, ...samples };
        }),
      };
      loaded.set(summary.key, event);
      return event;
    })
    .finally(() => pending.delete(summary.key));
  pending.set(summary.key, promise);
  return promise;
}
