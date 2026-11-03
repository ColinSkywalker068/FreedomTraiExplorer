import type { Point } from '../../lib/scene-data.ts'
export interface Collider { id: string; rings: Point[][]; bounds: [number, number, number, number] }
export interface CollisionWorld { bounds: [number, number, number, number]; colliders: Collider[] }
function insideRing(point: Point, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}
function distanceToEdgeSquared(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const length = dx * dx + dz * dz
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length)) : 0
  return (point[0] - a[0] - t * dx) ** 2 + (point[1] - a[1] - t * dz) ** 2
}
export function canStand(position: Point, world: CollisionWorld, radius = 0.32): boolean {
  const [x, z] = position
  const [minX, minZ, maxX, maxZ] = world.bounds
  if (x < minX + radius || x > maxX - radius || z < minZ + radius || z > maxZ - radius) return false
  for (const collider of world.colliders) {
    const b = collider.bounds
    if (x < b[0] - radius || z < b[1] - radius || x > b[2] + radius || z > b[3] + radius) continue
    if (insideRing(position, collider.rings[0]) && !collider.rings.slice(1).some(ring => insideRing(position, ring))) return false
    for (const ring of collider.rings) for (let i = 0; i < ring.length; i++) if (distanceToEdgeSquared(position, ring[i], ring[(i + 1) % ring.length]) < radius * radius) return false
  }
  return true
}
export function moveWithCollisions(position: Point, delta: Point, world: CollisionWorld, radius = 0.32): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / Math.min(0.2, radius / 2)))
  const dx = delta[0] / steps, dz = delta[1] / steps
  let [x, z] = position
  for (let i = 0; i < steps; i++) {
    if (canStand([x + dx, z], world, radius)) x += dx
    if (canStand([x, z + dz], world, radius)) z += dz
  }
  return [x, z]
}
