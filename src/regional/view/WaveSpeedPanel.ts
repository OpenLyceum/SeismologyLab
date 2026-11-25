/**
 * WaveSpeedPanel.ts
 *
 * Regional screen: the crustal P and S speeds the distance rule assumes, and the
 * resulting kilometres of distance per second of S–P, d = Δt · vP·vS / (vP − vS).
 */

import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { Text, VBox } from "scenerystack/scenery";
import { NumberControl } from "scenerystack/scenery-phet";
import type { SeismologyLabModel } from "../../common/model/SeismologyLabModel.js";
import { FLAT_BUTTON_APPEARANCE_OPTIONS } from "../../common/SeismologyLabButtonOptions.js";
import { SeismologyLabPanel } from "../../common/SeismologyLabPanel.js";
import { fillPattern } from "../../common/view/format.js";
import { BOLD_LABEL_FONT, LABEL_FONT, SMALL_FONT } from "../../common/view/SeismologyLabFonts.js";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors from "../../SeismologyLabColors.js";
import { VP_RANGE, VS_RANGE } from "../../SeismologyLabConstants.js";

export class WaveSpeedPanel extends SeismologyLabPanel {
  public readonly controls: NumberControl[];

  public constructor(model: SeismologyLabModel, width: number) {
    const strings = StringManager.getInstance().getViewStrings();
    const unitPatternProperty = new DerivedProperty([strings.kmPerSecondStringProperty], (unit) => `{{value}} ${unit}`);
    const pControl = new NumberControl(strings.pWaveSpeedStringProperty, model.vpProperty, VP_RANGE, {
      delta: 0.1,
      titleNodeOptions: { font: LABEL_FONT, fill: SeismologyLabColors.textColorProperty, maxWidth: 150 },
      numberDisplayOptions: { decimalPlaces: 1, valuePattern: unitPatternProperty, textOptions: { font: LABEL_FONT } },
      arrowButtonOptions: { ...FLAT_BUTTON_APPEARANCE_OPTIONS },
    });
    const sControl = new NumberControl(strings.sWaveSpeedStringProperty, model.vsProperty, VS_RANGE, {
      delta: 0.1,
      titleNodeOptions: { font: LABEL_FONT, fill: SeismologyLabColors.textColorProperty, maxWidth: 150 },
      numberDisplayOptions: { decimalPlaces: 1, valuePattern: unitPatternProperty, textOptions: { font: LABEL_FONT } },
      arrowButtonOptions: { ...FLAT_BUTTON_APPEARANCE_OPTIONS },
    });
    const ratioProperty = new DerivedProperty(
      [model.vpProperty, model.vsProperty, strings.secondsPerKmStringProperty],
      (vp, vs, pattern) => (vp > vs ? fillPattern(pattern, { value: toFixed((vp * vs) / (vp - vs), 1) }) : "—"),
    );
    const content = new VBox({
      align: "left",
      spacing: 6,
      children: [
        new Text(strings.waveSpeedsStringProperty, {
          font: BOLD_LABEL_FONT,
          fill: SeismologyLabColors.textColorProperty,
          maxWidth: width - 24,
        }),
        pControl,
        sControl,
        new Text(ratioProperty, {
          font: SMALL_FONT,
          fill: SeismologyLabColors.mutedTextColorProperty,
          maxWidth: width - 24,
        }),
      ],
    });
    super(content, { minWidth: width, maxWidth: width, isDisposable: false });
    this.controls = [pControl, sControl];
  }
}
