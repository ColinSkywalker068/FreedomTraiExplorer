import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PCFShadowMap } from 'three'
import type { SceneData } from '../../lib/scene-data'
import { createExplorationConfig } from './config'
import type { Position, SceneAnchor } from './config'
import Environment from './Environment'
import KingStreet from './KingStreet'
import Player from './Player'
import type { ControlMode } from './Player'
import { Npcs } from './Npcs'
import NpcDialogue from './NpcDialogue'
import { useNpcChat } from './useNpcChat'
import { npcProfiles, withinTalkRange } from './npc-chat'
import type { NpcId, NpcPositions, NpcReaction } from './npc-chat'
import './experience.css'
import './npc-dialogue.css'

interface Props { data: SceneData; onReady: () => void; onReturn: () => void; active: boolean }

export default function OldStateHouseExperience({ data,onReady,onReturn,active }: Props) {
  const config=useMemo(()=>createExplorationConfig(data),[data])
  const [historical,setHistorical]=useState(false)
  const [canvas,setCanvas]=useState<HTMLCanvasElement|null>(null)
  const [mode,setMode]=useState<ControlMode>('paused')
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [info,setInfo]=useState<SceneAnchor|null>(null)
  const [nearby,setNearby]=useState<SceneAnchor|null>(null)
  const [placements,setPlacements]=useState(false)
  const [hasExplored,setHasExplored]=useState(false)
  const [npc,setNpc]=useState<NpcId|null>(null)
  const [nearbyNpc,setNearbyNpc]=useState<NpcId|null>(null)
  const [greeted,setGreeted]=useState(false)
  const [greeting,setGreeting]=useState(false)
  const [reaction,setReaction]=useState<NpcReaction|null>(null)
  const npcPositions=useRef<NpcPositions>({})
  const registerNpcPosition = useCallback((id: NpcId, position: Position | null) => {
    if (position) npcPositions.current[id] = position
    else delete npcPositions.current[id]
  }, [])
  const playerPosition=useRef<Position>([...config.playerSpawn.position])
  const onPosition=useCallback((x:number,y:number,z:number)=>{
    playerPosition.current[0]=x
    playerPosition.current[1]=y
    playerPosition.current[2]=z
  },[])
  const activeConversation=useRef<NpcId|null>(null)
  const resumeMode=useRef<ControlMode>('paused')
  const sequence=useRef(0)
  const closeButton=useRef<HTMLButtonElement>(null)
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  const pause=useCallback(()=>{ if (canvas && document.pointerLockElement===canvas) document.exitPointerLock();setMode('paused') },[canvas])
  const closeInfo=useCallback(()=>{setInfo(null);requestAnimationFrame(()=>{if(alive.current)canvas?.focus()})},[canvas])
  const inspect=useCallback((anchor:SceneAnchor)=>{ if(!active)return;pause();setInfo(anchor) },[active,pause])
  const playReaction=useCallback((id:NpcId,action:NpcReaction['action'])=>{
    if(activeConversation.current===id)setReaction({npcId:id,action,sequence:++sequence.current})
  },[])
  const chat=useNpcChat(playReaction)
  const beginTalk=useCallback((id:NpcId)=>{
    if(!active||!ready||info||activeConversation.current||!withinTalkRange(playerPosition.current,npcPositions.current[id],config.playerSpawn.position[1]))return
    activeConversation.current=id
    resumeMode.current=mode
    pause();setNpc(id);setGreeting(false)
    playReaction(id,'WAVE')
  },[active,ready,info,config,mode,pause,playReaction])
  const closeTalk=useCallback(()=>{
    activeConversation.current=null
    setNpc(null);setReaction(null)
    if(resumeMode.current==='drag')setMode('drag')
    requestAnimationFrame(()=>{if(alive.current)canvas?.focus()})
  },[canvas])
  const interact=useCallback(()=>{
    if(nearbyNpc&&withinTalkRange(playerPosition.current,npcPositions.current[nearbyNpc],config.playerSpawn.position[1]))beginTalk(nearbyNpc)
    else if(nearby)inspect(nearby)
  },[nearbyNpc,config,beginTalk,nearby,inspect])
  const markReady=useCallback(()=>{setReady(true);onReady()},[onReady])
  useEffect(()=>{
    const change=()=>{if(canvas&&document.pointerLockElement===canvas&&active&&!historical&&!activeConversation.current){setMode('locked');setHasExplored(true)}else setMode('paused')}
    const reject=()=>{setError('Pointer lock is unavailable here. You can still explore with drag look.');setMode('paused')}
    const blur=()=>pause()
    const hidden=()=>{if(document.hidden)pause()}
    const escape=(event:KeyboardEvent)=>{if(active&&event.key==='Escape'){if(activeConversation.current){event.preventDefault();closeTalk();return}if(info)closeInfo();pause()}}
    document.addEventListener('pointerlockchange',change);document.addEventListener('pointerlockerror',reject);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerlockchange',change);document.removeEventListener('pointerlockerror',reject);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',escape);if(canvas&&document.pointerLockElement===canvas)document.exitPointerLock()}
  },[canvas,active,pause,info,closeInfo,closeTalk,historical])
  useEffect(()=>{if(!active&&canvas&&document.pointerLockElement===canvas)document.exitPointerLock()},[active,canvas])
  useEffect(()=>{if(info)closeButton.current?.focus()},[info])
  const start=()=>{
    if(!active||!canvas||info)return
    setError('');canvas.focus()
    try { const request=canvas.requestPointerLock();if(request&&typeof request.catch==='function')request.catch(()=>{if(alive.current){setError('Pointer lock was not allowed. Choose drag look to continue.');setMode('paused')}}) } catch {setError('Pointer lock was not allowed. Choose drag look to continue.');setMode('paused')}
  }
  const dragLook=()=>{if(!active||!canvas||info)return;setError('');setMode('drag');setHasExplored(true);canvas.focus()}
  const returnToMap=()=>{pause();onReturn()}
  const enabled=active&&!historical&&!info&&!npc&&ready&&(mode==='locked'||mode==='drag')

  useEffect(()=>{
    if(!enabled||nearbyNpc!=='curious-tourist'||greeted)return
    const timer=window.setTimeout(()=>{setGreeted(true);setGreeting(true);setReaction({npcId:'curious-tourist',action:'WAVE',sequence:++sequence.current})},100)
    return ()=>window.clearTimeout(timer)
  },[enabled,nearbyNpc,greeted])
  useEffect(()=>{
    if(!greeting)return
    const timer=window.setTimeout(()=>setGreeting(false),8500)
    return ()=>window.clearTimeout(timer)
  },[greeting])
  useEffect(()=>{
    if(!reaction)return
    const timer=window.setTimeout(()=>setReaction(null),4500)
    return ()=>window.clearTimeout(timer)
  },[reaction])
  const highlight=reaction?.action==='POINT_TO_BUILDING'?'architecture':reaction?.action==='HIGHLIGHT_MASSACRE_MARKER'?'boston-massacre-site':null
  const target=config.anchors.find(anchor=>anchor.id===highlight)

  return <>{historical&&<KingStreet modern={config} onReturn={()=>setHistorical(false)} />}<section hidden={historical} style={historical?{display:"none"}:undefined} className="osh-experience" inert={!active} aria-label="Old State House present-day exploration" data-experience="old-state-house" data-control-mode={enabled?mode:'paused'}>
    <div className="osh-world" inert={!!info||!!npc}>
    <Canvas shadows={{type:PCFShadowMap}} dpr={[1,1.5]} frameloop={enabled||(active&&npc)?'always':'demand'} camera={{position:config.playerSpawn.position,fov:65,near:0.12,far:340}} gl={{antialias:true,powerPreference:'high-performance'}} onCreated={({gl})=>setCanvas(gl.domElement)}>
      <color attach="background" args={['#cbd6d7']} /><fog attach="fog" args={['#cbd6d7',100,245]} />
      <hemisphereLight args={['#e9f0f4','#8a877b',2.2]} /><ambientLight intensity={0.75} />
      <directionalLight position={[45,85,30]} intensity={3.3} color="#fff0d8" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-72} shadow-camera-right={72} shadow-camera-top={72} shadow-camera-bottom={-72} shadow-camera-near={1} shadow-camera-far={210} shadow-bias={-0.0002} shadow-normalBias={0.04} shadow-radius={2.5} />
      <Environment config={config} onReady={markReady} onInspect={inspect} showPlacements={placements} />
      <Npcs spawns={config.npcSpawns} collision={config.collision} active={active&&ready} engagedNpcId={npc} nearbyNpcId={nearbyNpc} positions={npcPositions} registerPosition={registerNpcPosition} onSelect={beginTalk} action={reaction??undefined} speakingNpcId={npc&&reaction?.npcId===npc&&reaction.action==='NONE'?npc:null} />
      {target&&<mesh position={[target.position[0],target.position[1]+0.095,target.position[2]]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.75,1,32]}/><meshBasicMaterial color="#ffc75d" transparent opacity={0.94} depthWrite={false}/></mesh>}
      <Player config={config} enabled={enabled} mode={mode} onNearby={setNearby} onInteract={interact} onPosition={onPosition} npcPositions={npcPositions} onNearbyNpc={setNearbyNpc} />
    </Canvas>
    <header className="osh-header"><div><span className="osh-eyebrow">MINIATURE BOSTON · STREET LEVEL</span><h1>Old State House</h1><p>State Street, Boston <span>·</span> Present day</p></div><button className="osh-return" onClick={returnToMap}>← <span>Return to Miniature Boston</span></button></header>
    {!ready&&<div className="osh-loading" role="status"><span className="osh-spinner"/><p>Arriving on State Street…</p></div>}
    {active&&ready&&mode==='paused'&&!info&&!npc&&<div className="osh-pause-panel"><span className="osh-eyebrow">A CLOSER LOOK AT HISTORY</span><h2>Boston, at street level.</h2><p>Walk around the Old State House.<br/>Follow the red brick line and meet two people near the plaza.</p><div className="osh-key-guide"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>Space</kbd> Jump</span><span><kbd>↑</kbd><kbd>↓</kbd> Fly</span><span><kbd>X</kbd> Drop</span><span>Mouse · Look</span><span><kbd>E</kbd> Talk / inspect</span></div>{error&&<p className="osh-input-error" role="status">{error}</p>}<div className="osh-start-actions"><button onClick={start}>{hasExplored?'Resume walking':'Start walking'} <span>↗</span></button><button className="osh-secondary" onClick={dragLook}>Explore with drag look</button></div><p className="osh-mobile-hint">Drag look also works without pointer lock. Use a keyboard to walk; touch exploration supports looking around.</p></div>}
    {enabled&&greeting&&nearbyNpc==='curious-tourist'&&<p className="osh-tourist-greeting" role="status"><strong>Curious tourist</strong> {npcProfiles['curious-tourist'].greeting}</p>}
    {enabled&&<><div className="osh-reticle" aria-hidden/><div className="osh-walking-hint"><span>{mode==='drag'?'Drag to look':'Mouse to look'}</span><i/>WASD move · Space jump · ↑/↓ fly · X drop<i/>Esc to pause</div>{nearbyNpc?<button className="osh-nearby" onClick={()=>beginTalk(nearbyNpc)}><kbd>E</kbd> Talk to {npcProfiles[nearbyNpc].label.toLowerCase()} <span>↗</span></button>:nearby&&<button className="osh-nearby" onClick={()=>inspect(nearby)}><kbd>E</kbd> {nearby.label} <span>↗</span></button>}<button className="osh-pause-button" onClick={pause}>Pause</button></>}
    {ready&&!info&&<nav className="osh-site-notes" aria-label="Site information"><span>SITE NOTES</span><button onClick={()=>{pause();setHistorical(true)}}>Enter Boston, 1770 <span>↗</span></button>{config.anchors.filter(anchor=>anchor.available).map(anchor=><button key={anchor.id} onClick={()=>inspect(anchor)} disabled={!active}>{anchor.id==='architecture'?'Architecture':'Massacre marker'} <span>↗</span></button>)}</nav>}
    {ready&&<footer className="osh-footer"><details className="osh-credits"><summary>Scene credits & notes</summary><div><strong>A present-day artistic interpretation</strong><p>Old State House model: <a href="https://pinshape.com/items/5151-old-state-house-boston" target="_blank" rel="noreferrer">MakeALot</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Converted, rescaled and artistically materialled for this scene.</p><p>Character meshes and animations: <a href="https://quaternius.com/packs/universalbasecharacters.html" target="_blank" rel="noreferrer">Quaternius Universal Base Characters</a> and <a href="https://quaternius.itch.io/universal-animation-library" target="_blank" rel="noreferrer">Universal Animation Library</a> · CC0.</p><p>Planters and bollards: <a href="https://quaternius.com/packs/downtowncitymegakit.html" target="_blank" rel="noreferrer">Quaternius</a> · CC0. <a href="/experiences/old-state-house/NOTICE.txt" target="_blank" rel="noreferrer">Runtime asset notice</a>.</p><p>Layout: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · ODbL. Surrounding façades, pavement and furniture placement are simplified; this is not a surveyed reconstruction.</p></div></details><label><input type="checkbox" checked={placements} onChange={event=>setPlacements(event.target.checked)} disabled={!active}/> Show NPC placements</label></footer>}
    </div>
    {npc&&<NpcDialogue key={npc} id={npc} thread={chat.threads[npc]} onClose={closeTalk} onSend={message=>chat.request(npc,message)} onAction={action=>playReaction(npc,action)} />}
    {info&&<div className="osh-modal-scrim"><section className="osh-info-card" role="dialog" aria-modal="true" aria-labelledby="osh-info-title" onKeyDown={event=>{if(event.key!=='Tab')return;const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]'));const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}><button ref={closeButton} className="osh-close-info" onClick={closeInfo} aria-label="Close site information">×</button><span className="osh-eyebrow">A NOTE FROM THIS PLACE</span><h2 id="osh-info-title">{info.label}</h2><p>{info.description}</p><a href={info.source} target="_blank" rel="noreferrer">Read the official history <span>↗</span></a><button className="osh-info-done" onClick={closeInfo}>Back to the plaza</button></section></div>}
  </section></>
}
