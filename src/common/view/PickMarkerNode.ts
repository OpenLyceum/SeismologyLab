/**
 * PickMarkerNode.ts
 *
 * A draggable, keyboard-operable P or S arrival marker on one seismogram. It is drawn in
 * the chart's own coordinate frame (origin at the chart's top-left corner). An unplaced
 * marker waits in the tray to the chart's left; dragging it onto the record, or pressing
 * an arrow key, places it. A placed marker outside the visible window is pinned to the
 * nearer edge and dimmed, so it stays reachable.
 */
import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import type { ChartTransform } from "scenerystack/bamboo";
import type { Range } from "scenerystack/dot";
import { DragListener, KeyboardListener, Line, Node, Rectangle, type TColor, Text } from "scenerystack/scenery";
import { MIN_PICK_SEPARATION_SECONDS, STACK } from "../../SeismologyLabConstants.js";
import { BOLD_LABEL_FONT } from "./SeismologyLabFonts.js";

type PickKind = "p" | "s";

export type PickMarkerNodeOptions = {
  readonly kind: PickKind;
  readonly pickProperty: Property<number | null>;
  /** The record's other pick, which this one may not cross. */
  readonly otherPickProperty: TReadOnlyProperty<number | null>;
  readonly transform: ChartTransform;
  /** Time span the record covers (s). */
  readonly recordRange: Range;
  readonly windowProperty: TReadOnlyProperty<Range>;
  readonly steps: { readonly coarse: number; readonly fine: number };
  readonly color: TColor;
  readonly label: TReadOnlyProperty<string>;
  readonly accessibleName: TReadOnlyProperty<string>;
  readonly accessibleHelpText: TReadOnlyProperty<string>;
  /** Called after the student moves the marker (drag end or a key press). */
  readonly onUserMove: () => void;
};

const HANDLE_SIZE = 16;

export class PickMarkerNode extends Node {
  private readonly disposePickMarker: () => void;

  public constructor(options: PickMarkerNodeOptions) {
    super({ tagName: "div", focusable: true, cursor: "ew-resize" });
    const { kind, pickProperty, otherPickProperty, transform, recordRange, windowProperty } = options;
    const height = STACK.CHART_HEIGHT;

    const line = new Line(0, 0, 0, height, { stroke: options.color, lineWidth: 2 });
    // A wider invisible strip makes the line easy to grab.
    const hitStrip = new Rectangle(-5, 0, 10, height, { fill: "transparent" });
    const handleBox = new Rectangle(-HANDLE_SIZE / 2, 0, HANDLE_SIZE, HANDLE_SIZE, 3, 3, { fill: options.color });
    const handleText = new Text(options.label, { font: BOLD_LABEL_FONT, maxWidth: HANDLE_SIZE - 2 });
    const handle = new Node({ children: [handleBox, handleText] });
    const handleY = kind === "p" ? 0 : height - HANDLE_SIZE;
    this.children = [hitStrip, line, handle];

    const update = () => {
      handleText.center = handleBox.center;
      const pick = pickProperty.value;
      if (pick === null) {
        // Parked in the tray: P on top, S below, handle only.
        line.visible = false;
        hitStrip.visible = false;
        handle.x = -STACK.TRAY_WIDTH / 2;
        handle.y = kind === "p" ? 6 : height - HANDLE_SIZE - 6;
        this.opacity = 0.9;
        return;
      }
      const window = windowProperty.value;
      const clamped = window.constrainValue(pick);
      const x = transform.modelToViewX(clamped);
      line.visible = true;
      hitStrip.visible = true;
      line.setLine(x, 0, x, height);
      hitStrip.x = x - 5;
      handle.x = x;
      handle.y = handleY;
      this.opacity = clamped === pick ? 1 : 0.45;
    };

    /** Keep a pick inside the record and on its side of the other pick. */
    const constrain = (time: number): number => {
      let value = recordRange.constrainValue(time);
      const other = otherPickProperty.value;
      if (other !== null) {
        value =
          kind === "p"
            ? Math.min(value, other - MIN_PICK_SEPARATION_SECONDS)
            : Math.max(value, other + MIN_PICK_SEPARATION_SECONDS);
      }
      return recordRange.constrainValue(value);
    };

    const dragListener = new DragListener({
      start: (event) => {
        this.moveToFront();
        const local = this.globalToLocalPoint(event.pointer.point);
        // Grabbing a parked marker drops it at the cursor once it crosses into the chart.
        if (local.x >= 0) {
          pickProperty.value = constrain(transform.viewToModelX(local.x));
        }
      },
      drag: (event) => {
        const local = this.globalToLocalPoint(event.pointer.point);
        if (local.x >= 0 || pickProperty.value !== null) {
          const x = Math.max(0, Math.min(STACK.CHART_WIDTH, local.x));
          pickProperty.value = constrain(transform.viewToModelX(x));
        }
      },
      end: () => {
        if (pickProperty.value !== null) {
          options.onUserMove();
        }
      },
    });
    this.addInputListener(dragListener);

    const keyboardListener = new KeyboardListener({
      keys: ["arrowLeft", "arrowRight", "shift+arrowLeft", "shift+arrowRight"],
      fireOnHold: true,
      fire: (_event, keysPressed) => {
        const current = pickProperty.value;
        if (current === null) {
          // First key press places the marker inside the visible window.
          const window = windowProperty.value;
          const fraction = kind === "p" ? 0.2 : 0.4;
          pickProperty.value = constrain(window.min + fraction * window.getLength());
        } else {
          const step = keysPressed.startsWith("shift") ? options.steps.fine : options.steps.coarse;
          const direction = keysPressed.endsWith("Left") ? -1 : 1;
          pickProperty.value = constrain(current + direction * step);
        }
        options.onUserMove();
      },
    });
    this.addInputListener(keyboardListener);

    this.accessibleName = options.accessibleName;
    this.accessibleHelpText = options.accessibleHelpText;

    pickProperty.link(update);
    windowProperty.lazyLink(update);
    transform.changedEmitter.addListener(update);

    this.disposePickMarker = () => {
      pickProperty.unlink(update);
      windowProperty.unlink(update);
      transform.changedEmitter.removeListener(update);
      dragListener.dispose();
      keyboardListener.dispose();
      handleText.dispose();
    };
  }

  public override dispose(): void {
    this.disposePickMarker();
    super.dispose();
  }
}
