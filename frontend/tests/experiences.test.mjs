import test from 'node:test'
import assert from 'node:assert/strict'
import { experiences, experienceForLandmark } from '../src/lib/experiences.ts'

test('the two future experiences keep stable identifiers tied to their historic sites', () => {
  assert.equal(experienceForLandmark('old-north-church')?.id, 'old-north-lantern-mission')
  assert.equal(experienceForLandmark('old-state-house')?.id, 'old-state-house-boston-massacre')
  assert.equal(new Set(experiences.map(experience => experience.id)).size, 2)
  assert.ok(experiences.every(experience => experience.status === 'coming-soon'))
})

test('ordinary and unknown landmarks do not acquire an experience placeholder', () => {
  assert.equal(experienceForLandmark('boston-common'), undefined)
  assert.equal(experienceForLandmark('unknown-landmark'), undefined)
})
