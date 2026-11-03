import assert from 'node:assert/strict'
import test from 'node:test'
import { appendTurns, nearestNpc, parseReply, withinTalkRange } from '../src/experiences/old-state-house/npc-chat.ts'

test('NPC interaction uses current positions and excludes flying visitors', () => {
  const positions = { 'curious-tourist': [9, 0, 0], 'historical-guide': [2, 0, 0] }
  assert.equal(nearestNpc([0, 1.68, 0], positions, 1.68), 'historical-guide')
  assert.equal(nearestNpc([0, 9, 0], positions, 1.68), null)
  assert.equal(withinTalkRange([0, 1.68, 0], positions['curious-tourist'], 1.68), false)
})

test('dialogue keeps text but discards unknown actions and unsafe source URLs', () => {
  assert.deepEqual(parseReply({dialogue:'Hello',action:'EXECUTE',sources:[{title:'bad',url:'javascript:alert(1)'},{title:'History',url:'https://www.nps.gov/bost/'}]}), {
    dialogue:'Hello',action:'NONE',sources:[{title:'History',url:'https://www.nps.gov/bost/'}],
  })
  assert.throws(() => parseReply({dialogue:'  '}))
})

test('transcript limit drops oldest turns without mutating earlier state', () => {
  const history = Array.from({length:32}, (_, text) => ({ role:'player', text:String(text) }))
  const next = appendTurns(history, {role:'npc',text:'latest'})
  assert.equal(next.length, 32)
  assert.equal(next[0].text, '1')
  assert.equal(next.at(-1).text, 'latest')
  assert.equal(history[0].text, '0')
})
