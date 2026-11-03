# Miniature Boston · Freedom Trail geographical foundation

A local, navigable 3D diorama of the real Freedom Trail corridor. Prepared OSM geography includes **3,408 complete building footprints, 7,461 road features, parks, shoreline/water, a branched red trail, and all 16 official sites**. Source geometry and provenance are separate from rendering.

Project: `/home/colinskywalker068/projects/boston-signals` (native WSL Linux filesystem).

## Launch

```bash
cd ~/projects/boston-signals
nvm use
cd frontend
npm run dev -- --host localhost --port 5173 --strictPort
```

Open [localhost:5173](http://localhost:5173) from Windows or WSL. Stop with **Ctrl+C**. Left-drag to orbit, right-drag to pan (or focus the canvas and use arrow keys), scroll to zoom. Select a numbered marker or stop in the list; Find on map focuses it. Building layer, zoom and reset controls are provided.

## Old State House at street level

Select **Old State House** from a map marker or the stop list. The atlas camera focuses on the landmark; select **Explore Site** in its information card to enter the present-day exterior. The site is loaded only on entry.

Select **Start walking** to capture the mouse, use **WASD** to move and the mouse to look, and press **Escape** to pause/release the cursor. The scene provides an explicit resume control and an alternative when pointer lock is unavailable. **Return to Miniature Boston** restores the saved map camera, target and selected landmark. Ground-level movement has simplified building/obstacle collisions and a compact walking boundary.

The Old State House has present-day NPCs and an explorable Boston, 1770 evidence hunt. See the sections below for inference and gameplay. See [scene architecture, coordinates, controls and verification](docs/TASK2_1_EXPLORATION.md), [model processing and licenses](docs/TASK2_1_ASSETS.md), and [scene implementation notes](docs/TASK2_1_SCENE.md).

## Python and data regeneration

```bash
cd ~/projects/boston-signals
source .venv/bin/activate
python scripts/fetch_geography.py  # validates/reuses the supplied cache; no live requests
python scripts/geography.py
python scripts/geography.py --validate-only
```

See [the pipeline guide](docs/GEOGRAPHY_PIPELINE.md) for explicit source refresh, adjustable corridor width, all stages and file locations. See [data sources](docs/DATA_SOURCES.md) for the official route validation, all landmark coordinates, source IDs, licenses and corrections.

## Test and build

```bash
cd ~/projects/boston-signals
.venv/bin/python -m unittest discover -s tests -v
nvm use
cd frontend
npm test
npm run lint
npm run build
```

The build writes ignored `frontend/dist/`. To serve the production build, run `npm run preview -- --host localhost` and open the URL it prints; stop with Ctrl+C.

## Reinstall dependencies

```bash
cd ~/projects/boston-signals
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install
nvm use
(cd frontend && npm ci)
/usr/bin/python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Uses the prepared Node 24, React 19, TypeScript, Vite, Three.js, Fiber v9 and Drei environment. Geographic Python tooling uses system Python 3.14 in `.venv`, independent of conda. Keep npm/pip unprivileged. Installed setup versions are recorded in `docs/setup-verification.md`.

## Structure

```text
frontend/src/              UI, batched city renderer, typed data/geometry helpers
frontend/src/experiences/  Lazy-loadable Old State House exterior, player, collision and anchors
frontend/public/experiences/ Selected optimized GLBs only; source libraries remain outside public
frontend/tests/            Node-based frontend geometry/data/navigation/collision tests
frontend/public/data/      Static scene, WGS84 route/sites/region GeoJSON, license notice
scripts/                   Cached downloader, preprocessing/validation, source configuration
tests/                     Python geography, cache and real-data regressions
data/raw/                  Cached source extracts, query and provenance manifests
data/processed/            Geographic validation report
docs/reference/            Supplied concept image
docs/DATA_SOURCES.md       Source identities, coordinates, licenses and approximations
docs/GEOGRAPHY_PIPELINE.md Regeneration instructions
```

## Current scope and limitations

- Real footprint layouts, not fabricated city blocks. The model covers 6.17 km² of cached city geometry, with 3,408 complete building footprints inside or touching the oval. A regular oval stage light defines the focus independently of the geometry boundary. Camera panning stays within 450 m of the real trail and zoom-out is bounded.
- The network includes official Charlestown branches. Two documented additions repair omissions in relation 976514 using mapped sidewalks/crossings. The displayed 5.7 km is the sum of the **network**, not a single walking itinerary.
- Heights use OSM measurements where available, floor-derived estimates or labeled type defaults otherwise. Terrain is flat; atlas roofs and bridge elevations remain simplified. The detailed Old State House uses an independently processed source model.
- This is an exploratory viewer, not live navigation. Dense downtown markers can overlap at city-wide zoom; the stop list and focus controls remain available.
- The current playable landmark is the Old State House.
- © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), geographic data under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Retain data attribution and the public data notice when sharing.

See [broader city context and navigation](docs/BROADER_CONTEXT.md) for the updated crop strategy and configuration.

The modeled district now sits in a low-cost [continuous city backdrop](docs/INFINITE_CONTEXT.md): 196 km² of cached aerial context, softened into distance haze. Exploration remains near the trail.

See [oval stage illumination](docs/STAGE_LIGHT.md) for the shared light field and complete boundary buildings.

Task 2 preserves the atlas design while adding sourced landmark descriptions, a small future-experience registry, smooth camera focus/reset, and two schematic architectural cues. See [refinement and verification](docs/TASK2_REFINEMENT.md) and [historical sources](docs/LANDMARK_HISTORY.md).

## Old State House NPCs

The tourist and historical guide support typed conversations through the local Qwen3 service. See [Task 2.2 setup, controls and API](docs/TASK2_2_NPCS.md).


### Boston, 1770 — The Evidence Hunt

At street level in the Old State House, select **Enter Boston, 1770** in Site Notes. Use WASD and drag look, E to interact, and J for the evidence journal. Run the frontend command above. For live witness questions, run these commands from the project root in separate terminals:

```sh
ollama serve
backend/.venv/bin/python -m uvicorn backend.npc_api:app --host 127.0.0.1 --port 8000
```

The backend uses the locally installed Qwen3 model. The printed records and journal also work offline. See [scene notes](docs/HISTORICAL_SCENE.md), [sources](docs/HISTORICAL_SOURCES.md), and [gameplay](docs/GAMEPLAY_EVIDENCE_HUNT.md).

For the hosted demo, see [Render deployment](docs/RENDER_DEMO.md).
