/**
 * WavefrontMapNode.ts
 *
 * The Waves screen's map: the shared station map plus the epicenter and two expanding
 * rings where the P wave (solid) and the S wave (dashed) are reaching the surface now.
 * A legend sits in a strip just below the map. A station gains a halo in its own color once the P wave has reached it, and the halo
 * thickens during the pause at that arrival.
 */
import { Circle, HBox, Line, Node, Path, Text } from "scenerystack/scenery";
import { StarShape } from "scenerystack/scenery-phet";
import type { SeismicEventSummary } from "../../common/data/dataTypes.js";
import { stationsByDistance } from "../../common/data/eventLibrary.js";
import { circleShape, lonOffsets } from "../../common/view/mapShapes.js";
import { SMALL_FONT } from "../../common/view/SeismologyLabFonts.js";
import { StationMapNode } from "../../common/view/StationMapNode.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import type { WavesModel } from "../model/WavesModel.js";

const HALO_RADIUS = 13;

export class WavefrontMapNode extends Node {
  public constructor(model: WavesModel, width: number, height: number) {
    super({ isDisposable: false });
    const waveStrings = StringManager.getInstance().getWavesViewStrings();
    const base = new StationMapNode(model.eventProperty, width, height);

    const pRing = new Path(null, { stroke: SeismologyLabColors.pWaveColorProperty, lineWidth: 2.5, pickable: false });
    const sRing = new Path(null, {
      stroke: SeismologyLabColors.sWaveColorProperty,
      lineWidth: 2.5,
      lineDash: [8, 5],
      pickable: false,
    });
    const haloLayer = new Node({ pickable: false });
    base.underStationsLayer.children = [pRing, sRing, haloLayer];

    const epicenter = new Path(new StarShape({ outerRadius: 10, innerRadius: 4.5 }), {
      fill: SeismologyLabColors.truthColorProperty,
      stroke: SeismologyLabColors.chartBackgroundColorProperty,
      pickable: false,
    });

    // ── Legend, in a strip under the map so it never hides a station ──────────
    const legendText = (string: typeof waveStrings.pFrontStringProperty) =>
      new Text(string, { font: SMALL_FONT, fill: SeismologyLabColors.textColorProperty, maxWidth: 110 });
    const legendItem = (sample: Node, string: typeof waveStrings.pFrontStringProperty) =>
      new HBox({ spacing: 6, children: [sample, legendText(string)] });
    const legend = new HBox({
      spacing: 22,
      pickable: false,
      children: [
        legendItem(
          new Line(0, 0, 22, 0, { stroke: SeismologyLabColors.pWaveColorProperty, lineWidth: 2.5 }),
          waveStrings.pFrontStringProperty,
        ),
        legendItem(
          new Line(0, 0, 22, 0, { stroke: SeismologyLabColors.sWaveColorProperty, lineWidth: 2.5, lineDash: [8, 5] }),
          waveStrings.sFrontStringProperty,
        ),
        legendItem(
          new Path(new StarShape({ outerRadius: 6, innerRadius: 2.7 }), {
            fill: SeismologyLabColors.truthColorProperty,
          }),
          waveStrings.epicenterStringProperty,
        ),
      ],
    });
    legend.boundsProperty.link(() => {
      legend.left = 2;
      legend.top = height + 5;
    });
    base.overlayLayer.children = [epicenter];
    this.children = [base, legend];

    // ── Per-event pieces ──────────────────────────────────────────────────────
    let halos: Circle[] = [];
    const updateHalos = () => {
      const time = model.timer.timeProperty.value;
      const holding = model.holdingProperty.value;
      model.stationsProperty.value.forEach((station, index) => {
        const halo = halos[index];
        if (halo) {
          const justArrived = holding && Math.abs(time - station.pTheoSeconds) < 1e-9;
          halo.visible = time >= station.pTheoSeconds;
          halo.lineWidth = justArrived ? 5 : 2;
          halo.radius = justArrived ? HALO_RADIUS + 4 : HALO_RADIUS;
        }
      });
    };
    const rebuild = (event: SeismicEventSummary) => {
      const projection = base.projectionFor(event);
      epicenter.translation = projection.toViewWrapped([event.lon, event.lat]);
      for (const halo of halos) {
        halo.dispose();
      }
      halos = stationsByDistance(event).map(
        (station, index) =>
          new Circle(HALO_RADIUS, {
            stroke: stationColorProperty(index),
            lineWidth: 2,
            translation: projection.toViewWrapped([station.lon, station.lat]),
          }),
      );
      haloLayer.children = halos;
      updateHalos();
    };
    model.eventProperty.link(rebuild);

    const ring = (path: Path, radiusKm: number | null) => {
      const event = model.eventProperty.value;
      path.visible = radiusKm !== null && radiusKm > 0;
      path.shape =
        radiusKm !== null && radiusKm > 0
          ? circleShape(
              [event.lon, event.lat],
              radiusKm,
              base.projectionFor(event),
              lonOffsets(event.kind === "global"),
            )
          : null;
    };
    model.pRadiusKmProperty.link((radius) => ring(pRing, radius));
    model.sRadiusKmProperty.link((radius) => ring(sRing, radius));

    model.timer.timeProperty.lazyLink(updateHalos);
    model.holdingProperty.lazyLink(updateHalos);
  }
}
