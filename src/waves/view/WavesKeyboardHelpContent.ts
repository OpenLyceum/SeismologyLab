/**
 * WavesKeyboardHelpContent.ts
 *
 * Keyboard help for the Waves screen: the time controls, the earthquake combo box and
 * basic actions.
 */
import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  TimeControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class WavesKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    super(
      [new TimeControlsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection()],
      [new BasicActionsKeyboardHelpSection()],
    );
  }
}
