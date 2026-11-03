import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLandmarkDetails, buildingsForRendering } from '../src/lib/landmark-geometry.ts'
const scene=JSON.parse(readFileSync(new URL('../public/data/scene.json',import.meta.url)))
test('landmark details preserve source data and replace only the Bunker Hill block', () => {
  const before=JSON.stringify(scene)
  const buildings=buildingsForRendering(scene.buildings)
  assert.equal(buildings.length,scene.buildings.length-1)
  assert.equal(buildings.some(b=>b.id==='way-212124093-0'),false)
  assert.ok(buildings.includes(scene.buildings.find(b=>b.id==='way-29650592-0')))
  const details=createLandmarkDetails(scene)
  assert.equal(JSON.stringify(scene),before)
  details.stone.computeBoundingBox();details.gold.computeBoundingBox()
  assert.equal(details.stone.boundingBox.max.y,67)
  const center=[235944.305-scene.origin[0],900944.155-scene.origin[1]]
  assert.ok(Math.abs((details.gold.boundingBox.min.x+details.gold.boundingBox.max.x)/2-center[0])<.02)
  assert.ok(Math.abs((details.gold.boundingBox.min.z+details.gold.boundingBox.max.z)/2+center[1])<.02)
  assert.ok(details.gold.boundingBox.max.y<=40.01)
  const triangles=[details.stone,details.gold].reduce((sum,g)=>sum+(g.index?g.index.count:g.attributes.position.count)/3,0)
  assert.ok(triangles<1000)
  details.stone.dispose();details.gold.dispose()
})
test('absent landmarks do not create floating details or remove unrelated buildings', () => {
  const empty={origin:[0,0],buildings:[{id:'other',rings:[[[0,0],[1,0],[1,1],[0,0]]],height:10}]}
  assert.deepEqual(buildingsForRendering(empty.buildings),empty.buildings)
  const details=createLandmarkDetails(empty)
  assert.equal(details.stone.attributes.position?.count??0,0)
  assert.equal(details.gold.attributes.position?.count??0,0)
  details.stone.dispose();details.gold.dispose()
})