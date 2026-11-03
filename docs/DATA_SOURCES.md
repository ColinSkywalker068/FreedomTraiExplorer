# Data sources and geographic decisions

Prepared 2026-11-02. This is a source-backed exploratory model, not survey or turn-by-turn navigation data.

## Official trail references

- [Freedom Trail Foundation site list](https://www.thefreedomtrail.org/trail-sites): official 16 identities and geographic order.
- [Foundation FAQs](https://www.thefreedomtrail.org/faqs): visitor route context and ordering. The advertised walk length is not the sum of every branch in this dataset.
- [Official Foundation map](https://www.thefreedomtrail.org/sites/default/files/content/page/hero-image/ft-map.pdf): bridge alignment and Charlestown branches. Cached locally as `data/raw/official-freedom-trail-map.pdf` for validation, not incorporated as artwork in the viewer.
- [NPS maps](https://home.nps.gov/bost/planyourvisit/maps.htm).
- [NPS audio-described map brochure](https://www.nps.gov/bost/planyourvisit/freedom-trail-audio-described-brochure.htm) and [NPS directions](https://home.nps.gov/bost/planyourvisit/directions.htm): independent street-level validation of the Navy Yard/Chestnut/Adams connector.

These references define the official sites and route intent. They do not supply the scene's invented-looking precision: every coordinate and footprint comes from identified OSM geometry. The concept image in `docs/reference/miniature_boston_concept.png` informs visual direction only.

## OpenStreetMap inputs and licensing

- [Candidate trail relation 976514](https://www.openstreetmap.org/relation/976514); [full relation API](https://api.openstreetmap.org/api/0.6/relation/976514/full.json).
- A bounded map extract covers longitude -71.073 to -71.048 and latitude 42.352 to 42.380. Four small map API tiles were fetched sequentially, with pauses, after public Overpass endpoints returned capacity errors. A full-size map request was rejected by OSM's node cap; the four bounded requests succeeded. No parallel bulk scraping was used.
- `data/raw/corridor-tile-0.osm` through `-3.osm` are merged by OSM type/ID into `corridor.osm`, keeping tagged rather than skeletal duplicates.
- The original Overpass QL query is retained as `data/raw/corridor-query.overpassql`. [Overpass Turbo](https://overpass-turbo.eu/) is a query workbench, not an additional geometry source.
- `data/raw/source-manifest.json` records request URLs/parameters, hashes, file dates, and cached status. `corridor-download.json` records the initial successful acquisition. Prepared data is rebuilt locally with [OSMnx](https://osmnx.readthedocs.io/en/stable/), GeoPandas, Shapely, PyProj, and NetworkX.

**Attribution:** © OpenStreetMap contributors. OSM and the derived geographic database are available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OSM copyright and attribution requirements](https://www.openstreetmap.org/copyright) and `frontend/public/data/NOTICE.md`. Keep this attribution and license notice when sharing prepared geographic data. No license is asserted here for unrelated application code.

## Route reconstruction and explicit corrections

Relation member order is not trusted. Only member ways with a highway tag become walking edges. Sixteen non-walking member ways (landmark buildings, cemeteries, park/site boundaries, the ship and museum) are excluded from the route, while retained as geographic features. Nodes join edges by OSM node ID; maximal chains between junctions become individually ordered segments. The original walking relation has two connected components.

1. **Northern bridge landing: 41.42 m.** Connect the two components along already mapped sidewalks/crossings near Chelsea, North Washington and Rutherford. Source ways: 1314062052, 1395412916, 1508639886, 1508639887, 1508639888, 1508639889. The path runs from approximately 42.371128/-71.0615523 to 42.3712847/-71.0620054. No straight gap line was invented.
2. **Missing official Charlestown branch: 224.78 m.** The candidate relation ends on Adams/Chestnut and omits the official route to Navy Yard Gate 1. A reviewed, explicit node sequence follows mapped Chestnut sidewalk, crosses Chelsea and Constitution Road, and continues along the Constitution frontage to Gate 1. Ordered source ways: 843210131, 1263416502, 94842714, 843210143, 843553574, 843553566. Every edge is an OSM footway with sidewalk/crossing tags. This creates the official Charlestown loop and avoids an otherwise 1.2 km backtrack through City Square. Full nodes, way IDs, reason and source are in `scripts/geography_config.json` and the validation report.

The river crossing follows the mapped North Washington/Bill Russell bridge sidewalk (including way 1291968605), not Zakim Bridge or the Charles River Dam. The official map labels this older crossing as Charlestown Bridge. Temporary construction-detour descriptions on older visitor pages were not traced into the scene.

The final network has 14 connected segments and totals 5.653 km across all branches/spurs. This is a **network length**, not a single recommended walking itinerary. The viewer calls it “mapped network.” Corrections carry `street_connector` provenance, and unchanged relation geometry carries `osm_relation` provenance. All route centerlines retain real coordinates; no smoothing curves cross city blocks.

## Landmark identity and positions

| Stop | Official display name | Site type | Latitude, longitude | Primary OSM object |
| --- | --- | --- | --- | --- |
| 1 | Boston Common | park | 42.3550495, -71.0660764 | [relation/17995454](https://www.openstreetmap.org/relation/17995454) |
| 2 | Massachusetts State House | government-building | 42.3586009, -71.0638749 | [way/29718019](https://www.openstreetmap.org/way/29718019) |
| 3 | Park Street Church | church | 42.3568584, -71.0620416 | [way/240317867](https://www.openstreetmap.org/way/240317867) |
| 4 | Granary Burying Ground | cemetery | 42.3571314, -71.0617866 | [way/29861355](https://www.openstreetmap.org/way/29861355) |
| 5 | King's Chapel & Burying Ground | church-and-cemetery | 42.3580511, -71.0600388 | [way/29551954](https://www.openstreetmap.org/way/29551954) |
| 6 | Boston Latin School Site / Benjamin Franklin Statue | statue-and-school-site | 42.3579330, -71.0595681 | [node/3996416865](https://www.openstreetmap.org/node/3996416865) |
| 7 | Old Corner Bookstore | historic-building | 42.3575368, -71.0584239 | [way/240319309](https://www.openstreetmap.org/way/240319309) |
| 8 | Old South Meeting House | meeting-house | 42.3569896, -71.0583844 | [way/29620426](https://www.openstreetmap.org/way/29620426) |
| 9 | Old State House | historic-building | 42.3587305, -71.0574680 | [way/29608515](https://www.openstreetmap.org/way/29608515) |
| 10 | Boston Massacre Site | pavement-marker | 42.3587814, -71.0571703 | [node/632018853](https://www.openstreetmap.org/node/632018853) |
| 11 | Faneuil Hall | market-hall | 42.3600335, -71.0562341 | [way/29551702](https://www.openstreetmap.org/way/29551702) |
| 12 | Paul Revere House | historic-house | 42.3637376, -71.0536828 | [way/240376785](https://www.openstreetmap.org/way/240376785) |
| 13 | Old North Church | church | 42.3663160, -71.0544478 | [way/29650592](https://www.openstreetmap.org/way/29650592) |
| 14 | Copp's Hill Burying Ground | cemetery | 42.3673680, -71.0559115 | [way/29837117](https://www.openstreetmap.org/way/29837117) |
| 15 | USS Constitution | ship | 42.3724393, -71.0565455 | [way/166151194](https://www.openstreetmap.org/way/166151194) |
| 16 | Bunker Hill Monument | monument | 42.3763522, -71.0607674 | [way/212124093](https://www.openstreetmap.org/way/212124093) |

Point objects use their source coordinates. Polygon sites use a representative point inside the real source footprint, so markers identify the site rather than an assumed entrance. The route is not extended through buildings to touch these points. Boston Common's marker is inside the full park, approximately 192 m from the trail centerline. Exact source names, methods and references are included in `landmarks.geojson` and `scene.json`.

King's Chapel and its cemetery count as one official stop; the cemetery is additionally sourced to [way 29818712](https://www.openstreetmap.org/way/29818712). The Latin School/Franklin combined stop additionally references [the actual school-site mosaic](https://www.openstreetmap.org/node/7613081520). USS Constitution is [the frigate footprint](https://www.openstreetmap.org/way/166151194), not the distinct museum building. The OSM footprint named “Old South Meeting Place” is the documented Old South Meeting House building; its source identity is preserved in metadata.

## Projection, clipping and geometry

- Source coordinates are WGS84 longitude/latitude. The shared projected CRS is **EPSG:26986**, NAD83 / Massachusetts Mainland, in meters (not the feet-based Boston 3D model CRS).
- Shared origin: easting 236200.00, northing 901800.00. Local X is east, local 2D Y is north. Three.js maps these to `[east, elevation, -north]`.
- The default `district_context` crop fills the area between trail bends using the convex hull of the real route, sites and Boston Common, with 350 m context padding. It is clipped 30 m inside cached source coverage. This retains 4.30 km² of real surrounding city and shoreline (2.21× the former ribbon area). The original 200 m corridor remains available as `trail_corridor` mode. No horizontal geometry is distorted.
- Geometry is repaired with `make_valid`, simplified at 0.7 m before clipping, snapped on a centimeter grid, and exported with exterior/interior rings intact. MultiPolygons are expanded into independently batched polygons; small sub-square-meter fragments are removed.
- Street/pedestrian centerlines are actual OSM geometry. Display widths are category-based estimates, not measured carriageway boundaries. Underground roads/buildings and proposed/construction footprints are omitted.
- Water uses actual OSM coastlines polygonized against the extract boundary. OSM's land-on-left coastline direction classifies the harbor side. Inland water polygons are added. All water is clipped to the same corridor. Park/site polygons can include harbor water, so water is subtracted from green fill rather than painting water as grass.

## Heights and display approximations

- 331 footprint parts preserve an OSM height tag, including feet-to-meter conversion when needed.
- 713 use mapped floor counts × 3.2 m; these are labeled `estimate:levels`.
- 3195 use deterministic type-based defaults, labeled `estimate:default`. No random heights or coordinate offsets are applied.
- Building footprints are real; roof forms, facades, ship detail, steeples and monument taper are not modeled. The ship is a simplified source-backed footprint extrusion.
- Ground uses a shared flat datum. Beacon Hill/Bunker Hill terrain elevation and bridge deck elevation are not modeled. An 18 m display base is retained only as a fallback when the optional aerial backdrop is absent; a loaded backdrop creates continuous flat surroundings without a raised platform.
- Roads, park fills and the red route are slightly separated vertically to prevent z-fighting. The red centerline is drawn with exaggerated visual width; its horizontal position is unchanged. Marker buttons can overlap when viewing dense downtown sites from far away; use the complete stop list and focus control.

## Optional datasets investigated, not downloaded

[Boston Planning 3D download](https://www.bostonplans.org/3d-data-maps/3d-smart-model/3d-data-download) and [Citywide 3D Model](https://www.bostonplans.org/3d-data-maps/3d-smart-model/citywide-3d-model) were investigated. Download/catalog pages returned 403. The accessible [official model documentation](https://maps.bostonplans.org/3d/3D_Data_Documentation.pdf) describes tiled/individual building models with a feet-based State Plane local origin and model status filtering requirements. They were unnecessary for this OSM foundation; no full-city model was downloaded.

[MassGIS 2D building structures](https://www.mass.gov/info-details/massgis-data-building-structures-2-d) was considered as a roofprint fallback. Its official description identifies town-level data and Boston source updates, but it does not provide the height information needed for this viewer. OSM coverage was sufficient; no MassGIS archive was downloaded.

## Distant aerial context

See [continuous city backdrop](INFINITE_CONTEXT.md) for the public-domain USGS/USDA NAIP source, EPSG:26986 registration, extent, caching and deliberately lower-detail rendering. It complements the OSM-derived detailed district and has its own source/license notice.
