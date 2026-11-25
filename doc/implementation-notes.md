# Implementation notes — Seismology Lab

Developer-facing architecture notes for `seismology-lab`.

## Architecture

Screens: `src/waves/`, `src/regional/`, `src/global/`. The Waves screen has its own `WavesModel` (below). Regional and Global both compose one `SeismologyLabModel` (`src/common/model/`) built with their `ScreenKind`. They share every view except the panel under the map, which is `WaveSpeedPanel` on Regional and `TravelTimeChartNode` on Global. `buildLabScreen` (`src/common/view/LabScreenLayout.ts`) does the layout and the parallel-DOM order for both.

- **Data is generated, not fetched from a server at runtime.** `scripts/build-data.ts` writes `src/common/data/generated/`, and the output is committed. `npm run build` never touches the network.
  - `eventCatalog.ts` (about 50 KB), `travelTimeData.ts` and `landData.ts` are bundled into the main chunk. The catalog has every event's origin, stations and theoretical arrivals but no samples. `build-data` fails if these exceed 600 KB.
  - `waveforms/<key>.ts` holds one event's samples (70–140 KB). `waveformLoaders.ts` imports each one dynamically, so Vite emits one chunk per event; `build-data` fails if a chunk exceeds 300 KB.
  - `src/common/data/eventLibrary.ts` merges a summary with its waveforms (`loadEvent`, cached; `loadedEvent` when already loaded). `main.ts` preloads the first regional and first global event before `sim.start()`, so no screen opens on a loading message.
  - Workbox precaches every JS chunk, so after the first visit the PWA still works offline.
- **Async event switch.** `SeismologyLabModel.eventProperty` and `WavesModel.eventProperty` hold `SeismicEventSummary`. If the waveforms are not cached, the model sets `loadingProperty`, clears the stations, and rebuilds when the load resolves. A token counter drops a load that resolves after the user has moved on. Tests preload with `await Promise.all(catalogEvents().map(loadEvent))`, so models rebuild synchronously; `tests/eventLibrary.test.ts` covers the lazy path.
- **Per-event objects.** When the earthquake changes, `SeismologyLabModel` builds a new `StationRecord` for each station. It sets `stationsProperty` first and then disposes the old records. The seismogram stack and the map rebuild from `stationsProperty`, not `eventProperty`, so that they unlink from the old records while those still exist.
- **Distance models.** `RegionalDistanceModel` (constant speeds; it depends on the vP/vS Properties) and `GlobalDistanceModel` (IASP91 at the catalog depth) share one interface. `StationRecord.distanceKmProperty` derives from S–P plus the model's dependencies.
- **Seismograms** draw a min/max envelope per pixel column (`SeismogramRowNode`). A 3,600-sample global record therefore costs the same to draw as a regional one, at any zoom. All rows share `model.timeWindowProperty`. Zoom is view state (`SeismogramStackNode.zoomLevelProperty`).
- **Waves screen.** `WavesModel` composes the template `TimeModel` (play/pause, speed). `step()` converts wall-clock dt to earthquake seconds (`WAVES_PLAYBACK_RATE` × speed). When a step would cross a station's P arrival, it stops there and holds for `WAVES_ARRIVAL_PAUSE_SECONDS`. Step-forward goes through arrivals without holding. `arrivalEmitter` drives the spoken arrival responses. `frontRadiusKm` inverts the IASP91 table with `TravelTimeCurve.distanceForTime`. Views: `ArrivalTraceStackNode` (records drawn up to the current column from a precomputed `columnEnvelope`), `WavefrontMapNode` and `ArrivalChartNode`.
- **Shared map and trace pieces.** `StationMapNode` draws ocean, land, graticule and stations, and rebuilds on `eventProperty`. `projectionFor(event)` is a cached pure function, so layers rebuilt on another trigger (the lab circles rebuild on `stationsProperty`) never depend on listener order. `EpicenterMapNode` and `WavefrontMapNode` add their layers to it. Shape helpers are in `mapShapes.ts`; the envelope helpers are in `traceShapes.ts`.
- **Map.** `MapProjection` is equirectangular, with a cos(latitude) aspect for regional maps.
  - The regional view frames the stations padded by the largest station distance. Every circle, and so the epicenter, is on the map, but the epicenter is not at its centre.
  - The world map puts its seam in the widest longitude gap between stations (`worldCenterLon`). Land and circles are drawn at −360°, 0° and +360°; point features are wrapped with `wrapLon`.
  - Regional maps draw 1:50m coastline inside the event's data box and 1:110m outside it (`outsideBoxShape` clip).
- **Accessibility.**
  - Every P/S marker and the epicenter marker is a focusable `div` with a `KeyboardListener`: arrows for coarse steps, Shift+arrows for fine steps. The first key press places an unplaced marker.
  - Markers announce their time and, once S–P exists, the distance, as object and context responses.
  - The screen summary's current details count the drawn circles.

## Data pipeline (`npm run build-data`)

- Needs network access and **Java** (for TauP). TauP 3.2.1 is downloaded into the git-ignored `.cache/`.
- `scripts/data/fdsn.ts` routes each network to its home data center (`DATA_CENTERS`): NC/BK → NCEDC, CI → SCEDC, everything else → EarthScope. The retired `irisws/timeseries` and `irisws/traveltime` services are not used.
- `scripts/data/miniseed.ts` reads SEED 2.4 records (Steim-1/2, int16/32, float32). It takes the record length from blockette 1000 and checks Steim's last-sample integrity.
- `scripts/data/dsp.ts` provides the zero-phase Butterworth bandpass and the decimation.
- Station selection, the SNR screen and the azimuth spread are in `scripts/data/buildEvent.ts`. The inputs are hand-edited in `scripts/data/events.json`.

## Known limitations

- The global records are decimated to 2 samples/s with a 1 Hz upper band edge, which equals the new Nyquist frequency. Block averaging softens the aliasing, and S onsets at teleseismic distances are dominated by energy well below 1 Hz.
- On Anchorage, the seam between the 1:50m and 1:110m coastlines is visible at the edge of the event's data box.
- The world map is equirectangular, so circles near the poles look large. An orthographic globe, as in PlateTectonics, would be truer but makes the drag target harder to use.
