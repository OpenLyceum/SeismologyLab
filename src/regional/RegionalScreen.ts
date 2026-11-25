/**
 * RegionalScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createRegionalIcon() in src/common/SeismologyLabScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createRegionalIcon } from "../common/SeismologyLabScreenIcons.js";
import SeismologyLabColors from "../SeismologyLabColors.js";
import { RegionalModel } from "./model/RegionalModel.js";
import { RegionalKeyboardHelpContent } from "./view/RegionalKeyboardHelpContent.js";
import { RegionalScreenView } from "./view/RegionalScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type RegionalScreenOptions = ScreenOptions & { tandem: Tandem };

export class RegionalScreen extends Screen<RegionalModel, RegionalScreenView> {
  public constructor(options: RegionalScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new RegionalModel(),
      // View factory — receives the model instance
      (model) =>
        new RegionalScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<RegionalScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new RegionalKeyboardHelpContent(),
          homeScreenIcon: createRegionalIcon(),
          navigationBarIcon: createRegionalIcon(),
        },
        options,
      ),
    );
  }
}
