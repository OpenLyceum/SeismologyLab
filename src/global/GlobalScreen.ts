/**
 * GlobalScreen.ts
 *
 * The top-level Screen component. It wires together the model and view
 * factories and passes screen-level options (name, background color, tandem)
 * to the parent Screen class.
 *
 * Registered in the screens array in src/main.ts. Its home-screen and navigation-bar
 * icons come from createGlobalIcon() in src/common/SeismologyLabScreenIcons.ts
 * (see doc/multi-screen.md).
 */
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { ScreenOptions } from "scenerystack/sim";
import { Screen } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createGlobalIcon } from "../common/SeismologyLabScreenIcons.js";
import SeismologyLabColors from "../SeismologyLabColors.js";
import { GlobalModel } from "./model/GlobalModel.js";
import { GlobalKeyboardHelpContent } from "./view/GlobalKeyboardHelpContent.js";
import { GlobalScreenView } from "./view/GlobalScreenView.js";

// Require tandem to be explicit — accidental omission would break PhET-iO.
type GlobalScreenOptions = ScreenOptions & { tandem: Tandem };

export class GlobalScreen extends Screen<GlobalModel, GlobalScreenView> {
  public constructor(options: GlobalScreenOptions) {
    super(
      // Model factory — called once when the screen is first shown
      () => new GlobalModel(),
      // View factory — receives the model instance
      (model) =>
        new GlobalScreenView(model, {
          tandem: options.tandem.createTandem("view"),
        }),
      optionize<GlobalScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
          createKeyboardHelpNode: () => new GlobalKeyboardHelpContent(),
          homeScreenIcon: createGlobalIcon(),
          navigationBarIcon: createGlobalIcon(),
        },
        options,
      ),
    );
  }
}
