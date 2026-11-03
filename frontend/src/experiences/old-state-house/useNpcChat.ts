import { npcApiUrl } from './api-url'
import { useEffect, useRef, useState } from 'react'
import { appendTurns, parseReply } from './npc-chat'
import type { NpcAction, NpcId, Turn } from './npc-chat'

export type Thread = { turns: Turn[]; pending?: {kind:'send';message:string} | {kind:'reset'}; error?: string }
type Threads = Partial<Record<NpcId,Thread>>
export const emptyThread: Thread = { turns: [] }

export function useNpcChat(onAction: (id: NpcId, action: NpcAction) => void) {
  const [threads,setThreads]=useState<Threads>({})
  const requests=useRef(new Map<NpcId,AbortController>())
  const session=useRef<string>(null)
  useEffect(()=>{
    const current=requests.current
    return ()=>{ for(const request of current.values()) request.abort();current.clear() }
  },[])
  const update=(id:NpcId, change:(thread:Thread)=>Thread)=>setThreads(previous=>({...previous,[id]:change(previous[id]??emptyThread)}))
  const request=async (id:NpcId,message?:string)=>{
    if(requests.current.has(id))return false
    session.current ??= crypto.randomUUID()
    const controller=new AbortController()
    requests.current.set(id,controller)
    update(id,thread=>({...thread,pending:message===undefined?{kind:'reset'}:{kind:'send',message},error:undefined}))
    try {
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(85000)])
      const response=message===undefined
        ? await fetch(npcApiUrl('/'+session.current+'/'+id),{method:'DELETE',signal})
        : await fetch(npcApiUrl('/chat'),{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({session_id:session.current,npc_id:id,scene_id:'old-state-house',message})})
      if(!response.ok) {
        if(response.status===429)throw new Error('The AI is busy. Try again in a moment.')
        if(response.status===502)throw new Error('The AI returned an unusable answer. Please try again.')
        if(response.status===504)throw new Error('The AI took too long to answer. Please try again.')
        throw new Error('The AI is unavailable. You can try again or switch to the scripted demo.')
      }
      const reply=message===undefined?null:parseReply(await response.json())
      if(controller.signal.aborted)return false
      if(!reply||message===undefined)update(id,()=>emptyThread)
      else {
        update(id,thread=>({turns:appendTurns(thread.turns,{role:'player',text:message},{role:'npc',text:reply.dialogue,sources:reply.sources})}))
        onAction(id,reply.action)
      }
      return true
    } catch(error) {
      if(controller.signal.aborted)return false
      const description=error instanceof Error && !(error instanceof TypeError) && error.name!=='TimeoutError'
        ? error.message : 'The AI could not be reached. Try again or use the scripted demo.'
      update(id,thread=>({...thread,pending:undefined,error:description}))
      return false
    } finally {
      if(requests.current.get(id)===controller)requests.current.delete(id)
    }
  }
  return {threads,request}
}

