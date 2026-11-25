/** Owns the shared seismology state for the Global screen. */
import type { TModel } from "scenerystack/joist";
import { Tandem } from "scenerystack/tandem";
import { EVENTS } from "../../common/data/generated/eventData.js";
import { SeismologyLabModel } from "../../common/model/SeismologyLabModel.js";

export class GlobalModel implements TModel {
  public readonly shared: SeismologyLabModel;

  public constructor(tandem = Tandem.OPT_OUT) {
    this.shared = new SeismologyLabModel("global", EVENTS, tandem);
  }

  public reset(): void {
    this.shared.reset();
  }

  public dispose(): void {
    this.shared.dispose();
  }
}
