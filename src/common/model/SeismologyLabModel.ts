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
import type { ScreenKind, SeismicEventData } from "../data/dataTypes.js";
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
  public readonly events: readonly SeismicEventData[];
  public readonly eventProperty: Property<SeismicEventData>;
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
  public readonly canCheckProperty: TReadOnlyProperty<boolean>;
  private readonly disposeLinks: () => void;
  private unlinkRecords: (() => void) | undefined;

  public constructor(kind: ScreenKind, events: readonly SeismicEventData[], tandem: Tandem) {
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
    const rebuild = (event: SeismicEventData) => this.rebuildStations(event);
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

  private rebuildStations(event: SeismicEventData): void {
    this.unlinkRecords?.();
    const old = this.recordsProperty.value;
    const distanceModel =
      this.kind === "regional"
        ? new RegionalDistanceModel(this.vpProperty, this.vsProperty)
        : new GlobalDistanceModel(this.curve, event.depthKm);
    const records = [...event.stations]
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((data) => new StationRecord(data, distanceModel));
    this.guessProperty.reset();
    this.revealedProperty.reset();
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
    ]) {
      property.dispose();
    }
  }
}
