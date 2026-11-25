# AGENTS.md — Seismology Lab

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

Students locate an earthquake's epicenter from P–S arrival-time differences on **real seismograms**. `src/main.ts` registers two screens:

- **Regional** — six stations 40–250 km from a crustal earthquake; S–P → distance with constant crustal speeds (vP, vS adjustable).
- **Global** — six GSN stations 25–95° away from a great earthquake; S–P → distance from IASP91 travel-time curves.

The student drags (or arrow-keys) P and S markers on each trace. Each S–P draws a distance circle on the map, and the student places the epicenter marker. **Check** reports the miss distance only. **Reveal** shows the USGS epicenter, the theoretical arrivals and the circles' least-squares best fit.

Physics, data provenance and non-claims are in [`doc/model.md`](doc/model.md). Architecture is in [`doc/implementation-notes.md`](doc/implementation-notes.md). Check any change that affects a number against those docs.

## Key files

| File | Purpose |
|---|---|
| `src/SeismologyLabColors.ts` | All `ProfileColorProperty` instances, incl. the six-color station palette |
| `src/SeismologyLabConstants.ts` | Layout, wave-speed defaults, feedback thresholds, keyboard steps |
| `src/SeismologyLabNamespace.ts` | Namespace for color property names |
| `src/i18n/StringManager.ts` | Singleton localized string accessor (`getViewStrings`, `getControlA11yStrings`) |
| `src/common/data/dataTypes.ts` | Shapes of the bundled data (hand-written) |
| `src/common/data/generated/` | **Generated — do not edit.** `npm run build-data` owns it |
| `src/common/model/SeismologyLabModel.ts` | Per-screen state: event, stations, picks, guess, check/reveal |
| `src/common/model/StationRecord.ts` | One station's samples, P/S picks, S–P and distance |
| `src/common/model/DistanceModel.ts` | Regional (constant speeds) vs global (IASP91) S–P → distance |
| `src/common/model/DistanceRule.ts` | `d = Δt·vP·vS/(vP − vS)` and its inverse |
| `src/common/model/TravelTimeCurve.ts` | IASP91 table interpolation and S–P inversion |
| `src/common/model/locateEpicenter.ts` | Least-squares epicenter on the sphere |
| `src/common/model/geodesy.ts` | Great-circle distance, destination point, small circles |
| `src/common/view/LabScreenLayout.ts` | Shared layout and parallel-DOM order for both screens |
| `src/common/view/SeismogramStackNode.ts` | Rows, shared time axis, zoom / pan / fit |
| `src/common/view/SeismogramRowNode.ts` | One trace (min/max envelope), readout, theoretical ticks |
| `src/common/view/PickMarkerNode.ts` | Draggable / keyboard P or S marker |
| `src/common/view/EpicenterMapNode.ts` | Map, circles, epicenter marker, reveal overlay |
| `src/common/view/MapProjection.ts` | Equirectangular projection, regional framing, world seam |
| `src/common/view/CheckPanel.ts` | Check / Reveal and feedback |
| `src/regional/view/WaveSpeedPanel.ts` | vP / vS controls |
| `src/global/view/TravelTimeChartNode.ts` | P, S, S–P curves with per-station read-off lines |
| `scripts/build-data.ts` | Fetches and reshapes every dataset |
| `scripts/data/events.json` | Hand-edited event list, networks, distance bands, filters |
| `scripts/data/{fdsn,miniseed,dsp,taup,buildEvent}.ts` | FDSN routing, SEED reader, filters, TauP wrapper, station selection |

## Data

- `npm run build-data` needs network access and Java (TauP 3.2.1 is downloaded into `.cache/`). Downloads are cached; delete `.cache/data/` to refresh.
- `irisws/timeseries` and `irisws/traveltime` are **retired**. Use FDSN `dataselect` + `station`, routed per network (NC/BK → NCEDC, CI → SCEDC, the rest → EarthScope).
- Regional stations are capped at 250 km on purpose. Beyond that Pn/Sn arrive first and the constant-speed rule underestimates distance by 35–80 km. `tests/eventData.test.ts` checks that answer-key picks relocate every event within 30 km (regional) or 250 km (global).

## Compliance carve-outs

None.
