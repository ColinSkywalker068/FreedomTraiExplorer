import { npcApiUrl } from './api-url'
import { useEffect, useRef, useState } from 'react'
import { records as data } from './history-records'
import type { Encounter } from './history-records'
import './history.css'

const questions = {
  Q1:'What happened on King Street?',
  Q2:'Who ordered the soldiers to fire?',
  Q3:'How did the event become a public narrative?',
}
const key = 'boston1770.journal.v1'
const sessionKey = 'boston1770.session.v1'
const lookup = (id:string)=>data.clues.find(c=>c.id===id)
function readProgress():{clues:string[];docs:string[]} {
  try {
    const saved=JSON.parse(sessionStorage.getItem(key) ?? '{}')
    return {clues:Array.isArray(saved.clues)?[...new Set<string>(saved.clues.filter((id:string)=>lookup(id)))]:[],
      docs:Array.isArray(saved.docs)?[...new Set<string>(saved.docs.filter((id:string)=>data.documents.some(d=>d.id===id)))]:[]}
  } catch { return {clues:[],docs:[]} }
}

export function EvidenceHunt({encounter,close,onDiscovery,onNod}:{encounter:Encounter|null;close:()=>void;onDiscovery:(title:string)=>void;onNod:(id:string)=>void}) {
  const [progress,setProgress]=useState(readProgress)
  const [documentId,setDocumentId]=useState('')
  const [zoom,setZoom]=useState(1)
  const [message,setMessage]=useState('')
  const [pending,setPending]=useState(false)
  const [threads,setThreads]=useState<Record<string,{question:string;reply:string;mode:string;clueId?:string}[]>>({})
  const [selected,setSelected]=useState<string[]>([])
  const [reflection,setReflection]=useState('')
  const abort=useRef<AbortController|null>(null)
  const panel=useRef<HTMLElement>(null)
  const witness=data.witnesses.find(w=>w.id===encounter?.id)
  const publication=data.documents.find(d=>d.id===documentId)
  const collected=data.clues.filter(c=>progress.clues.includes(c.id))
  const ready=progress.docs.length>0&&collected.length>=8&&collected.some(c=>c.interactions.some(i=>/^W/.test(i)))&&collected.some(c=>c.interactions.some(i=>/^P/.test(i)))
  useEffect(()=>{try{sessionStorage.setItem(key,JSON.stringify(progress))}catch{/* storage disabled */}},[progress])
  useEffect(()=>()=>abort.current?.abort(),[])
  useEffect(()=>{if(encounter)panel.current?.focus()},[encounter])
  const collect=(ids:string[],interaction:string)=>{
    const discovered=ids.map(lookup).filter(c=>c&&c.interactions.includes(interaction)&&!progress.clues.includes(c.id))
    if(!discovered.length)return
    setProgress(current=>({...current,clues:[...new Set([...current.clues,...discovered.map(c=>c!.id)])]}))
    onDiscovery(discovered.map(c=>c!.title).join(' · '))
  }
  const openDocument=(id:string)=>{
    setDocumentId(id);setZoom(1)
    setProgress(current=>({...current,docs:[...new Set([...current.docs,id])]}))
  }
  const dismiss=()=>{
    abort.current?.abort();abort.current=null
    setPending(false);setMessage('');setDocumentId('');close()
  }
  const send=async()=>{
    const question=message.trim()
    if(!witness||!question||pending)return
    const controller=new AbortController()
    abort.current=controller
    setPending(true);setMessage('')
    const add=(reply:string,mode:string,clueId?:string)=>setThreads(old=>({...old,[witness.id]:[...(old[witness.id]??[]),{question,reply,mode,clueId}].slice(-12)}))
    try{
      let session=sessionStorage.getItem(sessionKey)
      if(!session){session=crypto.randomUUID();sessionStorage.setItem(sessionKey,session)}
      const response=await fetch(npcApiUrl('/history/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({witness:witness.id,session,message:question}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(85000)])})
      if(!response.ok)throw new Error('Witness service unavailable')
      const result=await response.json()
      if(controller.signal.aborted)return
      const clueId=typeof result.clueId==='string'&&witness.clueIds.includes(result.clueId)?result.clueId:undefined
      add(result.dialogue,result.mode==='live'&&result.provider==='groq'?'hosted':result.mode,clueId)
      if(result.action==='NOD')onNod(witness.id)
      if(clueId)collect([clueId],witness.id)
    }catch{
      if(!controller.signal.aborted)add('The witness service is unavailable. You can read the preserved record below.','offline')
    }finally{if(abort.current===controller){abort.current=null;setPending(false)}}
  }
  if(!encounter)return null
  const title=publication?.title??(encounter.kind==='journal'?'Evidence journal':encounter.kind==='press'?'The print shop':encounter.kind==='site'?'King Street field notes':witness?.name)
  return <div className="osh-modal-scrim history-scrim"><section ref={panel} tabIndex={-1} className="history-panel" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();dismiss()}
    if(event.key==='Tab'){
      const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea'))
      if(event.shiftKey&&[panel.current,focusable[0]].includes(document.activeElement as HTMLElement)){event.preventDefault();focusable.at(-1)?.focus()}
      else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0]?.focus()}
    }
  }}>
    <button className="osh-close-info" onClick={dismiss} aria-label="Close and return to King Street">×</button>
    <span className="osh-eyebrow">BOSTON, 1770 · THE EVIDENCE HUNT</span><h2>{title}</h2>
    {publication?<><p>{publication.date} · {publication.representation}</p><p>{publication.description}</p>
      {'image' in publication&&typeof publication.image==='string'&&<><label>Zoom <input type="range" min="1" max="3" step=".25" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label><div className="history-image"><img src={publication.image} style={{width:zoom*100+'%'}} alt={publication.title}/></div></>}
      <div className="history-list">{publication.details.map(detail=><details key={detail.id}><summary>{detail.title}</summary><p>{detail.text}</p><button onClick={()=>collect(detail.clueIds,publication.id)} disabled={detail.clueIds.every(id=>progress.clues.includes(id))}>Record observation</button></details>)}</div>
      <p><a href={data.sources.find(s=>s.id===publication.sourceId)?.url} target="_blank" rel="noreferrer">Open archival source ↗</a></p><button onClick={()=>setDocumentId('')}>Back to list</button></>
    :encounter.kind==='press'?<><p>{data.witnesses.find(w=>w.id==='printer')?.greeting}</p><div className="history-list">{data.documents.map(d=><button key={d.id} onClick={()=>openDocument(d.id)}>{d.title} <small>{d.date} · {d.representation}</small></button>)}</div></>
    :encounter.kind==='witness'&&witness?<><p>{witness.description}</p><p>{witness.greeting}</p>
      <div className="history-thread" aria-live="polite">{threads[witness.id]?.map((turn,index)=>{const source=turn.clueId?lookup(turn.clueId):undefined;return <div key={index}><strong>You · {turn.question}</strong><p>{turn.reply}</p>{source&&<p><a href={source.url} target="_blank" rel="noreferrer">{source.locator} ↗</a></p>}<small>{turn.mode==='hosted'?'Record selected by hosted AI':turn.mode==='live'?'Record selected by local AI':turn.mode==='scripted'?'Scripted fallback':turn.mode==='offline'?'Offline':'Record limits'}</small></div>})}</div>
      <form onSubmit={e=>{e.preventDefault();void send()}}><input aria-label="Ask the witness" value={message} maxLength={600} onChange={e=>setMessage(e.target.value)} placeholder="What did you see or hear?"/><button disabled={pending||!message.trim()}>{pending?'Listening…':'Ask'}</button></form>
      <details><summary>Read the preserved record</summary><p>Scripted reading of the source.</p>{witness.clueIds.map(id=>{
        const clue=lookup(id)
        return clue&&<article key={id}><strong>{clue.title}</strong><p>{clue.claim}</p><p><a href={clue.url} target="_blank" rel="noreferrer">{clue.locator} ↗</a></p><button onClick={()=>collect([id],witness.id)} disabled={progress.clues.includes(id)}>Record testimony</button></article>
      })}</details></>
    :encounter.kind==='site'?<><p>The historical street and the meeting places are approximate. These field notes link the setting to surviving records.</p>{data.clues.filter(c=>encounter.id&&c.interactions.includes(encounter.id)).map(c=><details key={c.id}><summary>{c.title}</summary><p>{c.claim}</p><button onClick={()=>collect([c.id],encounter.id!)} disabled={progress.clues.includes(c.id)}>Record observation</button></details>)}</>
    :<><p>{collected.length} of {data.clues.length} evidence entries collected</p>
      {Object.entries(questions).map(([id,label])=><section key={id}><h3>{label}</h3>{collected.filter(c=>c.question===id).map(c=><details key={c.id}><summary>{c.title}</summary><p>{c.claim}</p><p>{c.type} · {c.speaker} · {c.publicationDate}</p><p>{c.uncertainty}</p><a href={c.url} target="_blank" rel="noreferrer">{c.sourceId} · {c.locator} ↗</a></details>)}</section>)}
      <h3>Connections</h3>{data.comparisons.filter(c=>c.clueIds.every(id=>progress.clues.includes(id))).map(c=><article key={c.id}><strong>{c.title}</strong><p>{c.text}</p></article>)}
      <h3>Collected publications</h3>{data.documents.filter(d=>progress.docs.includes(d.id)).map(d=><button key={d.id} onClick={()=>openDocument(d.id)}>{d.title}</button>)}
      <h3>Your interpretation</h3>{ready?<><p>Choose up to three entries that shape your account. Consider what those sources leave unresolved.</p>
        {collected.map(c=><label className="history-choice" key={c.id}><input type="checkbox" checked={selected.includes(c.id)} disabled={selected.length>=3&&!selected.includes(c.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{c.title}</label>)}
        <label className="history-choice">What remains uncertain?<textarea value={reflection} onChange={e=>setReflection(e.target.value)} maxLength={1600}/></label>
        {!!selected.length&&<article><h4>Your account, based on the selected records</h4>{selected.map(id=>{const c=lookup(id)!;return <p key={id}>{c.claim} <a href={c.url} target="_blank" rel="noreferrer">{c.sourceId} ↗</a> {c.uncertainty}</p>})}{reflection&&<p>{reflection}</p>}</article>}</>:<p>Collect eight entries, including a witness statement and a publication, to assemble an interpretation.</p>}</>}
  </section></div>
}
