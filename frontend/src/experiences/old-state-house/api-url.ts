const apiBase = (import.meta.env.VITE_NPC_API_URL ?? '').replace(/\/+$/, '')

export const npcApiUrl = (path: string) => apiBase + '/api/npcs' + path
export const npcAiLabel = apiBase ? 'Hosted AI' : 'Local AI'
