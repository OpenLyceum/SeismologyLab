/**
 * SeismologyLabPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Add controls here
 * when the sim gains sim-specific preferences. The empty shell still wraps content
 * in SeismologyLabPanel so the shared panel toolkit stays reachable.
 */
import { Bounds2 } from "scenerystack/dot";
import { VBox } from "scenerystack/scenery";
import type { Tandem } from "scenerystack/tandem";
import { SeismologyLabPanel } from "../common/SeismologyLabPanel.js";
import SeismologyLabNamespace from "../SeismologyLabNamespace.js";
import type { SeismologyLabPreferencesModel } from "./SeismologyLabPreferencesModel.js";

export class SeismologyLabPreferencesNode extends VBox {
  public constructor(_preferencesModel: SeismologyLabPreferencesModel, _tandem?: Tandem) {
    // Pattern for a preference control (skill: scenerystack-preferences). The dialog is
    // always white, so use the controlSurface colors, not textColorProperty.
    //
    //   const prefStrings = StringManager.getInstance().getPreferences();
    //   const showGridCheckbox = new Checkbox(
    //     preferencesModel.showGridProperty,
    //     new Text(prefStrings.showGridStringProperty, {
    //       font: new PhetFont(14),
    //       fill: SeismologyLabColors.controlSurfaceTextColorProperty,
    //     }),
    //     {
    //       // Shared slider / NumberControl / checkbox bundles live in SeismologyLabControlOptions.ts:
    //       // copy the template's src/common/*ControlOptions.ts and apply the SeismologyLab prefix.
    //       checkboxColor: SeismologyLabColors.controlSurfaceTextColorProperty,
    //       checkboxColorBackground: SeismologyLabColors.controlSurfaceColorProperty,
    //       ...(tandem && { tandem: tandem.createTandem("showGridCheckbox") }),
    //     },
    //   );
    //
    // Add showGridCheckbox to the content children below.
    const content = new VBox({
      align: "left",
      spacing: 12,
      children: [],
    });
    // An empty VBox has no bounds, and keyboard focus on the empty Simulation tab then
    // fails HighlightFromNode's finite-bounds assertion. Give it a 1 × 1 footprint.
    if (content.children.length === 0) {
      content.localBounds = new Bounds2(0, 0, 1, 1);
    }
    // Transparent / borderless so the Preferences dialog stays visually empty.
    const panel = new SeismologyLabPanel(content, {
      fill: "transparent",
      stroke: null,
      xMargin: 0,
      yMargin: 0,
    });
    super({
      align: "left",
      spacing: 12,
      children: [panel],
    });
  }
}

SeismologyLabNamespace.register("SeismologyLabPreferencesNode", SeismologyLabPreferencesNode);
