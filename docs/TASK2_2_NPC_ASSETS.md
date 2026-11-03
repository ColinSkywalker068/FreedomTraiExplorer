# Task 2.2 NPC assets

The tourist wears a rust zip jacket, slate trousers, a green cap and a daypack. The guide wears a navy button jacket, tan trousers and a brass name badge. Both use the original Quaternius Standard humanoids. The jackets are separate skinned clothing meshes with relaxed torso silhouettes, turned hem and cuff edges, and fitted skin-weighted trim. The garment surfaces are smoothed across welded seams, with subtle elbow and knee shaping. Trousers have additional calf and thigh ease and a clean ankle cut. Shoes use shaped profiles with a raised instep, tapered heel, rounded toe and thin rubber sole. They use skeletal animation without cloth simulation. The source bodies and clips are CC0 1.0. [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) · [Universal Animation Library](https://quaternius.itch.io/universal-animation-library)

The asset script maps the source's joint rotations onto the matching destination bones through their respective rest orientations. It uses the target rig's bone lengths, samples the original idle, walk and talking loops at 24 Hz, and corrects vertical placement from the skinned foot geometry. Wave, nod and point gestures are built from the retargeted idle pose. The local GLBs each carry `Idle`, `Walk`, `Talk`, `Wave`, `Nod`, and `Point`, with embedded geometry and materials.

| Runtime model | Bytes | SHA-256 |
| --- | ---: | --- |
| `curious-tourist.glb` | 1,613,016 | `32e737199190cbba7203d9f1951a0bc954ade072cee334b0e0d62e4ca6131f68` |
| `historical-guide.glb` | 1,506,840 | `fdeedd84e17e037c70e44c6ba7fa58a010f3dc44fcd38ef267788b208e1cd184` |

The models load independently on entry to the Old State House scene. Each model starts in animated idle before display. The animation mixer blends clip changes and returns to idle after a timed gesture. The tourist follows the scene's existing waypoint segments and pauses to look at the building. Each step checks the plaza collision world, and proximity and conversation can pause travel. The guide stays at the configured spawn. Proximity turns the actors toward the player, and the point-to-guide action briefly highlights the guide's position. Closing the scene releases the mixers and the loaded mesh, material, texture and skeleton resources.

## Reproduce and verify

Run from the project root after the Task 0 base-body inspection staging and glTF Transform setup.

```sh
.venv/bin/python scripts/asset_processing/build_old_state_house_npcs.py
node --experimental-strip-types scripts/asset_processing/verify_old_state_house_npcs.mjs
```

The build runs glTF Transform pruning and validation on each output. The verification script uses the application's Three.js loader to evaluate ten samples per clip and checks model scale, ground clearance and neutral idle width. It also samples 101 positions on each real waypoint segment against the scene's collision world. Local Blender previews are stored in `assets/processed/inspection/characters/task2-2-idle-preview.png`.

The jackets are separate stylized garment shells derived from the source topology; trousers use a separately fitted, relaxed surface derived from the source bodies, with attached accessories. The walking loop uses fixed-speed waypoint travel and clip blending, with sampled vertical grounding. Brief horizontal foot slip can still occur during turns or crossfades.
