/** Generate the offline seismograms, IASP91 tables and maps. */
import { readdirSync, rmSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import type {
  SeismicEventData,
  SeismicEventSummary,
  StationWaveforms,
  TravelTimeTableData,
} from "../src/common/data/dataTypes.js";
import type { EventSpec } from "./data/buildEvent.js";
import config from "./data/events.json" with { type: "json" };

// Node executes these TypeScript tools directly. Resolve the same .js specifiers as the app build.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const path = specifier.startsWith(".") && specifier.endsWith(".js") ? `${specifier.slice(0, -3)}.ts` : specifier;
    return nextResolve(path, context);
  },
});
const { buildEvent } = await import("./data/buildEvent.js");
const { fetchLand, encodeLand } = await import("./data/land.js");
const { numberArray, writeGeneratedModule } = await import("./data/emit.js");
const { travelTimes } = await import("./data/taup.js");

const GENERATED = "src/common/data/generated";
/** The catalog, travel times and land are bundled into the main chunk; keep them small. */
const BUNDLED_LIMIT_BYTES = 600_000;
/** Each event's waveforms are a separate lazily loaded chunk. */
const WAVEFORM_LIMIT_BYTES = 300_000;

function summarize({ stations, ...event }: SeismicEventData): SeismicEventSummary {
  return { ...event, stations: stations.map(({ vertical: _v, horizontal: _h, ...station }) => station) };
}

function waveforms({ stations }: SeismicEventData): StationWaveforms[] {
  return stations.map(({ vertical, horizontal }) => ({ vertical, horizontal }));
}

async function build(): Promise<void> {
  const [world, regional] = await Promise.all([fetchLand(110), fetchLand(50)]);
  const distancesDeg = Array.from({ length: 101 }, (_, index) => index);
  const depthsKm = [0, 33, 100, 300, 600];
  const pair = (values: number[]): readonly [number, number] => {
    const [first, second] = values;
    if (values.length !== 2 || first === undefined || second === undefined) {
      throw new Error("Expected a pair of event configuration values");
    }
    return [first, second];
  };
  const common = ({
    key,
    eventId,
    networks,
    stations,
    sps,
    window,
    band,
  }: (typeof config.regional | typeof config.global)[number]) => ({
    key,
    eventId,
    networks,
    stations,
    sps,
    window: pair(window),
    band: pair(band),
  });
  const regionalSpecs: EventSpec[] = config.regional.map((spec) => ({ ...common(spec), distKm: pair(spec.distKm) }));
  const globalSpecs: EventSpec[] = config.global.map((spec) => ({ ...common(spec), distDeg: pair(spec.distDeg) }));
  const [events, rows] = await Promise.all([
    Promise.all([
      ...regionalSpecs.map((spec) => buildEvent(spec, "regional", regional)),
      ...globalSpecs.map((spec) => buildEvent(spec, "global", regional)),
    ]),
    Promise.all(depthsKm.map((depth) => travelTimes(depth, distancesDeg))),
  ]);
  const table: TravelTimeTableData = {
    distancesDeg,
    depthsKm,
    p: rows.map((row) => row.map(({ p }) => p)),
    s: rows.map((row) => row.map(({ s }) => s)),
  };
  rmSync(`${GENERATED}/eventData.ts`, { force: true });
  rmSync(`${GENERATED}/waveforms`, { recursive: true, force: true });
  writeGeneratedModule(
    `${GENERATED}/eventCatalog.ts`,
    "Catalog origins, stations and theoretical arrivals. Waveforms load per event (waveformLoaders.ts).",
    `import type { SeismicEventSummary } from "../dataTypes.js";\n\nexport const EVENT_CATALOG: readonly SeismicEventSummary[] = [\n${events
      .map((event) => `  ${JSON.stringify(summarize(event))},`)
      .join("\n")}\n];`,
  );
  for (const event of events) {
    writeGeneratedModule(
      `${GENERATED}/waveforms/${event.key}.ts`,
      `Quantized vertical and horizontal samples for ${event.key}, in catalog station order.`,
      `import type { StationWaveforms } from "../../dataTypes.js";\n\nexport const WAVEFORMS: readonly StationWaveforms[] = [\n${waveforms(
        event,
      )
        .map((station) => `  ${JSON.stringify(station)},`)
        .join("\n")}\n];`,
    );
  }
  writeGeneratedModule(
    `${GENERATED}/waveformLoaders.ts`,
    "One dynamic import per event, so Vite emits each event's waveforms as its own chunk.",
    `import type { StationWaveforms } from "../dataTypes.js";\n\nexport const WAVEFORM_LOADERS: Readonly<Record<string, () => Promise<readonly StationWaveforms[]>>> = {\n${events
      .map((event) => `  ${event.key}: async () => (await import("./waveforms/${event.key}.js")).WAVEFORMS,`)
      .join("\n")}\n};`,
  );
  writeGeneratedModule(
    `${GENERATED}/travelTimeData.ts`,
    "TauP IASP91 first P- and S-family arrivals in seconds.",
    `import type { TravelTimeTableData } from "../dataTypes.js";\n\nexport const TRAVEL_TIME_TABLE: TravelTimeTableData = ${JSON.stringify(table)};`,
  );
  writeGeneratedModule(
    `${GENERATED}/landData.ts`,
    "Natural Earth 110m coastline ring coordinates.",
    `export const WORLD_LAND: readonly (readonly number[])[] = [\n${encodeLand(world)
      .map((ring) => `  ${numberArray(ring)},`)
      .join("\n")}\n];`,
  );

  console.table(
    events.map((event) => ({
      event: event.key,
      stations: event.stations.length,
      bytes: Buffer.byteLength(JSON.stringify(event)),
    })),
  );
  const fileSize = (path: string) => statSync(path).size;
  const bundled = readdirSync(GENERATED)
    .filter((file) => file.endsWith(".ts"))
    .reduce((total, file) => total + fileSize(`${GENERATED}/${file}`), 0);
  console.log(`Bundled data: ${bundled} bytes (limit ${BUNDLED_LIMIT_BYTES})`);
  if (bundled > BUNDLED_LIMIT_BYTES) {
    throw new Error(`Bundled data exceeds ${BUNDLED_LIMIT_BYTES} bytes`);
  }
  for (const event of events) {
    const size = fileSize(`${GENERATED}/waveforms/${event.key}.ts`);
    if (size > WAVEFORM_LIMIT_BYTES) {
      throw new Error(`${event.key} waveforms are ${size} bytes (limit ${WAVEFORM_LIMIT_BYTES})`);
    }
  }
}

await build();
