/**
 * StationMapNode.ts
 *
 * The map every screen shares: ocean, coastline, graticule and the event's stations,
 * rebuilt whenever the earthquake changes. Screens add their own layers — distance
 * circles and the epicenter marker, or expanding wavefronts — between the graticule
 * and the stations (`underStationsLayer`) or above the stations (`overlayLayer`).
 *
 * The projection is a pure function of the event (`projectionFor`), so a screen layer
 * can rebuild from its own trigger without depending on listener order.
 */
import type { TReadOnlyProperty } from "scenerystack/axon";
import { Shape } from "scenerystack/kite";
import { Node, Path, Rectangle, Text } from "scenerystack/scenery";
import SeismologyLabColors, { stationColorProperty } from "../../SeismologyLabColors.js";
import type { SeismicEventSummary } from "../data/dataTypes.js";
import { stationsByDistance } from "../data/eventLibrary.js";
import { WORLD_LAND } from "../data/generated/landData.js";
import type { MapProjection } from "./MapProjection.js";
import { lonOffsets, outsideBoxShape, projectionForEvent, ringsShape } from "./mapShapes.js";
import { TICK_FONT } from "./SeismologyLabFonts.js";

const STATION_SIZE = 9;

export class StationMapNode extends Node {
  /** Pressable background: screens attach their input listeners here. */
  public readonly ocean: Rectangle;
  public readonly underStationsLayer = new Node();
  public readonly overlayLayer = new Node();
  /** One node per station of the current event, nearest first; translation = map position. */
  private stationNodesList: Node[] = [];
  private readonly baseLayer = new Node();
  private readonly stationLayer = new Node();
  private readonly projections = new Map<string, MapProjection>();
  private readonly mapWidth: number;
  private readonly mapHeight: number;

  public constructor(eventProperty: TReadOnlyProperty<SeismicEventSummary>, width: number, height: number) {
    super({ isDisposable: false });
    this.mapWidth = width;
    this.mapHeight = height;
    this.ocean = new Rectangle(0, 0, width, height, { fill: SeismologyLabColors.oceanColorProperty });
    const frame = new Rectangle(0, 0, width, height, {
      stroke: SeismologyLabColors.chartStrokeColorProperty,
      pickable: false,
    });
    this.children = [this.ocean, this.baseLayer, this.underStationsLayer, this.stationLayer, this.overlayLayer, frame];
    this.clipArea = Shape.rectangle(0, 0, width, height);
    eventProperty.link((event) => this.rebuild(event));
  }

  public get stationNodes(): readonly Node[] {
    return this.stationNodesList;
  }

  /** The (cached) projection for an event's map. */
  public projectionFor(event: SeismicEventSummary): MapProjection {
    let projection = this.projections.get(event.key);
    if (!projection) {
      projection = projectionForEvent(event, this.mapWidth, this.mapHeight);
      this.projections.set(event.key, projection);
    }
    return projection;
  }

  private rebuild(event: SeismicEventSummary): void {
    for (const child of [...this.baseLayer.children, ...this.stationLayer.children]) {
      child.dispose();
    }
    const projection = this.projectionFor(event);
    const isGlobal = event.kind === "global";
    const offsets = lonOffsets(isGlobal);

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
    this.baseLayer.children = [...land, graticulePath];

    // ── Stations ──────────────────────────────────────────────────────────────
    this.stationNodesList = stationsByDistance(event).map((station, index) => {
      const triangle = new Path(
        new Shape()
          .moveTo(0, -STATION_SIZE)
          .lineTo(STATION_SIZE * 0.87, STATION_SIZE * 0.5)
          .lineTo(-STATION_SIZE * 0.87, STATION_SIZE * 0.5)
          .close(),
        {
          fill: stationColorProperty(index),
          stroke: SeismologyLabColors.chartBackgroundColorProperty,
          lineWidth: 1,
        },
      );
      const code = new Text(station.code, { font: TICK_FONT, fill: SeismologyLabColors.textColorProperty });
      code.left = STATION_SIZE;
      code.centerY = 0;
      return new Node({
        children: [triangle, code],
        translation: projection.toViewWrapped([station.lon, station.lat]),
        pickable: false,
      });
    });
    this.stationLayer.children = this.stationNodesList;
  }
}
