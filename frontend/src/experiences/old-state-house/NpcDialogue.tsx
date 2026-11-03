import { npcAiLabel, npcApiUrl } from './api-url'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { appendTurns, npcProfiles } from './npc-chat'
import type { NpcAction, NpcId, Turn } from './npc-chat'

import { emptyThread } from './useNpcChat'
import type { Thread } from './useNpcChat'

type Availability = 'checking' | 'available' | 'unavailable'
interface Props {
  id:NpcId
  thread?:Thread
  onClose:()=>void
  onSend:(message?:string)=>Promise<boolean>
  onAction:(action:NpcAction)=>void
}

export default function NpcDialogue({id,thread=emptyThread,onClose,onSend,onAction}:Props) {
  const profile=npcProfiles[id]
  const [draft,setDraft]=useState('')
  const [availability,setAvailability]=useState<Availability>('checking')
  const [demo,setDemo]=useState(false)
  const [demoTurns,setDemoTurns]=useState<Turn[]>([])
  const input=useRef<HTMLInputElement>(null)
  const close=useRef<HTMLButtonElement>(null)
  const history=useRef<HTMLDivElement>(null)
  const live=useRef(true)
  useEffect(()=>{live.current=true;return()=>{live.current=false}},[])
  useEffect(()=>{
    const controller=new AbortController()
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(75000)])
    fetch(npcApiUrl('/health'),{signal})
      .then(async response=>response.ok && (await response.json()).available===true)
      .then(available=>{if(!controller.signal.aborted)setAvailability(available?'available':'unavailable')})
      .catch(()=>{if(!controller.signal.aborted)setAvailability('unavailable')})
    return ()=>controller.abort()
  },[])
  useEffect(()=>{(input.current??close.current)?.focus()},[])
  useEffect(()=>{if(history.current)history.current.scrollTop=history.current.scrollHeight},[thread,demo,demoTurns])
  const submit=(event:FormEvent)=>{
    event.preventDefault()
    if(!draft.trim()||thread.pending)return
    const message=draft.trim()
    void onSend(message).then(success=>{if(success&&live.current)setDraft('')})
  }
  const scripted=(index:number)=>{
    const reply=profile.demo[index]
    setDemoTurns(turns=>appendTurns(turns,{role:'player',text:profile.questions[index]},{role:'npc',text:reply.dialogue,sources:reply.sources,demo:true}))
    onAction(reply.action)
  }
  const turns=demo?demoTurns:thread.turns

  return <div className="osh-dialogue-scrim">
    <section className="osh-dialogue" role="dialog" aria-modal="true" aria-labelledby="osh-dialogue-title" onKeyDown={event=>{
      if(event.key!=='Tab')return
      const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)'))
      const first=items[0],last=items.at(-1)
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }}>
      <header><div><span className="osh-eyebrow">{profile.role}</span><h2 id="osh-dialogue-title">{profile.label}</h2></div><button ref={close} onClick={onClose} aria-label="Close conversation">×</button></header>
      <div className="osh-dialogue-status"><span>{demo?'SCRIPTED DEMO':availability==='available'?npcAiLabel.toUpperCase():availability==='checking'?'CHECKING ' + npcAiLabel.toUpperCase():npcAiLabel.toUpperCase() + ' UNAVAILABLE'}</span><button type="button" onClick={()=>setDemo(value=>!value)}>{demo?'Back to ' + npcAiLabel:'Scripted demo'}</button></div>
      <div ref={history} className="osh-dialogue-history" role="log" aria-label="Conversation history">
        <p className="osh-npc-turn">{profile.greeting}</p>
        {turns.map((turn,index)=><div className={'osh-'+turn.role+'-turn'} key={index}><p>{turn.text}</p>{turn.sources?.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>)}
        {!demo&&thread.pending&&(thread.pending.kind==='send'?<><p className="osh-player-turn">{thread.pending.message}</p><p className="osh-thinking" role="status">Waiting for a reply…</p></>:<p className="osh-thinking" role="status">Resetting conversation…</p>)}
      </div>
      {!demo&&thread.error&&<p className="osh-chat-error" role="alert">{thread.error}</p>}
      {(demo||turns.length===0)&&<div className="osh-suggestions">{profile.questions.map((question,index)=><button key={question} disabled={!demo&&!!thread.pending} onClick={()=>demo?scripted(index):void onSend(question)}>{question}</button>)}</div>}
      {!demo&&<form className="osh-message" onSubmit={submit}><input ref={input} value={draft} onChange={event=>setDraft(event.target.value)} readOnly={!!thread.pending} placeholder="Ask a question…" aria-label="Message" maxLength={600}/><button disabled={!draft.trim()||!!thread.pending}>Send</button></form>}
      <footer>{demo?<button type="button" onClick={()=>setDemoTurns([])}>Reset demo</button>:<button type="button" disabled={!!thread.pending||thread.turns.length===0} onClick={()=>void onSend()}>Reset conversation</button>}<span>Esc to close</span></footer>
    </section>
  </div>
}
