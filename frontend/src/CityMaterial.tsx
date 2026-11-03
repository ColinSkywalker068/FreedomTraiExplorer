import { useCallback, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { MeshStandardMaterial } from 'three'
import { createSpotlightUniforms, spotlightShader } from './lib/spotlight'
import type { SpotlightData } from './lib/scene-data'

type Props = ThreeElements['meshStandardMaterial'] & { spotlight?: SpotlightData; fadeGround?: boolean }

/** Preserve Three's physical lighting and apply the shared stage field per fragment. */
export default function CityMaterial({ spotlight, fadeGround = false, ...props }: Props) {
  const uniforms = useMemo(() => createSpotlightUniforms(spotlight), [spotlight])
  const beforeCompile = useCallback<MeshStandardMaterial['onBeforeCompile']>(shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 stageLocalMeters;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 stageWorldPosition = modelMatrix * vec4(transformed, 1.0);\nstageLocalMeters = vec2(stageWorldPosition.x, -stageWorldPosition.z);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 stageLocalMeters;\n${spotlightShader}`)
      .replace('#include <opaque_fragment>', `outgoingLight *= stageIllumination(stageLocalMeters);\n${fadeGround ? 'diffuseColor.a *= stageCoverage(stageLocalMeters);' : ''}\n#include <opaque_fragment>`)
  }, [uniforms, fadeGround])
  return <meshStandardMaterial key={JSON.stringify([spotlight ?? null, fadeGround])} {...props} onBeforeCompile={beforeCompile} customProgramCacheKey={() => `shared-elliptical-stage-v2-${fadeGround}`} />
}
