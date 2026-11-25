/**
 * EpicenterMapNode.ts
 *
 * The station map: coastlines, a graticule, one triangle per station, each station's
 * distance circle (a true small circle on the sphere), the student's draggable
 * epicenter marker and, after reveal, the USGS epicenter, the circles' best fit and the
 * student's miss distance. Rebuilt whenever the selected earthquake changes.
 */
import { DerivedProperty, Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, DragListener, KeyboardListener, Line, Node, Path, Text } from "scenerystack/scenery";
import { StarShape } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import type { LonLat } from "../model/geodesy.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import { fillPattern, formatDegrees, formatKm } from "./format.js";
import type { MapProjection } from "./MapProjection.js";
import { circleShape, lonOffsets } from "./mapShapes.js";
import { SMALL_FONT } from "./SeismologyLabFonts.js";
import { StationMapNode } from "./StationMapNode.js";

const GUESS_RADIUS = 9;

export class EpicenterMapNode extends Node {
  public readonly guessNode: Node;
  private readonly base: StationMapNode;
  private readonly model: SeismologyLabModel;
  private disposeContent: () => void = () => undefined;

  public constructor(model: SeismologyLabModel, width: number, height: number) {
    super({ isDisposable: false });
    const a11yStrings = StringManager.getInstance().getControlA11yStrings();
    this.model = model;
    const base = new StationMapNode(model.eventProperty, width, height);
    this.base = base;
    const ocean = base.ocean;

    // ── Student's epicenter marker ────────────────────────────────────────────
    const guessRing = new Circle(GUESS_RADIUS, {
      stroke: SeismologyLabColors.guessColorProperty,
      lineWidth: 2.5,
      fill: "transparent",
    });
    const guessCross = new Path(
      new Shape()
        .moveTo(-GUESS_RADIUS - 5, 0)
        .lineTo(GUESS_RADIUS + 5, 0)
        .moveTo(0, -GUESS_RADIUS - 5)
        .lineTo(0, GUESS_RADIUS + 5),
      { stroke: SeismologyLabColors.guessColorProperty, lineWidth: 1.5 },
    );
    const guessNode = new Node({
      children: [guessRing, guessCross],
      cursor: "pointer",
      tagName: "div",
      focusable: true,
      accessibleName: a11yStrings.epicenterMarkerStringProperty,
      accessibleHelpText: a11yStrings.epicenterHelpStringProperty,
    });
    this.guessNode = guessNode;

    const announceGuess = () => {
      const guess = model.guessProperty.value;
      if (guess) {
        guessNode.addAccessibleObjectResponse(
          fillPattern(a11yStrings.epicenterValueStringProperty.value, {
            lat: formatDegrees(guess[1]),
            lon: formatDegrees(guess[0]),
          }),
        );
      }
    };
    const placeAt = (globalPoint: Vector2) => {
      model.guessProperty.value = this.projection.toLonLat(this.globalToLocalPoint(globalPoint));
    };
    const dragListener = new DragListener({
      start: (event) => placeAt(event.pointer.point),
      drag: (event) => placeAt(event.pointer.point),
      end: announceGuess,
    });
    guessNode.addInputListener(dragListener);
    // Pressing anywhere on the map places the marker there and keeps dragging it.
    const mapPressListener = new DragListener({
      start: (event) => placeAt(event.pointer.point),
      drag: (event) => placeAt(event.pointer.point),
      end: announceGuess,
    });
    ocean.addInputListener(mapPressListener);
    guessNode.addInputListener(
      new KeyboardListener({
        keys: [
          "arrowLeft",
          "arrowRight",
          "arrowUp",
          "arrowDown",
          "shift+arrowLeft",
          "shift+arrowRight",
          "shift+arrowUp",
          "shift+arrowDown",
        ],
        fireOnHold: true,
        fire: (_event, keysPressed) => {
          const guess = model.guessProperty.value;
          const bounds = this.projection.viewBounds;
          const current = guess ? this.projection.toViewWrapped(guess) : bounds.center;
          if (guess) {
            const step = (keysPressed.startsWith("shift") ? 0.005 : 0.025) * bounds.width;
            const delta = keysPressed.endsWith("Left")
              ? new Vector2(-step, 0)
              : keysPressed.endsWith("Right")
                ? new Vector2(step, 0)
                : keysPressed.endsWith("Up")
                  ? new Vector2(0, -step)
                  : new Vector2(0, step);
            model.guessProperty.value = this.projection.toLonLat(current.plus(delta));
          } else {
            model.guessProperty.value = this.projection.toLonLat(current);
          }
          announceGuess();
        },
      }),
    );

    const positionGuess = (guess: LonLat | null) => {
      if (guess) {
        guessNode.translation = this.projection.toViewWrapped(guess);
        guessNode.opacity = 1;
      } else {
        // Parked in the lower-left corner until placed.
        guessNode.translation = new Vector2(GUESS_RADIUS + 10, height - GUESS_RADIUS - 10);
        guessNode.opacity = 0.7;
      }
    };

    this.children = [base];
    base.overlayLayer.addChild(guessNode);

    // Rebuild on the station list, which the model replaces before disposing the old records.
    model.stationsProperty.link(() => {
      this.rebuild();
      positionGuess(model.guessProperty.value);
    });
    model.guessProperty.link(positionGuess);
  }

  private get projection(): MapProjection {
    return this.base.projectionFor(this.model.eventProperty.value);
  }

  private rebuild(): void {
    this.disposeContent();
    const model = this.model;
    const event = model.eventProperty.value;
    const projection = this.projection;
    const offsets = lonOffsets(model.kind === "global");
    const disposers: (() => void)[] = [];

    // ── Distance circles ──────────────────────────────────────────────────────
    const circles: Node[] = [];
    model.stationsProperty.value.forEach((record, index) => {
      const color = stationColorProperty(index);
      const { data } = record;
      const center: LonLat = [data.lon, data.lat];
      const circle = new Path(null, { stroke: color, lineWidth: 2, pickable: false });
      const visibility = Multilink.multilink(
        [record.distanceKmProperty, record.circleVisibleProperty, model.showCirclesProperty],
        (distance, visible, showCircles) => {
          circle.visible = distance !== null && visible && showCircles;
          circle.shape = distance === null ? null : circleShape(center, distance, projection, offsets);
        },
      );
      disposers.push(() => visibility.dispose());
      circles.push(circle);
    });

    // ── Answer overlay ────────────────────────────────────────────────────────
    const truth = new Path(new StarShape({ outerRadius: 10, innerRadius: 4.5 }), {
      fill: SeismologyLabColors.truthColorProperty,
      stroke: SeismologyLabColors.chartBackgroundColorProperty,
      translation: projection.toViewWrapped([event.lon, event.lat]),
    });
    const bestFit = new Path(new Shape().moveTo(0, -7).lineTo(7, 0).lineTo(0, 7).lineTo(-7, 0).close(), {
      stroke: SeismologyLabColors.bestFitColorProperty,
      lineWidth: 2,
    });
    const missLine = new Line(0, 0, 0, 0, {
      stroke: SeismologyLabColors.truthColorProperty,
      lineDash: [5, 4],
      lineWidth: 1.5,
    });
    const missText = new Text("", { font: SMALL_FONT, fill: SeismologyLabColors.textColorProperty });
    const missLabelProperty: TReadOnlyProperty<string> = new DerivedProperty([model.misfitKmProperty], (misfit) =>
      misfit === null ? "" : `${formatKm(misfit)} km`,
    );
    const overlay = new Node({ children: [missLine, bestFit, truth, missText], pickable: false });
    const overlayLink = Multilink.multilink(
      [model.revealedProperty, model.guessProperty, model.bestFitProperty, missLabelProperty],
      (revealed, guess, fit, missLabel) => {
        overlay.visible = revealed;
        bestFit.visible = fit !== null;
        if (fit) {
          bestFit.translation = projection.toViewWrapped(fit.lonLat);
        }
        missLine.visible = guess !== null;
        missText.visible = guess !== null;
        if (guess) {
          const from = projection.toViewWrapped(guess);
          missLine.setPoint1(from);
          missLine.setPoint2(truth.translation);
          missText.string = missLabel;
          missText.center = from.average(truth.translation).plusXY(0, -10);
        }
      },
    );
    disposers.push(() => {
      overlayLink.dispose();
      missLabelProperty.dispose();
    });

    this.base.underStationsLayer.children = circles;
    this.base.overlayLayer.insertChild(0, overlay);
    this.disposeContent = () => {
      for (const dispose of disposers) {
        dispose();
      }
      this.base.overlayLayer.removeChild(overlay);
      for (const child of [...circles, overlay]) {
        child.dispose();
      }
    };
  }
}
