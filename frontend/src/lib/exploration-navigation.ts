import type { CameraPose } from './camera-transition'
export type ExplorationPhase = 'map' | 'approach' | 'loading' | 'revealing' | 'exploring' | 'returning' | 'returning-covered' | 'map-revealing' | 'error'
export type ExplorationEvent = 'enter' | 'load' | 'ready' | 'settled' | 'return' | 'restored' | 'failed' | 'retry'
export function canExploreSite(id: string): boolean { return id === 'old-state-house' }
export function copyMapPose(pose: CameraPose): CameraPose {
  return { position: pose.position.clone(), target: pose.target.clone(), zoom: pose.zoom }
}
export function explorationReducer(phase: ExplorationPhase, event: ExplorationEvent): ExplorationPhase {
  if (event === 'return') {
    if (phase === 'exploring' || phase === 'revealing') return 'returning'
    if (phase === 'loading' || phase === 'error' || phase === 'approach') return 'returning-covered'
    return phase
  }
  if (event === 'failed' && (phase === 'loading' || phase === 'revealing' || phase === 'exploring')) return 'error'
  if (event === 'enter' && phase === 'map') return 'approach'
  if (event === 'load' && phase === 'approach') return 'loading'
  if (event === 'ready' && phase === 'loading') return 'revealing'
  if (event === 'settled' && phase === 'revealing') return 'exploring'
  if (event === 'settled' && phase === 'map-revealing') return 'map'
  if (event === 'restored' && (phase === 'returning' || phase === 'returning-covered')) return 'map-revealing'
  if (event === 'retry' && phase === 'error') return 'loading'
  return phase
}
