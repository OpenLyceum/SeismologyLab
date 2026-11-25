/** Generate the offline seismograms, IASP91 tables and maps. */
import { readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import type { SeismicEventData, TravelTimeTableData } from "../src/common/data/dataTypes.js";
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
const LIMIT_BYTES = 2_000_000;

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
  const eventLines = (items: SeismicEventData[]) => items.map((item) => `  ${JSON.stringify(item)},`).join("\n");
  writeGeneratedModule(
    `${GENERATED}/eventData.ts`,
    "Catalog origins, stations and quantized waveform samples.",
    `import type { SeismicEventData } from "../dataTypes.js";\n\nexport const EVENTS: readonly SeismicEventData[] = [\n${eventLines(events)}\n];`,
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
  const size = readdirSync(GENERATED).reduce((total, file) => total + statSync(`${GENERATED}/${file}`).size, 0);
  console.log(`Generated data: ${size} bytes (limit ${LIMIT_BYTES})`);
  if (size > LIMIT_BYTES) {
    throw new Error("Generated data exceeds the 2 MB limit");
  }
}

await build();
