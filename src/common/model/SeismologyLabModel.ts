/** Shared station, trace window and answer-checking state for one screen. */
import { BooleanProperty, DerivedProperty, NumberProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import type { Tandem } from "scenerystack/tandem";
import {
  CHECK_FAIR_KM,
  CHECK_GOOD_KM,
  REGIONAL_VP_KM_S,
  REGIONAL_VS_KM_S,
  REQUIRED_CIRCLES,
  VP_RANGE,
  VS_RANGE,
} from "../../SeismologyLabConstants.js";
import type { ScreenKind, SeismicEventData, SeismicEventSummary } from "../data/dataTypes.js";
import { loadEvent, loadedEvent, stationsByDistance } from "../data/eventLibrary.js";
import { TRAVEL_TIME_TABLE } from "../data/generated/travelTimeData.js";
import { GlobalDistanceModel, RegionalDistanceModel } from "./DistanceModel.js";
import { greatCircleKm, type LonLat } from "./geodesy.js";
import { locateEpicenter } from "./locateEpicenter.js";
import { StationRecord } from "./StationRecord.js";
import { TravelTimeCurve } from "./TravelTimeCurve.js";

type CheckResult = "none" | "good" | "fair" | "far";
type BestFit = ReturnType<typeof locateEpicenter>;

export class SeismologyLabModel {
  public readonly kind: ScreenKind;
  public readonly events: readonly SeismicEventSummary[];
  public readonly eventProperty: Property<SeismicEventSummary>;
  /** True while the chosen event's waveforms are being fetched. */
  public readonly loadingProperty = new BooleanProperty(false);
  /** True when the chosen event's waveforms could not be loaded. */
  public readonly loadFailedProperty = new BooleanProperty(false);
  private readonly recordsProperty = new Property<readonly StationRecord[]>([]);
  public readonly stationsProperty: TReadOnlyProperty<readonly StationRecord[]> = this.recordsProperty;
  public readonly vpProperty: NumberProperty;
  public readonly vsProperty: NumberProperty;
  public readonly showHorizontalProperty: BooleanProperty;
  public readonly showCirclesProperty = new BooleanProperty(true);
  public readonly guessProperty = new Property<LonLat | null>(null);
  public readonly revealedProperty = new BooleanProperty(false);
  private readonly fitProperty = new Property<BestFit>(null);
  public readonly bestFitProperty: TReadOnlyProperty<BestFit> = this.fitProperty;
  public readonly misfitKmProperty: TReadOnlyProperty<number | null>;
  public readonly checkResultProperty = new Property<CheckResult>("none");
  public readonly timeWindowProperty = new Property(new Range(0, 1));
  public readonly curve = new TravelTimeCurve(TRAVEL_TIME_TABLE);
  private readonly circleCountProperty = new NumberProperty(0);
  /** Stations whose distance circle is drawn (picked, valid and visible). */
  public readonly drawnCircleCountProperty: TReadOnlyProperty<number> = this.circleCountProperty;
  public readonly canCheckProperty: TReadOnlyProperty<boolean>;
  private readonly disposeLinks: () => void;
  private unlinkRecords: (() => void) | undefined;
  /** Incremented on every event change, so a load that resolves late is ignored. */
  private loadToken = 0;

  public constructor(kind: ScreenKind, events: readonly SeismicEventSummary[], tandem: Tandem) {
    this.kind = kind;
    this.events = events.filter((event) => event.kind === kind);
    const first = this.events[0];
    if (!first) {
      throw new Error("SeismologyLab requires at least one event per screen");
    }
    this.eventProperty = new Property(first, { validValues: [...this.events] });
    this.vpProperty = new NumberProperty(REGIONAL_VP_KM_S, {
      range: VP_RANGE,
      tandem: tandem.createTandem("vpProperty"),
    });
    this.vsProperty = new NumberProperty(REGIONAL_VS_KM_S, {
      range: VS_RANGE,
      tandem: tandem.createTandem("vsProperty"),
    });
    this.showHorizontalProperty = new BooleanProperty(false, { tandem: tandem.createTandem("showHorizontalProperty") });

    const misfitKmProperty = new DerivedProperty([this.eventProperty, this.guessProperty], (event, guess) =>
      guess ? greatCircleKm(guess, [event.lon, event.lat]) : null,
    );
    const canCheckProperty = new DerivedProperty(
      [this.guessProperty, this.circleCountProperty, this.showCirclesProperty],
      (guess, count, showCircles) => guess !== null && count >= REQUIRED_CIRCLES && showCircles,
    );
    this.misfitKmProperty = misfitKmProperty;
    this.canCheckProperty = canCheckProperty;

    const invalidate = () => this.checkResultProperty.reset();
    const rebuild = (event: SeismicEventSummary) => this.selectEvent(event);
    this.eventProperty.link(rebuild);
    this.guessProperty.lazyLink(invalidate);
    this.showCirclesProperty.lazyLink(invalidate);
    this.disposeLinks = () => {
      this.eventProperty.unlink(rebuild);
      this.guessProperty.unlink(invalidate);
      this.showCirclesProperty.unlink(invalidate);
      canCheckProperty.dispose();
      misfitKmProperty.dispose();
    };
  }

  public get fullTimeWindow(): Range {
    const records = this.recordsProperty.value;
    const start = Math.min(...records.map(({ data }) => data.startSeconds));
    const end = Math.max(...records.map(({ data, vertical }) => data.startSeconds + vertical.length / data.sampleRate));
    return records.length > 0 ? new Range(start, end) : new Range(0, 1);
  }

  /**
   * Shows the chosen event's stations: at once if its waveforms are loaded (always the
   * case in tests and for the preloaded first event), otherwise after they arrive.
   */
  private selectEvent(summary: SeismicEventSummary): void {
    const token = ++this.loadToken;
    this.loadFailedProperty.value = false;
    const ready = loadedEvent(summary);
    if (ready) {
      this.loadingProperty.value = false;
      this.rebuildStations(ready);
      return;
    }
    this.loadingProperty.value = true;
    this.rebuildStations(null);
    loadEvent(summary).then(
      (event) => {
        if (token === this.loadToken) {
          this.loadingProperty.value = false;
          this.rebuildStations(event);
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

  private rebuildStations(event: SeismicEventData | null): void {
    this.unlinkRecords?.();
    this.unlinkRecords = undefined;
    const old = this.recordsProperty.value;
    this.guessProperty.reset();
    this.revealedProperty.reset();
    if (!event) {
      this.recordsProperty.value = [];
      this.fitProperty.value = null;
      this.circleCountProperty.value = 0;
      for (const record of old) {
        record.dispose();
      }
      return;
    }
    const distanceModel =
      this.kind === "regional"
        ? new RegionalDistanceModel(this.vpProperty, this.vsProperty)
        : new GlobalDistanceModel(this.curve, event.depthKm);
    const records = stationsByDistance(event).map((data) => new StationRecord(data, distanceModel));
    this.recordsProperty.value = records;
    this.timeWindowProperty.value = this.fullTimeWindow;
    for (const record of old) {
      record.dispose();
    }

    const update = () => {
      const observations = records.flatMap(({ data, distanceKmProperty }) => {
        const distanceKm = distanceKmProperty.value;
        const station: LonLat = [data.lon, data.lat];
        return distanceKm === null ? [] : [{ station, distanceKm }];
      });
      this.circleCountProperty.value = records.filter(
        (record) => record.circleVisibleProperty.value && record.distanceKmProperty.value !== null,
      ).length;
      this.fitProperty.value = locateEpicenter(observations);
      this.checkResultProperty.reset();
    };
    const dependencies = records.flatMap((record) => [record.distanceKmProperty, record.circleVisibleProperty]);
    for (const dependency of dependencies) {
      dependency.lazyLink(update);
    }
    this.unlinkRecords = () => {
      for (const dependency of dependencies) {
        dependency.unlink(update);
      }
    };
    update();
  }

  public check(): void {
    const distance = this.misfitKmProperty.value;
    if (this.canCheckProperty.value && distance !== null) {
      this.checkResultProperty.value =
        distance <= CHECK_GOOD_KM[this.kind] ? "good" : distance <= CHECK_FAIR_KM[this.kind] ? "fair" : "far";
    }
  }

  public reveal(): void {
    this.revealedProperty.value = true;
  }

  public reset(): void {
    this.eventProperty.reset();
    this.vpProperty.reset();
    this.vsProperty.reset();
    this.showHorizontalProperty.reset();
    this.showCirclesProperty.reset();
    this.guessProperty.reset();
    this.revealedProperty.reset();
    this.checkResultProperty.reset();
    this.timeWindowProperty.value = this.fullTimeWindow;
    for (const record of this.recordsProperty.value) {
      record.reset();
    }
  }

  public dispose(): void {
    this.loadToken++;
    this.disposeLinks();
    this.unlinkRecords?.();
    for (const record of this.recordsProperty.value) {
      record.dispose();
    }
    for (const property of [
      this.recordsProperty,
      this.eventProperty,
      this.vpProperty,
      this.vsProperty,
      this.showHorizontalProperty,
      this.showCirclesProperty,
      this.guessProperty,
      this.revealedProperty,
      this.fitProperty,
      this.checkResultProperty,
      this.timeWindowProperty,
      this.circleCountProperty,
      this.loadingProperty,
      this.loadFailedProperty,
    ]) {
      property.dispose();
    }
  }
}
