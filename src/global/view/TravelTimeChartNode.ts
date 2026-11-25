/**
 * TravelTimeChartNode.ts
 *
 * Global screen: the IASP91 first-arrival P and S travel times, and their difference
 * S–P, against epicentral distance at the event's catalog depth. Every station with
 * both picks draws a horizontal line at its S–P that meets the S–P curve, with a drop
 * line to the distance the sim reads off for that station.
 */
import { Multilink } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, LinePlot, TickLabelSet } from "scenerystack/bamboo";
import { Range, toFixed, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Node, Path, Text } from "scenerystack/scenery";
import type { SeismologyLabModel } from "../../common/model/SeismologyLabModel.js";
import { SMALL_FONT, TICK_FONT } from "../../common/view/SeismologyLabFonts.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import { KM_PER_DEGREE } from "../../SeismologyLabConstants.js";

const MAX_DISTANCE_DEG = 100;
const MAX_MINUTES = 30;

export class TravelTimeChartNode extends Node {
  public constructor(model: SeismologyLabModel, width: number, height: number) {
    super({ isDisposable: false });
    const strings = StringManager.getInstance().getViewStrings();
    const leftMargin = 30;
    const bottomMargin = 30;
    const transform = new ChartTransform({
      viewWidth: width - leftMargin - 8,
      viewHeight: height - bottomMargin - 6,
      modelXRange: new Range(0, MAX_DISTANCE_DEG),
      modelYRange: new Range(0, MAX_MINUTES),
    });
    const background = new ChartRectangle(transform, {
      fill: SeismologyLabColors.chartBackgroundColorProperty,
      stroke: SeismologyLabColors.chartStrokeColorProperty,
    });
    const gridX = new GridLineSet(transform, Orientation.HORIZONTAL, 20, {
      stroke: SeismologyLabColors.chartGridColorProperty,
    });
    const gridY = new GridLineSet(transform, Orientation.VERTICAL, 5, {
      stroke: SeismologyLabColors.chartGridColorProperty,
    });
    const tickLabel = (value: number) =>
      new Text(toFixed(value, 0), { font: TICK_FONT, fill: SeismologyLabColors.textColorProperty });
    const labelsX = new TickLabelSet(transform, Orientation.HORIZONTAL, 20, { edge: "min", createLabel: tickLabel });
    const labelsY = new TickLabelSet(transform, Orientation.VERTICAL, 10, { edge: "min", createLabel: tickLabel });

    const pPlot = new LinePlot(transform, [], { stroke: SeismologyLabColors.pWaveColorProperty, lineWidth: 2 });
    const sPlot = new LinePlot(transform, [], { stroke: SeismologyLabColors.sWaveColorProperty, lineWidth: 2 });
    const sMinusPPlot = new LinePlot(transform, [], {
      stroke: SeismologyLabColors.accentColorProperty,
      lineWidth: 2,
      lineDash: [6, 3],
    });
    const curveLabel = (
      string: typeof strings.pCurveStringProperty,
      fill: typeof SeismologyLabColors.pWaveColorProperty,
    ) => new Text(string, { font: SMALL_FONT, fill, maxWidth: 40 });
    const pLabel = curveLabel(strings.pCurveStringProperty, SeismologyLabColors.pWaveColorProperty);
    const sLabel = curveLabel(strings.sCurveStringProperty, SeismologyLabColors.sWaveColorProperty);
    const sMinusPLabel = curveLabel(strings.sMinusPCurveStringProperty, SeismologyLabColors.accentColorProperty);
    const stationLines = new Node();

    const plotLayer = new Node({
      clipArea: Shape.rectangle(0, 0, transform.viewWidth, transform.viewHeight),
      children: [gridX, gridY, stationLines, pPlot, sPlot, sMinusPPlot],
    });
    const axisX = new Text(strings.travelTimeDistanceStringProperty, {
      font: TICK_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      maxWidth: transform.viewWidth,
    });
    const axisY = new Text(strings.travelTimeMinutesStringProperty, {
      font: TICK_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      rotation: -Math.PI / 2,
      maxWidth: transform.viewHeight,
    });
    const chart = new Node({
      x: leftMargin,
      y: 4,
      children: [background, plotLayer, labelsX, labelsY, pLabel, sLabel, sMinusPLabel],
    });
    axisX.centerX = chart.x + transform.viewWidth / 2;
    axisX.top = chart.y + transform.viewHeight + 14;
    axisY.centerY = chart.y + transform.viewHeight / 2;
    axisY.left = 0;
    this.children = [chart, axisX, axisY];

    const curveAt = (depthKm: number, time: (distance: number, depth: number) => number) => {
      const points: (Vector2 | null)[] = [];
      for (let distance = 1; distance <= MAX_DISTANCE_DEG; distance += 0.5) {
        const minutes = time(distance, depthKm) / 60;
        points.push(Number.isFinite(minutes) ? new Vector2(distance, minutes) : null);
      }
      return points;
    };
    const placeLabel = (label: Text, points: (Vector2 | null)[], below = false) => {
      const last = points.filter((point): point is Vector2 => point !== null).at(-1);
      if (last) {
        label.right = transform.modelToViewX(last.x) - 4;
        if (below) {
          label.top = transform.modelToViewY(last.y) + 3;
        } else {
          label.bottom = transform.modelToViewY(last.y) - 2;
        }
      }
    };

    model.eventProperty.link((event) => {
      const { curve } = model;
      const p = curveAt(event.depthKm, (d, z) => curve.pTime(d, z));
      const s = curveAt(event.depthKm, (d, z) => curve.sTime(d, z));
      const sMinusP = curveAt(event.depthKm, (d, z) => curve.sMinusP(d, z));
      pPlot.setDataSet(p);
      sPlot.setDataSet(s);
      sMinusPPlot.setDataSet(sMinusP);
      placeLabel(pLabel, p);
      placeLabel(sLabel, s);
      placeLabel(sMinusPLabel, sMinusP, true);
    });

    // Station read-off lines, rebuilt when the stations or any of their distances change.
    let unlinkStations: () => void = () => undefined;
    model.stationsProperty.link((records) => {
      unlinkStations();
      const paths = records.map(
        (_record, index) => new Path(null, { stroke: stationColorProperty(index), lineWidth: 1.5 }),
      );
      stationLines.children = paths;
      const links = records.map((record, index) =>
        Multilink.multilink([record.sMinusPProperty, record.distanceKmProperty], (interval, distanceKm) => {
          const path = paths[index];
          if (!path) {
            return;
          }
          if (interval === null || distanceKm === null) {
            path.shape = null;
            return;
          }
          const x = transform.modelToViewX(distanceKm / KM_PER_DEGREE);
          const y = transform.modelToViewY(interval / 60);
          path.shape = new Shape().moveTo(0, y).lineTo(x, y).lineTo(x, transform.viewHeight);
        }),
      );
      unlinkStations = () => {
        for (const link of links) {
          link.dispose();
        }
        for (const path of paths) {
          path.dispose();
        }
      };
    });
  }
}
