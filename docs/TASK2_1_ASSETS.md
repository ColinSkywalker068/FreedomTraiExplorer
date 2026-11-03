# Task 2.1 Old State House exterior assets

The detailed exterior uses the acquired **Old State House Boston** architecture by **MakeALot**, converted from the complete STL. It preserves the actual printed model’s stepped gables, balcony, dormers, sash geometry, roof, and layered cupola. The runtime directory contains only that building, two selected streetscape props, and an attribution notice. The source archives and extracted files were not changed.

## Runtime contract

| Asset | Runtime URL | Actual size | Geometry |
| --- | --- | ---: | ---: |
| Old State House | `/experiences/old-state-house/models/old-state-house.glb` | 4,113,740 bytes | 75,402 triangles; 6 materials |
| Streetscape prop library | `/experiences/old-state-house/models/streetscape.glb` | 415,480 bytes | 308 triangles across two named roots |
| Attribution | `/experiences/old-state-house/NOTICE.txt` | text | Creator, source, license, and modifications |

The building is already scaled to meters. Its glTF bounds are `[-16.962221, 0, -6.031668]` through `[16.962221, 31.064575, 6.031668]` in X/Y/Z order. Local **+X faces the east balcony**, **+Y is up**, and Z is the horizontal width. The ground is Y=0; the overall horizontal bounding box is centered. Place it at the mapped building center, then rotate about Y by **+3.5321°** in the scene convention east=+X, north=−Z. No additional model scale is needed.

The prop GLB is a library, not a placed scene. Clone the selected named root rather than drawing both coincident roots. `Bollard` is approximately `0.216 × 0.892 × 0.227 m` (190 triangles); `Planter` is `2.000 × 0.600 × 2.000 m` (118 triangles), all in X/Y/Z order. Each is independently centered on X/Z and grounded at Y=0. Placements in the experience are artistic furnishings, not surveyed locations.

## Architectural source and scale

- Source: [Old State House Boston by MakeALot](https://pinshape.com/items/5151-old-state-house-boston), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). User supplied the authenticated archive; no credentials were handled by the conversion. The original ZIP is `assets/raw/architecture/old-state-house-makealot/old-state-house-boston-by-makealot.zip` and the input is its `extracted/OldStateHouseComplete.stl`. The separately supplied wall component was not substituted into the assembled mesh.
- Footprint reference: cached [OSM way 29608515](https://www.openstreetmap.org/way/29608515), projected in EPSG:26986. Its simplified minimum bounding rectangle is **33.9244 × 12.0633 m**, at **+3.5321°** from projected east. Scale the overall source bounds, including the protruding balcony, to that rectangle; it is a scene registration envelope rather than a dimensional survey of the walls.
- Orientation: the Blender clay renders from both gables show the balcony only at source +X. This matches the east elevation’s balcony in the [NPS architectural description](https://www.nps.gov/media/video/view.htm?id=8E81E055-8721-4D77-B0C7-EBB208E48ABD) and [Revolutionary Spaces’ building history](https://revolutionaryspaces.org/discover/old-state-house/). Blender’s standard Y-up export keeps source +X as runtime +X.
- Height ruling: the raw OSM way has `height=20`; this is a source tag, not the application’s generic building-height estimate. Its datum and tower inclusion are unspecified. The [MIT/NSF structural study archived by NIST, §2.3](https://nehrpsearch.nist.gov/static/files/NSF/PB82105008.pdf#page=14) describes about 51–57 ft excluding the central tower and a tower extending about 70 ft above the attic floor. Treating 20 m as a cupola-inclusive total would flatten the source silhouette. Preserve the STL’s vertical-to-length proportion, yielding **31.065 m** inclusive of cupola, while narrowing width by about 8.7% relative to a uniform scale to match the mapped width. The resulting total is source-proportioned and approximate, not a claimed modern surveyed height.

The raw STL extent is `253.425 × 98.700 × 232.061` print units in Blender X/Y/Z. Applied factors are `0.13386383 / 0.12222224 / 0.13386383` meters per source unit. Subtract the source horizontal midpoint and minimum Z before scaling, then export the grounded result in glTF axes.

## Conversion and optimization

1. Inspect the complete STL in Blender 5.2.3 LTS from both gables and the side, and record individual component bounds. The source is already assembled and shows no print raft or supports. Blender’s import removed seven duplicate triangles; the conversion dissolved degenerate geometry and recalculated normals without remeshing the architectural details. The imported source reported 26 nonmanifold edges before cleanup; this exterior display model is not supplied as a watertight collider.
2. Assign warm painted timber/stone trim, brick, slate, foundation stone, an aged brass finial, and recessed dark glazing. A deterministic, original 512 px brick image uses physical UV scale; it is an illustration of masonry color and bond, not a sampled historical texture. Recessed backing quads sit behind the preserved window sash geometry. No interior was constructed.
3. Select only `Prop_Bollard.gltf` and `Prop_Planter_Single.gltf` from [Quaternius Downtown City MegaKit Standard](https://quaternius.itch.io/downtown-city-megakit), licensed [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Center and ground each named root. Preserve the source base-color pattern at up to 512 px while replacing the prop normal and ORM maps with simplified PBR parameters. This reduced the two-prop library from about 6.87 MB to 415 KB, with unchanged mesh bounds and triangle counts.
4. Export self-contained GLBs in Blender, then use the prepared glTF Transform wrapper for deduplication, vertex welding, and pruning. No Draco, meshopt, external texture URI, or added runtime decoder is needed. No lossy geometry decimation was applied to the building’s small architectural features.

Reproduction commands from the project root (use a fresh optimization output path):

```sh
scripts/asset_processing/blender.sh --background --python "$PWD/scripts/asset_processing/inspect_old_state_house.py"
scripts/asset_processing/blender.sh --background --python "$PWD/scripts/asset_processing/convert_old_state_house.py"
scripts/asset_processing/optimize_asset.sh assets/processed/inspection/old-state-house/old-state-house-unoptimized.glb /tmp/old-state-house.glb
scripts/asset_processing/optimize_asset.sh assets/processed/inspection/old-state-house/streetscape-unoptimized.glb /tmp/streetscape.glb
# After validation, copy the two GLBs to frontend/public/experiences/old-state-house/models/.
.venv/bin/python scripts/asset_processing/validate_old_state_house_assets.py
```

## Verification and provenance

The asset contract first failed on the missing runtime building, then passed on the generated files. It checks GLB parsing, embedded resources, bounds/orientation envelope, material/triangle counts, the two named prop roots, and byte equality between the source STL and its ZIP member. Both final GLBs were inspected and validated with glTF Transform; validation found **zero errors, warnings, informational findings, or hints**. The source and converted geometry were visually inspected in Blender using architectural and eye-height renders. Browser integration and player/collision verification are covered separately by the experience workflow.

| Evidence | SHA256 |
| --- | --- |
| User-supplied architecture ZIP | `f9aa22fbb76970cbf47238fb8c7b524a6181d563c34eb28869737bf61e7b67f7` |
| Original `OldStateHouseComplete.stl` | `cd46e94e08a98bc6650d5c76e473c116adc47f3edc02b937890649aee3bd3b70` |
| Quaternius environment Standard ZIP | `5b1a945576d54cdbb4ccc9c3d52711e6d530da74c74c586407ecc28b165335da` |
| Original `Prop_Bollard.gltf` | `4a05291a05873e4043c6354c7cae969c0726fd9b4590625a24ee3bcf940a1c9a` |
| Original `Prop_Planter_Single.gltf` | `5ab51700931236c2de45c9c8c5c1206ff312d56f00cedf134bfa462da4ef4f13` |
| Runtime `old-state-house.glb` | `7684c8de4dbd42ce3f29252934a2bfda2eb4c34c2898cf9f63de7128e0a6ac64` |
| Runtime `streetscape.glb` | `f25fa89cb2e678d350cc51eabd1f90c1cb606390f9ea9e8805a96a396e80709a` |

Local processing evidence is under `assets/processed/inspection/old-state-house/`: `manifest.json` records conversions, all raw prop dependency hashes and ZIP matching, runtime checks, and image names. The render files are `source-positive-x.png`, `source-negative-x.png`, `source-side.png`, `materialed-overview.png`, and `materialed-human-front.png`. The folder also contains the CLI inspect reports and validation bounds JSON.

This is an exterior interpretation of the source asset. Fine details such as heraldic sculptures, exact clock detailing, finish wear, and façade/roof measurements are simplified or absent in the STL. No fabricated geometry is presented as a surveyed reconstruction. Retain [the public attribution notice](../frontend/public/experiences/old-state-house/NOTICE.txt) whenever redistributing these assets.
