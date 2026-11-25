/**
 * RegionalKeyboardHelpContent.ts
 *
 * Keyboard help for the Regional screen: moving the arrival and epicenter markers, the
 * earthquake combo box, sliders and basic actions.
 */
import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class RegionalKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const leftColumn = [new MoveDraggableItemsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection()];
    const rightColumn = [new SliderControlsKeyboardHelpSection(), new BasicActionsKeyboardHelpSection()];
    super(leftColumn, rightColumn);
  }
}
