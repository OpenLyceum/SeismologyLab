/**
 * WavesScreenSummaryContent.ts
 *
 * The accessible screen summary for the Waves screen. Current details report the replay
 * time and how many stations each wave has reached.
 */
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { formatSeconds } from "../../common/view/format.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { WavesModel } from "../model/WavesModel.js";

export class WavesScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: WavesModel) {
    const a11y = StringManager.getInstance().getWavesA11yStrings();
    const timeProperty = new DerivedProperty([model.timer.timeProperty, model.eventProperty], (time, event) =>
      formatSeconds(Math.max(0, time), event.kind === "global"),
    );
    const totalProperty = new DerivedProperty([model.stationsProperty], (stations) => stations.length);
    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: new PatternStringProperty(a11y.currentDetailsStringProperty, {
        time: timeProperty,
        p: model.pArrivedCountProperty,
        s: model.sArrivedCountProperty,
        total: totalProperty,
      }),
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
