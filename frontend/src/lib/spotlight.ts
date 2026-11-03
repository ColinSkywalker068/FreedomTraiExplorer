import type { Point, SpotlightData } from './scene-data.ts'
import { Vector2 } from 'three'

/** Ellipse signed-distance approximation is exact on its axes and first-order at the edge. */
export function spotlightIntensity(point: Point, spotlight: SpotlightData): number {
  const dx = point[0] - spotlight.center[0]
  const dn = point[1] - spotlight.center[1]
  const cosine = Math.cos(spotlight.rotationRadians)
  const sine = Math.sin(spotlight.rotationRadians)
  // Positive rotation tilts the major (north) axis toward geographic east.
  const x = cosine * dx - sine * dn
  const n = sine * dx + cosine * dn
  const [rx, rn] = spotlight.radii
  const k0 = Math.hypot(x / rx, n / rn)
  const k1 = Math.hypot(x / (rx * rx), n / (rn * rn))
  const distance = k1 > 0.000001 ? k0 * (k0 - 1) / k1 : -Math.min(rx, rn)
  const t = Math.min(1, Math.max(0, (distance + spotlight.penumbraMeters / 2) / spotlight.penumbraMeters))
  const smooth = t * t * (3 - 2 * t)
  return spotlight.ambient + (1 - spotlight.ambient) * (1 - smooth)
}

/** Shared verbatim by the aerial and physically shaded city surface shaders. */
export const spotlightShader = `
  uniform vec2 stageCenter;
  uniform vec2 stageRadii;
  uniform vec2 stageRotation;
  uniform vec2 stageParameters;
  float stageCoverage(vec2 meters) {
    vec2 delta = meters - stageCenter;
    vec2 q = vec2(dot(delta, vec2(stageRotation.x, -stageRotation.y)), dot(delta, vec2(stageRotation.y, stageRotation.x)));
    float k0 = length(q / stageRadii);
    float k1 = length(q / (stageRadii * stageRadii));
    float signedDistance = k1 > 0.000001 ? k0 * (k0 - 1.0) / k1 : -min(stageRadii.x, stageRadii.y);
    float edge = smoothstep(-stageParameters.x * 0.5, stageParameters.x * 0.5, signedDistance);
    return 1.0 - edge;
  }
  float stageIllumination(vec2 meters) {
    return mix(stageParameters.y, 1.0, stageCoverage(meters));
  }
`

export function createSpotlightUniforms(spotlight?: SpotlightData) {
  return {
    stageCenter: { value: new Vector2(...(spotlight?.center ?? [0, 0])) },
    stageRadii: { value: new Vector2(...(spotlight?.radii ?? [1, 1])) },
    stageRotation: { value: new Vector2(Math.cos(spotlight?.rotationRadians ?? 0), Math.sin(spotlight?.rotationRadians ?? 0)) },
    stageParameters: { value: new Vector2(spotlight?.penumbraMeters ?? 1, spotlight?.ambient ?? 1) },
  }
}
