/**
 * SeismologyLabPanel.ts
 *
 * A pre-themed Panel that automatically uses SeismologyLabColors for background and
 * border. Use this for all control panels and info boxes in the sim so that
 * default / projector mode switching is handled automatically.
 *
 * ── Basic usage ───────────────────────────────────────────────────────────────
 *
 *   import { SeismologyLabPanel } from "../../common/SeismologyLabPanel.js";
 *   import { VBox, Text } from "scenerystack/scenery";
 *
 *   const content = new VBox({
 *     children: [ new Text("label"), slider ],
 *     spacing: 8,
 *   });
 *   const panel = new SeismologyLabPanel(content);
 *
 * ── Overriding defaults ───────────────────────────────────────────────────────
 *
 *   // Wider margins, sharper corners, custom stroke
 *   const panel = new SeismologyLabPanel(content, { xMargin: 20, cornerRadius: 0 });
 *
 *   // Transparent background (decorative border only)
 *   const panel = new SeismologyLabPanel(content, { fill: "transparent" });
 */

import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import type { Node } from "scenerystack/scenery";
import { Panel, type PanelOptions } from "scenerystack/sun";
import SeismologyLabColors from "../SeismologyLabColors.js";
import { PANEL_CORNER_RADIUS } from "../SeismologyLabConstants.js";

/** @public */
export type SeismologyLabPanelOptions = PanelOptions;

/** Pre-themed Panel wrapper for control panels and info boxes. @public */
export class SeismologyLabPanel extends Panel {
  public constructor(content: Node, providedOptions?: SeismologyLabPanelOptions) {
    const options = optionize<SeismologyLabPanelOptions, EmptySelfOptions, PanelOptions>()(
      {
        fill: SeismologyLabColors.panelBackgroundColorProperty,
        stroke: SeismologyLabColors.panelBorderColorProperty,
        cornerRadius: PANEL_CORNER_RADIUS,
        xMargin: 12,
        yMargin: 10,
      },
      providedOptions,
    );
    super(content, options);
  }
}
