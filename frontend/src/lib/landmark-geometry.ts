import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PolygonFeature, SceneData } from './scene-data.ts'

const monumentId = 'way-212124093-0'
const stateHouseId = 'way-29718019-0'
const isMonument = (b: PolygonFeature) => b.id === monumentId && b.rings[0].length === 5

/** Rendering only: source footprints/heights remain untouched in the geographic dataset. */
export function buildingsForRendering(buildings: PolygonFeature[]): PolygonFeature[] {
  return buildings.filter(b => !isMonument(b))
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  if (!parts.length) return new BufferGeometry()
  const flat = parts.map(part => part.index ? part.toNonIndexed() : part)
  flat.forEach(part => { part.deleteAttribute('uv'); part.clearGroups() })
  const geometry = mergeGeometries(flat, false)!
  flat.forEach(part => part.dispose())
  parts.forEach(part => { if (!flat.includes(part)) part.dispose() })
  geometry.computeBoundingSphere()
  return geometry
}

export function createLandmarkDetails(data: Pick<SceneData, 'origin' | 'buildings'>): { stone: BufferGeometry; gold: BufferGeometry } {
  const stone: BufferGeometry[] = [], gold: BufferGeometry[] = []
  const stateHouse = data.buildings.find(b => b.id === stateHouseId)
  if (stateHouse) {
    // Cached OSM dome way 240316620 bounds centre, EPSG:26986; not the marker's interior point.
    const x = 235944.305 - data.origin[0], z = -(900944.155 - data.origin[1])
    const radius = 7.55, base = stateHouse.height ?? 18.8
    stone.push(new CylinderGeometry(radius,radius,25-base,20,1).translate(x,(25+base)/2,z))
    const dome = new SphereGeometry(radius,20,8,0,Math.PI*2,0,Math.PI/2)
    dome.scale(1,7/radius,1).translate(x,25,z);gold.push(dome)
    stone.push(new CylinderGeometry(1.5,1.5,4,8,1).translate(x,34,z))
    gold.push(new ConeGeometry(2.2,4,4,1).translate(x,38,z))
  }
  const monument = data.buildings.find(isMonument)
  if (monument) {
    const corners=monument.rings[0].slice(0,4)
    const cx=corners.reduce((sum,p)=>sum+p[0],0)/4, cn=corners.reduce((sum,p)=>sum+p[1],0)/4
    const width=Math.hypot(corners[1][0]-corners[0][0],corners[1][1]-corners[0][1])
    const height=monument.height ?? 67
    const top=corners.map(([x,n])=>[cx+(x-cx)*4.5/width,height-4,-cn-(n-cn)*4.5/width])
    const bottom=corners.map(([x,n])=>[x,0,-n])
    const vertices:number[]=[]
    for(let i=0;i<4;i++) {
      const j=(i+1)%4
      vertices.push(...bottom[i],...top[i],...bottom[j],...bottom[j],...top[i],...top[j])
      vertices.push(...top[i],cx,height,-cn,...top[j])
    }
    const obelisk=new BufferGeometry()
    obelisk.setAttribute('position',new Float32BufferAttribute(vertices,3));obelisk.computeVertexNormals();stone.push(obelisk)
  }
  return { stone: merge(stone), gold: merge(gold) }
}