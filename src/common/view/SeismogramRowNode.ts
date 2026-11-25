/**
 * SeismogramRowNode.ts
 *
 * One station's record: its label, a min/max envelope of the selected component on a
 * bamboo chart sharing the stack's time window, the P and S pick markers, the S–P →
 * distance readout and, after reveal, the theoretical IASP91 arrival ticks.
 */
import { DerivedProperty, Multilink, PatternStringProperty } from "scenerystack/axon";
import { ChartRectangle, ChartTransform, GridLineSet } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { Line, Node, Path, Rectangle, type TColor, Text } from "scenerystack/scenery";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors from "../../SeismologyLabColors.js";
import { KM_PER_DEGREE, PICK_KEYBOARD_STEP_SECONDS, STACK } from "../../SeismologyLabConstants.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import type { StationRecord } from "../model/StationRecord.js";
import { fillPattern, formatDegrees, formatKm, formatSeconds, niceTimeSpacing } from "./format.js";
import { PickMarkerNode } from "./PickMarkerNode.js";
import { BOLD_LABEL_FONT, SMALL_FONT } from "./SeismologyLabFonts.js";

/** Largest |sample| in a channel, so each trace fills its row. */
function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
  }
  return peak > 0 ? peak : 1;
}

/** Min/max envelope per pixel column, so long records draw quickly at any zoom. */
function envelopeShape(
  samples: Float32Array,
  sampleRate: number,
  startSeconds: number,
  window: Range,
  transform: ChartTransform,
  peak: number,
): Shape {
  const shape = new Shape();
  const columns = STACK.CHART_WIDTH;
  const secondsPerColumn = window.getLength() / columns;
  let started = false;
  for (let column = 0; column < columns; column++) {
    const t0 = window.min + column * secondsPerColumn;
    const first = Math.max(0, Math.floor((t0 - startSeconds) * sampleRate));
    const last = Math.min(samples.length - 1, Math.ceil((t0 + secondsPerColumn - startSeconds) * sampleRate));
    if (last < 0 || first > samples.length - 1 || last < first) {
      continue;
    }
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let index = first; index <= last; index++) {
      const value = (samples[index] ?? 0) / peak;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    const yLow = transform.modelToViewY(low);
    const yHigh = transform.modelToViewY(high);
    if (started) {
      shape.lineTo(column, yHigh);
    } else {
      shape.moveTo(column, yHigh);
      started = true;
    }
    shape.lineTo(column, yLow);
  }
  return shape;
}

export class SeismogramRowNode extends Node {
  private readonly disposeRow: () => void;

  public constructor(record: StationRecord, model: SeismologyLabModel, color: TColor) {
    super();
    const viewStrings = StringManager.getInstance().getViewStrings();
    const a11yStrings = StringManager.getInstance().getControlA11yStrings();
    const isGlobal = model.kind === "global";
    const { data } = record;
    const stationName = `${data.network}.${data.code}`;

    // ── Label column ──────────────────────────────────────────────────────────
    const nameText = new Text(stationName, {
      font: BOLD_LABEL_FONT,
      fill: color,
      maxWidth: STACK.LABEL_WIDTH - 4,
    });
    const channelText = new Text("", { font: SMALL_FONT, fill: SeismologyLabColors.mutedTextColorProperty });
    const label = new Node({ children: [nameText, channelText] });
    nameText.left = 0;
    nameText.top = 8;

    // ── Chart ─────────────────────────────────────────────────────────────────
    const chartX = STACK.LABEL_WIDTH + STACK.TRAY_WIDTH;
    const transform = new ChartTransform({
      viewWidth: STACK.CHART_WIDTH,
      viewHeight: STACK.CHART_HEIGHT,
      modelXRange: model.timeWindowProperty.value.copy(),
      modelYRange: new Range(-1.08, 1.08),
    });
    const background = new ChartRectangle(transform, {
      fill: SeismologyLabColors.chartBackgroundColorProperty,
      stroke: SeismologyLabColors.chartStrokeColorProperty,
    });
    const grid = new GridLineSet(
      transform,
      Orientation.HORIZONTAL,
      niceTimeSpacing(transform.modelXRange.getLength()),
      {
        stroke: SeismologyLabColors.chartGridColorProperty,
      },
    );
    const trace = new Path(null, { stroke: SeismologyLabColors.traceColorProperty, lineWidth: 1 });
    const theoreticalP = new Line(0, 0, 0, STACK.CHART_HEIGHT, {
      stroke: SeismologyLabColors.pWaveColorProperty,
      lineDash: [4, 3],
      lineWidth: 1.5,
    });
    const theoreticalS = new Line(0, 0, 0, STACK.CHART_HEIGHT, {
      stroke: SeismologyLabColors.sWaveColorProperty,
      lineDash: [4, 3],
      lineWidth: 1.5,
    });
    const plotLayer = new Node({
      clipArea: Shape.rectangle(0, 0, STACK.CHART_WIDTH, STACK.CHART_HEIGHT),
      children: [grid, trace, theoreticalP, theoreticalS],
    });

    // ── Readout ───────────────────────────────────────────────────────────────
    const readoutProperty = new DerivedProperty(
      [
        record.sMinusPProperty,
        record.distanceKmProperty,
        viewStrings.readoutEmptyStringProperty,
        viewStrings.readoutRegionalStringProperty,
        viewStrings.readoutGlobalStringProperty,
        viewStrings.readoutInvalidStringProperty,
      ],
      (interval, distance, empty, regional, global, invalid) => {
        if (interval === null) {
          return empty;
        }
        const seconds = formatSeconds(interval, isGlobal);
        if (distance === null) {
          return fillPattern(invalid, { interval: seconds });
        }
        return isGlobal
          ? fillPattern(global, {
              interval: seconds,
              degrees: formatDegrees(distance / KM_PER_DEGREE),
              distance: formatKm(distance),
            })
          : fillPattern(regional, { interval: seconds, distance: formatKm(distance) });
      },
    );
    const readoutText = new Text(readoutProperty, {
      font: SMALL_FONT,
      fill: SeismologyLabColors.textColorProperty,
      maxWidth: 200,
    });
    const readoutBackground = new Rectangle(0, 0, 1, 1, 3, 3, {
      fill: SeismologyLabColors.readoutBackgroundColorProperty,
    });
    const readout = new Node({ children: [readoutBackground, readoutText], pickable: false });
    const layoutReadout = () => {
      readoutBackground.setRect(0, 0, readoutText.width + 8, readoutText.height + 2);
      readoutText.left = 4;
      readoutText.top = 1;
      readout.right = STACK.CHART_WIDTH - 4;
      readout.top = 3;
    };
    readoutText.boundsProperty.link(layoutReadout);

    // ── Markers ───────────────────────────────────────────────────────────────
    const recordRange = new Range(data.startSeconds, data.startSeconds + record.vertical.length / data.sampleRate);
    const steps = PICK_KEYBOARD_STEP_SECONDS[model.kind];
    const pNameProperty = new PatternStringProperty(a11yStrings.pMarkerStringProperty, { station: stationName });
    const sNameProperty = new PatternStringProperty(a11yStrings.sMarkerStringProperty, { station: stationName });

    const announce = (marker: Node, time: number | null) => {
      if (time !== null) {
        marker.addAccessibleObjectResponse(
          fillPattern(a11yStrings.markerValueStringProperty.value, { time: formatSeconds(time, isGlobal) }),
        );
      }
      const interval = record.sMinusPProperty.value;
      const distance = record.distanceKmProperty.value;
      if (interval !== null && distance !== null) {
        marker.addAccessibleContextResponse(
          fillPattern(a11yStrings.distanceResponseStringProperty.value, {
            interval: formatSeconds(interval, isGlobal),
            station: stationName,
            distance: formatKm(distance),
          }),
        );
      }
    };
    const pMarker: PickMarkerNode = new PickMarkerNode({
      kind: "p",
      pickProperty: record.pPickProperty,
      otherPickProperty: record.sPickProperty,
      transform,
      recordRange,
      windowProperty: model.timeWindowProperty,
      steps,
      color: SeismologyLabColors.pWaveColorProperty,
      label: viewStrings.pMarkerStringProperty,
      accessibleName: pNameProperty,
      accessibleHelpText: a11yStrings.markerHelpStringProperty,
      onUserMove: () => announce(pMarker, record.pPickProperty.value),
    });
    const sMarker: PickMarkerNode = new PickMarkerNode({
      kind: "s",
      pickProperty: record.sPickProperty,
      otherPickProperty: record.pPickProperty,
      transform,
      recordRange,
      windowProperty: model.timeWindowProperty,
      steps,
      color: SeismologyLabColors.sWaveColorProperty,
      label: viewStrings.sMarkerStringProperty,
      accessibleName: sNameProperty,
      accessibleHelpText: a11yStrings.markerHelpStringProperty,
      onUserMove: () => announce(sMarker, record.sPickProperty.value),
    });

    const chart = new Node({
      x: chartX,
      children: [background, plotLayer, readout, pMarker, sMarker],
    });
    this.children = [label, chart];

    // ── Updates ───────────────────────────────────────────────────────────────
    const verticalPeak = peakOf(record.vertical);
    const horizontalPeak = peakOf(record.horizontal);
    const redraw = () => {
      const window = model.timeWindowProperty.value;
      transform.setModelXRange(window.copy());
      grid.setSpacing(niceTimeSpacing(window.getLength()));
      const horizontal = model.showHorizontalProperty.value;
      trace.shape = envelopeShape(
        horizontal ? record.horizontal : record.vertical,
        data.sampleRate,
        data.startSeconds,
        window,
        transform,
        horizontal ? horizontalPeak : verticalPeak,
      );
      channelText.string = horizontal ? data.horizontalChannel : data.verticalChannel;
      channelText.left = 0;
      channelText.top = nameText.bottom + 2;
      theoreticalP.setLine(
        transform.modelToViewX(data.pTheoSeconds),
        0,
        transform.modelToViewX(data.pTheoSeconds),
        STACK.CHART_HEIGHT,
      );
      theoreticalS.setLine(
        transform.modelToViewX(data.sTheoSeconds),
        0,
        transform.modelToViewX(data.sTheoSeconds),
        STACK.CHART_HEIGHT,
      );
    };
    const windowMultilink = Multilink.multilink([model.timeWindowProperty, model.showHorizontalProperty], redraw);
    const revealListener = (revealed: boolean) => {
      theoreticalP.visible = revealed;
      theoreticalS.visible = revealed;
    };
    model.revealedProperty.link(revealListener);

    this.disposeRow = () => {
      windowMultilink.dispose();
      model.revealedProperty.unlink(revealListener);
      readoutText.boundsProperty.unlink(layoutReadout);
      pMarker.dispose();
      sMarker.dispose();
      pNameProperty.dispose();
      sNameProperty.dispose();
      readoutText.dispose();
      readoutProperty.dispose();
      nameText.dispose();
      grid.dispose();
      background.dispose();
    };
  }

  /** The two markers, in keyboard order. */
  public get focusableMarkers(): Node[] {
    const chart = this.children[1];
    return chart ? chart.children.filter((child) => child instanceof PickMarkerNode) : [];
  }

  public override dispose(): void {
    this.disposeRow();
    super.dispose();
  }
}

/** Seismogram rows share an x layout; the stack places them vertically. */
export const ROW_PITCH = STACK.CHART_HEIGHT + STACK.ROW_SPACING;
