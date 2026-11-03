import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import CityMaterial from './CityMaterial'
import { createLandmarkDetails } from './lib/landmark-geometry'
import type { SceneData } from './lib/scene-data'

/** Two schematic architectural cues, using the atlas's existing material and stage light. */
export default function LandmarkDetails({ data }: { data: SceneData }) {
  const geometry = useMemo(() => createLandmarkDetails(data), [data])
  useEffect(() => () => { geometry.stone.dispose(); geometry.gold.dispose() }, [geometry])
  return <group>
    <mesh geometry={geometry.stone} castShadow receiveShadow><CityMaterial spotlight={data.spotlight} color="#e8dfc7" roughness={0.88} flatShading side={DoubleSide} /></mesh>
    <mesh geometry={geometry.gold} castShadow receiveShadow><CityMaterial spotlight={data.spotlight} color="#b9a05e" roughness={0.78} metalness={0.15} flatShading /></mesh>
  </group>
}