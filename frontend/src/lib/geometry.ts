import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry, Vector2 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Point, PolygonFeature } from './scene-data.ts'
import type { Road } from './scene-data.ts'

export function createRoadNetwork(roads: Road[]): BufferGeometry {
  const parts = roads.map(road => createRibbons(road.paths, road.width, road.bridge ? 3 : 2.3))
  const merged = parts.length ? mergeGeometries(parts, false)! : new BufferGeometry()
  parts.forEach(part => part.dispose())
  return merged
}

/** Each polygon retains its exterior and all interior rings. */
export function createFootprints(features: PolygonFeature[], extrude = false, baseElevation = 0): BufferGeometry {
  const geometries = features.map(feature => {
    const shape = new Shape(feature.rings[0].map(([x, y]) => new Vector2(x, y)))
    shape.holes = feature.rings.slice(1).map(ring => new Path(ring.map(([x, y]) => new Vector2(x, y))))
    let geometry: BufferGeometry = extrude
      ? new ExtrudeGeometry(shape, { depth: feature.height ?? 1, bevelEnabled: false, steps: 1, curveSegments: 1 })
      : new ShapeGeometry(shape)
    if (geometry.index) {
      const indexed = geometry
      geometry = indexed.toNonIndexed()
      indexed.dispose()
    }
    // east, north, elevation -> east, elevation, -north
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, baseElevation, 0)
    geometry.clearGroups()
    return geometry
  })
  if (!geometries.length) return new BufferGeometry()
  const merged = mergeGeometries(geometries, false)!
  geometries.forEach(geometry => geometry.dispose())
  merged.computeBoundingSphere()
  return merged
}

/** Independent straight ribbons never connect unrelated branches or smooth through blocks. */
export function createRibbons(paths: Point[][], width: number, height: number): BufferGeometry {
  const vertices: number[] = []
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, an] = path[i - 1]
      const [bx, bn] = path[i]
      const length = Math.hypot(bx - ax, bn - an)
      if (length < 0.0001) continue
      const dx = -(bn - an) / length * width / 2
      const dz = -(bx - ax) / length * width / 2
      const a = [ax + dx, height, -an + dz]
      const b = [ax - dx, height, -an - dz]
      const c = [bx + dx, height, -bn + dz]
      const d = [bx - dx, height, -bn - dz]
      vertices.push(...a, ...c, ...b, ...b, ...c, ...d)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
