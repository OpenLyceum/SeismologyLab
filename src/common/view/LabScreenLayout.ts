/**
 * LabScreenLayout.ts
 *
 * Builds the layout both screens share — control bar on top, seismogram stack on the
 * left, map / screen-specific panel / check panel on the right, Reset All bottom-right —
 * and keeps the parallel-DOM order in step with the rebuilt seismogram rows.
 */
import { Node } from "scenerystack/scenery";
import { ResetAllButton } from "scenerystack/scenery-phet";
import type { ScreenView } from "scenerystack/sim";
import type { Checkbox } from "scenerystack/sun";
import { RIGHT_COLUMN, SCREEN_VIEW_MARGIN, STACK } from "../../SeismologyLabConstants.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../SeismologyLabButtonOptions.js";
import { CheckPanel } from "./CheckPanel.js";
import { EpicenterMapNode } from "./EpicenterMapNode.js";
import { LabControlBar } from "./LabControlBar.js";
import { SeismogramStackNode } from "./SeismogramStackNode.js";

export type LabScreenLayoutOptions = {
  readonly mapHeight: number;
  /** Screen-specific node placed under the map (wave speeds, travel-time chart). */
  readonly belowMap: Node;
  /** Its keyboard-reachable parts, in traversal order. */
  readonly belowMapControls: readonly Node[];
  readonly extraCheckboxes?: Checkbox[];
  /** View-side state to clear on Reset All. */
  readonly resetView?: () => void;
};

export function buildLabScreen(
  screenView: ScreenView,
  model: SeismologyLabModel,
  options: LabScreenLayoutOptions,
): void {
  const { layoutBounds } = screenView;

  const controlBar = new LabControlBar(model, screenView, options.extraCheckboxes);
  controlBar.left = STACK.X;
  controlBar.top = 10;

  const stack = new SeismogramStackNode(model);

  const map = new EpicenterMapNode(model, RIGHT_COLUMN.WIDTH, options.mapHeight);
  map.left = RIGHT_COLUMN.X;
  map.top = STACK.Y;

  options.belowMap.left = RIGHT_COLUMN.X;
  options.belowMap.top = map.bottom + 10;

  const resetAllButton = new ResetAllButton({
    ...FLAT_RESET_ALL_BUTTON_OPTIONS,
    listener: () => {
      model.reset();
      stack.reset();
      options.resetView?.();
    },
    right: layoutBounds.maxX - SCREEN_VIEW_MARGIN,
    bottom: layoutBounds.maxY - SCREEN_VIEW_MARGIN,
  });

  const checkPanel = new CheckPanel(model, resetAllButton.left - 12 - RIGHT_COLUMN.X);
  checkPanel.left = RIGHT_COLUMN.X;
  checkPanel.top = options.belowMap.bottom + 10;

  screenView.addChild(stack);
  screenView.addChild(map);
  screenView.addChild(options.belowMap);
  screenView.addChild(checkPanel);
  screenView.addChild(resetAllButton);
  // The control bar goes last so the combo box's list draws over everything else.
  screenView.addChild(controlBar);

  // ScreenView may not carry a pdomOrder itself, so a wrapper borrows the controls.
  const traversal = new Node();
  const updateOrder = () => {
    traversal.pdomOrder = [
      controlBar.comboBox,
      ...controlBar.checkboxes,
      ...stack.markerNodes,
      ...stack.controls,
      map.guessNode,
      ...options.belowMapControls,
      ...checkPanel.interactiveNodes,
      resetAllButton,
    ];
  };
  stack.onRowsChanged = updateOrder;
  updateOrder();
  screenView.addChild(traversal);
}
