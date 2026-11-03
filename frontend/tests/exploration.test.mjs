import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canStand, moveWithCollisions } from '../src/experiences/old-state-house/collision.ts'
import { createExplorationConfig } from '../src/experiences/old-state-house/config.ts'
import { createDeferredDisposal } from '../src/experiences/old-state-house/lifetime.ts'

const world = { bounds: [-20, -20, 20, 20], colliders: [{ id: 'wall', rings: [[[1, -10], [2, -10], [2, 10], [1, 10], [1, -10]]], bounds: [1, -10, 2, 10] }] }

test('the player circle stays outside solid footprints and within the walkable boundary', () => {
  assert.equal(canStand([1.5, 0], world), false)
  assert.equal(canStand([0.8, 0], world), false)
  assert.equal(canStand([19.9, 0], world), false)
  assert.equal(canStand([0, 0], world), true)
})

test('a large frame displacement cannot tunnel through a thin building wall', () => {
  const result = moveWithCollisions([0, 0], [15, 0], world)
  assert.ok(result[0] < 0.69 && result[0] >= 0)
  assert.equal(canStand(result, world), true)
})

test('movement slides along walls and stops at outer bounds', () => {
  const result = moveWithCollisions([0, 0], [5, 5], world)
  assert.ok(result[0] < 0.69)
  assert.ok(result[1] > 4.9)
  const edge = moveWithCollisions([-19, 0], [-10, 3], world)
  assert.ok(edge[0] >= -19.68 && edge[1] > 2.9)
})

test('courtyard holes stay walkable while the surrounding wall remains solid', () => {
  const courtyard = { bounds: [-30, -30, 30, 30], colliders: [{ id: 'court', rings: [[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]],[[-3,-3],[-3,3],[3,3],[3,-3],[-3,-3]]], bounds: [-10,-10,10,10] }] }
  assert.equal(canStand([0, 0], courtyard), true)
  assert.equal(canStand([5, 0], courtyard), false)
})

test('real geography produces safe player/NPC spawns and the exact Massacre-site anchor', () => {
  const data = JSON.parse(readFileSync(new URL('../public/data/scene.json', import.meta.url)))
  const config = createExplorationConfig(data)
  assert.equal(config.playerSpawn.position[1], 1.68)
  assert.equal(canStand([config.playerSpawn.position[0], config.playerSpawn.position[2]], config.collision), true)
  assert.equal(config.npcSpawns.length, 2)
  for (const npc of config.npcSpawns) {
    assert.equal(canStand([npc.position[0], npc.position[2]], config.collision, 0.5), true, npc.id)
    for (const point of npc.waypoints ?? []) assert.equal(canStand([point[0], point[2]], config.collision, 0.5), true)
  }
  const massacre = data.landmarks.find(site => site.id === 'boston-massacre-site')
  const marker = config.anchors.find(anchor => anchor.id === 'boston-massacre-site')
  assert.ok(Math.abs(marker.position[0] - (massacre.position[0] - config.origin[0])) < 0.001)
  assert.ok(Math.abs(marker.position[2] + (massacre.position[1] - config.origin[1])) < 0.001)
  assert.ok(!config.contextBuildings.some(building => building.id.includes('29608515')))
})

test('StrictMode effect replay does not dispose a still-retained scene resource', async () => {
  let disposals = 0
  const lifetime = createDeferredDisposal(() => { disposals++ })
  const firstCleanup = lifetime.retain()
  firstCleanup()
  const realCleanup = lifetime.retain()
  await Promise.resolve()
  assert.equal(disposals, 0)
  realCleanup()
  realCleanup()
  await Promise.resolve()
  assert.equal(disposals, 1)
})

test('the actual pedestrian plaza is paved rather than rendered as grass', () => {
  const data = JSON.parse(readFileSync(new URL('../public/data/scene.json', import.meta.url)))
  const config = createExplorationConfig(data)
  assert.ok(config.greens.every(feature => feature.kind !== 'pedestrian-space'))
  assert.ok(config.pavedAreas.some(feature => feature.id === 'way-815050292-0-dry-0'))
})
