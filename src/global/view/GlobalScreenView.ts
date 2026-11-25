/**
 * GlobalScreenView.ts
 *
 * Global screen: seismograms recorded 25–95° from a great earthquake, a world map, and
 * the IASP91 travel-time curves that turn S–P into distance.
 */
import { BooleanProperty } from "scenerystack/axon";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { labCheckbox } from "../../common/view/LabControlBar.js";
import { buildLabScreen } from "../../common/view/LabScreenLayout.js";
import { StringManager } from "../../i18n/StringManager.js";
import { RIGHT_COLUMN } from "../../SeismologyLabConstants.js";
import type { GlobalModel } from "../model/GlobalModel.js";
import { GlobalScreenSummaryContent } from "./GlobalScreenSummaryContent.js";
import { TravelTimeChartNode } from "./TravelTimeChartNode.js";

export type GlobalScreenViewOptions = ScreenViewOptions;

const CHART_HEIGHT = 150;

export class GlobalScreenView extends ScreenView {
  public constructor(model: GlobalModel, providedOptions?: GlobalScreenViewOptions) {
    const options = optionize<GlobalScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new GlobalScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    // View-only: whether the travel-time chart is shown.
    const showTravelTimesProperty = new BooleanProperty(true);
    const chart = new TravelTimeChartNode(model.shared, RIGHT_COLUMN.WIDTH, CHART_HEIGHT);
    showTravelTimesProperty.link((show) => {
      chart.visible = show;
    });
    buildLabScreen(this, model.shared, {
      mapHeight: RIGHT_COLUMN.MAP_HEIGHT_GLOBAL,
      belowMap: chart,
      belowMapControls: [],
      extraCheckboxes: [
        labCheckbox(
          showTravelTimesProperty,
          StringManager.getInstance().getViewStrings().showTravelTimesStringProperty,
        ),
      ],
      resetView: () => showTravelTimesProperty.reset(),
    });
  }
}
