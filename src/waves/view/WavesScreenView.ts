/**
 * WavesScreenView.ts
 *
 * Waves screen: the earthquake chooser and the auto-pause check box along the top, the
 * filling-in seismograms on the left, the wavefront map and the arrival chart on the
 * right, and the time controls, clock and replay button along the bottom.
 */
import { DerivedProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node, Text } from "scenerystack/scenery";
import { ResetAllButton, TimeControlNode } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { RectangularPushButton } from "scenerystack/sun";
import {
  FLAT_BUTTON_APPEARANCE_OPTIONS,
  FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS,
  FLAT_RESET_ALL_BUTTON_OPTIONS,
  LIGHT_SURFACE_TEXT_FILL,
  TIME_CONTROL_SPEED_RADIO_OPTIONS,
} from "../../common/SeismologyLabButtonOptions.js";
import { fillPattern, formatKm, formatSeconds } from "../../common/view/format.js";
import { createEventComboBox, labCheckbox } from "../../common/view/LabControlBar.js";
import { BOLD_LABEL_FONT, LABEL_FONT } from "../../common/view/SeismologyLabFonts.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors from "../../SeismologyLabColors.js";
import { RIGHT_COLUMN, SCREEN_VIEW_MARGIN, STACK } from "../../SeismologyLabConstants.js";
import type { WavesModel } from "../model/WavesModel.js";
import { ArrivalChartNode } from "./ArrivalChartNode.js";
import { ArrivalTraceStackNode } from "./ArrivalTraceStackNode.js";
import { WavefrontMapNode } from "./WavefrontMapNode.js";
import { WavesScreenSummaryContent } from "./WavesScreenSummaryContent.js";

const MAP_HEIGHT = 238;
const CHART_HEIGHT = 196;

export type WavesScreenViewOptions = ScreenViewOptions;

export class WavesScreenView extends ScreenView {
  public constructor(model: WavesModel, providedOptions?: WavesScreenViewOptions) {
    const options = optionize<WavesScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      { screenSummaryContent: new WavesScreenSummaryContent(model) },
      providedOptions,
    );
    super(options);
    const strings = StringManager.getInstance();
    const waveStrings = strings.getWavesViewStrings();
    const a11yStrings = strings.getWavesA11yStrings();
    const { layoutBounds } = this;

    // ── Top bar ───────────────────────────────────────────────────────────────
    const comboBox = createEventComboBox(model.eventProperty, model.events, this);
    const autoPauseCheckbox = labCheckbox(model.autoPauseProperty, waveStrings.autoPauseStringProperty);
    const topBar = new HBox({ spacing: 18, children: [comboBox, autoPauseCheckbox], left: STACK.X, top: 10 });

    // ── Play area ─────────────────────────────────────────────────────────────
    const stack = new ArrivalTraceStackNode(model);
    const map = new WavefrontMapNode(model, RIGHT_COLUMN.WIDTH, MAP_HEIGHT);
    map.left = RIGHT_COLUMN.X;
    map.top = STACK.Y;
    const chart = new ArrivalChartNode(model, RIGHT_COLUMN.WIDTH, CHART_HEIGHT);
    chart.left = RIGHT_COLUMN.X;
    chart.top = map.bottom + 6;

    // ── Bottom bar: time controls, clock, replay, reset ───────────────────────
    const timeControl = new TimeControlNode(model.timer.isPlayingProperty, {
      ...TIME_CONTROL_SPEED_RADIO_OPTIONS,
      timeSpeedProperty: model.timer.timeSpeedProperty,
      timeSpeeds: [...model.timer.timeSpeeds],
      flowBoxSpacing: 18,
      playPauseStepButtonOptions: {
        ...FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS,
        stepForwardButtonOptions: {
          ...FLAT_PLAY_PAUSE_STEP_BUTTON_OPTIONS.stepForwardButtonOptions,
          listener: () => model.stepForward(),
        },
      },
      accessibleHelpText: a11yStrings.timeControlsHelpStringProperty,
    });
    const clockProperty = new DerivedProperty(
      [model.timer.timeProperty, model.eventProperty, waveStrings.clockStringProperty],
      (time, event, pattern) =>
        fillPattern(pattern, { time: formatSeconds(Math.max(0, time), event.kind === "global") }),
    );
    const clock = new Text(clockProperty, {
      font: BOLD_LABEL_FONT,
      fill: SeismologyLabColors.timeCursorColorProperty,
      maxWidth: 220,
    });
    const replayButton = new RectangularPushButton({
      ...FLAT_BUTTON_APPEARANCE_OPTIONS,
      baseColor: SeismologyLabColors.controlSurfaceColorProperty,
      content: new Text(waveStrings.restartStringProperty, {
        font: LABEL_FONT,
        fill: LIGHT_SURFACE_TEXT_FILL,
        maxWidth: 120,
      }),
      listener: () => model.restart(),
    });
    const bottomBar = new HBox({ spacing: 22, children: [timeControl, clock, replayButton] });
    bottomBar.left = STACK.X + STACK.LABEL_WIDTH + STACK.TRAY_WIDTH;
    bottomBar.bottom = layoutBounds.maxY - SCREEN_VIEW_MARGIN;

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        this.interruptSubtreeInput();
        model.reset();
      },
      right: layoutBounds.maxX - SCREEN_VIEW_MARGIN,
      bottom: layoutBounds.maxY - SCREEN_VIEW_MARGIN,
    });

    // ── Arrival announcements ─────────────────────────────────────────────────
    model.arrivalEmitter.addListener((phase, index) => {
      const station = model.stationsProperty.value[index];
      if (!station) {
        return;
      }
      const isGlobal = model.eventProperty.value.kind === "global";
      const name = `${station.network}.${station.code}`;
      timeControl.addAccessibleContextResponse(
        phase === "p"
          ? fillPattern(a11yStrings.pArrivalStringProperty.value, {
              station: name,
              distance: formatKm(station.distanceKm),
              time: formatSeconds(station.pTheoSeconds, isGlobal),
            })
          : fillPattern(a11yStrings.sArrivalStringProperty.value, {
              station: name,
              interval: formatSeconds(station.sTheoSeconds - station.pTheoSeconds, isGlobal),
            }),
      );
    });

    this.addChild(stack);
    this.addChild(map);
    this.addChild(chart);
    this.addChild(bottomBar);
    this.addChild(resetAllButton);
    // The top bar goes last so the combo box's list draws over everything else.
    this.addChild(topBar);

    const traversal = new Node({
      pdomOrder: [comboBox, autoPauseCheckbox, timeControl, replayButton, resetAllButton],
    });
    this.addChild(traversal);
  }
}
