/**
 * ArrivalTraceStackNode.ts
 *
 * The Waves screen's seismograms: one row per station, nearest first, sharing a time
 * axis from the origin time to the end of the replay. Each record is drawn only up to
 * the current time, so it fills in as the clock sweeps across. When a wave reaches a
 * station its P or S flag appears, and once both have arrived the S–P gap is shaded.
 */
import { DerivedProperty, Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Line, Node, Path, Rectangle, type TColor, Text } from "scenerystack/scenery";
import type { SeismicEventData, StationData } from "../../common/data/dataTypes.js";
import { stationsByDistance } from "../../common/data/eventLibrary.js";
import { decodeSamples } from "../../common/model/decodeSamples.js";
import { formatDegrees, formatKm, formatSeconds, niceTimeSpacing } from "../../common/view/format.js";
import { ROW_PITCH } from "../../common/view/SeismogramRowNode.js";
import { BOLD_LABEL_FONT, SMALL_FONT, TICK_FONT } from "../../common/view/SeismologyLabFonts.js";
import { type ColumnEnvelope, columnEnvelope, envelopePath, peakOf } from "../../common/view/traceShapes.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import { KM_PER_DEGREE, STACK } from "../../SeismologyLabConstants.js";
import type { WavesModel } from "../model/WavesModel.js";

const CHART_X = STACK.LABEL_WIDTH + STACK.TRAY_WIDTH;
const Y_RANGE = new Range(-1.08, 1.08);

/** The replay's time axis: from the origin (or the record start, if earlier) to the replay's end. */
function timeWindow(event: SeismicEventData, endSeconds: number): Range {
  const start = Math.min(0, ...event.stations.map(({ startSeconds }) => startSeconds));
  return new Range(start, endSeconds);
}

export class ArrivalTraceRowNode extends Node {
  private readonly disposeRow: () => void;

  public constructor(
    station: StationData,
    isGlobal: boolean,
    window: Range,
    timeProperty: TReadOnlyProperty<number>,
    color: TColor,
  ) {
    super();
    const viewStrings = StringManager.getInstance().getViewStrings();
    const transform = new ChartTransform({
      viewWidth: STACK.CHART_WIDTH,
      viewHeight: STACK.CHART_HEIGHT,
      modelXRange: window,
      modelYRange: Y_RANGE,
    });

    // ── Label column: station and distance ────────────────────────────────────
    const nameText = new Text(`${station.network}.${station.code}`, {
      font: BOLD_LABEL_FONT,
      fill: color,
      maxWidth: CHART_X - 6,
      top: 8,
    });
    const distanceText = new Text(
      isGlobal ? `${formatDegrees(station.distanceKm / KM_PER_DEGREE)}°` : `${formatKm(station.distanceKm)} km`,
      { font: SMALL_FONT, fill: SeismologyLabColors.mutedTextColorProperty, top: nameText.bottom + 2 },
    );

    // ── Chart ─────────────────────────────────────────────────────────────────
    const background = new ChartRectangle(transform, {
      fill: SeismologyLabColors.chartBackgroundColorProperty,
      stroke: SeismologyLabColors.chartStrokeColorProperty,
    });
    const grid = new GridLineSet(transform, Orientation.HORIZONTAL, niceTimeSpacing(window.getLength()), {
      stroke: SeismologyLabColors.chartGridColorProperty,
    });
    const pX = transform.modelToViewX(station.pTheoSeconds);
    const sX = transform.modelToViewX(station.sTheoSeconds);
    const band = new Rectangle(pX, 0, sX - pX, STACK.CHART_HEIGHT, {
      fill: SeismologyLabColors.sMinusPBandColorProperty,
    });
    const bandLabel = new Text(viewStrings.waves.sMinusPGapStringProperty, {
      font: TICK_FONT,
      fill: SeismologyLabColors.textColorProperty,
      maxWidth: Math.max(10, sX - pX - 4),
      bottom: STACK.CHART_HEIGHT - 2,
    });
    bandLabel.centerX = (pX + sX) / 2;
    const flag = (x: number, label: TReadOnlyProperty<string>, stroke: TColor) =>
      new Node({
        children: [
          new Line(x, 0, x, STACK.CHART_HEIGHT, { stroke, lineWidth: 2 }),
          new Text(label, { font: BOLD_LABEL_FONT, fill: stroke, left: x + 3, top: 1, maxWidth: 20 }),
        ],
      });
    const pFlag = flag(pX, viewStrings.pMarkerStringProperty, SeismologyLabColors.pWaveColorProperty);
    const sFlag = flag(sX, viewStrings.sMarkerStringProperty, SeismologyLabColors.sWaveColorProperty);
    const trace = new Path(null, { stroke: SeismologyLabColors.traceColorProperty, lineWidth: 1 });
    const plotLayer = new Node({
      clipArea: Shape.rectangle(0, 0, STACK.CHART_WIDTH, STACK.CHART_HEIGHT),
      children: [grid, band, bandLabel, trace, pFlag, sFlag],
    });
    const chart = new Node({ x: CHART_X, children: [background, plotLayer] });
    this.children = [nameText, distanceText, chart];

    // ── Fill in as time passes ────────────────────────────────────────────────
    const samples = decodeSamples(station.vertical);
    const envelope: ColumnEnvelope = columnEnvelope(
      samples,
      station.sampleRate,
      station.startSeconds,
      window,
      STACK.CHART_WIDTH,
      peakOf(samples),
    );
    const toViewY = (value: number) => transform.modelToViewY(value);
    let drawnColumns = -1;
    const update = (time: number) => {
      const columns = Math.max(0, Math.min(STACK.CHART_WIDTH, Math.ceil(transform.modelToViewX(time))));
      if (columns !== drawnColumns) {
        drawnColumns = columns;
        trace.shape = envelopePath(envelope, toViewY, columns);
      }
      const pArrived = time >= station.pTheoSeconds;
      const sArrived = time >= station.sTheoSeconds;
      pFlag.visible = pArrived;
      sFlag.visible = sArrived;
      band.visible = sArrived;
      bandLabel.visible = sArrived && bandLabel.width < sX - pX;
      nameText.opacity = pArrived ? 1 : 0.55;
    };
    timeProperty.link(update);
    this.disposeRow = () => timeProperty.unlink(update);
  }

  public override dispose(): void {
    this.disposeRow();
    super.dispose();
  }
}

export class ArrivalTraceStackNode extends Node {
  private readonly rowLayer = new Node();
  private rows: ArrivalTraceRowNode[] = [];

  public constructor(model: WavesModel) {
    super({ isDisposable: false, x: STACK.X, y: STACK.Y });
    const viewStrings = StringManager.getInstance().getViewStrings();
    const timeProperty = model.timer.timeProperty;

    // ── Shared time axis, placed under the last row ───────────────────────────
    const axisTransform = new ChartTransform({
      viewWidth: STACK.CHART_WIDTH,
      viewHeight: 1,
      modelXRange: new Range(0, 1),
      modelYRange: new Range(0, 1),
    });
    const tickMarks = new TickMarkSet(axisTransform, Orientation.HORIZONTAL, 10, {
      edge: "min",
      stroke: SeismologyLabColors.mutedTextColorProperty,
    });
    const tickLabels = new TickLabelSet(axisTransform, Orientation.HORIZONTAL, 10, {
      edge: "min",
      createLabel: (value: number) =>
        new Text(formatSeconds(value, Number.isInteger(value)), {
          font: TICK_FONT,
          fill: SeismologyLabColors.textColorProperty,
        }),
    });
    const axisTitle = new Text(viewStrings.timeAxisStringProperty, {
      font: SMALL_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      maxWidth: STACK.CHART_WIDTH,
    });
    const axis = new Node({ x: CHART_X, children: [tickMarks, tickLabels, axisTitle] });

    // ── Time cursor across every row ──────────────────────────────────────────
    const cursor = new Line(0, -4, 0, 0, {
      stroke: SeismologyLabColors.timeCursorColorProperty,
      lineWidth: 1.5,
      pickable: false,
    });

    // ── Loading / failure message ─────────────────────────────────────────────
    const statusProperty = new DerivedProperty(
      [
        model.loadingProperty,
        model.loadFailedProperty,
        viewStrings.loadingStringProperty,
        viewStrings.loadFailedStringProperty,
      ],
      (loading, failed, loadingText, failedText) => (failed ? failedText : loading ? loadingText : ""),
    );
    const status = new Text(statusProperty, {
      font: BOLD_LABEL_FONT,
      fill: SeismologyLabColors.textColorProperty,
      maxWidth: STACK.CHART_WIDTH,
    });
    statusProperty.link(() => {
      status.centerX = CHART_X + STACK.CHART_WIDTH / 2;
      status.centerY = (6 * ROW_PITCH) / 2;
    });

    this.children = [this.rowLayer, axis, cursor, status];

    let window = new Range(0, 1);
    const placeCursor = () => {
      const time = Math.min(Math.max(timeProperty.value, window.min), window.max);
      cursor.x = CHART_X + axisTransform.modelToViewX(time);
    };
    Multilink.multilink([model.eventDataProperty, model.endSecondsProperty], (event, end) => {
      const old = this.rows;
      window = event ? timeWindow(event, end) : new Range(0, end);
      this.rows = event
        ? stationsByDistance(event).map((station, index) => {
            const row = new ArrivalTraceRowNode(
              station,
              event.kind === "global",
              window,
              timeProperty,
              stationColorProperty(index),
            );
            row.y = index * ROW_PITCH;
            return row;
          })
        : [];
      this.rowLayer.children = this.rows;
      for (const row of old) {
        row.dispose();
      }
      const bottom = Math.max(1, model.stationsProperty.value.length) * ROW_PITCH - STACK.ROW_SPACING;
      axisTransform.setModelXRange(window.copy());
      const spacing = niceTimeSpacing(window.getLength());
      tickMarks.setSpacing(spacing);
      tickLabels.setSpacing(spacing);
      axis.y = bottom;
      axisTitle.centerX = STACK.CHART_WIDTH / 2;
      axisTitle.top = 16;
      cursor.setLine(0, -4, 0, bottom + 4);
      cursor.visible = event !== null;
      placeCursor();
    });
    timeProperty.link(placeCursor);
  }
}
