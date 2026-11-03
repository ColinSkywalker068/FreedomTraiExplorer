import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { moveWithCollisions } from './collision'
import type { ExplorationConfig, SceneAnchor } from './config'
import { nearestNpc } from './npc-chat'
import type { NpcId, NpcPositions } from './npc-chat'

const WALK_SPEED = 4.5
const FLIGHT_SPEED = 9
const CLIMB_SPEED = 6
const MAX_FLIGHT_HEIGHT = 35
const JUMP_SPEED = 5.5
const GRAVITY = 14
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyX'])

export type ControlMode = 'paused' | 'locked' | 'drag'
interface Props { sceneLabel?: string; config: ExplorationConfig; enabled: boolean; mode: ControlMode; onNearby: (anchor: SceneAnchor | null) => void; onInteract: () => void; onPosition: (x:number,y:number,z:number)=>void; npcPositions: RefObject<NpcPositions>; onNearbyNpc: (id: NpcId | null) => void }

export default function Player({ sceneLabel='Old State House', config, enabled, mode, onNearby, onInteract, onPosition, npcPositions, onNearbyNpc }: Props) {
  const get = useThree(state => state.get)
  const airborne = useRef({ flying: false, jumpVelocity: 0 })
  const keys = useRef(new Set<string>())
  const interact = useRef(onInteract)
  useEffect(()=>{interact.current=onInteract},[onInteract])
  const nearbyNpc = useRef<NpcId | null>(null)
  const yaw = useRef(0), pitch = useRef(0), diagnosticTime = useRef(0), nearbyId = useRef('')
  useEffect(() => {
    const { camera, gl, invalidate } = get()
    camera.rotation.order = 'YXZ'; camera.position.set(...config.playerSpawn.position); camera.lookAt(...config.playerSpawn.target)
    airborne.current = { flying: false, jumpVelocity: 0 }
    yaw.current = camera.rotation.y; pitch.current = camera.rotation.x
    gl.domElement.setAttribute('tabindex','0')
    gl.domElement.setAttribute('aria-label',sceneLabel+' walking scene. W A S D to move, mouse to look, Space to jump, Up and Down to fly, X to drop, E to talk or inspect, Escape to pause.')
    invalidate()
  },[config,get,sceneLabel])

  useEffect(() => {
    const { camera, gl, invalidate } = get(), canvas = gl.domElement
    const look = (dx: number, dy: number) => {
      if (!enabled) return
      yaw.current -= dx*0.0021; pitch.current = Math.max(-1.15,Math.min(1.15,pitch.current-dy*0.0021))
      camera.rotation.set(pitch.current,yaw.current,0,'YXZ'); invalidate()
    }
    let dragging = false, lastX = 0, lastY = 0
    const mouse = (event: MouseEvent) => { if (mode==='locked' && document.pointerLockElement===canvas) look(event.movementX,event.movementY) }
    const down = (event: PointerEvent) => { if (enabled && mode==='drag' && event.button===0) { dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);canvas.focus() } }
    const drag = (event: PointerEvent) => { if (!dragging) return;look(event.clientX-lastX,event.clientY-lastY);lastX=event.clientX;lastY=event.clientY }
    const up = () => { dragging=false }
    const keyDown = (event: KeyboardEvent) => {
      if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('button,a,input,textarea,select')) return
      if (MOVEMENT_KEYS.has(event.code)) {
        keys.current.add(event.code)
        event.preventDefault()
        if (!event.repeat && event.code === 'KeyX') {
          airborne.current = { flying: false, jumpVelocity: 0 }
          camera.position.y = config.playerSpawn.position[1]
          keys.current.delete('ArrowUp')
        }
        if (!event.repeat && event.code === 'Space' && !airborne.current.flying && camera.position.y === config.playerSpawn.position[1]) {
          airborne.current.jumpVelocity = JUMP_SPEED
        }
        invalidate()
      }
      if (event.code==='KeyE' && !event.repeat) { event.preventDefault();interact.current() }
    }
    const keyUp = (event: KeyboardEvent) => keys.current.delete(event.code)
    const clear = () => { keys.current.clear();dragging=false }
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear)
    document.addEventListener('mousemove',mouse);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',drag);window.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up)
    canvas.setAttribute('data-control-mode',enabled?mode:'paused')
    return () => { clear();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);document.removeEventListener('mousemove',mouse);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',drag);window.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up) }
  },[enabled,mode,get,config])

  useFrame((state, delta) => {
    const camera = state.camera
    if (enabled) {
      const dt = Math.min(delta, 0.05)
      const ground = config.playerSpawn.position[1]
      const motion = airborne.current
      const up = keys.current.has('ArrowUp')
      const down = keys.current.has('ArrowDown')
      if (up && !keys.current.has('KeyX')) {
        motion.flying = true
        motion.jumpVelocity = 0
      }
      const forward = Number(keys.current.has('KeyW')) - Number(keys.current.has('KeyS'))
      const side = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight'))
        - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft'))
      const speed = (motion.flying ? FLIGHT_SPEED : WALK_SPEED) * dt / Math.max(1, Math.hypot(forward, side))
      const horizontalForward = forward * (motion.flying ? Math.cos(pitch.current) : 1)
      if (forward || side) {
        const dx = (-Math.sin(yaw.current) * horizontalForward + Math.cos(yaw.current) * side) * speed
        const dz = (-Math.cos(yaw.current) * horizontalForward - Math.sin(yaw.current) * side) * speed
        const [x, z] = moveWithCollisions([camera.position.x, camera.position.z], [dx, dz], config.collision)
        camera.position.x = x
        camera.position.z = z
      }
      if (motion.flying) {
        const climb = (Number(up) - Number(down)) * CLIMB_SPEED * dt
        camera.position.y = Math.min(ground + MAX_FLIGHT_HEIGHT, Math.max(ground, camera.position.y + climb + Math.sin(pitch.current) * forward * speed))
        if (camera.position.y === ground && !up) motion.flying = false
      } else if (motion.jumpVelocity || camera.position.y > ground) {
        camera.position.y = Math.max(ground, camera.position.y + motion.jumpVelocity * dt - GRAVITY * dt * dt / 2)
        motion.jumpVelocity = camera.position.y === ground ? 0 : motion.jumpVelocity - GRAVITY * dt
      }
    } else keys.current.clear()
    onPosition(camera.position.x,camera.position.y,camera.position.z)
    diagnosticTime.current += delta
    if (diagnosticTime.current>0.12 || !state.gl.domElement.hasAttribute('data-player-position')) {
      diagnosticTime.current=0
      const canvas=state.gl.domElement
      canvas.setAttribute('data-player-position',JSON.stringify(camera.position.toArray().map(value=>Math.round(value*1000)/1000)))
      canvas.setAttribute('data-detail-render-calls',String(state.gl.info.render.calls));canvas.setAttribute('data-detail-triangles',String(state.gl.info.render.triangles));canvas.setAttribute('data-detail-textures',String(state.gl.info.memory.textures));canvas.setAttribute('data-detail-geometries',String(state.gl.info.memory.geometries))
      const npc=nearestNpc([camera.position.x,camera.position.y,camera.position.z],npcPositions.current,config.playerSpawn.position[1])
      if(npc!==nearbyNpc.current){nearbyNpc.current=npc;onNearbyNpc(npc)}
      const nearest=config.anchors.filter(anchor=>anchor.available).map(anchor=>({anchor,distance:Math.hypot(anchor.position[0]-camera.position.x,camera.position.y-config.playerSpawn.position[1],anchor.position[2]-camera.position.z)})).sort((a,b)=>a.distance-b.distance)[0]
      const anchor=nearest?.distance<5.5?nearest.anchor:null
      if ((anchor?.id??'')!==nearbyId.current) {nearbyId.current=anchor?.id??'';onNearby(anchor)}
    }
  })
  return null
}
