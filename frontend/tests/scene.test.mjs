import test from 'node:test'
import assert from 'node:assert/strict'
import { validateScene, viewFrame } from '../src/lib/scene-data.ts'
import { createFootprints, createRibbons, createRoadNetwork } from '../src/lib/geometry.ts'
import { fitCameraToBounds, shouldApplyViewAction, projectLandmarkPositions, panOrthographicCamera, constrainCameraTargetToRoute, overviewZoomLimits, distanceToRoute } from '../src/lib/scene-camera.ts'
import { OrthographicCamera, Vector3 } from 'three'
import { createBackdropQuad, resolveBackdropHaze } from '../src/lib/backdrop.ts'
import { spotlightIntensity } from '../src/lib/spotlight.ts'

const square = [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]
const hole = [[5, 5], [5, 15], [15, 15], [15, 5], [5, 5]]
const fixture = () => ({
  version: 1, crs: 'EPSG:26986', origin: [230000, 900000], bounds: [0, 0, 100, 200],
  region: [{ rings: [square] }], buildings: [{ id: 'b', rings: [square, hole], height: 12, heightSource: 'estimate', kind: 'yes' }],
  roads: [], greens: [], water: [], route: { segments: [{ id: 'r', coordinates: [[0, 0], [0, 20]], status: 'mapped' }], lengthMeters: 20 },
  landmarks: Array.from({ length: 16 }, (_, index) => ({ id: `site-${index + 1}`, order: index + 1, name: index === 0 ? 'Test site' : `Site ${index + 1}`, type: 'site', position: [10 + index, 10], lon: -71, lat: 42, sources: [] })), meta: {},
})

const backdropFixture = () => ({ url: '/data/city-backdrop.jpg', bounds: [-7000, -7000, 7000, 7000], source: 'USGS NAIP', attribution: 'Imagery: USGS / USDA NAIP', hazeStartMeters: 3500, hazeEndMeters: 6500, center: [0, 0], pixelSize: [2048, 2048] })

test('rejects a coordinate-system mismatch instead of rendering shifted geography', () => {
  const value = fixture()
  value.crs = 'EPSG:4326'
  assert.throws(() => validateScene(value), /coordinate system/i)
})

test('rejects malformed route and building heights before sending them to WebGL', () => {
  const value = fixture()
  value.route.segments[0].coordinates[0][0] = NaN
  assert.throws(() => validateScene(value), /route/i)
  const badHeight = fixture()
  badHeight.buildings[0].height = -3
  assert.throws(() => validateScene(badHeight), /height/i)
  assert.equal(validateScene(fixture()).landmarks[0].name, 'Test site')
})

test('frames an asymmetric corridor around its geographic center', () => {
  assert.deepEqual(viewFrame([100, -200, 500, 800]).center, [300, 0, -300])
  assert.equal(viewFrame([100, -200, 500, 800]).span, 1000)
})

test('requires all sixteen unique official stop numbers', () => {
  const missing = fixture()
  missing.landmarks.pop()
  assert.throws(() => validateScene(missing), /sixteen|16/i)
  const duplicate = fixture()
  duplicate.landmarks[15].order = 1
  assert.throws(() => validateScene(duplicate), /landmark|stop/i)
  const outOfRange = fixture()
  outOfRange.landmarks[15].order = 17
  assert.throws(() => validateScene(outOfRange), /landmark|stop/i)
  const duplicateId = fixture()
  duplicateId.landmarks[15].id = duplicateId.landmarks[0].id
  assert.throws(() => validateScene(duplicateId), /landmark/i)
})

test('extrudes a physical geographic base below a zero top datum', () => {
  const geometry = createFootprints([{ rings: [square, hole], height: 18 }], true, -18)
  geometry.computeBoundingBox()
  assert.ok(Math.abs(geometry.boundingBox.min.y + 18) < 0.001)
  assert.ok(Math.abs(geometry.boundingBox.max.y) < 0.001)
  assert.ok(Math.abs(geometry.boundingBox.min.z + 20) < 0.001)
  geometry.dispose()
})

test('extrudes true footprints with courtyard holes and maps north to negative Z', () => {
  const geometry = createFootprints([{ rings: [square, hole], height: 12 }], true)
  geometry.computeBoundingBox()
  assert.ok(Math.abs(geometry.boundingBox.min.z + 20) < 0.001)
  assert.ok(Math.abs(geometry.boundingBox.max.y - 12) < 0.001)
  // Top triangles must total 20*20 - 10*10 square meters, preserving the hole.
  const p = geometry.attributes.position
  let topArea = 0
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].every(j => Math.abs(p.getY(i + j) - 12) < 0.001)) {
      topArea += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) - (p.getX(i + 2) - p.getX(i)) * (p.getZ(i + 1) - p.getZ(i))) / 2
    }
  }
  assert.ok(Math.abs(topArea - 300) < 0.001)
  geometry.dispose()
})

test('renders disconnected route branches without inventing connecting streets', () => {
  const geometry = createRibbons([[[0, 0], [0, 10]], [[100, 0], [100, 10]]], 4, 3)
  const p = geometry.attributes.position
  for (let i = 0; i < p.count; i += 3) {
    const xs = [p.getX(i), p.getX(i + 1), p.getX(i + 2)]
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 4)
  }
  geometry.computeBoundingBox()
  assert.deepEqual(geometry.boundingBox.min.toArray(), [-2, 3, -10])
  assert.deepEqual(geometry.boundingBox.max.toArray(), [102, 3, 0])
  geometry.dispose()
})

test('skips duplicate route vertices without creating invalid triangles', () => {
  const geometry = createRibbons([[[0, 0], [0, 0], [10, 0]]], 4, 2)
  assert.equal(geometry.attributes.position.count, 6)
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite))
  geometry.dispose()
})

test('fits the real Boston corridor into short desktop and mobile viewports', () => {
  const bounds = [-807.52, -1387.89, 727.12, 1478.47]
  for (const size of [{ width: 582, height: 591 }, { width: 390, height: 580 }]) {
    const camera = new OrthographicCamera()
    fitCameraToBounds(camera, bounds, size)
    const center = new Vector3(-40.2, 0, -45.29).project(camera)
    assert.ok(Math.abs(center.x) < 0.0001 && Math.abs(center.y) < 0.0001)
    for (const x of [bounds[0], bounds[2]]) for (const north of [bounds[1], bounds[3]]) {
      const projected = new Vector3(x, 0, -north).project(camera)
      assert.ok(Math.abs(projected.x) <= 0.81, `horizontal clipping: ${projected.x}`)
      assert.ok(Math.abs(projected.y) <= 0.73, `vertical clipping: ${projected.y}`)
      assert.ok(projected.z > -1 && projected.z < 1)
    }
  }
})

test('keeps ordinary park paths above green surfaces and bridges below the trail', () => {
  const geometry = createRoadNetwork([
    { id: 'park-path', paths: [[[0, 0], [10, 0]]], kind: 'footway', width: 3, bridge: false },
    { id: 'bridge', paths: [[[20, 0], [30, 0]]], kind: 'footway', width: 3, bridge: true },
  ])
  const position = geometry.getAttribute('position')
  assert.equal(position?.count, 12)
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    assert.ok(y > 1.5, 'road must stay above opaque green-space surface')
    assert.ok(y < 4.5, 'road must stay below the trail')
  }
  assert.ok(position.getY(0) < position.getY(6), 'bridge sits above ordinary paths')
  geometry.dispose()
})

test('viewport changes do not replay a handled zoom or focus action', () => {
  for (const type of ['in', 'out', 'focus']) {
    assert.equal(shouldApplyViewAction(5, { id: 5, type }), false)
    assert.equal(shouldApplyViewAction(5, { id: 6, type }), true)
    assert.equal(shouldApplyViewAction(null, { id: 0, type }), true)
  }
  assert.equal(shouldApplyViewAction(5, { id: 5, type: 'reset' }), true, 'a reset view may refit after resize')
})

test('marker projection uses a camera moved after the previous rendered frame', () => {
  const camera = new OrthographicCamera(-100, 100, 100, -100, 1, 1000)
  camera.position.set(0, 100, 100)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  // Controls alter position and orientation before the renderer updates its matrices.
  camera.position.set(100, 120, -100)
  camera.lookAt(100, 0, 0)
  const [marker] = projectLandmarkPositions([{ id: 'site', position: [100, 0] }], camera, { width: 400, height: 300 }, 0)
  assert.ok(Math.abs(marker.x - 200) < 0.001)
  assert.ok(Math.abs(marker.y - 150) < 0.001)
  assert.equal(marker.visible, true)
})

test('arrow-key panning translates camera and orbit target by a screen-space distance', () => {
  const camera = new OrthographicCamera(-200, 200, 150, -150, 1, 1000)
  camera.position.set(0, 100, 100)
  camera.lookAt(0, 0, 0)
  camera.zoom = 2
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const target = new Vector3(0, 0, 0)
  const originalPosition = camera.position.clone()
  const sites = [{ id: 'site', position: [0, 0] }]
  const size = { width: 400, height: 300 }
  const [before] = projectLandmarkPositions(sites, camera, size, 0)
  assert.equal(panOrthographicCamera(camera, target, 'ArrowLeft', size), true)
  const [after] = projectLandmarkPositions(sites, camera, size, 0)
  assert.ok(Math.abs(after.x - before.x - 24) < 0.001)
  assert.ok(Math.abs(after.y - before.y) < 0.001)
  assert.ok(camera.position.clone().sub(originalPosition).distanceTo(target) < 0.001)
  const saved = camera.position.clone()
  assert.equal(panOrthographicCamera(camera, target, 'Enter', size), false)
  assert.deepEqual(camera.position.toArray(), saved.toArray())
})

test('pan limits follow the real nearest route segment rather than its bounding rectangle', () => {
  const route = [[[0, 0], [1000, 0], [1000, 1000]]]
  const target = new Vector3(400, 37, -600)
  const camera = new OrthographicCamera()
  camera.position.copy(target).add(new Vector3(300, 1000, 300))
  const relative = camera.position.clone().sub(target)
  assert.equal(constrainCameraTargetToRoute(camera, target, route, 450), true)
  assert.ok(Math.abs(target.x - 400) < 0.001)
  assert.ok(Math.abs(target.z + 450) < 0.001)
  assert.equal(target.y, 0)
  assert.ok(camera.position.clone().sub(target).distanceTo(relative) < 0.001)
})

test('pan limits preserve targets already inside the trail corridor', () => {
  const target = new Vector3(400, 0, -100)
  const camera = new OrthographicCamera()
  camera.position.set(700, 1000, 200)
  const before = camera.position.toArray()
  assert.equal(constrainCameraTargetToRoute(camera, target, [[[0, 0], [1000, 0]]], 450), false)
  assert.deepEqual(target.toArray(), [400, 0, -100])
  assert.deepEqual(camera.position.toArray(), before)
})

test('overview zoom-out limits adapt to available viewport space', () => {
  const bounds = [-807.52, -1387.89, 727.12, 1478.47]
  const small = overviewZoomLimits(bounds, { width: 390, height: 580 })
  const large = overviewZoomLimits(bounds, { width: 900, height: 800 })
  const camera = new OrthographicCamera()
  fitCameraToBounds(camera, bounds, { width: 390, height: 580 })
  assert.ok(Math.abs(small.min - camera.zoom * 0.8) < 0.0001)
  assert.ok(large.min > small.min)
  assert.equal(small.max, 6)
})

test('navigation diagnostics measure nearest segment interiors and far endpoints', () => {
  const route = [[[0, 0], [1000, 0], [1000, 1000]]]
  assert.equal(distanceToRoute([400, 600], route), 600)
  assert.equal(distanceToRoute([1000, 500], route), 0)
  assert.ok(Math.abs(distanceToRoute([2000, 2000], route) - Math.sqrt(2000000)) < 0.001)
  const camera = new OrthographicCamera()
  const target = new Vector3(400, 0, -600)
  constrainCameraTargetToRoute(camera, target, route, 450)
  assert.ok(distanceToRoute([target.x, -target.z], route) <= 450.001)
})

test('optional aerial backdrop rejects reversed bounds while older scenes remain valid', () => {
  const value = { ...fixture(), backdrop: backdropFixture() }
  assert.equal(validateScene(value).backdrop.source, 'USGS NAIP')
  value.backdrop.bounds = [7000, -7000, -7000, 7000]
  assert.throws(() => validateScene(value), /backdrop.*bounds/i)
  assert.equal(validateScene(fixture()).backdrop, undefined)
})

test('backdrop uses exactly two triangles with north-up geographic image registration', () => {
  const geometry = createBackdropQuad([-3000, -5000, 4000, 6000])
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  assert.equal(position?.count, 4)
  assert.equal(geometry.index.count, 6)
  for (let i = 0; i < 4; i++) {
    assert.equal(position.getX(i), uv.getX(i) === 0 ? -3000 : 4000)
    assert.equal(position.getZ(i), uv.getY(i) === 1 ? -6000 : 5000)
    assert.ok(position.getY(i) < 0)
  }
  assert.equal(uv.getY(0), 1, 'the image top row registers to geographic north')
  geometry.dispose()
})

test('backdrop haze preserves all detailed geography and finishes before image edges', () => {
  const haze = resolveBackdropHaze(backdropFixture(), [-1000, -1500, 1000, 1500])
  assert.ok(haze.start > Math.hypot(1000, 1500))
  assert.ok(haze.end > haze.start)
  assert.ok(haze.end < 7000, 'all four image edges must lie entirely beyond the fade end')
})

const spotlightFixture = () => ({ center: [0, 0], radii: [820, 1430], rotationRadians: 0, penumbraMeters: 32, ambient: 0.18 })

test('a complete building crossing the oval has independently lit interior and exterior points', () => {
  const light = spotlightFixture()
  // Both points lie in the same uncut footprint spanning X790..850, north-20..20.
  assert.equal(spotlightIntensity([790, 0], light), 1)
  assert.equal(spotlightIntensity([850, 0], light), 0.18)
  assert.ok(Math.abs(spotlightIntensity([820, 0], light) - 0.59) < 0.001)
  assert.equal(spotlightIntensity([0, 0], light), 1)
})

test('the oval field respects local-meter rotation and its narrow penumbra', () => {
  const light = { ...spotlightFixture(), center: [100, 200], rotationRadians: Math.PI / 2 }
  assert.ok(Math.abs(spotlightIntensity([100, 1020], light) - 0.59) < 0.001)
  assert.ok(Math.abs(spotlightIntensity([-1330, 200], light) - 0.59) < 0.001)
  assert.equal(spotlightIntensity([100, 1000], light), 1)
  assert.equal(spotlightIntensity([100, 1040], light), 0.18)
})

test('east-of-north oval rotation keeps the exported Boston Common point inside the lit core', () => {
  const light = { ...spotlightFixture(), center: [57.063, -19.15], rotationRadians: Math.PI / 18 }
  assert.equal(spotlightIntensity([-550.93, -1103.37], light), 1)
  const majorAxisBoundary = [light.center[0] + Math.sin(light.rotationRadians) * 1430, light.center[1] + Math.cos(light.rotationRadians) * 1430]
  assert.ok(Math.abs(spotlightIntensity(majorAxisBoundary, light) - 0.59) < 0.001)
})

test('optional spotlight rejects invalid radii and preserves old unmasked scenes', () => {
  const value = { ...fixture(), spotlight: spotlightFixture() }
  assert.equal(validateScene(value).spotlight.penumbraMeters, 32)
  value.spotlight.radii = [-820, 1430]
  assert.throws(() => validateScene(value), /spotlight.*radii/i)
  assert.equal(validateScene(fixture()).spotlight, undefined)
})


test('the overhead beam follows the oval footprint and converges above it', async () => {
  const { createStageBeam } = await import('../src/lib/stage-beam.ts')
  const light = { center: [70, -30], radii: [820, 1430], rotationRadians: Math.PI / 18, penumbraMeters: 80, ambient: 0.34 }
  const geometry = createStageBeam(light)
  const points = geometry.attributes.position
  const c = Math.cos(light.rotationRadians), s = Math.sin(light.rotationRadians)
  for (let i = 0; i < 49; i++) {
    const dx = points.getX(i) - light.center[0], dn = -points.getZ(i) - light.center[1]
    assert.ok(Math.abs(Math.hypot((c * dx - s * dn) / 820, (s * dx + c * dn) / 1430) - 1) < 1e-6)
    assert.equal(points.getY(i), 6)
  }
  geometry.computeBoundingBox()
  assert.equal(geometry.boundingBox.max.y, 4006)
  assert.ok(geometry.index.count / 3 < 1000)
  assert.ok(Array.from(points.array).every(Number.isFinite))
  geometry.dispose()
})


test('playable orbit keeps backdrop edges and beam source outside the viewport', async () => {
  const { safePerspectiveZoom, orbitTiltLimits } = await import('../src/lib/scene-camera.ts')
  const { stageBeamSource } = await import('../src/lib/stage-beam.ts')
  const source = stageBeamSource({ center: [57,-19] })
  for (const polar of [orbitTiltLimits.min, orbitTiltLimits.max]) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      for (const target of [new Vector3(0,0,0),new Vector3(1000,0,-1500),new Vector3(-1000,0,1500)]) {
        const camera = new OrthographicCamera(-800,800,450,-450,1,40000)
        camera.position.copy(target).add(new Vector3(Math.sin(polar)*Math.sin(angle),Math.cos(polar),Math.sin(polar)*Math.cos(angle)).multiplyScalar(5000))
        camera.lookAt(target)
        camera.zoom = safePerspectiveZoom(camera,[-7000,-7000,7000,7000],source)
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
        assert.ok(source.clone().project(camera).y >= 1.1499)
        for (const x of [-1,1]) for (const y of [-1,1]) {
          const point = new Vector3(x,y,-1).unproject(camera)
          const direction = camera.getWorldDirection(new Vector3())
          point.addScaledVector(direction,-point.y/direction.y)
          assert.ok(Math.abs(point.x) <= 6700.01)
          assert.ok(Math.abs(point.z) <= 6700.01)
        }
      }
    }
  }
  assert.ok(orbitTiltLimits.max - orbitTiltLimits.min >= Math.PI / 9 - 1e-6)
})
