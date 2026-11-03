import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createKingStreetConfig } from '../src/experiences/old-state-house/king-street-config.ts'
import { createExplorationConfig } from '../src/experiences/old-state-house/config.ts'
import { canStand } from '../src/experiences/old-state-house/collision.ts'

const registry = JSON.parse(readFileSync(new URL('../../shared/history1770.json', import.meta.url)))
const modern = createExplorationConfig(JSON.parse(readFileSync(new URL('../public/data/scene.json', import.meta.url))))
const config = createKingStreetConfig(modern)
test('King Street leaves the arrival and witness spots within the walking bounds', () => {
  for (const [x,,z] of [config.playerSpawn.position,...registry.witnesses.map(witness=>witness.position),[18,0,-6],[22,0,3]]) {
    assert.ok(canStand([x,z],config.collision), `blocked encounter at ${x}, ${z}`)
  }
  assert.equal(canStand([17,-16],config.collision),false)
  assert.equal(canStand([45,0],config.collision),false)
})
