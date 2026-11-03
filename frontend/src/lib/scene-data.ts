export type Point = [number, number]
export interface PolygonFeature { id?: string; rings: Point[][]; kind?: string; height?: number; heightSource?: string }
export interface Road { id: string; paths: Point[][]; kind: string; width: number; bridge: boolean }
export interface Landmark { id: string; order: number; name: string; type: string; position: Point; lon: number; lat: number; sources: { url: string; label?: string }[]; [key: string]: unknown }
export interface BackdropData { url: string; bounds: [number, number, number, number]; source: string; attribution: string; hazeStartMeters: number; hazeEndMeters: number; center: Point; pixelSize: Point }
export interface SpotlightData { center: Point; radii: Point; rotationRadians: number; penumbraMeters: number; ambient: number }
export interface SceneData {
  version: number; crs: string; origin: Point; bounds: [number, number, number, number]
  region: PolygonFeature[]; buildings: PolygonFeature[]; roads: Road[]; greens: PolygonFeature[]; water: PolygonFeature[]
  route: { segments: { id: string; coordinates: Point[]; status: string }[]; lengthMeters: number }
  landmarks: Landmark[]; meta: Record<string, unknown>
  backdrop?: BackdropData
  spotlight?: SpotlightData
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const point = (v: unknown): v is Point => Array.isArray(v) && v.length >= 2 && finite(v[0]) && finite(v[1])
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Validate at the network boundary; renderers only consume projected local meters. */
export function validateScene(value: unknown): SceneData {
  requireValue(record(value), 'The city data is not an object.')
  requireValue(value.version === 1 && value.crs === 'EPSG:26986', 'Unsupported city data version or coordinate system.')
  requireValue(point(value.origin), 'The city origin is invalid.')
  requireValue(Array.isArray(value.bounds) && value.bounds.length === 4 && value.bounds.every(finite) && value.bounds[2] > value.bounds[0] && value.bounds[3] > value.bounds[1], 'The city bounds are invalid.')
  for (const key of ['region', 'buildings', 'greens', 'water'] as const) {
    const features = value[key]
    requireValue(Array.isArray(features), `Missing ${key} data.`)
    for (const feature of features) {
      requireValue(record(feature) && Array.isArray(feature.rings) && feature.rings.length > 0 && feature.rings.every((ring: unknown) => Array.isArray(ring) && ring.length >= 4 && ring.every(point)), `Invalid ${key} footprint.`)
      if (key === 'buildings') requireValue(finite(feature.height) && feature.height > 0, 'Invalid building height.')
    }
  }
  requireValue(Array.isArray(value.roads), 'Missing roads data.')
  for (const road of value.roads) requireValue(record(road) && finite(road.width) && road.width > 0 && Array.isArray(road.paths) && road.paths.every((path: unknown) => Array.isArray(path) && path.length >= 2 && path.every(point)), 'Invalid road geometry.')
  requireValue(record(value.route) && finite(value.route.lengthMeters) && value.route.lengthMeters > 0 && Array.isArray(value.route.segments) && value.route.segments.length > 0, 'Missing route geometry.')
  for (const segment of value.route.segments) requireValue(record(segment) && Array.isArray(segment.coordinates) && segment.coordinates.length >= 2 && segment.coordinates.every(point), 'Invalid route coordinates.')
  requireValue(Array.isArray(value.landmarks) && value.landmarks.length === 16, 'The Freedom Trail requires exactly 16 landmarks.')
  const ids = new Set<string>()
  const orders = new Set<number>()
  for (const landmark of value.landmarks) {
    requireValue(record(landmark) && typeof landmark.id === 'string' && !ids.has(landmark.id) && typeof landmark.name === 'string' && finite(landmark.order) && Number.isInteger(landmark.order) && landmark.order >= 1 && landmark.order <= 16 && !orders.has(landmark.order) && point(landmark.position) && finite(landmark.lon) && finite(landmark.lat) && Array.isArray(landmark.sources), 'Invalid landmark data: stops must have unique identifiers and numbers 1–16.')
    ids.add(landmark.id)
    orders.add(landmark.order)
  }
  requireValue(record(value.meta), 'Missing data provenance.')
  if (value.backdrop !== undefined) {
    const backdrop = value.backdrop
    requireValue(record(backdrop), 'Invalid backdrop metadata.')
    requireValue(Array.isArray(backdrop.bounds) && backdrop.bounds.length === 4 && backdrop.bounds.every(finite) && backdrop.bounds[2] > backdrop.bounds[0] && backdrop.bounds[3] > backdrop.bounds[1], 'Invalid backdrop bounds.')
    requireValue(typeof backdrop.url === 'string' && backdrop.url.startsWith('/data/') && typeof backdrop.source === 'string' && typeof backdrop.attribution === 'string', 'Invalid backdrop source.')
    requireValue(point(backdrop.center) && backdrop.center[0] > backdrop.bounds[0] && backdrop.center[0] < backdrop.bounds[2] && backdrop.center[1] > backdrop.bounds[1] && backdrop.center[1] < backdrop.bounds[3], 'Invalid backdrop center.')
    requireValue(finite(backdrop.hazeStartMeters) && finite(backdrop.hazeEndMeters) && backdrop.hazeStartMeters > 0 && backdrop.hazeEndMeters > backdrop.hazeStartMeters, 'Invalid backdrop haze range.')
    requireValue(point(backdrop.pixelSize) && backdrop.pixelSize.every(value => Number.isInteger(value) && value > 0), 'Invalid backdrop image dimensions.')
  }
  if (value.spotlight !== undefined) {
    const spotlight = value.spotlight
    requireValue(record(spotlight) && point(spotlight.center), 'Invalid spotlight center.')
    requireValue(point(spotlight.radii) && spotlight.radii.every(radius => radius > 0), 'Invalid spotlight radii.')
    requireValue(finite(spotlight.rotationRadians) && finite(spotlight.penumbraMeters) && spotlight.penumbraMeters > 0 && finite(spotlight.ambient) && spotlight.ambient >= 0 && spotlight.ambient <= 1, 'Invalid spotlight field parameters.')
  }
  return value as unknown as SceneData
}

export function viewFrame(bounds: number[]): { center: [number, number, number]; span: number } {
  return { center: [(bounds[0] + bounds[2]) / 2, 0, -(bounds[1] + bounds[3]) / 2], span: Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) }
}
