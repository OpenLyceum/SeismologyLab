/**
 * SeismogramStackNode.ts
 *
 * The left column: one SeismogramRowNode per station (nearest first), a shared time
 * axis under the last row, and zoom / pan / fit controls for the common time window.
 * Rows are rebuilt whenever the selected earthquake changes.
 */
import { DerivedProperty, NumberProperty } from "scenerystack/axon";
import { ChartTransform, TickLabelSet, TickMarkSet } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Orientation } from "scenerystack/phet-core";
import { HBox, Node, Text } from "scenerystack/scenery";
import { PlusMinusZoomButtonGroup } from "scenerystack/scenery-phet";
import { ArrowButton, RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import { MAX_ZOOM_LEVEL, STACK } from "../../SeismologyLabConstants.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import type { StationRecord } from "../model/StationRecord.js";
import { FLAT_BUTTON_APPEARANCE_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../SeismologyLabButtonOptions.js";
import { formatSeconds, niceTimeSpacing } from "./format.js";
import { ROW_PITCH, SeismogramRowNode } from "./SeismogramRowNode.js";
import { BOLD_LABEL_FONT, LABEL_FONT, SMALL_FONT, TICK_FONT } from "./SeismologyLabFonts.js";

export class SeismogramStackNode extends Node {
  /** Interactive nodes in traversal order; replaced on every rebuild. */
  private rows: SeismogramRowNode[] = [];
  private readonly rowLayer = new Node();
  private readonly zoomLevelProperty = new NumberProperty(0, { range: new Range(0, MAX_ZOOM_LEVEL) });
  public readonly controls: Node[];

  public constructor(model: SeismologyLabModel) {
    super({ isDisposable: false, x: STACK.X, y: STACK.Y });
    const viewStrings = StringManager.getInstance().getViewStrings();
    const a11yStrings = StringManager.getInstance().getControlA11yStrings();

    // ── Shared time axis, placed under the last row ───────────────────────────
    const axisTransform = new ChartTransform({
      viewWidth: STACK.CHART_WIDTH,
      viewHeight: 1,
      modelXRange: model.timeWindowProperty.value.copy(),
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
    const axis = new Node({ x: STACK.LABEL_WIDTH + STACK.TRAY_WIDTH, children: [tickMarks, tickLabels, axisTitle] });

    // ── Window controls ───────────────────────────────────────────────────────
    const zoomButtons = new PlusMinusZoomButtonGroup(this.zoomLevelProperty, {
      orientation: "horizontal",
      spacing: 4,
      buttonOptions: { ...FLAT_BUTTON_APPEARANCE_OPTIONS, baseColor: SeismologyLabColors.controlSurfaceColorProperty },
    });
    zoomButtons.accessibleName = a11yStrings.zoomStringProperty;
    const pan = (direction: number) => {
      const full = model.fullTimeWindow;
      const window = model.timeWindowProperty.value;
      const shift = direction * 0.25 * window.getLength();
      const min = Math.max(full.min, Math.min(full.max - window.getLength(), window.min + shift));
      model.timeWindowProperty.value = new Range(min, min + window.getLength());
    };
    const arrowOptions = {
      ...FLAT_BUTTON_APPEARANCE_OPTIONS,
      baseColor: SeismologyLabColors.controlSurfaceColorProperty,
      arrowFill: LIGHT_SURFACE_TEXT_FILL,
      arrowHeight: 12,
      arrowWidth: 12,
    };
    const earlierButton = new ArrowButton("left", () => pan(-1), {
      ...arrowOptions,
      accessibleName: a11yStrings.earlierStringProperty,
    });
    const laterButton = new ArrowButton("right", () => pan(1), {
      ...arrowOptions,
      accessibleName: a11yStrings.laterStringProperty,
    });
    const fitButton = new RectangularPushButton({
      ...FLAT_BUTTON_APPEARANCE_OPTIONS,
      baseColor: SeismologyLabColors.controlSurfaceColorProperty,
      content: new Text(a11yStrings.fitStringProperty, {
        font: LABEL_FONT,
        fill: LIGHT_SURFACE_TEXT_FILL,
        maxWidth: 160,
      }),
      listener: () => {
        this.zoomLevelProperty.value = 0;
        model.timeWindowProperty.value = model.fullTimeWindow;
      },
    });
    const controlBar = new HBox({
      spacing: 8,
      children: [zoomButtons, earlierButton, laterButton, fitButton],
    });
    this.controls = [zoomButtons, earlierButton, laterButton, fitButton];

    // ── Loading / failure message while an event's waveforms are fetched ─────
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
      status.centerX = STACK.LABEL_WIDTH + STACK.TRAY_WIDTH + STACK.CHART_WIDTH / 2;
      status.centerY = (6 * ROW_PITCH) / 2;
    });

    this.children = [this.rowLayer, axis, controlBar, status];

    // Zoom keeps the window centre, clamped inside the record.
    this.zoomLevelProperty.lazyLink((zoom) => {
      const full = model.fullTimeWindow;
      const width = full.getLength() / 2 ** zoom;
      const center = model.timeWindowProperty.value.getCenter();
      const min = Math.max(full.min, Math.min(full.max - width, center - width / 2));
      model.timeWindowProperty.value = new Range(min, min + width);
    });

    model.timeWindowProperty.link((window) => {
      axisTransform.setModelXRange(window.copy());
      const spacing = niceTimeSpacing(window.getLength());
      tickMarks.setSpacing(spacing);
      tickLabels.setSpacing(spacing);
      earlierButton.enabled = window.min > model.fullTimeWindow.min + 1e-6;
      laterButton.enabled = window.max < model.fullTimeWindow.max - 1e-6;
    });

    model.stationsProperty.link((records) => {
      this.rebuild(records, model);
      const bottom = records.length * ROW_PITCH - STACK.ROW_SPACING;
      axis.y = bottom;
      axisTitle.centerX = STACK.CHART_WIDTH / 2;
      axisTitle.top = 16;
      controlBar.left = STACK.LABEL_WIDTH + STACK.TRAY_WIDTH;
      controlBar.top = bottom + 38;
      this.zoomLevelProperty.reset();
    });
  }

  private rebuild(records: readonly StationRecord[], model: SeismologyLabModel): void {
    const old = this.rows;
    this.rows = records.map((record, index) => {
      const row = new SeismogramRowNode(record, model, stationColorProperty(index));
      row.y = index * ROW_PITCH;
      return row;
    });
    this.rowLayer.children = this.rows;
    for (const row of old) {
      row.dispose();
    }
    this.pdomOrderChanged();
  }

  /** P and S markers of every row, nearest station first. */
  public get markerNodes(): Node[] {
    return this.rows.flatMap((row) => row.focusableMarkers);
  }

  /** Lets the screen view refresh its traversal order after a rebuild. */
  public onRowsChanged: () => void = () => undefined;

  private pdomOrderChanged(): void {
    this.onRowsChanged();
  }

  public reset(): void {
    this.zoomLevelProperty.reset();
  }
}
