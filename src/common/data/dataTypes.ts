/** Bundled event, waveform and travel-time data shared by the generator and simulation. */
export type ScreenKind = "regional" | "global";

/** A station's location, channels and theoretical arrivals: bundled with the catalog. */
export type StationSummary = {
  readonly network: string;
  readonly code: string;
  readonly location: string;
  readonly lat: number;
  readonly lon: number;
  readonly verticalChannel: string;
  readonly horizontalChannel: string;
  readonly sampleRate: number;
  readonly startSeconds: number;
  readonly distanceKm: number;
  readonly pTheoSeconds: number;
  readonly sTheoSeconds: number;
};

/** A station's base64 Int16 samples: loaded on demand, one module per event. */
export type StationWaveforms = {
  readonly vertical: string;
  readonly horizontal: string;
};

export type StationData = StationSummary & StationWaveforms;

/** Everything about an earthquake except its waveforms. */
export type SeismicEventSummary = {
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
  readonly stations: readonly StationSummary[];
};

export type SeismicEventData = Omit<SeismicEventSummary, "stations"> & {
  readonly stations: readonly StationData[];
};

export type TravelTimeTableData = {
  readonly distancesDeg: readonly number[];
  readonly depthsKm: readonly number[];
  readonly p: readonly (readonly (number | null)[])[];
  readonly s: readonly (readonly (number | null)[])[];
};
