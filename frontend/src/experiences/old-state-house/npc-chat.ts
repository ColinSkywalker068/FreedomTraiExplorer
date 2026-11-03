import type { NpcSpawn, Position } from './config'

export type NpcId = NpcSpawn['id']
export type NpcPositions = Partial<Record<NpcId, Position>>
const actions = ['NONE','WAVE','NOD','POINT_TO_BUILDING','POINT_TO_GUIDE','HIGHLIGHT_MASSACRE_MARKER'] as const
export type NpcAction = typeof actions[number]
export type NpcReaction = { npcId: NpcId; action: NpcAction; sequence: number }
export interface Source { title: string; url: string }
interface Reply { dialogue: string; action: NpcAction; sources: Source[] }
export interface Turn { role: 'player' | 'npc'; text: string; sources?: Source[]; demo?: boolean }
export const npcProfiles = {
  'curious-tourist': {
    label: 'Curious tourist', role: 'Freedom Trail visitor',
    greeting: 'Hey! Have you been here before? I keep wondering how this little building ended up between all these skyscrapers.',
    questions: ['What are you looking at?', 'Who can tell me more?'],
    demo: [
      {dialogue:'That little brick building! I spotted it following the red line. The skyscrapers make it look even smaller, don’t they?',action:'POINT_TO_BUILDING',sources:[]},
      {dialogue:'I’m figuring this out too. That guide over there looks like they know the story. Want to ask them?',action:'POINT_TO_GUIDE',sources:[]},
    ],
  },
  'historical-guide': {
    label: 'Historical guide', role: 'Local historical interpreter',
    greeting: 'Welcome to the Old State House. Would you like to talk about the building, or what happened right here on State Street?',
    questions: ['What happened at the Boston Massacre?', 'Where is the Massacre marker?', 'What is the balcony known for?'],
    demo: [
      {dialogue:'On March 5, 1770, British soldiers fired into a crowd outside the Old State House. Five people died. The shooting became a powerful symbol in the political struggle between Britain and the colonies.',action:'NOD',sources:[{title:'Freedom Trail Foundation · Boston Massacre Site',url:'https://www.thefreedomtrail.org/trail-sites/boston-massacre-site'}]},
      {dialogue:'Look for the pavement marker just outside the Old State House. It commemorates the people killed here on March 5, 1770.',action:'HIGHLIGHT_MASSACRE_MARKER',sources:[{title:'Freedom Trail Foundation · Boston Massacre Site',url:'https://www.thefreedomtrail.org/trail-sites/boston-massacre-site'}]},
      {dialogue:'The Declaration of Independence was read publicly from that balcony in July 1776. People gathered below to hear it in Boston.',action:'POINT_TO_BUILDING',sources:[{title:'Revolutionary Spaces · Old State House',url:'https://revolutionaryspaces.org/discover/old-state-house/'}]},
    ],
  },
} satisfies Record<NpcId,{ label: string; role: string; greeting: string; questions: string[]; demo: Reply[] }>

const talkDistance = (eye: Position, position: Position, eyeHeight: number) =>
  Math.hypot(eye[0]-position[0],eye[1]-eyeHeight-position[1],eye[2]-position[2])

export function withinTalkRange(eye: Position, position: Position | undefined, eyeHeight: number) {
  return !!position && Math.abs(eye[1]-eyeHeight-position[1]) < 1.8 && talkDistance(eye,position,eyeHeight) <= 4.5
}

export function nearestNpc(eye: Position, positions: NpcPositions, eyeHeight: number) {
  let best: NpcId | null = null
  let distance = Infinity
  for (const id of Object.keys(npcProfiles) as NpcId[]) {
    const position = positions[id]
    if (!position || !withinTalkRange(eye,position,eyeHeight)) continue
    const candidate = talkDistance(eye,position,eyeHeight)
    if (candidate < distance) { best = id; distance = candidate }
  }
  return best
}

export function parseReply(value: unknown): Reply {
  if (!value || typeof value !== 'object' || !('dialogue' in value) || typeof value.dialogue !== 'string' || !value.dialogue.trim()) {
    throw new Error('The local AI returned an unreadable reply.')
  }
  const action = 'action' in value && actions.includes(value.action as NpcAction) ? value.action as NpcAction : 'NONE'
  const candidates: unknown[] = 'sources' in value && Array.isArray(value.sources) ? value.sources.slice(0,5) : []
  const sources = candidates.flatMap(source => {
    if (!source || typeof source !== 'object' || !('title' in source) || typeof source.title !== 'string' || !('url' in source) || typeof source.url !== 'string') return []
    try { if (new URL(source.url).protocol === 'https:') return [{title:source.title,url:source.url}] } catch { /* skip invalid links */ }
    return []
  })
  return { dialogue: value.dialogue.trim(), action, sources }
}

export function appendTurns(history: Turn[], ...turns: Turn[]) {
  return [...history,...turns].slice(-32)
}
