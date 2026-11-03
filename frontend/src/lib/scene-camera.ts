import { OrthographicCamera, Vector3 } from 'three'
import type { Camera } from 'three'
import type { Landmark } from './scene-data.ts'
import type { Point } from './scene-data.ts'

export function distanceToRoute(point: Point, paths: Point[][]): number {
  return Math.sqrt(nearestRoutePoint(point[0], point[1], paths).distanceSquared)
}
import { viewFrame } from './scene-data.ts'

export function shouldApplyViewAction(lastHandledId: number | null, action: { id: number; type: 'reset' | 'in' | 'out' | 'focus' }): boolean {
  return lastHandledId !== action.id || action.type === 'reset'
}

export function projectLandmarkPositions(landmarks: Pick<Landmark, 'id' | 'position'>[], camera: Camera, size: { width: number; height: number }, elevation = 65) {
  // Controls run before the renderer; demand frames must use this frame's inverse.
  camera.updateMatrixWorld(true)
  return landmarks.map(site => {
    const point = new Vector3(site.position[0], elevation, -site.position[1]).project(camera)
    return { id: site.id, x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2, visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.15 && Math.abs(point.y) < 1.15 }
  })
}

export function panOrthographicCamera(camera: OrthographicCamera, target: Vector3, key: string, size: { width: number; height: number }, pixels = 24): boolean {
  const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  const direction = directions[key]
  if (!direction || size.width <= 0 || size.height <= 0) return false
  camera.updateMatrixWorld(true)
  const horizontal = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(direction[0] * pixels * (camera.right - camera.left) / camera.zoom / size.width)
  const vertical = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(direction[1] * pixels * (camera.top - camera.bottom) / camera.zoom / size.height)
  const delta = horizontal.add(vertical)
  camera.position.add(delta)
  target.add(delta)
  camera.updateMatrixWorld(true)
  return true
}

function nearestRoutePoint(east: number, north: number, paths: Point[][]) {
  let nearestEast = east
  let nearestNorth = north
  let nearestDistanceSquared = Infinity
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const [ax, an] = path[i - 1]
    const [bx, bn] = path[i]
    const dx = bx - ax
    const dn = bn - an
    const lengthSquared = dx * dx + dn * dn
    const fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, ((east - ax) * dx + (north - an) * dn) / lengthSquared)) : 0
    const x = ax + fraction * dx
    const n = an + fraction * dn
    const distanceSquared = (east - x) ** 2 + (north - n) ** 2
    if (distanceSquared < nearestDistanceSquared) { nearestDistanceSquared = distanceSquared; nearestEast = x; nearestNorth = n }
  }
  return { east: nearestEast, north: nearestNorth, distanceSquared: nearestDistanceSquared }
}

export function constrainCameraTargetToRoute(camera: Camera, target: Vector3, paths: Point[][], radius: number): boolean {
  const east = target.x
  const north = -target.z
  const nearest = nearestRoutePoint(east, north, paths)
  let clampedEast = east
  let clampedNorth = north
  if (Number.isFinite(nearest.distanceSquared) && nearest.distanceSquared > radius * radius) {
    const factor = radius / Math.sqrt(nearest.distanceSquared)
    clampedEast = nearest.east + (east - nearest.east) * factor
    clampedNorth = nearest.north + (north - nearest.north) * factor
  }
  const delta = new Vector3(clampedEast - east, -target.y, -clampedNorth - target.z)
  if (delta.lengthSq() < 1e-12) return false
  target.add(delta)
  camera.position.add(delta)
  camera.updateMatrixWorld(true)
  return true
}

export function overviewZoomLimits(bounds: number[], size: { width: number; height: number }): { min: number; max: number } {
  const camera = new OrthographicCamera()
  fitCameraToBounds(camera, bounds, { width: Math.max(1, size.width), height: Math.max(1, size.height) })
  return { min: Math.min(6, Math.max(0.0001, camera.zoom * 0.8)), max: 6 }
}

/** Fit the projected geographic rectangle, reserving room for map furniture. */
export function fitCameraToBounds(camera: OrthographicCamera, bounds: number[], size: { width: number; height: number }): void {
  const frame = viewFrame(bounds)
  const center = new Vector3(...frame.center)
  camera.position.copy(center).add(new Vector3(frame.span * 0.65, frame.span * 1.05, frame.span * 0.75))
  camera.lookAt(center)
  camera.near = 1
  camera.far = frame.span * 12
  camera.left = -size.width / 2
  camera.right = size.width / 2
  camera.top = size.height / 2
  camera.bottom = -size.height / 2
  camera.updateMatrixWorld()
  const corners = [bounds[0], bounds[2]].flatMap(x => [bounds[1], bounds[3]].map(north => new Vector3(x, 0, -north).applyMatrix4(camera.matrixWorldInverse)))
  const width = Math.max(...corners.map(corner => corner.x)) - Math.min(...corners.map(corner => corner.x))
  const height = Math.max(...corners.map(corner => corner.y)) - Math.min(...corners.map(corner => corner.y))
  camera.zoom = Math.min(size.width * 0.8 / width, size.height * 0.72 / height)
  camera.updateProjectionMatrix()
}


export const orbitTiltLimits = { min: Math.PI * 35 / 180, max: Math.PI * 55 / 180 }

/** Smallest zoom whose ground footprint stays in the backdrop and source stays above view. */
export function safePerspectiveZoom(camera: OrthographicCamera, bounds?: number[], source?: Vector3): number {
  camera.updateMatrixWorld(true)
  let minimum = 0.0001
  const direction = camera.getWorldDirection(new Vector3())
  if (bounds && direction.y < -0.01) {
    const center = camera.position.clone().addScaledVector(direction, -camera.position.y / direction.y)
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    right.addScaledVector(direction, -right.y / direction.y)
    up.addScaledVector(direction, -up.y / direction.y)
    const padding = 300
    for (const x of [camera.left, camera.right]) for (const y of [camera.bottom, camera.top]) {
      const offset = right.clone().multiplyScalar(x).addScaledVector(up, y)
      for (const [value, delta, lower, upper] of [
        [center.x, offset.x, bounds[0] + padding, bounds[2] - padding],
        [-center.z, -offset.z, bounds[1] + padding, bounds[3] - padding],
      ]) {
        const room = delta >= 0 ? upper - value : value - lower
        minimum = Math.max(minimum, Math.abs(delta) / Math.max(1, room))
      }
    }
  }
  if (source) {
    const height = source.clone().applyMatrix4(camera.matrixWorldInverse).y
    minimum = Math.max(minimum, camera.top * 1.15 / Math.max(1, height))
  }
  return minimum
}

/** Move back along the viewing axis when the widened view reaches the near plane.
 * Orthographic framing is unchanged by this translation. */
export function clearAtlasNearPlane(camera: OrthographicCamera, elevation: number): boolean {
  camera.updateMatrixWorld(true)
  const direction = camera.getWorldDirection(new Vector3())
  if (direction.y >= -0.01) return false
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const lowestRay = camera.position.y
    + Math.min(camera.bottom * up.y, camera.top * up.y) / camera.zoom
    + Math.min(camera.left * right.y, camera.right * right.y) / camera.zoom
  const clearance = (lowestRay - elevation) / -direction.y
  const retreat = camera.near + 1 - clearance
  if (retreat <= 1e-6) return false
  camera.position.addScaledVector(direction, -retreat)
  camera.updateMatrixWorld(true)
  return true
}
