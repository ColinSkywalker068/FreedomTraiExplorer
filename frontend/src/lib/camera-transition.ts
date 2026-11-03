import { Spherical, Vector3 } from 'three'
import { distanceToRoute } from './scene-camera.ts'

export interface CameraPose { position: Vector3; target: Vector3; zoom: number }
export const cameraTransitionDuration = (reducedMotion: boolean) => reducedMotion ? 0 : 0.65

/** Ease around the target instead of flying a straight line through city geometry. */
export function interpolateCameraPose(start: CameraPose, end: CameraPose, progress: number, targetPath?: Vector3[]): CameraPose {
  const t = Math.min(1, Math.max(0, progress))
  const ease = t * t * (3 - 2 * t)
  const target = targetPath?.length ? sampleTargetPath(targetPath, ease) : start.target.clone().lerp(end.target, ease)
  const from = new Spherical().setFromVector3(start.position.clone().sub(start.target))
  const to = new Spherical().setFromVector3(end.position.clone().sub(end.target))
  const arc = Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta))
  const offset = new Vector3().setFromSpherical(new Spherical(
    from.radius + (to.radius - from.radius) * ease,
    from.phi + (to.phi - from.phi) * ease,
    from.theta + arc * ease,
  ))
  return { position: target.clone().add(offset), target, zoom: start.zoom + (end.zoom - start.zoom) * ease }
}
/** Route-connected travel avoids discontinuous nearest-branch clamps between distant sites. */
export function createCameraTargetPath(start: Vector3, end: Vector3, paths: [number, number][][], radius = 450): Vector3[] {
  const distance = start.distanceTo(end)
  if (distance < 0.001) return [start.clone(), end.clone()]
  const steps = Math.max(1, Math.ceil(distance / 25))
  const margin = distance / steps / 2
  if (Array.from({ length: steps + 1 }, (_, i) => start.clone().lerp(end, i / steps))
    .every(point => distanceToRoute([point.x, -point.z], paths) <= radius - margin)) return [start.clone(), end.clone()]
  const points = new Map<string, Vector3>()
  const graph = new Map<string, Map<string, number>>()
  const key = (p: Vector3) => `${p.x},${p.z}`
  const add = (id: string, p: Vector3) => { points.set(id, p); if (!graph.has(id)) graph.set(id, new Map()) }
  const link = (a: string, b: string) => {
    const length = points.get(a)!.distanceTo(points.get(b)!)
    graph.get(a)!.set(b, length); graph.get(b)!.set(a, length)
  }
  const segments: [string, string][] = []
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = new Vector3(path[i-1][0], 0, -path[i-1][1]), b = new Vector3(path[i][0], 0, -path[i][1])
    add(key(a), a); add(key(b), b); link(key(a), key(b)); segments.push([key(a), key(b)])
  }
  if (!segments.length) return [start.clone(), end.clone()]
  const attach = (id: string, location: Vector3) => {
    let best = Infinity, edge = segments[0], projected = location.clone()
    for (const candidate of segments) {
      const a = points.get(candidate[0])!, b = points.get(candidate[1])!
      const delta = b.clone().sub(a)
      const t = Math.max(0, Math.min(1, location.clone().sub(a).dot(delta) / (delta.lengthSq() || 1)))
      const point = a.clone().addScaledVector(delta, t), distance = point.distanceToSquared(location)
      if (distance < best) { best = distance; edge = candidate; projected = point }
    }
    add(id, projected); link(id, edge[0]); link(id, edge[1])
    return edge
  }
  const first = attach('@start', start), last = attach('@end', end)
  if (first[0] === last[0] && first[1] === last[1]) link('@start', '@end')
  const distances = new Map<string, number>([['@start', 0]]), previous = new Map<string, string>()
  const remaining = new Set(graph.keys())
  while (remaining.size) {
    let current = '', distance = Infinity
    for (const id of remaining) if ((distances.get(id) ?? Infinity) < distance) { current = id; distance = distances.get(id)! }
    if (!current || current === '@end') break
    remaining.delete(current)
    for (const [neighbor, length] of graph.get(current)!) {
      if (distance + length < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, distance + length); previous.set(neighbor, current)
      }
    }
  }
  if (!previous.has('@end')) return [start.clone(), end.clone()]
  const ids = ['@end']
  while (ids[0] !== '@start') ids.unshift(previous.get(ids[0])!)
  return [start.clone(), ...ids.map(id => points.get(id)!.clone()), end.clone()]
}

function sampleTargetPath(path: Vector3[], fraction: number): Vector3 {
  const lengths = path.slice(1).map((point, i) => point.distanceTo(path[i]))
  let remaining = lengths.reduce((sum, value) => sum + value, 0) * fraction
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) return path[i].clone().lerp(path[i+1], remaining / lengths[i])
    remaining -= lengths[i]
  }
  return path[path.length-1].clone()
}