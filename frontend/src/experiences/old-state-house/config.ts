import type { Point, PolygonFeature, Road, SceneData } from '../../lib/scene-data.ts'
import type { Collider, CollisionWorld } from './collision.ts'

export type Position = [number, number, number]
export interface NpcSpawn { id: 'curious-tourist' | 'historical-guide'; label: string; position: Position; yawRadians: number; waypoints?: Position[] }
export interface SceneAnchor { id: 'architecture' | 'boston-massacre-site' | 'historical-documents' | 'historical-experience'; label: string; position: Position; available: boolean; description: string; source: string }
export interface PropPlacement { id: string; kind: 'bollard' | 'planter' | 'bench' | 'lamp'; position: Position; yawRadians: number }
export interface ExplorationConfig {
  origin: Point; landmark: PolygonFeature; contextBuildings: PolygonFeature[]; roads: Road[]; greens: PolygonFeature[]; pavedAreas: PolygonFeature[]; routePaths: Point[][]
  collision: CollisionWorld; playerSpawn: { position: Position; target: Position }; npcSpawns: NpcSpawn[]; anchors: SceneAnchor[]; props: PropPlacement[]
  buildingRotationY: number; modelUrl: string; propsUrl: string
}

function ringBounds(rings: Point[][]): [number, number, number, number] {
  const points = rings.flat()
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
}
function nearby(rings: Point[][], extent: number): boolean {
  const b = ringBounds(rings)
  return b[0] <= extent && b[1] <= extent && b[2] >= -extent && b[3] >= -extent
}
function collider(feature: PolygonFeature): Collider {
  const rings = feature.rings.map(ring => ring.map(([x, n]): Point => [x, -n]))
  return { id: feature.id ?? 'structure', rings, bounds: ringBounds(rings) }
}

export function createExplorationConfig(data: SceneData): ExplorationConfig {
  const site = data.landmarks.find(landmark => landmark.id === 'old-state-house')
  const massacre = data.landmarks.find(landmark => landmark.id === 'boston-massacre-site')
  if (!site || !massacre) throw new Error('Old State House geographic anchors are missing.')
  const origin = site.position
  const localPoint = ([east, north]: Point): Point => [east - origin[0], north - origin[1]]
  const localFeature = (feature: PolygonFeature): PolygonFeature => ({ ...feature, rings: feature.rings.map(ring => ring.map(localPoint)) })
  const original = data.buildings.find(building => building.id === 'way-29608515-0')
  if (!original) throw new Error('The actual Old State House footprint is missing.')
  const landmark = localFeature(original)
  const contextBuildings = data.buildings.filter(building => building !== original).map(localFeature).filter(building => nearby(building.rings, 170))
  const roads = data.roads.map(road => ({ ...road, paths: road.paths.map(path => path.map(localPoint)).flatMap(path => path.slice(1).flatMap((point, index) => nearby([[path[index], point]], 170) ? [[path[index], point]] : [])) })).filter(road => road.paths.length)
  const landscape = data.greens.map(localFeature).filter(feature => nearby(feature.rings, 170))
  const greens = landscape.filter(feature=>feature.kind!=='pedestrian-space')
  const pavedAreas = landscape.filter(feature=>feature.kind==='pedestrian-space')
  const routePaths = data.route.segments.flatMap(segment => {
    const path = segment.coordinates.map(localPoint)
    return path.slice(1).flatMap((point, index) => nearby([[path[index], point]], 170) ? [[path[index], point]] : [])
  })
  const props: PropPlacement[] = [
    { id: 'west-planter', kind: 'planter', position: [-12, 0, -19.5], yawRadians: 0 },
    { id: 'west-bollard', kind: 'bollard', position: [-21, 0, -18], yawRadians: 0 },
    { id: 'east-bollard', kind: 'bollard', position: [18, 0, 3.5], yawRadians: 0 },
    { id: 'north-planter', kind: 'planter', position: [-6, 0, -20], yawRadians: 0 },
    { id: 'plaza-bench', kind: 'bench', position: [21.1, 0, -2.37], yawRadians: 0 },
    { id: 'plaza-lamp', kind: 'lamp', position: [19, 0, -21], yawRadians: 0 },
    { id: 'west-lamp', kind: 'lamp', position: [-25, 0, -17.5], yawRadians: 0 },
  ]
  const colliders = [landmark, ...contextBuildings].filter(feature => nearby(feature.rings, 54)).map(collider)
  for (const prop of props) {
    const [x, , z] = prop.position
    const [hx, hz] = prop.kind === 'planter' ? [1, 1] : prop.kind==='bench' ? [1.2,0.48] : [0.2, 0.2]
    colliders.push({ id: prop.id, rings: [[[x-hx,z-hz],[x+hx,z-hz],[x+hx,z+hz],[x-hx,z+hz],[x-hx,z-hz]]], bounds: [x-hx,z-hz,x+hx,z+hz] })
  }
  let longest = 0, buildingRotationY = 0
  const ring = landmark.rings[0]
  for (let i = 1; i < ring.length; i++) {
    let dx = ring[i][0] - ring[i-1][0], dn = ring[i][1] - ring[i-1][1]
    const length = Math.hypot(dx, dn)
    if (length > longest) { if (dx < 0) { dx = -dx; dn = -dn }; longest = length; buildingRotationY = Math.atan2(dn, dx) }
  }
  return {
    origin, landmark, contextBuildings, roads, greens, pavedAreas, routePaths, props, buildingRotationY,
    modelUrl: '/experiences/old-state-house/models/old-state-house.glb', propsUrl: '/experiences/old-state-house/models/streetscape.glb',
    collision: { bounds: [-52, -50, 52, 50], colliders },
    playerSpawn: { position: [38, 1.68, -16], target: [1, 13, 0] },
    npcSpawns: [
      { id: 'curious-tourist', label: 'Curious tourist', position: [23.5, 0, -8], yawRadians: -Math.PI/2, waypoints: [[23.5,0,-8],[26.5,0,-7.5]] },
      { id: 'historical-guide', label: 'Historical guide', position: [24, 0, -3], yawRadians: -Math.PI/2 },
    ],
    anchors: [
      { id: 'architecture', label: 'Old State House architecture', position: [20.5, 0, 1], available: true, description: 'Built in 1713, the Old State House served as the seat of royal government in Massachusetts. Its east balcony became the setting for Boston’s first public reading of the Declaration of Independence in July 1776. Explore the exterior; interiors are outside this experience.', source: 'https://revolutionaryspaces.org/discover/old-state-house/' },
      { id: 'boston-massacre-site', label: 'Boston Massacre site', position: [massacre.position[0]-origin[0], 0, -(massacre.position[1]-origin[1])], available: true, description: 'A pavement marker outside the Old State House commemorates the Boston Massacre of March 5, 1770, when British soldiers killed five people. This scene follows the cached mapped marker location; it is a present-day visit, not a reconstruction of the event.', source: 'https://www.thefreedomtrail.org/trail-sites/boston-massacre-site' },
      { id: 'historical-documents', label: 'Historical documents', position: [20, 0, -10], available: false, description: 'Reserved for a future archival experience.', source: '' },
      { id: 'historical-experience', label: 'Historical experience', position: [26, 0, 0], available: false, description: 'Reserved for a future historical experience.', source: '' },
    ],
  }
}
