import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { copyMapPose, explorationReducer, canExploreSite } from '../src/lib/exploration-navigation.ts'
test('saved map pose is independent of ongoing camera movement', () => {
 const pose={position:new Vector3(12,30,40),target:new Vector3(2,0,4),zoom:2}
 const saved=copyMapPose(pose);pose.position.set(0,0,0);pose.target.set(9,0,9);pose.zoom=5
 assert.deepEqual(saved.position.toArray(),[12,30,40]);assert.deepEqual(saved.target.toArray(),[2,0,4]);assert.equal(saved.zoom,2)
})
test('entry is deliberate and stale asset completion cannot undo return',()=>{
 assert.equal(canExploreSite('old-state-house'),true);assert.equal(canExploreSite('old-north-church'),false)
 let phase=explorationReducer('map','enter');assert.equal(phase,'approach')
 phase=explorationReducer(phase,'load');assert.equal(phase,'loading')
 phase=explorationReducer(phase,'return');assert.equal(phase,'returning-covered')
 assert.equal(explorationReducer(phase,'ready'),'returning-covered')
 assert.equal(explorationReducer(phase,'restored'),'map-revealing');assert.equal(explorationReducer('map-revealing','settled'),'map')
 assert.equal(explorationReducer('map','ready'),'map')
})
test('error recovery retains an available route back to the map',()=>{
 assert.equal(explorationReducer('loading','failed'),'error')
 assert.equal(explorationReducer('error','retry'),'loading')
 assert.equal(explorationReducer('error','return'),'returning-covered')
 assert.equal(explorationReducer('exploring','return'),'returning')
 assert.equal(explorationReducer('map-revealing','failed'),'map-revealing')
 assert.equal(explorationReducer('loading','ready'),'revealing')
 assert.equal(explorationReducer('revealing','settled'),'exploring')
})
