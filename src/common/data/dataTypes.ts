/** Bundled event, waveform and travel-time data shared by the generator and simulation. */
export type ScreenKind = "regional" | "global";

export type StationData = {
  readonly network: string;
  readonly code: string;
  readonly location: string;
  readonly lat: number;
  readonly lon: number;
  readonly verticalChannel: string;
  readonly horizontalChannel: string;
  readonly sampleRate: number;
  readonly startSeconds: number;
  readonly vertical: string;
  readonly horizontal: string;
  readonly distanceKm: number;
  readonly pTheoSeconds: number;
  readonly sTheoSeconds: number;
};

export type SeismicEventData = {
  readonly key: string;
  readonly kind: ScreenKind;
  readonly comcatId: string;
  readonly originIso: string;
  readonly lat: number;
  readonly lon: number;
  readonly depthKm: number;
  readonly magnitude: number;
  readonly magType: string;
  readonly place: string;
  readonly mapBox: readonly [west: number, south: number, east: number, north: number];
  readonly regionalLand: readonly (readonly number[])[];
  readonly stations: readonly StationData[];
};

export type TravelTimeTableData = {
  readonly distancesDeg: readonly number[];
  readonly depthsKm: readonly number[];
  readonly p: readonly (readonly (number | null)[])[];
  readonly s: readonly (readonly (number | null)[])[];
};
