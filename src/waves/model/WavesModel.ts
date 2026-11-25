/**
 * WavesModel.ts
 *
 * The Waves screen replays an earthquake in compressed time. The clock runs in seconds
 * after the origin time; the P and S fronts spread from the epicenter, and each
 * station's record fills in as the clock passes. Every time the P wave reaches a
 * station, playback holds for a moment so the arrival can be seen on the map and the
 * trace together.
 *
 * Arrival times are the TauP IASP91 predictions bundled with each station, the same
 * ticks Reveal shows on the lab screens, so the fronts and the traces agree.
 */
import { BooleanProperty, DerivedProperty, Emitter, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import { TimeSpeed } from "scenerystack/scenery-phet";
import type { SeismicEventData, SeismicEventSummary, StationSummary } from "../../common/data/dataTypes.js";
import { catalogEvents, loadEvent, loadedEvent, stationsByDistance } from "../../common/data/eventLibrary.js";
import { TRAVEL_TIME_TABLE } from "../../common/data/generated/travelTimeData.js";
import { TravelTimeCurve } from "../../common/model/TravelTimeCurve.js";
import { TimeModel } from "../../common/TimeModel.js";
import {
  KM_PER_DEGREE,
  WAVES_ARRIVAL_PAUSE_SECONDS,
  WAVES_PLAYBACK_RATE,
  WAVES_STEP_SECONDS,
  WAVES_TAIL_SECONDS,
} from "../../SeismologyLabConstants.js";

type Phase = "p" | "s";

const curve = new TravelTimeCurve(TRAVEL_TIME_TABLE);

/**
 * Where a wavefront meets the surface (km from the epicenter) `seconds` after the origin,
 * or null while it has not yet surfaced or once it is past the 100° travel-time table.
 * Both screens use the IASP91 first-arrival curves at the catalog depth: the model the
 * stations' arrival flags come from, so a front reaches each station as its flag appears.
 */
export function frontRadiusKm(event: SeismicEventSummary, phase: Phase, seconds: number): number | null {
  const degrees = curve.distanceForTime(phase, seconds, event.depthKm);
  return Number.isFinite(degrees) ? degrees * KM_PER_DEGREE : null;
}

/** Earthquake time at which the replay of an event ends. */
function endSeconds(event: SeismicEventSummary): number {
  const lastS = Math.max(...event.stations.map(({ sTheoSeconds }) => sTheoSeconds));
  return lastS + WAVES_TAIL_SECONDS[event.kind];
}

export class WavesModel implements TModel {
  public readonly events: readonly SeismicEventSummary[];
  public readonly eventProperty: Property<SeismicEventSummary>;
  /** The chosen event with its waveforms, or null while they load. */
  public readonly eventDataProperty = new Property<SeismicEventData | null>(null);
  public readonly loadingProperty = new BooleanProperty(false);
  public readonly loadFailedProperty = new BooleanProperty(false);
  /** Stations of the chosen event, nearest first. */
  public readonly stationsProperty: TReadOnlyProperty<readonly StationSummary[]>;
  /** Seconds after the origin time; the play/pause state and speed live here too. */
  public readonly timer = new TimeModel({
    timeSpeedMultipliers: new Map([
      [TimeSpeed.FAST, 2],
      [TimeSpeed.NORMAL, 1],
      [TimeSpeed.SLOW, 0.25],
    ]),
  });
  /** Hold briefly each time the P wave reaches a station. */
  public readonly autoPauseProperty = new BooleanProperty(true);
  /** True during an arrival hold. */
  public readonly holdingProperty = new BooleanProperty(false);
  public readonly pRadiusKmProperty: TReadOnlyProperty<number | null>;
  public readonly sRadiusKmProperty: TReadOnlyProperty<number | null>;
  /** How many stations each wave has reached. */
  public readonly pArrivedCountProperty: TReadOnlyProperty<number>;
  public readonly sArrivedCountProperty: TReadOnlyProperty<number>;
  public readonly endSecondsProperty: TReadOnlyProperty<number>;
  /** Fires with the station index (nearest first) each time a wave reaches a station. */
  public readonly arrivalEmitter = new Emitter<[Phase, number]>({
    parameters: [{ validValues: ["p", "s"] }, { valueType: "number" }],
  });
  private holdRemaining = 0;
  private loadToken = 0;
  private readonly disposeLinks: () => void;

  public constructor() {
    this.events = catalogEvents();
    const first = this.events[0];
    if (!first) {
      throw new Error("SeismologyLab requires at least one event");
    }
    this.eventProperty = new Property(first, { validValues: [...this.events] });
    const stationsProperty = new DerivedProperty([this.eventProperty], (event) => stationsByDistance(event));
    this.stationsProperty = stationsProperty;
    const time = this.timer.timeProperty;
    const pRadiusProperty = new DerivedProperty([this.eventProperty, time], (event, t) => frontRadiusKm(event, "p", t));
    const sRadiusProperty = new DerivedProperty([this.eventProperty, time], (event, t) => frontRadiusKm(event, "s", t));
    const arrived = (phase: Phase) =>
      new DerivedProperty(
        [stationsProperty, time],
        (stations, t) =>
          stations.filter((station) => (phase === "p" ? station.pTheoSeconds : station.sTheoSeconds) <= t).length,
      );
    const pArrivedProperty = arrived("p");
    const sArrivedProperty = arrived("s");
    const endProperty = new DerivedProperty([this.eventProperty], endSeconds);
    this.pRadiusKmProperty = pRadiusProperty;
    this.sRadiusKmProperty = sRadiusProperty;
    this.pArrivedCountProperty = pArrivedProperty;
    this.sArrivedCountProperty = sArrivedProperty;
    this.endSecondsProperty = endProperty;

    const select = (event: SeismicEventSummary) => this.selectEvent(event);
    this.eventProperty.link(select);
    // Pressing play at the end replays from the origin time.
    const rewind = (playing: boolean) => {
      if (playing && this.isFinished) {
        this.cancelHold();
        this.timer.timeProperty.reset();
      }
    };
    this.timer.isPlayingProperty.lazyLink(rewind);
    this.disposeLinks = () => {
      this.eventProperty.unlink(select);
      this.timer.isPlayingProperty.unlink(rewind);
      for (const property of [
        pRadiusProperty,
        sRadiusProperty,
        pArrivedProperty,
        sArrivedProperty,
        endProperty,
        stationsProperty,
      ]) {
        property.dispose();
      }
    };
  }

  /** Whether the replay has reached its end. */
  public get isFinished(): boolean {
    return this.timer.timeProperty.value >= this.endSecondsProperty.value;
  }

  public step(dt: number): void {
    if (!(this.timer.isPlayingProperty.value && Number.isFinite(dt)) || dt <= 0) {
      return;
    }
    let wallSeconds = dt;
    if (this.holdRemaining > 0) {
      this.holdRemaining -= wallSeconds;
      if (this.holdRemaining > 0) {
        return;
      }
      wallSeconds = -this.holdRemaining;
      this.holdRemaining = 0;
      this.holdingProperty.value = false;
    }
    const rate = WAVES_PLAYBACK_RATE[this.eventProperty.value.kind] * this.timer.speedMultiplier;
    this.advance(wallSeconds * rate, this.autoPauseProperty.value);
  }

  /** The step-forward button: one fixed step, through any arrival without holding. */
  public stepForward(): void {
    this.cancelHold();
    this.advance(WAVES_STEP_SECONDS[this.eventProperty.value.kind], false);
  }

  /** Replay the current earthquake from its origin time. */
  public restart(): void {
    this.cancelHold();
    this.timer.timeProperty.reset();
    this.timer.isPlayingProperty.value = true;
  }

  public reset(): void {
    this.cancelHold();
    this.autoPauseProperty.reset();
    this.eventProperty.reset();
    this.timer.reset();
  }

  public dispose(): void {
    this.loadToken++;
    this.disposeLinks();
    this.timer.dispose();
    this.arrivalEmitter.dispose();
    for (const property of [
      this.eventProperty,
      this.eventDataProperty,
      this.loadingProperty,
      this.loadFailedProperty,
      this.autoPauseProperty,
      this.holdingProperty,
    ]) {
      property.dispose();
    }
  }

  /**
   * Moves the clock forward by `seconds` of earthquake time. With `holdAtP`, it stops at
   * the first P arrival in the interval and starts a hold there.
   */
  private advance(seconds: number, holdAtP: boolean): void {
    const time = this.timer.timeProperty;
    const from = time.value;
    let to = Math.min(from + seconds, this.endSecondsProperty.value);
    let hold = false;
    if (holdAtP) {
      const nextP = Math.min(
        ...this.stationsProperty.value.map(({ pTheoSeconds }) => pTheoSeconds).filter((t) => t > from && t <= to),
      );
      if (Number.isFinite(nextP)) {
        to = nextP;
        hold = true;
      }
    }
    if (to <= from) {
      return;
    }
    time.value = to;
    if (hold) {
      this.holdRemaining = WAVES_ARRIVAL_PAUSE_SECONDS;
      this.holdingProperty.value = true;
    }
    this.stationsProperty.value.forEach((station, index) => {
      for (const phase of ["p", "s"] as const) {
        const arrival = phase === "p" ? station.pTheoSeconds : station.sTheoSeconds;
        if (arrival > from && arrival <= to) {
          this.arrivalEmitter.emit(phase, index);
        }
      }
    });
    if (to >= this.endSecondsProperty.value) {
      this.timer.isPlayingProperty.value = false;
    }
  }

  private cancelHold(): void {
    this.holdRemaining = 0;
    this.holdingProperty.value = false;
  }

  private selectEvent(summary: SeismicEventSummary): void {
    const token = ++this.loadToken;
    this.cancelHold();
    this.timer.timeProperty.reset();
    this.timer.isPlayingProperty.value = false;
    this.loadFailedProperty.value = false;
    const ready = loadedEvent(summary);
    this.eventDataProperty.value = ready ?? null;
    this.loadingProperty.value = !ready;
    if (ready) {
      return;
    }
    loadEvent(summary).then(
      (event) => {
        if (token === this.loadToken) {
          this.loadingProperty.value = false;
          this.eventDataProperty.value = event;
        }
      },
      () => {
        if (token === this.loadToken) {
          this.loadingProperty.value = false;
          this.loadFailedProperty.value = true;
        }
      },
    );
  }
}
