import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, SkinnedMesh, Texture } from 'three'
import type { AnimationAction, BufferGeometry, Material, Object3D, Skeleton } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { canStand } from './collision'
import type { CollisionWorld } from './collision'
import type { NpcSpawn, Position } from './config'

type NpcId = NpcSpawn['id']
type Gesture = 'WAVE' | 'NOD' | 'POINT_TO_BUILDING' | 'POINT_TO_GUIDE' | 'HIGHLIGHT_MASSACRE_MARKER' | 'NONE'
type Clip = 'Idle' | 'Walk' | 'Talk' | 'Wave' | 'Nod' | 'Point'

interface NpcProps {
  active: boolean
  collision?: CollisionWorld
  engagedNpcId: NpcId | null
  nearbyNpcId?: NpcId | null
  speakingNpcId?: NpcId | null
  positions: RefObject<Partial<Record<NpcId, Position>>>
  registerPosition: (id: NpcId, position: Position | null) => void
  onSelect?: (id: NpcId) => void
  action?: { npcId: NpcId; action: Gesture; sequence: number }
}

const assetRoot = '/experiences/old-state-house/models'
// Keep the original GLBs available for an easy visual rollback.
// Set to an empty string to use the original Quaternius avatars.
const avatarPrefix: string = ''
const walkingSpeed = 1.1
const gestureClip: Partial<Record<Gesture, Clip>> = {
  WAVE: 'Wave',
  NOD: 'Nod',
  POINT_TO_BUILDING: 'Point',
  POINT_TO_GUIDE: 'Point',
  HIGHLIGHT_MASSACRE_MARKER: 'Nod',
}

function disposeModel(scene: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const skeletons = new Set<Skeleton>()
  const textures = new Set<Texture>()
  scene.traverse(object => {
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton)
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
    }
  })
  skeletons.forEach(skeleton => skeleton.dispose())
  textures.forEach(texture => {
    texture.dispose()
    const image = texture.source.data as { close?: () => void } | undefined
    image?.close?.()
  })
  materials.forEach(material => material.dispose())
  geometries.forEach(geometry => geometry.dispose())
}

function useAvatar(id: NpcId) {
  const [scene, setScene] = useState<Object3D | null>(null)
  const mixer = useRef<AnimationMixer | null>(null)
  const actions = useRef<Partial<Record<Clip, AnimationAction>>>({})
  const playing = useRef<Clip>('Idle')
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => {
    let mounted = true
    let model: Object3D | undefined
    new GLTFLoader().loadAsync(assetRoot + '/' + avatarPrefix + id + '.glb').then(gltf => {
      if (!mounted) {
        disposeModel(gltf.scene)
        return
      }
      model = gltf.scene
      model.traverse(object => {
        if (object instanceof Mesh) {
          object.castShadow = true
          object.receiveShadow = true
        }
      })
      const avatarMixer = new AnimationMixer(model)
      mixer.current = avatarMixer
      actions.current = Object.fromEntries(gltf.animations.map(clip => [clip.name.charAt(0).toUpperCase() + clip.name.slice(1), avatarMixer.clipAction(clip)]))
      actions.current.Idle?.play()
      avatarMixer.update(.001)
      if (avatarPrefix) {
        const bounds = new Box3().setFromObject(model, true)
        const height = bounds.max.y - bounds.min.y
        const avatar = new Group()
        if (Number.isFinite(height) && height > 0) {
          const scale = (id === 'curious-tourist' ? 1.65 : 1.72) / height
          avatar.scale.setScalar(scale)
          avatar.position.y = -bounds.min.y * scale
        }
        avatar.add(model)
        setScene(avatar)
      } else {
        setScene(model)
      }
      invalidate()
    }).catch(() => {
      // The standing fallback stays visible if the optional character asset cannot load.
    })
    return () => {
      mounted = false
      mixer.current?.stopAllAction()
      if (model) {
        mixer.current?.uncacheRoot(model)
        disposeModel(model)
      }
      mixer.current = null
      actions.current = {}
      playing.current = 'Idle'
    }
  }, [id, invalidate])

  function play(name: Clip, once = false) {
    const next = actions.current[name]
    if (!next || (!once && playing.current === name)) return
    const previous = actions.current[playing.current]
    if (previous !== next) previous?.fadeOut(.2)
    next.reset().setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once
    next.setEffectiveWeight(1).fadeIn(.2).play()
    playing.current = name
  }
  return { scene, mixer, actions, play }
}

function StandingFallback({ tourist }: { tourist: boolean }) {
  const coat = tourist ? '#a84e31' : '#346764'
  return <>
    <mesh position={[0, 1.23, 0]}><capsuleGeometry args={[.17, .39, 5, 10]} /><meshStandardMaterial color={coat} /></mesh>
    <mesh position={[0, 1.64, 0]}><sphereGeometry args={[.115, 12, 8]} /><meshStandardMaterial color="#bd906e" /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * .218, 1.17, 0]} rotation={[0, 0, side * .07]}><capsuleGeometry args={[.064, .38, 4, 8]} /><meshStandardMaterial color={coat} /></mesh>
      <mesh position={[side * .091, .46, 0]}><capsuleGeometry args={[.078, .75, 4, 8]} /><meshStandardMaterial color="#344655" /></mesh>
    </group>)}
  </>
}

function shortestAngle(delta: number) {
  return Math.atan2(Math.sin(delta), Math.cos(delta))
}

function Npc({ spawn, ...props }: NpcProps & { spawn: NpcSpawn }) {
  const group = useRef<Group>(null)
  const highlight = useRef<Group>(null)
  const patrol = useRef({ target: 0, wait: 2.6 })
  const oneShot = useRef<{ time: number; sequence: number; action?: Gesture }>({ time: 0, sequence: -1 })
  const highlighted = useRef({ time: 0, sequence: -1 })
  const talk = useRef({ active: false, time: 0, sequence: -1 })
  const reported = useRef<Position>([...spawn.position])
  const { scene, mixer, actions, play } = useAvatar(spawn.id)

  const { registerPosition } = props
  useEffect(() => {
    registerPosition(spawn.id, reported.current)
    return () => registerPosition(spawn.id, null)
  }, [registerPosition, spawn.id])

  useFrame((state, delta) => {
    const actor = group.current
    if (!actor || !props.active) return
    const dt = Math.min(delta, .05)
    const position = actor.position
    const viewer = state.camera.position
    const engaged = props.engagedNpcId === spawn.id
    const near = engaged || props.nearbyNpcId === spawn.id ||
      Math.hypot(viewer.x - position.x, viewer.z - position.z) < 2.7
    const command = props.action
    const speaking = props.speakingNpcId === spawn.id
    const speechSequence = command?.sequence ?? -1
    if (speaking && (!talk.current.active || speechSequence !== talk.current.sequence)) {
      talk.current = { active: true, time: 3.4, sequence: speechSequence }
    }
    if (!speaking) talk.current.active = false
    talk.current.time = Math.max(0, talk.current.time - dt)
    if (command?.npcId === spawn.id && command.sequence !== oneShot.current.sequence) {
      const clip = gestureClip[command.action]
      const duration = clip ? actions.current[clip]?.getClip().duration : undefined
      // Wait for the asset if the first greeting occurs while it is loading.
      if (!clip || duration !== undefined || (avatarPrefix && scene)) {
        oneShot.current = { sequence: command.sequence, time: duration ?? (clip ? 1.1 : 0), action: command.action }
        if (clip && duration) play(clip, true)
      }
    }
    if (spawn.id === 'historical-guide' && command?.action === 'POINT_TO_GUIDE' &&
        highlighted.current.sequence !== command.sequence) {
      highlighted.current = { time: 3.2, sequence: command.sequence }
    }
    highlighted.current.time = Math.max(0, highlighted.current.time - dt)
    if (highlight.current) highlight.current.visible = highlighted.current.time > 0

    let yaw = spawn.yawRadians
    let walking = false
    const gesture = oneShot.current.time > 0 ? oneShot.current.action : undefined
    if (gesture === 'POINT_TO_GUIDE') {
      const guide = props.positions.current['historical-guide']
      if (guide) yaw = Math.atan2(guide[0] - position.x, guide[2] - position.z)
    } else if (gesture === 'POINT_TO_BUILDING') {
      yaw = Math.atan2(-position.x, -position.z)
    } else if (near) {
      yaw = Math.atan2(viewer.x - position.x, viewer.z - position.z)
    } else if (!props.engagedNpcId && !gesture && spawn.waypoints?.length) {
      const path = spawn.waypoints
      const motion = patrol.current
      motion.wait = Math.max(0, motion.wait - dt)
      if (motion.wait > 0) {
        yaw = Math.atan2(-position.x, -position.z)
      } else {
        const target = path[motion.target % path.length]
        const dx = target[0] - position.x
        const dz = target[2] - position.z
        const distance = Math.hypot(dx, dz)
        if (distance < .04) {
          motion.target = (motion.target + 1) % path.length
          motion.wait = 2.6
        } else {
          yaw = Math.atan2(dx, dz)
          if (Math.abs(shortestAngle(yaw - actor.rotation.y)) < .4) {
            const step = Math.min(walkingSpeed * dt, distance)
            const next: [number, number] = [position.x + step * dx / distance, position.z + step * dz / distance]
            if (!props.collision || canStand(next, props.collision, .32)) {
              position.x = next[0]
              position.z = next[1]
              walking = true
            } else {
              motion.target = (motion.target + 1) % path.length
              motion.wait = 2.6
            }
          }
        }
      }
    }
    actor.rotation.y += shortestAngle(yaw - actor.rotation.y) * (1 - Math.exp(-7 * dt))
    if (oneShot.current.time > 0) oneShot.current.time = Math.max(0, oneShot.current.time - dt)
    else play(walking ? 'Walk' : talk.current.active && talk.current.time > 0 ? (avatarPrefix ? 'Idle' : 'Talk') : 'Idle')
    mixer.current?.update(dt)
    reported.current[0] = position.x
    reported.current[1] = position.y
    reported.current[2] = position.z
    state.invalidate()
  })

  return <group ref={group} position={spawn.position} rotation={[0, spawn.yawRadians, 0]} name={spawn.id}
    onClick={event => {
      if (!props.active || !props.onSelect) return
      event.stopPropagation()
      props.onSelect(spawn.id)
    }}>
    {scene ? <primitive object={scene} dispose={null} /> : <StandingFallback tourist={spawn.id === 'curious-tourist'} />}
    <group ref={highlight} visible={false} position={[0, .025, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.53, .61, 32]} />
        <meshBasicMaterial color="#e4ba72" transparent opacity={.68} depthWrite={false} />
      </mesh>
    </group>
  </group>
}

export function Npcs({ spawns, ...props }: NpcProps & { spawns: NpcSpawn[] }) {
  return <>{spawns.map(spawn => <Npc key={spawn.id} spawn={spawn} {...props} />)}</>
}
