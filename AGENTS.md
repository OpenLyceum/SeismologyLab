# AGENTS.md — Seismology Lab

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

Seismology Lab (`seismology-lab`) is a SceneryStack simulation scaffolded from SceneryStackTemplate.

## Key files

| File | Purpose |
|---|---|
| `src/SeismologyLabColors.ts` | All `ProfileColorProperty` instances |
| `src/SeismologyLabConstants.ts` | Named numeric constants |
| `src/SeismologyLabNamespace.ts` | Namespace for color property names |
| `src/i18n/StringManager.ts` | Singleton localized string accessor |
| `src/common/SeismologyLabPanel.ts` | Pre-themed `Panel` wrapper |
| `src/common/SeismologyLabButtonOptions.ts` | Flat button / combo-box option bundles |
| `src/regional/RegionalScreen.ts` | Screen wrapper |
| `src/regional/model/RegionalModel.ts` | Simulation state and logic |
| `src/regional/view/RegionalScreenView.ts` | Visual nodes, layout, a11y wiring |
| `src/global/GlobalScreen.ts` | Screen wrapper |
| `src/global/model/GlobalModel.ts` | Simulation state and logic |
| `src/global/view/GlobalScreenView.ts` | Visual nodes, layout, a11y wiring |

## Compliance carve-outs

None yet.
