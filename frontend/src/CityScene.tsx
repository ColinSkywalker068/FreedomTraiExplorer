import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { ComponentRef, RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { DoubleSide, MOUSE, Object3D, OrthographicCamera, PCFShadowMap, Vector3 } from 'three'
import { createFootprints, createRibbons, createRoadNetwork } from './lib/geometry'
import { viewFrame } from './lib/scene-data'
import { fitCameraToBounds, shouldApplyViewAction, projectLandmarkPositions, panOrthographicCamera, constrainCameraTargetToRoute, overviewZoomLimits, distanceToRoute } from './lib/scene-camera'
import type { Landmark, SceneData } from './lib/scene-data'
import BackdropGround from './BackdropGround'
import { useBackdropTexture } from './useBackdropTexture'
import CityMaterial from './CityMaterial'
import LandmarkDetails from './LandmarkDetails'
import { buildingsForRendering } from './lib/landmark-geometry'
import { interpolateCameraPose, cameraTransitionDuration, createCameraTargetPath } from './lib/camera-transition'
import type { CameraPose } from './lib/camera-transition'
import { copyMapPose } from './lib/exploration-navigation'
import StageBeam from './StageBeam'
import { stageBeamSource } from './lib/stage-beam'
import { orbitTiltLimits, safePerspectiveZoom } from './lib/scene-camera'

export interface ViewAction { id: number; type: 'reset' | 'in' | 'out' | 'focus' }
export interface CityNavigationHandle {
  capture: () => CameraPose | null
  restore: (pose: CameraPose) => void
  approach: () => void
}
interface Props {
  data: SceneData; selected: Landmark; onSelect: (id: string) => void
  navigation?: RefObject<CityNavigationHandle | null>; interactive?: boolean
  viewAction: ViewAction; buildings: boolean; onReady: () => void; onFailure: () => void
}

function City({ data, buildings }: Props) {
  const backdropTexture = useBackdropTexture(data.backdrop)
  const geometries = useMemo(() => {
    return {
      land: createFootprints(data.region.map(region => ({ ...region, height: 18 })), true, -18), buildings: createFootprints(buildingsForRendering(data.buildings), true),
      greens: createFootprints(data.greens), water: createFootprints(data.water), streets: createRoadNetwork(data.roads),
      route: createRibbons(data.route.segments.map(segment => segment.coordinates), 12, 5),
      routeEdge: createRibbons(data.route.segments.map(segment => segment.coordinates), 20, 4.5),
    }
  }, [data])
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries])
  return <group>
    {backdropTexture && data.backdrop ? <BackdropGround backdrop={data.backdrop} detailBounds={data.bounds} texture={backdropTexture} spotlight={data.spotlight} /> : <mesh geometry={geometries.land} receiveShadow><CityMaterial spotlight={data.spotlight} color="#59605a" roughness={1} side={DoubleSide} /></mesh>}
    <mesh renderOrder={1} geometry={geometries.water} position-y={0.7} receiveShadow><CityMaterial spotlight={data.spotlight} fadeGround={!!backdropTexture && !!data.spotlight} color="#183c4b" roughness={0.8} side={DoubleSide} transparent={!!backdropTexture} opacity={backdropTexture ? 0.5 : 1} depthWrite={!backdropTexture} /></mesh>
    <mesh renderOrder={2} geometry={geometries.greens} position-y={1.5} receiveShadow><CityMaterial spotlight={data.spotlight} fadeGround={!!backdropTexture && !!data.spotlight} transparent={!!backdropTexture && !!data.spotlight} depthWrite={!backdropTexture} color="#729269" roughness={1} side={DoubleSide} /></mesh>
    <mesh renderOrder={3} geometry={geometries.streets} receiveShadow><CityMaterial spotlight={data.spotlight} fadeGround={!!backdropTexture && !!data.spotlight} transparent={!!backdropTexture && !!data.spotlight} depthWrite={!backdropTexture} color="#9c9c8b" roughness={1} side={DoubleSide} /></mesh>
    {buildings && <mesh geometry={geometries.buildings} castShadow receiveShadow><CityMaterial spotlight={data.spotlight} color="#e8dfc7" roughness={0.88} flatShading /></mesh>}
    {buildings && <LandmarkDetails data={data} />}
    <mesh geometry={geometries.routeEdge}><meshBasicMaterial color="#632b28" side={DoubleSide} /></mesh>
    <mesh geometry={geometries.route}><meshBasicMaterial color="#ff4c40" side={DoubleSide} toneMapped={false} /></mesh>
    {data.spotlight && backdropTexture && <StageBeam spotlight={data.spotlight} />}
  </group>
}

function Navigation({ data, selected, viewAction, navigation, interactive = true }: Props) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const get = useThree(state => state.get)
  const size = useThree(state => state.size)
  const canvas = useThree(state => state.gl.domElement)
  const frame = useMemo(() => viewFrame(data.bounds), [data])
  const beamSource = useMemo(() => data.spotlight ? stageBeamSource(data.spotlight) : undefined, [data])
  const zoomLimits = useMemo(() => overviewZoomLimits(data.bounds, size), [data, size])
  const routePaths = useMemo(() => data.route.segments.map(segment => segment.coordinates), [data])
  const corridor = typeof data.meta.navigationCorridorMeters === 'number' && Number.isFinite(data.meta.navigationCorridorMeters) && data.meta.navigationCorridorMeters > 0 ? data.meta.navigationCorridorMeters : 450
  const handledAction = useRef<number | null>(null)
  const transition = useRef<{ start: CameraPose; end: CameraPose; path: Vector3[]; startedAt: number; duration: number } | null>(null)
  const reducedMotion = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { reducedMotion.current = query.matches }
    update(); query.addEventListener('change', update)
    const orbit = controls.current
    const interrupt = () => { transition.current = null; get().invalidate() }
    orbit?.addEventListener('start', interrupt)
    return () => { query.removeEventListener('change', update); orbit?.removeEventListener('start', interrupt) }
  }, [get])
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!interactive) return
      const orbit = controls.current
      const state = get()
      transition.current = null
      if (!orbit || !(state.camera instanceof OrthographicCamera)) return
      if (panOrthographicCamera(state.camera, orbit.target, event.code || event.key, state.size)) {
        event.preventDefault()
        orbit.update()
        state.invalidate()
      }
    }
    canvas.addEventListener('keydown', onKeyDown)
    return () => canvas.removeEventListener('keydown', onKeyDown)
  }, [canvas, get, interactive])
  useEffect(() => {
    const { camera, invalidate } = get()
    if (!(camera instanceof OrthographicCamera)) return
    const orbit = controls.current
    if (!orbit) return
    if (!shouldApplyViewAction(handledAction.current, viewAction)) { invalidate(); return }
    handledAction.current = viewAction.id
    transition.current = null
    if (viewAction.type === 'in' || viewAction.type === 'out') {
      camera.zoom = Math.max(zoomLimits.min, Math.min(zoomLimits.max, camera.zoom * (viewAction.type === 'in' ? 1.45 : 1 / 1.45)))
    } else {
      const site = selectedRef.current
      const radius = site.id === 'old-state-house' ? 125 : 550
      const bounds = viewAction.type === 'focus' ? [site.position[0] - radius, site.position[1] - radius, site.position[0] + radius, site.position[1] + radius] : data.bounds
      const target = new Vector3(...viewFrame(bounds).center)
      const duration = viewAction.id === 0 ? 0 : cameraTransitionDuration(reducedMotion.current)
      // Flush residual damping before capturing a new explicit destination.
      const damping = orbit.enableDamping
      orbit.enableDamping = false; orbit.update(); orbit.enableDamping = damping
      const start = { position: camera.position.clone(), target: orbit.target.clone(), zoom: camera.zoom }
      const destination = camera.clone()
      fitCameraToBounds(destination, bounds, size)
      if (viewAction.type === 'focus' && site.id === 'old-state-house') {
        const span = viewFrame(bounds).span
        destination.position.copy(target).add(new Vector3(span * 0.8, span * 1.3, span * 0.45))
        destination.lookAt(target)
      }
      camera.far = frame.span * 12
      const end = { position: destination.position.clone(), target, zoom: destination.zoom }
      if (duration > 0) transition.current = { start, end, path: createCameraTargetPath(start.target, target, routePaths, corridor), startedAt: performance.now(), duration }
      else { camera.position.copy(end.position); camera.zoom = end.zoom; orbit.target.copy(target); camera.lookAt(target) }
    }
    camera.updateProjectionMatrix()
    orbit.update()
    invalidate()
  }, [get, data, frame, size, viewAction, zoomLimits, routePaths, corridor])

  useImperativeHandle(navigation, () => ({
      capture: () => {
        const { camera } = get(); const orbit = controls.current
        if (!orbit || !(camera instanceof OrthographicCamera)) return null
        return copyMapPose({ position: camera.position, target: orbit.target, zoom: camera.zoom })
      },
      restore: pose => {
        const { camera, invalidate } = get(); const orbit = controls.current
        if (!orbit || !(camera instanceof OrthographicCamera)) return
        transition.current = null
        const damping = orbit.enableDamping
        orbit.enableDamping = false; orbit.update()
        camera.position.copy(pose.position); camera.zoom = pose.zoom; orbit.target.copy(pose.target)
        camera.lookAt(orbit.target); camera.updateProjectionMatrix(); orbit.update()
        orbit.enableDamping = damping
        invalidate()
      },
      approach: () => {
        const { camera, invalidate } = get(); const orbit = controls.current
        if (!orbit || !(camera instanceof OrthographicCamera)) return
        const site = selectedRef.current; const [x,n] = site.position
        const destination = camera.clone()
        fitCameraToBounds(destination, [x-45,n-45,x+45,n+45], size)
        destination.position.set(x + 72, 117, -n + 40.5)
        destination.lookAt(new Vector3(x,0,-n))
        destination.zoom = Math.min(zoomLimits.max, destination.zoom)
        const start = copyMapPose({ position: camera.position, target: orbit.target, zoom: camera.zoom })
        const end = { position: destination.position.clone(), target: new Vector3(x,0,-n), zoom: destination.zoom }
        const duration = reducedMotion.current ? 0 : 0.7
        if (duration) transition.current = { start, end, path: createCameraTargetPath(start.target,end.target,routePaths,corridor), startedAt: performance.now(), duration }
        else { camera.position.copy(end.position); camera.zoom=end.zoom; orbit.target.copy(end.target); camera.lookAt(orbit.target); camera.updateProjectionMatrix() }
        invalidate()
      },
  }), [get, size, zoomLimits, routePaths, corridor])

  // Controls integrate motion at -1; clamp before projecting DOM markers at 0.
  useFrame(({ camera, invalidate }) => {
    const orbit = controls.current
    if (!orbit || !(camera instanceof OrthographicCamera)) return
    const travel = transition.current
    if (travel) {
      const progress = reducedMotion.current ? 1 : (performance.now() - travel.startedAt) / 1000 / travel.duration
      const pose = interpolateCameraPose(travel.start, travel.end, progress, travel.path)
      camera.position.copy(pose.position); camera.zoom = pose.zoom; orbit.target.copy(pose.target)
      camera.lookAt(orbit.target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
      if (progress >= 1) transition.current = null
      invalidate()
    }
    canvas.setAttribute('data-camera-transition', transition.current ? 'moving' : 'idle')
    let changed = constrainCameraTargetToRoute(camera, orbit.target, routePaths, corridor)
    const safeMin = Math.max(zoomLimits.min, safePerspectiveZoom(camera, data.backdrop?.bounds, beamSource))
    orbit.minZoom = safeMin
    const zoom = Math.max(safeMin, Math.min(zoomLimits.max, camera.zoom))
    if (Math.abs(zoom - camera.zoom) > 0.000001) { camera.zoom = zoom; camera.updateProjectionMatrix(); changed = true }
    canvas.setAttribute('data-map-pose', JSON.stringify({ position: camera.position.toArray(), target: orbit.target.toArray(), zoom: camera.zoom }))
    canvas.setAttribute('data-camera-polar-angle', orbit.getPolarAngle().toFixed(6))
    canvas.setAttribute('data-camera-safe-min-zoom', safeMin.toFixed(6))
    canvas.setAttribute('data-navigation-distance-meters', distanceToRoute([orbit.target.x, -orbit.target.z], routePaths).toFixed(3))
    canvas.setAttribute('data-navigation-radius-meters', String(corridor))
    if (changed) invalidate()
  }, -0.5)
  return <OrbitControls ref={controls} enabled={interactive} makeDefault enableDamping dampingFactor={0.12} minPolarAngle={orbitTiltLimits.min} maxPolarAngle={orbitTiltLimits.max} minZoom={zoomLimits.min} maxZoom={zoomLimits.max} screenSpacePanning mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }} />
}

/** Buttons belong to the app's existing DOM root, avoiding nested React roots in Html. */
function MarkerProjection({ data, buttons }: { data: SceneData; buttons: RefObject<Map<string, HTMLButtonElement>> }) {
  useFrame(({ camera, size }) => {
    for (const marker of projectLandmarkPositions(data.landmarks, camera, size)) {
      const button = buttons.current.get(marker.id)
      if (!button) continue
      button.style.visibility = marker.visible ? 'visible' : 'hidden'
      button.style.transform = `translate3d(${marker.x}px,${marker.y}px,0) translate(-50%,-100%)`
    }
  }, 0)
  return null
}

function RendererHealth({ onFailure, onReady }: Props) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'Interactive Boston map. Drag to orbit, right-drag or use arrow keys to pan, and scroll to zoom.')
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    canvas.addEventListener('webglcontextlost', lost)
    onReady()
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onFailure, onReady])
  return null
}

export default function CityScene(props: Props) {
  const frame = viewFrame(props.data.bounds)
  const markerButtons = useRef(new Map<string, HTMLButtonElement>())
  const lightTarget = useMemo(() => {
    const target = new Object3D()
    target.position.set(...viewFrame(props.data.bounds).center)
    return target
  }, [props.data])
  return <div className="city-view"><Canvas orthographic frameloop="demand" shadows={{ type: PCFShadowMap }} dpr={[1, 1.75]} camera={{ position: [0, frame.span, frame.span], zoom: 0.1, near: 1, far: frame.span * 12 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} aria-label="Interactive 3D map of Boston's Freedom Trail" fallback={<div className="scene-message"><h2>3D is unavailable</h2><p>Your browser needs WebGL to display the city. You can still explore every stop in the list.</p></div>}>
    <color attach="background" args={['#11212a']} />
    <ambientLight intensity={1.5} />
    <hemisphereLight args={['#fff0d6', '#3a4b47', 1.8]} />
    <primitive object={lightTarget} />
    <directionalLight target={lightTarget} position={[frame.center[0] - frame.span * 0.4, frame.span, frame.center[2] + frame.span * 0.5]} intensity={3.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-frame.span * 0.7} shadow-camera-right={frame.span * 0.7} shadow-camera-top={frame.span * 0.7} shadow-camera-bottom={-frame.span * 0.7} shadow-camera-far={frame.span * 3} shadow-bias={-0.00015} />
    <City {...props} /><Navigation {...props} /><MarkerProjection data={props.data} buttons={markerButtons} /><RendererHealth {...props} />
  </Canvas><div className="marker-layer" aria-label="Historic sites on the map">{props.data.landmarks.map(site => <button key={site.id} ref={button => { if (button) markerButtons.current.set(site.id, button); else markerButtons.current.delete(site.id) }} className={`map-marker ${props.selected.id === site.id ? 'is-selected' : ''}`} style={{ visibility: 'hidden', zIndex: props.selected.id === site.id ? 90 : 30 }} onClick={() => props.onSelect(site.id)} aria-label={`Stop ${site.order}: ${site.name}`} aria-pressed={props.selected.id === site.id} title={site.name}>{String(site.order).padStart(2, '0')}</button>)}</div></div>
}
