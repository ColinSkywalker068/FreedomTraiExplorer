import { BufferGeometry, Float32BufferAttribute } from 'three'

/** Image top is north; geographic north maps to scene negative Z. */
export function createBackdropQuad(bounds: number[]): BufferGeometry {
  const [west, south, east, north] = bounds
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([west, -0.25, -north, east, -0.25, -north, west, -0.25, -south, east, -0.25, -south], 3))
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2))
  geometry.setIndex([0, 2, 1, 2, 3, 1])
  geometry.computeBoundingSphere()
  return geometry
}

export function resolveBackdropHaze(backdrop: { bounds: number[]; center: number[]; hazeStartMeters: number; hazeEndMeters: number }, detailBounds: number[]): { start: number; end: number } {
  const [cx, cn] = backdrop.center
  const edge = Math.min(cx - backdrop.bounds[0], cn - backdrop.bounds[1], backdrop.bounds[2] - cx, backdrop.bounds[3] - cn)
  const detailRadius = Math.max(...[detailBounds[0], detailBounds[2]].flatMap(x => [detailBounds[1], detailBounds[3]].map(n => Math.hypot(x - cx, n - cn))))
  const end = Math.min(backdrop.hazeEndMeters, edge - 1)
  return { start: Math.min(end - 1, Math.max(backdrop.hazeStartMeters, detailRadius + 100)), end }
}
