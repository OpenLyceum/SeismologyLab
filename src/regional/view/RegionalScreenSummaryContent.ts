/**
 * RegionalScreenSummaryContent.ts
 *
 * The accessible screen summary for the Regional screen. Current details report how many
 * distance circles the student has drawn so far.
 */
import { DerivedProperty, PatternStringProperty } from "scenerystack/axon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { RegionalModel } from "../model/RegionalModel.js";

export class RegionalScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: RegionalModel) {
    const a11y = StringManager.getInstance().getRegionalA11yStrings();
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
