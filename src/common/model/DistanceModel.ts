/** Distance from an S–P interval, using the screen's regional or global model. */
import type { TReadOnlyProperty } from "scenerystack/axon";
import { KM_PER_DEGREE } from "../../SeismologyLabConstants.js";
import { regionalDistanceKm } from "./DistanceRule.js";
import type { TravelTimeCurve } from "./TravelTimeCurve.js";

export interface DistanceModel {
  distanceKm(sMinusP: number): number | null;
  readonly dependencies: readonly TReadOnlyProperty<unknown>[];
}

export class RegionalDistanceModel implements DistanceModel {
  public readonly dependencies: readonly TReadOnlyProperty<unknown>[];
  private readonly vpProperty: TReadOnlyProperty<number>;
  private readonly vsProperty: TReadOnlyProperty<number>;

  public constructor(vpProperty: TReadOnlyProperty<number>, vsProperty: TReadOnlyProperty<number>) {
    this.vpProperty = vpProperty;
    this.vsProperty = vsProperty;
    this.dependencies = [vpProperty, vsProperty];
  }

  public distanceKm(sMinusP: number): number | null {
    const distance = regionalDistanceKm(sMinusP, this.vpProperty.value, this.vsProperty.value);
    return Number.isFinite(distance) ? distance : null;
  }
}

export class GlobalDistanceModel implements DistanceModel {
  public readonly dependencies = [];
  private readonly curve: TravelTimeCurve;
  private readonly depthKm: number;

  public constructor(curve: TravelTimeCurve, depthKm: number) {
    this.curve = curve;
    this.depthKm = depthKm;
  }

  public distanceKm(sMinusP: number): number | null {
    const degrees = this.curve.distanceForSMinusP(sMinusP, this.depthKm);
    return Number.isFinite(degrees) ? degrees * KM_PER_DEGREE : null;
  }
}
