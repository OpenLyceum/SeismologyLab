/**
 * LabControlBar.ts
 *
 * The row along the top of both screens: the earthquake chooser and the display
 * check boxes. Screen-specific check boxes are appended by the caller.
 */

import { DerivedProperty, type Property, type TReadOnlyProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { Checkbox, ComboBox, type ComboBoxItem } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors from "../../SeismologyLabColors.js";
import type { SeismicEventData } from "../data/dataTypes.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import { LIGHT_SURFACE_TEXT_FILL, SEISMOLOGY_LAB_COMBO_BOX_OPTIONS } from "../SeismologyLabButtonOptions.js";
import { fillPattern } from "./format.js";
import { LABEL_FONT } from "./SeismologyLabFonts.js";

/** A check box styled for the dark screen background. */
export function labCheckbox(property: Property<boolean>, label: TReadOnlyProperty<string>): Checkbox {
  const text = new Text(label, { font: LABEL_FONT, fill: SeismologyLabColors.textColorProperty, maxWidth: 170 });
  return new Checkbox(property, text, {
    boxWidth: 16,
    checkboxColor: SeismologyLabColors.textColorProperty,
    checkboxColorBackground: SeismologyLabColors.chartBackgroundColorProperty,
    accessibleName: label,
  });
}

export class LabControlBar extends HBox {
  public readonly comboBox: ComboBox<SeismicEventData>;
  public readonly checkboxes: Checkbox[];

  public constructor(model: SeismologyLabModel, listParent: Node, extraCheckboxes: Checkbox[] = []) {
    const viewStrings = StringManager.getInstance().getViewStrings();
    const a11yStrings = StringManager.getInstance().getControlA11yStrings();

    const items: ComboBoxItem<SeismicEventData>[] = model.events.map((event) => {
      const labelProperty = new DerivedProperty([viewStrings.eventPatternStringProperty], (pattern) =>
        fillPattern(pattern, {
          magnitude: toFixed(event.magnitude, 1),
          place: event.place,
          year: event.originIso.slice(0, 4),
        }),
      );
      return {
        value: event,
        createNode: () => new Text(labelProperty, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL, maxWidth: 330 }),
        accessibleName: labelProperty,
      };
    });
    const comboBox = new ComboBox(model.eventProperty, items, listParent, {
      ...SEISMOLOGY_LAB_COMBO_BOX_OPTIONS,
      xMargin: 8,
      yMargin: 4,
      accessibleName: a11yStrings.earthquakeStringProperty,
    });

    const checkboxes = [
      labCheckbox(model.showHorizontalProperty, viewStrings.showHorizontalStringProperty),
      labCheckbox(model.showCirclesProperty, viewStrings.showCirclesStringProperty),
      ...extraCheckboxes,
    ];
    super({ spacing: 18, children: [comboBox, ...checkboxes], isDisposable: false });
    this.comboBox = comboBox;
    this.checkboxes = checkboxes;
  }
}
