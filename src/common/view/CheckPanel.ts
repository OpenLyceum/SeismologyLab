/**
 * CheckPanel.ts
 *
 * "Check my location" and "Reveal answer", with feedback that names how far the
 * student's marker is from the USGS epicenter (never where it is), and, after reveal,
 * the catalog location and how well the student's own circles agree with it.
 */
import { DerivedProperty } from "scenerystack/axon";
import { HBox, type Node, RichText, Text, VBox } from "scenerystack/scenery";
import { RectangularPushButton } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors from "../../SeismologyLabColors.js";
import { greatCircleKm } from "../model/geodesy.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import { FLAT_PANEL_PUSH_BUTTON_OPTIONS, LIGHT_SURFACE_TEXT_FILL } from "../SeismologyLabButtonOptions.js";
import { SeismologyLabPanel } from "../SeismologyLabPanel.js";
import { fillPattern, formatDegrees, formatKm } from "./format.js";
import { LABEL_FONT, SMALL_FONT } from "./SeismologyLabFonts.js";

export class CheckPanel extends SeismologyLabPanel {
  public readonly checkButton: RectangularPushButton;
  public readonly revealButton: RectangularPushButton;

  public constructor(model: SeismologyLabModel, width: number) {
    const strings = StringManager.getInstance().getViewStrings();
    const contentWidth = width - 24;

    const button = (label: typeof strings.checkStringProperty, listener: () => void) =>
      new RectangularPushButton({
        ...FLAT_PANEL_PUSH_BUTTON_OPTIONS,
        content: new Text(label, { font: LABEL_FONT, fill: LIGHT_SURFACE_TEXT_FILL, maxWidth: contentWidth / 2 - 20 }),
        listener,
      });
    const checkButton = button(strings.checkStringProperty, () => model.check());
    const revealButton = button(strings.revealStringProperty, () => model.reveal());
    model.canCheckProperty.link((canCheck) => {
      checkButton.enabled = canCheck;
    });

    const feedbackProperty = new DerivedProperty(
      [
        model.checkResultProperty,
        model.misfitKmProperty,
        model.canCheckProperty,
        strings.feedbackNoneStringProperty,
        strings.feedbackReadyStringProperty,
        strings.feedbackGoodStringProperty,
        strings.feedbackFairStringProperty,
        strings.feedbackFarStringProperty,
      ],
      (result, misfit, canCheck, none, ready, good, fair, far) => {
        if (result === "none" || misfit === null) {
          return canCheck ? ready : none;
        }
        const pattern = result === "good" ? good : result === "fair" ? fair : far;
        return fillPattern(pattern, { distance: formatKm(misfit) });
      },
    );
    const feedback = new RichText(feedbackProperty, {
      font: SMALL_FONT,
      fill: SeismologyLabColors.textColorProperty,
      lineWrap: contentWidth,
    });

    const answerProperty = new DerivedProperty(
      [
        model.revealedProperty,
        model.eventProperty,
        model.bestFitProperty,
        strings.answerStringProperty,
        strings.bestFitStringProperty,
        strings.globalDepthNoteStringProperty,
      ],
      (revealed, event, fit, answerPattern, bestFit, depthNote) => {
        if (!revealed) {
          return model.kind === "global" ? fillPattern(depthNote, { depth: formatKm(event.depthKm) }) : "";
        }
        const lines = [
          fillPattern(answerPattern, {
            lat: formatDegrees(event.lat, 2),
            lon: formatDegrees(event.lon, 2),
            depth: formatKm(event.depthKm),
          }),
        ];
        if (fit) {
          lines.push(fillPattern(bestFit, { distance: formatKm(greatCircleKm(fit.lonLat, [event.lon, event.lat])) }));
        }
        return lines.join("<br>");
      },
    );
    const answer = new RichText(answerProperty, {
      font: SMALL_FONT,
      fill: SeismologyLabColors.mutedTextColorProperty,
      lineWrap: contentWidth,
    });

    const content = new VBox({
      align: "left",
      spacing: 8,
      children: [new HBox({ spacing: 10, children: [checkButton, revealButton] }), feedback, answer],
    });
    super(content, { minWidth: width, maxWidth: width, isDisposable: false });
    this.checkButton = checkButton;
    this.revealButton = revealButton;
  }

  public get interactiveNodes(): Node[] {
    return [this.checkButton, this.revealButton];
  }
}
