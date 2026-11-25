/**
 * GlobalScreenSummaryContent.ts
 *
 * The accessible screen summary for the Global screen. Current details report how many
 * distance circles the student has drawn so far.
 */
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { GlobalModel } from "../model/GlobalModel.js";

export class GlobalScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: GlobalModel) {
    const a11y = StringManager.getInstance().getGlobalA11yStrings();
    const totalProperty = new DerivedProperty([model.shared.stationsProperty], (stations) => stations.length);
    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: new PatternStringProperty(a11y.currentDetailsStringProperty, {
        count: model.shared.drawnCircleCountProperty,
        total: totalProperty,
      }),
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
