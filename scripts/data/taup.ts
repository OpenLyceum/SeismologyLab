/** Install the pinned TauP CLI and cache its IASP91 results. */
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { fetchBinary } from "./fetchCache.js";

const run = promisify(execFile);
const VERSION = "3.2.1";
const ZIP = `TauP-${VERSION}.zip`;
const URL = `https://github.com/crotwell/TauP/releases/download/v${VERSION}/${ZIP}`;
const CLI = `.cache/taup/TauP-${VERSION}/bin/taup`;
const PHASES = "P,p,Pdiff,PKP,S,s,Sdiff";
let installation: Promise<void> | undefined;

async function install(): Promise<void> {
  execFileSync("java", ["-version"], { stdio: "pipe" });
  if (!existsSync(CLI)) {
    const archive = await fetchBinary(URL, ZIP);
    mkdirSync(".cache/taup", { recursive: true });
    const archivePath = `.cache/taup/${ZIP}`;
    writeFileSync(archivePath, archive);
    execFileSync("unzip", ["-oq", archivePath, "-d", ".cache/taup"]);
  }
  const help = execFileSync(CLI, ["time", "--help"], { encoding: "utf8" });
  for (const flag of ["--mod", "--deg", "-h", "-p", "--json"]) {
    if (!help.includes(flag)) {
      throw new Error(`TauP ${VERSION} time --help is missing ${flag}`);
    }
  }
}

type TauPArrival = { phase: string; time: number; raytype: { ray: { deg: number } } };
type TravelTimes = { distDeg: number; p: number | null; s: number | null };

/** Run one JVM for the batch. Return the first arrival of each phase family at each distance. */
export async function travelTimes(depthKm: number, distancesDeg: number[]): Promise<TravelTimes[]> {
  installation ??= install();
  await installation;

  const distances = distancesDeg.join(",");
  const hash = createHash("sha256").update(`${VERSION}:${PHASES}:${distances}`).digest("hex").slice(0, 16);
  const path = `.cache/data/taup-${depthKm}-${hash}.json`;
  const raw = existsSync(path)
    ? readFileSync(path, "utf8")
    : (
        await run(CLI, ["time", "--mod", "iasp91", "-h", String(depthKm), "--deg", distances, "-p", PHASES, "--json"], {
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        })
      ).stdout;
  const { arrivals } = JSON.parse(raw) as { arrivals: TauPArrival[] };
  if (!existsSync(path)) {
    mkdirSync(".cache/data", { recursive: true });
    writeFileSync(path, raw);
  }

  return distancesDeg.map((distDeg) => {
    let p: number | null = null;
    let s: number | null = null;
    for (const arrival of arrivals) {
      if (Math.abs(arrival.raytype.ray.deg - distDeg) > 0.00001) {
        continue;
      }
      if (arrival.phase[0]?.toLowerCase() === "p") {
        p = p === null ? arrival.time : Math.min(p, arrival.time);
      } else {
        s = s === null ? arrival.time : Math.min(s, arrival.time);
      }
    }
    return { distDeg, p, s };
  });
}
