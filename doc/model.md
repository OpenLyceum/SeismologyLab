# Model — Seismology Lab

Educator-facing description of what this simulation models, where every number comes from, and what it does not claim.

## Overview

An earthquake sends out two body waves. The compressional **P** wave is faster than the shear **S** wave, so the gap between their arrivals at a station, **S–P**, grows with distance from the source. A single station therefore gives a *distance*, not a direction. One circle of that radius around each station, and three or more circles meeting at a point, give the **epicenter**.

Students do the whole method on real records. They pick the first P onset and the first S onset on each seismogram, the sim converts each S–P interval into a distance circle, and the student drags a marker to where the circles meet. **Check** reports how far the marker is from the USGS epicenter, without saying where that is. **Reveal** shows the USGS epicenter, the theoretical arrivals on every trace, and the least-squares best fit of the student's own circles.

- **Waves** — any of the bundled earthquakes replayed in compressed time, before any picking. The P and S fronts spread from the epicenter, each station's record fills in as the clock passes, and a chart plots each arrival time against distance. Playback holds for 1.2 s each time the P wave reaches a station (this can be turned off).
- **Regional** — six stations 40–250 km from a crustal earthquake. Distance comes from constant crustal wave speeds.
- **Global** — six Global Seismograph Network stations 25–95° (2,800–10,500 km) from a great earthquake. Distance comes from the IASP91 travel-time curves.

## Quantities and units

| Quantity | Symbol | Units | Range / value |
|---|---|---|---|
| P-, S-arrival pick | t_P, t_S | s after origin time | within the record |
| S–P interval | Δt | s | > 0.1 |
| Crustal P speed (regional) | v_P | km/s | 5.0–8.0, default 6.1 |
| Crustal S speed (regional) | v_S | km/s | 2.8–4.6, default 3.5 |
| Epicentral distance | d, Δ | km, ° | 1° = 111.195 km |
| Event depth (global) | h | km | catalog value |
| Feedback thresholds | — | km | regional 25 / 75, global 300 / 800 |

## Governing equations

**Regional.** With uniform wave speeds, `t_S − t_P = d/v_S − d/v_P`, so

```
d = Δt · v_P·v_S / (v_P − v_S)        ≈ 8.2 km per second of S–P at the defaults
```

The defaults are textbook crustal averages. The rule is valid only while the direct crustal waves (Pg, Sg) arrive first. Beyond about 200–250 km the head waves refracted along the Moho (Pn, Sn) overtake them, and S–P grows by about 9.4 km per second instead. For that reason the bundled regional stations are limited to 250 km (see `scripts/data/events.json`).

**Global.** S–P is read off the IASP91 first-arrival P-family and S-family travel times. These were computed with TauP for distances 0–100° at depths 0, 33, 100, 300 and 600 km, and are interpolated bilinearly at the event's catalog depth. S–P increases monotonically with distance over 1–100°, so each S–P maps to one distance, found by bisection.

**Waves replay.** The clock runs in seconds after the origin time at 8× real time for regional events and 60× for global ones, times the Slow (¼), Normal or Fast (2×) setting. Both kinds of event use the IASP91 curves at the catalog depth for the fronts: each ring is drawn where the first P- or S-family arrival reaches the surface at that moment, found by bisection on the travel-time table. The P and S flags on each record are the station's TauP arrival times, so a ring meets a station when its flag appears. Interpolating the 1° table puts a front within about 7 km of a regional station, and 18 km for the 47 km deep Anchorage event. Past 100°, the edge of the table, a ring is no longer drawn. The rings mark where each wave *surfaces*: at teleseismic distances the wave got there through the mantle, not along the surface.

**Location.** The circles' best fit, `locateEpicenter`, minimizes Σ (great-circle distance to station − distance from S–P)² on the sphere. It uses Gauss–Newton with a numerical Jacobian, starting from a weighted station centroid and eight surrounding points so that it does not settle on the mirror solution of a three-station problem.

## Where the numbers come from

- **Origins** (time, latitude, longitude, depth, magnitude) come from USGS ComCat.
  - Regional: `ci38443183` Ridgecrest 2019 M6.4, `nc72282711` South Napa 2014 M6.0, `ak018fcnsk91` Anchorage 2018 M7.1, `ci15481673` La Habra 2014 M5.1, `us10006jxs` Pawnee 2016 M5.8, `pr2020007007` Puerto Rico 2020 M6.4, `nn00725272` Monte Cristo Range 2020 M6.5, `nc73821036` Ferndale 2022 M6.4, and `nc75095651` offshore Cape Mendocino 2024 M7.0.
  - Global: `official20110311054624120_30` Tōhoku 2011 M9.1, `us20002926` Gorkha 2015 M7.8, `official20100227063411530_30` Maule 2010 M8.8, `usb000h4jh` Sea of Okhotsk 2013 M8.3 (598 km deep), `us1000778i` Kaikōura 2016 M7.8, `us2000ahv0` Tehuantepec 2017 M8.2, `ak0219neiszm` Chignik 2021 M8.2, `us6000jllz` Kahramanmaraş 2023 M7.8, `us7000pn9s` Mandalay 2025 M7.7, and `us6000qw60` Kamchatka 2025 M8.8.
- **Waveforms** are raw miniSEED from FDSN `dataselect`: EarthScope for AK, GS, II, IU, N4, NN, OK and PR, NCEDC for BK and NC, and SCEDC for CI. Each record is processed in this order:
  1. divide by the station sensitivity (the station-service `Scale`), giving approximate ground velocity;
  2. demean, detrend and taper;
  3. apply a zero-phase 4th-order Butterworth bandpass: 0.5–8 Hz regional (0.3–5 Hz Anchorage), 0.02–1 Hz global;
  4. decimate to 20 samples/s regional and 2 samples/s global;
  5. normalize each station so the larger of its two components peaks at 1, then quantize to 16 bits.

  The display also rescales each trace to fill its row.
- **Stations** are chosen automatically. Candidates are rejected for gaps, clipping, or a signal-to-noise ratio below 3 in a window around the theoretical S. The survivors are picked to spread around the epicenter in azimuth.
- **Theoretical arrivals** (shown after Reveal, and used by the tests) are IASP91 times from TauP at the true distance and depth.

## Simplifications

- **Uniform crust (regional).** One v_P and one v_S for the whole path. Real crust is layered, so distances near 200 km run a few percent long or short.
- **Depth ignored (regional).** The rule gives the distance from the *hypocenter*, but the circle is drawn on the surface. For the 47 km deep Anchorage event this puts the nearest station's circle about 16 km too large. That is a useful discussion point: deep events make near circles overshoot.
- **Catalog depth (global).** The global screen uses the USGS depth rather than solving for it.
- **Instrument response not removed.** Traces are scaled by a single sensitivity, not deconvolved. Because the picks depend only on timing, this does not affect the exercise, but amplitudes are not true ground motion.
- **Epicentral circles.** Circles are drawn on the sphere, but on an equirectangular map. On the global screen they therefore look stretched, and loops near the poles look large.
- **First arrivals only.** Later phases (PP, SS, surface waves) are visible in the records and can be mistaken for S. Learning to tell them apart is part of the task.
