/**
 * ArrivalChartNode.ts
 *
 * Arrival time against distance, built up during the replay: a P dot and then an S dot
 * appear for each station as the waves reach it, joined by a bar in the station's
 * color. A horizontal line marks the current time, so each dot appears as the line
 * reaches it. The bars lengthen with distance: S–P grows the farther the station is.
 */
import { ChartRectangle, ChartTransform, GridLineSet, TickLabelSet } from "scenerystack/bamboo";
import { Range, toFixed } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Circle, Line, Node, Text } from "scenerystack/scenery";
import type { SeismicEventSummary } from "../../common/data/dataTypes.js";
import { stationsByDistance } from "../../common/data/eventLibrary.js";
import { niceTimeSpacing } from "../../common/view/format.js";
import { SMALL_FONT, TICK_FONT } from "../../common/view/SeismologyLabFonts.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import { KM_PER_DEGREE } from "../../SeismologyLabConstants.js";
import type { WavesModel } from "../model/WavesModel.js";

const LEFT_MARGIN = 40;
const BOTTOM_MARGIN = 30;
const TOP_MARGIN = 20;

/** A round axis maximum a little beyond `value`, with its tick spacing. */
function niceAxis(value: number): { max: number; spacing: number } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const spacing = steps.find((step) => value / step <= 5) ?? 5000;
  return { max: Math.ceil((value * 1.08) / spacing) * spacing, spacing };
}

type StationMarks = { pDot: Circle; sDot: Circle; bar: Line; pSeconds: number; sSeconds: number };

export class ArrivalChartNode extends Node {
  public constructor(model: WavesModel, width: number, height: number) {
    super({ isDisposable: false });
    const strings = StringManager.getInstance().getWavesViewStrings();
    const transform = new ChartTransform({
      viewWidth: width - LEFT_MARGIN - 8,
      viewHeight: height - BOTTOM_MARGIN - TOP_MARGIN,
      modelXRange: new Range(0, 1),
      modelYRange: new Range(0, 1),
    });
    const background = new ChartRectangle(transform, {
      fill: SeismologyLabColors.chartBackgroundColorProperty,
      stroke: SeismologyLabColors.chartStrokeColorProperty,
    });
    const gridX = new GridLineSet(transform, Orientation.HORIZONTAL, 1, {
      stroke: SeismologyLabColors.chartGridColorProperty,
    });
    const gridY = new GridLineSet(transform, Orientation.VERTICAL, 1, {
      stroke: SeismologyLabColors.chartGridColorProperty,
    });
    const tickLabel = (value: number) =>
      new Text(toFixed(value, 0), { font: TICK_FONT, fill: SeismologyLabColors.textColorProperty });
    const labelsX = new TickLabelSet(transform, Orientation.HORIZONTAL, 1, { edge: "min", createLabel: tickLabel });
    const labelsY = new TickLabelSet(transform, Orientation.VERTICAL, 1, { edge: "min", createLabel: tickLabel });
    const nowLine = new Line(0, 0, transform.viewWidth, 0, {
      stroke: SeismologyLabColors.timeCursorColorProperty,
      lineWidth: 1.5,
      lineDash: [4, 3],
    });
    const markLayer = new Node();
    const plotLayer = new Node({
      clipArea: Shape.rectangle(-6, -6, transform.viewWidth + 12, transform.viewHeight + 12),
      children: [gridX, gridY, nowLine, markLayer],
    });
    const title = new Text(strings.arrivalChartTitleStringProperty, {
      font: SMALL_FONT,
      fill: SeismologyLabColors.textColorProperty,
      maxWidth: transform.viewWidth,
    });
    const axisX = new Text("", {
      font: TICK_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      maxWidth: transform.viewWidth,
    });
    const axisY = new Text(strings.arrivalChartTimeStringProperty, {
      font: TICK_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      rotation: -Math.PI / 2,
      maxWidth: transform.viewHeight,
    });
    const chart = new Node({
      x: LEFT_MARGIN,
      y: TOP_MARGIN,
      children: [background, plotLayer, labelsX, labelsY],
    });
    this.children = [chart, title, axisX, axisY];

    let marks: StationMarks[] = [];
    const update = () => {
      const time = model.timer.timeProperty.value;
      const yRange = transform.modelYRange;
      nowLine.visible = time >= yRange.min && time <= yRange.max;
      nowLine.y = transform.modelToViewY(Math.min(Math.max(time, yRange.min), yRange.max));
      for (const { pDot, sDot, bar, pSeconds, sSeconds } of marks) {
        pDot.visible = time >= pSeconds;
        sDot.visible = time >= sSeconds;
        bar.visible = time >= pSeconds;
        bar.setPoint2(bar.x1, transform.modelToViewY(Math.min(time, sSeconds)));
      }
    };

    const rebuild = (event: SeismicEventSummary) => {
      const isGlobal = event.kind === "global";
      const stations = stationsByDistance(event);
      const toX = (km: number) => (isGlobal ? km / KM_PER_DEGREE : km);
      const xAxis = niceAxis(Math.max(...stations.map(({ distanceKm }) => toX(distanceKm))));
      const yAxis = niceAxis(Math.max(...stations.map(({ sTheoSeconds }) => sTheoSeconds)));
      transform.setModelXRange(new Range(0, xAxis.max));
      transform.setModelYRange(new Range(0, yAxis.max));
      for (const set of [gridX, labelsX]) {
        set.setSpacing(xAxis.spacing);
      }
      const ySpacing = Math.max(yAxis.spacing, niceTimeSpacing(yAxis.max, 5));
      for (const set of [gridY, labelsY]) {
        set.setSpacing(ySpacing);
      }
      axisX.string = isGlobal
        ? strings.arrivalChartDegreesStringProperty.value
        : strings.arrivalChartKmStringProperty.value;

      for (const child of markLayer.children) {
        child.dispose();
      }
      marks = stations.map((station, index) => {
        const x = transform.modelToViewX(toX(station.distanceKm));
        const pY = transform.modelToViewY(station.pTheoSeconds);
        const bar = new Line(x, pY, x, pY, { stroke: stationColorProperty(index), lineWidth: 3 });
        const pDot = new Circle(4.5, {
          fill: SeismologyLabColors.pWaveColorProperty,
          stroke: SeismologyLabColors.chartBackgroundColorProperty,
          x,
          y: pY,
        });
        const sDot = new Circle(4.5, {
          fill: SeismologyLabColors.sWaveColorProperty,
          stroke: SeismologyLabColors.chartBackgroundColorProperty,
          x,
          y: transform.modelToViewY(station.sTheoSeconds),
        });
        return { pDot, sDot, bar, pSeconds: station.pTheoSeconds, sSeconds: station.sTheoSeconds };
      });
      markLayer.children = marks.flatMap(({ bar, pDot, sDot }) => [bar, pDot, sDot]);

      title.left = LEFT_MARGIN;
      title.bottom = TOP_MARGIN - 4;
      axisX.centerX = LEFT_MARGIN + transform.viewWidth / 2;
      axisX.bottom = height;
      axisY.centerX = 9;
      axisY.centerY = TOP_MARGIN + transform.viewHeight / 2;
      update();
    };
    model.eventProperty.link(rebuild);
    model.timer.timeProperty.lazyLink(update);
    // The axis title follows the locale as well as the event.
    for (const property of [strings.arrivalChartKmStringProperty, strings.arrivalChartDegreesStringProperty]) {
      property.lazyLink(() => rebuild(model.eventProperty.value));
    }
  }
}
