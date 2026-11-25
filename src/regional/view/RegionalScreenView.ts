/**
 * RegionalScreenView.ts
 *
 * Regional screen: seismograms from stations 40–250 km from the epicenter, a regional
 * map, and the crustal wave speeds that turn S–P into distance.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { buildLabScreen } from "../../common/view/LabScreenLayout.js";
import { RIGHT_COLUMN } from "../../SeismologyLabConstants.js";
import type { RegionalModel } from "../model/RegionalModel.js";
import { RegionalScreenSummaryContent } from "./RegionalScreenSummaryContent.js";
import { WaveSpeedPanel } from "./WaveSpeedPanel.js";

export type RegionalScreenViewOptions = ScreenViewOptions;

export class RegionalScreenView extends ScreenView {
  public constructor(model: RegionalModel, providedOptions?: RegionalScreenViewOptions) {
    const options = optionize<RegionalScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new RegionalScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    const waveSpeedPanel = new WaveSpeedPanel(model.shared, RIGHT_COLUMN.WIDTH);
    buildLabScreen(this, model.shared, {
      mapHeight: RIGHT_COLUMN.MAP_HEIGHT_REGIONAL,
      belowMap: waveSpeedPanel,
      belowMapControls: waveSpeedPanel.controls,
    });
  }
}
