/** Owns the shared seismology state for the Global screen. */
import type { TModel } from "scenerystack/joist";
import { Tandem } from "scenerystack/tandem";
import { catalogEvents } from "../../common/data/eventLibrary.js";
import { SeismologyLabModel } from "../../common/model/SeismologyLabModel.js";

export class GlobalModel implements TModel {
  public readonly shared: SeismologyLabModel;

  public constructor(tandem = Tandem.OPT_OUT) {
    this.shared = new SeismologyLabModel("global", catalogEvents(), tandem);
  }

  public reset(): void {
    this.shared.reset();
  }

  public dispose(): void {
    this.shared.dispose();
  }
}
