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
import { Circle, DragListener, KeyboardListener, Line, Node, Path, Rectangle, Text } from "scenerystack/scenery";
import { StarShape } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import type { SeismicEventData } from "../data/dataTypes.js";
import { WORLD_LAND } from "../data/generated/landData.js";
import { destinationPoint, type LonLat } from "../model/geodesy.js";
import type { SeismologyLabModel } from "../model/SeismologyLabModel.js";
import { fillPattern, formatDegrees, formatKm } from "./format.js";
import { type LonLatBox, MapProjection, regionalViewBox, worldCenterLon } from "./MapProjection.js";
import { SMALL_FONT, TICK_FONT } from "./SeismologyLabFonts.js";

const STATION_SIZE = 9;
const GUESS_RADIUS = 9;

/** Longitude copies to draw: the world map repeats land and circles one turn either side of the seam. */
function lonOffsets(isGlobal: boolean): readonly number[] {
  return isGlobal ? [-360, 0, 360] : [0];
}

function ringsShape(
  rings: readonly (readonly number[])[],
  projection: MapProjection,
  offsets: readonly number[],
): Shape {
  const shape = new Shape();
  for (const offset of offsets) {
    for (const ring of rings) {
      appendRing(shape, ring, projection, offset);
    }
  }
  return shape;
}

function appendRing(shape: Shape, ring: readonly number[], projection: MapProjection, offset: number): void {
  for (let index = 0; index + 1 < ring.length; index += 2) {
    const x = projection.toViewX((ring[index] ?? 0) + offset);
    const y = projection.toViewY(ring[index + 1] ?? 0);
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.close();
}

/**
 * A station's distance circle — a small circle on the sphere — as one continuous
 * polyline whose longitude is unwrapped (it may run past ±180°), drawn at each offset.
 */
function circleShape(center: LonLat, radiusKm: number, projection: MapProjection, offsets: readonly number[]): Shape {
  const points: LonLat[] = [];
  let previousLon = projection.wrapLon(center[0]);
  for (let bearing = 0; bearing <= 360; bearing += 2) {
    const [lon, lat] = destinationPoint(center, bearing, radiusKm);
    const unwrapped = previousLon + ((((lon - previousLon + 180) % 360) + 360) % 360) - 180;
    points.push([unwrapped, lat]);
    previousLon = unwrapped;
  }
  const shape = new Shape();
  for (const offset of offsets) {
    points.forEach(([lon, lat], index) => {
      const x = projection.toViewX(lon + offset);
      const y = projection.toViewY(lat);
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });
  }
  return shape;
}

/** Everything outside `box`, used to clip the coarse world coastline around a regional one. */
function outsideBoxShape(projection: MapProjection, box: LonLatBox): Shape {
  const { width, height } = projection.viewBounds;
  const [west, south, east, north] = box;
  const left = projection.toViewX(west);
  const right = projection.toViewX(east);
  const top = projection.toViewY(north);
  const bottom = projection.toViewY(south);
  // Outer rectangle clockwise, inner one counter-clockwise: a hole under the non-zero rule.
  return new Shape()
    .moveTo(0, 0)
    .lineTo(width, 0)
    .lineTo(width, height)
    .lineTo(0, height)
    .close()
    .moveTo(left, top)
    .lineTo(left, bottom)
    .lineTo(right, bottom)
    .lineTo(right, top)
    .close();
}

export class EpicenterMapNode extends Node {
  public readonly guessNode: Node;
  private readonly contentLayer = new Node();
  private projection: MapProjection;
  private disposeContent: () => void = () => undefined;

  public constructor(model: SeismologyLabModel, width: number, height: number) {
    super({ isDisposable: false });
    const a11yStrings = StringManager.getInstance().getControlA11yStrings();
    const isGlobal = model.kind === "global";
    this.projection = new MapProjection([-180, -90, 180, 90], width, height, true);

    const ocean = new Rectangle(0, 0, width, height, { fill: SeismologyLabColors.oceanColorProperty });
    const frame = new Rectangle(0, 0, width, height, {
      stroke: SeismologyLabColors.chartStrokeColorProperty,
      pickable: false,
    });

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

    this.children = [ocean, this.contentLayer, guessNode, frame];
    this.clipArea = Shape.rectangle(0, 0, width, height);

    // Rebuild on the station list, which the model replaces before disposing the old records.
    model.stationsProperty.link(() => {
      const event = model.eventProperty.value;
      this.projection = this.createProjection(model, width, height, isGlobal);
      this.rebuild(event, model);
      positionGuess(model.guessProperty.value);
    });
    model.guessProperty.link(positionGuess);
  }

  private createProjection(model: SeismologyLabModel, width: number, height: number, isGlobal: boolean): MapProjection {
    if (isGlobal) {
      const center = worldCenterLon(model.stationsProperty.value.map(({ data }) => data.lon));
      return new MapProjection([center - 180, -90, center + 180, 90], width, height, true);
    }
    const box = regionalViewBox(
      model.stationsProperty.value.map(({ data }) => ({ lonLat: [data.lon, data.lat], distanceKm: data.distanceKm })),
    );
    return new MapProjection(box, width, height, false);
  }

  private rebuild(event: SeismicEventData, model: SeismologyLabModel): void {
    this.disposeContent();
    const projection = this.projection;
    const isGlobal = model.kind === "global";
    const offsets = lonOffsets(isGlobal);
    const disposers: (() => void)[] = [];

    // ── Land ──────────────────────────────────────────────────────────────────
    const landOptions = {
      fill: SeismologyLabColors.landColorProperty,
      stroke: SeismologyLabColors.coastColorProperty,
      lineWidth: 0.8,
      pickable: false,
    };
    const land: Node[] = [];
    if (isGlobal) {
      land.push(new Path(ringsShape(WORLD_LAND, projection, offsets), landOptions));
    } else {
      // Detailed coastline inside the event's data box, coarse world coastline beyond it.
      land.push(
        new Path(ringsShape(WORLD_LAND, projection, offsets), {
          ...landOptions,
          clipArea: outsideBoxShape(projection, event.mapBox),
        }),
      );
      land.push(new Path(ringsShape(event.regionalLand, projection, offsets), landOptions));
    }

    // ── Graticule ─────────────────────────────────────────────────────────────
    const [west, south, east, north] = projection.box;
    const spacing = isGlobal ? 30 : 1;
    const graticule = new Shape();
    for (let lon = Math.ceil(west / spacing) * spacing; lon <= east; lon += spacing) {
      graticule.moveTo(projection.toViewX(lon), 0).lineTo(projection.toViewX(lon), projection.viewBounds.height);
    }
    for (let lat = Math.ceil(south / spacing) * spacing; lat <= north; lat += spacing) {
      graticule.moveTo(0, projection.toViewY(lat)).lineTo(projection.viewBounds.width, projection.toViewY(lat));
    }
    const graticulePath = new Path(graticule, {
      stroke: SeismologyLabColors.chartGridColorProperty,
      lineWidth: 0.6,
      pickable: false,
    });

    // ── Stations and circles ──────────────────────────────────────────────────
    const circles: Node[] = [];
    const stations: Node[] = [];
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

      const position = projection.toViewWrapped(center);
      const triangle = new Path(
        new Shape()
          .moveTo(0, -STATION_SIZE)
          .lineTo(STATION_SIZE * 0.87, STATION_SIZE * 0.5)
          .lineTo(-STATION_SIZE * 0.87, STATION_SIZE * 0.5)
          .close(),
        { fill: color, stroke: SeismologyLabColors.chartBackgroundColorProperty, lineWidth: 1 },
      );
      const code = new Text(data.code, { font: TICK_FONT, fill: SeismologyLabColors.textColorProperty });
      code.left = STATION_SIZE;
      code.centerY = 0;
      stations.push(new Node({ children: [triangle, code], translation: position, pickable: false }));
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

    this.contentLayer.children = [...land, graticulePath, ...circles, ...stations, overlay];
    this.disposeContent = () => {
      for (const dispose of disposers) {
        dispose();
      }
      for (const child of this.contentLayer.children) {
        child.dispose();
      }
    };
  }
}
