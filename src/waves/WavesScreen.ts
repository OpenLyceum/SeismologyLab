/**
 * WavesScreen.ts
 *
 * The Waves screen: a real earthquake replayed in compressed time, so students see the
 * P and S waves spread out and the S–P gap grow with distance before they pick
 * arrivals themselves on the Regional and Global screens.
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createWavesIcon } from "../common/SeismologyLabScreenIcons.js";
import SeismologyLabColors from "../SeismologyLabColors.js";
import { WavesModel } from "./model/WavesModel.js";
import { WavesKeyboardHelpContent } from "./view/WavesKeyboardHelpContent.js";
import { WavesScreenView } from "./view/WavesScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type WavesScreenOptions = ScreenOptions & { tandem: Tandem };

export class WavesScreen extends Screen<WavesModel, WavesScreenView> {
  public constructor(options: WavesScreenOptions) {
    super(
      () => new WavesModel(),
      (model) => new WavesScreenView(model, { tandem: options.tandem.createTandem("view") }),
      optionize<WavesScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new WavesKeyboardHelpContent(),
          homeScreenIcon: createWavesIcon(),
          navigationBarIcon: createWavesIcon(),
        },
        options,
      ),
    );
  }
}
