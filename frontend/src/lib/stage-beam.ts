import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import type { SpotlightData } from './scene-data.ts'

export const STAGE_BEAM_HEIGHT = 4000
export const stageBeamSource = (light: SpotlightData) => new Vector3(light.center[0] - 220, STAGE_BEAM_HEIGHT + 6, -light.center[1] - 300)

/** Registered oval footprint converging toward one quiet overhead source. */
export function createStageBeam(light: SpotlightData): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const sides = 48, levels = 8, height = STAGE_BEAM_HEIGHT
  const c = Math.cos(light.rotationRadians), s = Math.sin(light.rotationRadians)
  for (let level = 0; level <= levels; level++) {
    const t = level / levels
    const scale = 1 - t * 0.985
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2
      const x = light.radii[0] * Math.cos(angle) * scale
      const n = light.radii[1] * Math.sin(angle) * scale
      positions.push(light.center[0] + c * x + s * n - 220 * t, height * t + 6,
        -(light.center[1] - s * x + c * n + 300 * t))
      uvs.push(side / sides, t)
      if (level < levels && side < sides) {
        const a = level * (sides + 1) + side, b = a + sides + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}