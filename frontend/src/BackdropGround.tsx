import { useEffect, useMemo } from 'react'
import { Color, Vector2 } from 'three'
import type { Texture } from 'three'
import { createBackdropQuad, resolveBackdropHaze } from './lib/backdrop'
import type { BackdropData, SpotlightData } from './lib/scene-data'
import { createSpotlightUniforms, spotlightShader } from './lib/spotlight'

const vertexShader = `
  varying vec2 imageUv;
  varying vec2 localMeters;
  void main() {
    imageUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    localMeters = vec2(worldPosition.x, -worldPosition.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D cityImage;
  uniform vec2 cityCenter;
  uniform vec2 hazeRange;
  uniform vec3 horizonColor;
  varying vec2 imageUv;
  varying vec2 localMeters;
  ${spotlightShader}
  void main() {
    vec3 aerial = texture2D(cityImage, imageUv, 1.35).rgb;
    float luminance = dot(aerial, vec3(0.2126, 0.7152, 0.0722));
    float compressed = 0.10 + (luminance - 0.10) * 0.62;
    vec3 muted = mix(vec3(compressed), aerial, 0.08) * vec3(0.31, 0.37, 0.39);
    float water = smoothstep(0.004, 0.065, aerial.b - aerial.r) * (1.0 - smoothstep(0.18, 0.48, luminance));
    muted = mix(muted, vec3(0.008, 0.026, 0.036), water * 0.85);
    float haze = smoothstep(hazeRange.x, hazeRange.y, distance(localMeters, cityCenter));
    muted *= stageIllumination(localMeters);
    gl_FragColor = vec4(mix(muted, horizonColor, haze), 1.0);
    #include <colorspace_fragment>
  }
`

export default function BackdropGround({ backdrop, detailBounds, texture, spotlight }: { backdrop: BackdropData; detailBounds: number[]; texture: Texture; spotlight?: SpotlightData }) {
  const geometry = useMemo(() => createBackdropQuad(backdrop.bounds), [backdrop])
  const uniforms = useMemo(() => {
    const haze = resolveBackdropHaze(backdrop, detailBounds)
    return { ...createSpotlightUniforms(spotlight), cityImage: { value: texture }, cityCenter: { value: new Vector2(...backdrop.center) }, hazeRange: { value: new Vector2(haze.start, haze.end) }, horizonColor: { value: new Color('#11212a') } }
  }, [backdrop, detailBounds, texture, spotlight])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} raycast={() => {}}><shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} toneMapped={false} /></mesh>
}
