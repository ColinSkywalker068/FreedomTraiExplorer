import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import type { SpotlightData } from './lib/scene-data'
import { createStageBeam } from './lib/stage-beam'

const vertexShader = `
  varying float beamHeight;
  varying vec3 beamNormal;
  void main() {
    beamHeight = uv.y;
    beamNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragmentShader = `
  varying float beamHeight;
  varying vec3 beamNormal;
  void main() {
    // Fade at the ground, source and grazing silhouette: no visible cone outline.
    float ends = smoothstep(0.0, 0.12, beamHeight) * (1.0 - smoothstep(0.55, 1.0, beamHeight));
    float facing = smoothstep(0.0, 0.6, abs(normalize(beamNormal).z));
    gl_FragColor = vec4(0.94, 0.90, 0.78, 0.045 * ends * facing);
    #include <colorspace_fragment>
  }
`

/** A static translucent shell suggests airborne light without volumetric passes. */
export default function StageBeam({ spotlight }: { spotlight: SpotlightData }) {
  const geometry = useMemo(() => createStageBeam(spotlight), [spotlight])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} renderOrder={4} raycast={() => {}}>
    <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
  </mesh>
}