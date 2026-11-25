/**
 * GlobalKeyboardHelpContent.ts
 *
 * Keyboard help for the Global screen: moving the arrival and epicenter markers, the
 * earthquake combo box and basic actions.
 */
import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  MoveDraggableItemsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class GlobalKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const leftColumn = [new MoveDraggableItemsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection()];
    const rightColumn = [new BasicActionsKeyboardHelpSection()];
    super(leftColumn, rightColumn);
  }
}
