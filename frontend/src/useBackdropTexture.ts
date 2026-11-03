import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, TextureLoader } from 'three'
import type { Texture } from 'three'
import type { BackdropData } from './lib/scene-data'

/** Local static imagery loads independently; failure leaves the original city base visible. */
export function useBackdropTexture(backdrop: BackdropData | undefined): Texture | null {
  const { gl, invalidate } = useThree()
  const [loaded, setLoaded] = useState<{ url: string; texture: Texture } | null>(null)
  const url = backdrop?.url
  useEffect(() => {
    if (!url) return
    let active = true
    gl.domElement.setAttribute('data-backdrop-status', 'loading')
    const texture = new TextureLoader().load(url, image => {
      if (!active) { image.dispose(); return }
      image.colorSpace = SRGBColorSpace
      image.generateMipmaps = true
      image.minFilter = LinearMipmapLinearFilter
      image.magFilter = LinearFilter
      image.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())
      image.needsUpdate = true
      setLoaded({ url, texture: image })
      gl.domElement.setAttribute('data-backdrop-status', 'ready')
      invalidate()
    }, undefined, () => {
      if (!active) return
      gl.domElement.setAttribute('data-backdrop-status', 'fallback')
      invalidate()
    })
    return () => { active = false; texture.dispose() }
  }, [url, gl, invalidate])
  return loaded && loaded.url === url ? loaded.texture : null
}
