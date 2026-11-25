/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { catalogEvents, loadEvent } from "./common/data/eventLibrary.js";
import { GlobalScreen } from "./global/GlobalScreen.js";
import { StringManager } from "./i18n/StringManager.js";
import { SeismologyLabPreferencesModel } from "./preferences/SeismologyLabPreferencesModel.js";
import { SeismologyLabPreferencesNode } from "./preferences/SeismologyLabPreferencesNode.js";
import { RegionalScreen } from "./regional/RegionalScreen.js";
import SeismologyLabColors from "./SeismologyLabColors.js";
import { WavesScreen } from "./waves/WavesScreen.js";

// Each screen opens on its first catalog event; fetch those waveforms before the sim
// starts so no screen's first frame shows a loading message. Other events load on demand.
const firstEvents = Promise.all(
  (["regional", "global"] as const).flatMap((kind) => catalogEvents(kind).slice(0, 1).map(loadEvent)),
);

function launch(): void {
  const stringManager = StringManager.getInstance();

  // Simulation-specific preferences; initial values come from seismologyLabQueryParameters.
  const simPreferences = new SeismologyLabPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  const screens = [
    new WavesScreen({
      name: stringManager.getScreenNames().wavesStringProperty,
      tandem: Tandem.ROOT.createTandem("wavesScreen"),
      backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
    }),
    new RegionalScreen({
      name: stringManager.getScreenNames().regionalStringProperty,
      tandem: Tandem.ROOT.createTandem("regionalScreen"),
      backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
    }),
    new GlobalScreen({
      name: stringManager.getScreenNames().globalStringProperty,
      tandem: Tandem.ROOT.createTandem("globalScreen"),
      backgroundColorProperty: SeismologyLabColors.backgroundColorProperty,
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
    preferencesModel: new PreferencesModel({
      visualOptions: {
        // Adds a "Projector Mode" toggle in Preferences → Visual
        supportsProjectorMode: true,
        // Enables keyboard-navigation highlight outlines
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (tandem: Tandem) => new SeismologyLabPreferencesNode(simPreferences, tandem),
          },
        ],
      },
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
    }),

    // Optional: fill in credits shown in Help → About
    credits: {
      leadDesign: "",
      softwareDevelopment: "",
      team: "",
      qualityAssurance: "",
    },
  });

  sim.start();
}

// A failed preload still launches: the screen then shows its load-failure message.
onReadyToLaunch(() => {
  firstEvents.then(launch, launch);
});
