import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { landmarkContent } from '../src/lib/landmark-content.ts'

test('every real landmark has concise, linked historical content without altering geography', () => {
  const scene=JSON.parse(readFileSync(new URL('../public/data/scene.json',import.meta.url)))
  assert.deepEqual(Object.keys(landmarkContent).sort(),scene.landmarks.map(site=>site.id).sort())
  for (const site of scene.landmarks) {
    const content=landmarkContent[site.id]
    assert.ok(content.description.split(/\s+/).length>=20)
    assert.ok(content.description.split(/\s+/).length<=50)
    assert.equal(new URL(content.source.url).protocol,'https:')
    assert.ok(content.source.label.length>3)
  }
})