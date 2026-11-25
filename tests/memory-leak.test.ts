/**
 * Memory-leak regression suite (fleet standard).
 *
 * List every model/view object that links Properties, adds listeners, or owns child
 * nodes, with a factory that builds a fresh instance. The shared harness in
 * tests/helpers/memoryLeak.ts (template-owned) checks that each one is garbage
 * collected after dispose() and leaves no survivors across repeated cycles
 * (idempotentDispose: true also checks a second dispose()). Add sim-specific leak
 * tests below using forceGC().
 *
 * Rows and markers are rebuilt every time the earthquake changes, so they must unlink
 * from the long-lived screen model; `keepAlive` holds that model while each disposed
 * instance is checked for collection.
 */

import { NumberProperty, Property } from "scenerystack/axon";
import { ChartTransform } from "scenerystack/bamboo";
import { Range } from "scenerystack/dot";
import { Tandem } from "scenerystack/tandem";
import { EVENTS } from "../src/common/data/generated/eventData.js";
import { RegionalDistanceModel } from "../src/common/model/DistanceModel.js";
import { SeismologyLabModel } from "../src/common/model/SeismologyLabModel.js";
import { StationRecord } from "../src/common/model/StationRecord.js";
import { PickMarkerNode } from "../src/common/view/PickMarkerNode.js";
import { SeismogramRowNode } from "../src/common/view/SeismogramRowNode.js";
import { GlobalModel } from "../src/global/model/GlobalModel.js";
import { RegionalModel } from "../src/regional/model/RegionalModel.js";
import SeismologyLabColors from "../src/SeismologyLabColors.js";
import { describeDisposalLeaks } from "./helpers/memoryLeak.js";

const longLivedModel = new SeismologyLabModel("regional", EVENTS, Tandem.OPT_OUT);
const firstRecord = () => {
  const record = longLivedModel.stationsProperty.value[0];
  if (!record) {
    throw new Error("expected bundled stations");
  }
  return record;
};
const vpProperty = new NumberProperty(6.1);
const vsProperty = new NumberProperty(3.5);
const firstStation = EVENTS[0]?.stations[0];
const windowProperty = new Property(new Range(0, 100));
const labelProperty = new Property("P");

describeDisposalLeaks([
  { name: "RegionalModel", create: () => new RegionalModel() },
  { name: "GlobalModel", create: () => new GlobalModel() },
  { name: "SeismologyLabModel", create: () => new SeismologyLabModel("global", EVENTS, Tandem.OPT_OUT) },
  {
    name: "StationRecord",
    create: () => {
      if (!firstStation) {
        throw new Error("expected bundled stations");
      }
      return new StationRecord(firstStation, new RegionalDistanceModel(vpProperty, vsProperty));
    },
    keepAlive: () => [vpProperty, vsProperty],
  },
  {
    name: "SeismogramRowNode",
    create: () => new SeismogramRowNode(firstRecord(), longLivedModel, SeismologyLabColors.traceColorProperty),
    keepAlive: () => [longLivedModel, firstRecord()],
  },
  {
    name: "PickMarkerNode",
    create: () => {
      const record = firstRecord();
      return new PickMarkerNode({
        kind: "p",
        pickProperty: record.pPickProperty,
        otherPickProperty: record.sPickProperty,
        transform: new ChartTransform({ viewWidth: 400, viewHeight: 60, modelXRange: new Range(0, 100) }),
        recordRange: new Range(0, 100),
        windowProperty,
        steps: { coarse: 1, fine: 0.1 },
        color: SeismologyLabColors.pWaveColorProperty,
        label: labelProperty,
        accessibleName: labelProperty,
        accessibleHelpText: labelProperty,
        onUserMove: () => undefined,
      });
    },
    keepAlive: () => [firstRecord(), windowProperty, labelProperty],
  },
]);
