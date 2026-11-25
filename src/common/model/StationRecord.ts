/** Tracks a station's samples, picks, inferred distance and circle visibility. */
import { BooleanProperty, DerivedProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import type { StationData } from "../data/dataTypes.js";
import type { DistanceModel } from "./DistanceModel.js";
import { decodeSamples } from "./decodeSamples.js";

export class StationRecord {
  public readonly data: StationData;
  public readonly vertical: Float32Array;
  public readonly horizontal: Float32Array;
  public readonly pPickProperty = new Property<number | null>(null);
  public readonly sPickProperty = new Property<number | null>(null);
  public readonly circleVisibleProperty = new BooleanProperty(true);
  public readonly sMinusPProperty: TReadOnlyProperty<number | null>;
  public readonly distanceKmProperty: TReadOnlyProperty<number | null>;
  private readonly disposeProperties: () => void;

  public constructor(data: StationData, distanceModel: DistanceModel) {
    this.data = data;
    this.vertical = decodeSamples(data.vertical);
    this.horizontal = data.horizontal === data.vertical ? this.vertical : decodeSamples(data.horizontal);
    const sMinusPProperty = new DerivedProperty([this.pPickProperty, this.sPickProperty], (p, s) =>
      p !== null && s !== null && s > p ? s - p : null,
    );
    const distanceKmProperty = DerivedProperty.deriveAny([sMinusPProperty, ...distanceModel.dependencies], () =>
      sMinusPProperty.value === null ? null : distanceModel.distanceKm(sMinusPProperty.value),
    );
    this.sMinusPProperty = sMinusPProperty;
    this.distanceKmProperty = distanceKmProperty;
    this.disposeProperties = () => {
      distanceKmProperty.dispose();
      sMinusPProperty.dispose();
      this.pPickProperty.dispose();
      this.sPickProperty.dispose();
      this.circleVisibleProperty.dispose();
    };
  }

  public reset(): void {
    this.pPickProperty.reset();
    this.sPickProperty.reset();
    this.circleVisibleProperty.reset();
  }

  public dispose(): void {
    this.disposeProperties();
  }
}
