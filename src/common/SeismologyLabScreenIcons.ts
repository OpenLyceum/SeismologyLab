/**
 * SeismologyLabScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons, drawn on the standard 548 × 373
 * canvas: Waves is P and S wavefronts spreading from an epicenter past two stations;
 * Regional is a seismogram with its P and S picks; Global is the Earth with
 * three stations' distance circles meeting at an epicenter.
 */
import { Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Circle, Line, Node, Path, Rectangle } from "scenerystack/scenery";
import { StarShape } from "scenerystack/scenery-phet";
import { ScreenIcon } from "scenerystack/sim";
import SeismologyLabColors, { stationColorProperty } from "../SeismologyLabColors.js";

const W = 548;
const H = 373;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, { fill: SeismologyLabColors.backgroundColorProperty });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: SeismologyLabColors.backgroundColorProperty,
  });
}

/** A synthetic record: quiet, a small P coda, then a larger S coda (icon only, not data). */
function traceShape(left: number, right: number, centerY: number, pX: number, sX: number): Shape {
  const shape = new Shape().moveTo(left, centerY);
  for (let x = left; x <= right; x += 2) {
    const amplitude = x < pX ? 2 : x < sX ? 28 * Math.exp(-(x - pX) / 90) + 6 : 95 * Math.exp(-(x - sX) / 70) + 8;
    shape.lineTo(x, centerY + amplitude * Math.sin(x * 0.55) * Math.cos(x * 0.13));
  }
  return shape;
}

export function createWavesIcon(): ScreenIcon {
  const epicenter = { x: 190, y: H / 2 + 10 };
  const map = new Rectangle(30, 30, W - 60, H - 60, 12, 12, {
    fill: SeismologyLabColors.oceanColorProperty,
    stroke: SeismologyLabColors.chartStrokeColorProperty,
    lineWidth: 3,
  });
  const ring = (radius: number, stroke: typeof SeismologyLabColors.pWaveColorProperty, dash: number[]) => {
    const circle = new Circle(radius, { stroke, lineWidth: 7, lineDash: dash });
    circle.center = new Vector2(epicenter.x, epicenter.y);
    return circle;
  };
  const triangle = (x: number, y: number, index: number) =>
    new Path(new Shape().moveTo(0, -22).lineTo(19, 11).lineTo(-19, 11).close(), {
      fill: stationColorProperty(index),
      stroke: SeismologyLabColors.chartBackgroundColorProperty,
      lineWidth: 3,
      translation: new Vector2(x, y),
    });
  const star = new Path(new StarShape({ outerRadius: 24, innerRadius: 10 }), {
    fill: SeismologyLabColors.truthColorProperty,
    translation: new Vector2(epicenter.x, epicenter.y),
  });
  const content = new Node({
    children: [
      background(),
      map,
      ring(250, SeismologyLabColors.pWaveColorProperty, []),
      ring(140, SeismologyLabColors.sWaveColorProperty, [18, 10]),
      triangle(epicenter.x + 250 * 0.8, epicenter.y - 250 * 0.6, 0),
      triangle(epicenter.x + 210, epicenter.y + 80, 1),
      star,
    ],
  });
  content.clipArea = Shape.rectangle(0, 0, W, H);
  return iconFrom(content);
}

export function createRegionalIcon(): ScreenIcon {
  const centerY = H / 2;
  const pX = 150;
  const sX = 290;
  const chart = new Rectangle(30, 40, W - 60, H - 80, 12, 12, {
    fill: SeismologyLabColors.chartBackgroundColorProperty,
    stroke: SeismologyLabColors.chartStrokeColorProperty,
    lineWidth: 3,
  });
  const trace = new Path(traceShape(50, W - 50, centerY, pX, sX), {
    stroke: SeismologyLabColors.traceColorProperty,
    lineWidth: 3,
  });
  const pPick = new Line(pX, 55, pX, H - 55, { stroke: SeismologyLabColors.pWaveColorProperty, lineWidth: 7 });
  const sPick = new Line(sX, 55, sX, H - 55, { stroke: SeismologyLabColors.sWaveColorProperty, lineWidth: 7 });
  return iconFrom(new Node({ children: [background(), chart, trace, pPick, sPick] }));
}

export function createGlobalIcon(): ScreenIcon {
  const radius = 160;
  const center = { x: W / 2, y: H / 2 };
  const earth = new Circle(radius, {
    fill: SeismologyLabColors.oceanColorProperty,
    stroke: SeismologyLabColors.chartStrokeColorProperty,
    lineWidth: 4,
  });
  earth.centerX = center.x;
  earth.centerY = center.y;
  const epicenter = { x: center.x + 30, y: center.y - 20 };
  const stations = [
    { x: center.x - 95, y: center.y - 70 },
    { x: center.x + 110, y: center.y + 60 },
    { x: center.x - 40, y: center.y + 105 },
  ];
  const rings = stations.map((station, index) => {
    const distance = Math.hypot(station.x - epicenter.x, station.y - epicenter.y);
    const ring = new Circle(distance, { stroke: stationColorProperty(index), lineWidth: 5 });
    ring.centerX = station.x;
    ring.centerY = station.y;
    return ring;
  });
  const triangles = stations.map((station, index) => {
    const size = 18;
    return new Path(
      new Shape()
        .moveTo(station.x, station.y - size)
        .lineTo(station.x + size * 0.87, station.y + size * 0.5)
        .lineTo(station.x - size * 0.87, station.y + size * 0.5)
        .close(),
      { fill: stationColorProperty(index) },
    );
  });
  const star = new Path(new StarShape({ outerRadius: 22, innerRadius: 10 }), {
    fill: SeismologyLabColors.truthColorProperty,
    x: epicenter.x,
    y: epicenter.y,
  });
  const globe = new Node({
    children: [earth, ...rings, ...triangles, star],
    clipArea: Shape.circle(center.x, center.y, radius),
  });
  return iconFrom(new Node({ children: [background(), globe] }));
}
