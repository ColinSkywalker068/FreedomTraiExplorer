import { useEffect, useState } from 'react'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Mesh, Texture } from 'three'
import type { Object3D, Material, BufferGeometry } from 'three'

function disposeScene(scene: Object3D) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>()
  scene.traverse(object => { if (object instanceof Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value) } } })
  textures.forEach(texture => { texture.dispose(); const image = texture.source.data as { close?: () => void } | undefined; image?.close?.() })
  materials.forEach(material => material.dispose())
  geometries.forEach(geometry => geometry.dispose())
}

/** Each entry owns its own GLTF resources; no global loader cache survives an exit. */
export function useSiteAssets(modelUrl: string, propsUrl: string) {
  const [state, setState] = useState<{ building: Object3D; streetscape: Object3D } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    let alive = true
    const resources = new Set<Object3D>()
    const loader = new GLTFLoader()
    const load = (url: string) => loader.loadAsync(url).then(gltf => {
      if (!alive) { disposeScene(gltf.scene); return gltf.scene }
      resources.add(gltf.scene)
      gltf.scene.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true } })
      return gltf.scene
    })
    Promise.all([load(modelUrl), load(propsUrl)]).then(([building, streetscape]) => { if (alive) setState({ building, streetscape }) }).catch(reason => { if (alive) setError(new Error(`The Old State House assets could not load: ${reason instanceof Error ? reason.message : String(reason)}`)) })
    return () => { alive = false; resources.forEach(disposeScene); resources.clear() }
  }, [modelUrl, propsUrl])
  if (error) throw error
  return state
}
