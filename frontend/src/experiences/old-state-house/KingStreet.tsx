import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import { EvidenceHunt } from './EvidenceHunt'
import { records } from './history-records'
import type { Encounter } from './history-records'
import { Vector3, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Group } from 'three'
import Player from './Player'
import { cart, createKingStreetConfig, rows } from './king-street-config'
import { useSiteAssets } from './assets'
import type { ExplorationConfig, Position } from './config'
import type { NpcPositions } from './npc-chat'

const noop = () => {}

function CobbledStreet() {
  const texture=useMemo(()=>{
    const size=128
    const pixels=new Uint8Array(size*size*4)
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const row=Math.floor(y/16), staggered=(x+(row%2)*16)%128
      const dx=staggered%32-15.5, dy=y%16-7.5
      const stone=Math.abs(dx/15)**4+Math.abs(dy/7.1)**4
      const tint=(row*31+Math.floor(staggered/32)*17)%29
      const value=stone<1?114+tint+((x*3+y*5)%13)-Math.floor(stone*16):78
      pixels.set([value,value-7,value-14,255],(y*size+x)*4)
    }
    const map=new DataTexture(pixels,size,size)
    map.wrapS=map.wrapT=RepeatWrapping
    map.repeat.set(78,14)
    map.colorSpace=SRGBColorSpace
    map.generateMipmaps=true
    map.minFilter=LinearMipmapLinearFilter
    map.magFilter=LinearFilter
    map.needsUpdate=true
    return map
  },[])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[110,15]}/><meshStandardMaterial map={texture} roughness={.96}/></mesh>
}

function TownHouse({config}:{config:ExplorationConfig}) {
  const assets=useSiteAssets(config.modelUrl,config.propsUrl)
  return assets && <group rotation-y={config.buildingRotationY}><primitive object={assets.building} dispose={null}/></group>
}

function Townsperson({position,index,engaged=false,pace=false,nod=0}:{position:Position;index:number;engaged?:boolean;pace?:boolean;nod?:number}) {
  const actor=useRef<Group>(null)
  const shoulders=useRef<Group>(null)
  const head=useRef<Group>(null)
  const leftLeg=useRef<Group>(null)
  const rightLeg=useRef<Group>(null)
  const worldPosition=useMemo(()=>new Vector3(),[])
  const gesture=useRef({sequence:0,start:0})
  const coat=['#564036','#35474a','#7a5947','#726651'][index%4]
  const skin=['#b98466','#72513c','#c39476','#ab775a'][index%4]
  useFrame(({clock,camera})=>{
    const time=clock.elapsedTime
    if(actor.current&&pace&&!engaged) {
      actor.current.position.x=position[0]+Math.sin(time*.45)*1.3
      actor.current.rotation.y=Math.cos(time*.45)>=0?Math.PI/2:-Math.PI/2
    }
    if(actor.current&&engaged){
      actor.current.getWorldPosition(worldPosition)
      actor.current.rotation.y=Math.atan2(camera.position.x-worldPosition.x,camera.position.z-worldPosition.z)
    }
    if(leftLeg.current&&rightLeg.current){
      const stride=pace&&!engaged?Math.sin(time*5)*.23:0
      leftLeg.current.rotation.x=stride
      rightLeg.current.rotation.x=-stride
    }
    if(nod&&nod!==gesture.current.sequence)gesture.current={sequence:nod,start:time}
    if(head.current){
      const age=time-gesture.current.start
      head.current.rotation.x=nod&&age<.68?Math.sin(age/.68*Math.PI)*.25:0
    }
    if(shoulders.current)shoulders.current.rotation.z=Math.sin(time*(engaged?3:1.3)+index)*.024
  })
  return <group position={position} ref={actor} rotation-y={position[2]>0?Math.PI:0}>
    <group ref={shoulders}>
      <mesh position-y={1.02}><cylinderGeometry args={[.23,.31,.61,10]}/><meshStandardMaterial color={coat}/></mesh>
      <group ref={head} position-y={1.4}><mesh position-y={.11}><sphereGeometry args={[.143,14,10]}/><meshStandardMaterial color={skin}/></mesh>
      <mesh position-y={.26}><cylinderGeometry args={[.13,.17,.12,12]}/><meshStandardMaterial color="#39322d"/></mesh>
      <mesh position-y={.21}><cylinderGeometry args={[.225,.225,.035,12]}/><meshStandardMaterial color="#39322d"/></mesh></group>
      {[-1,1].map(side=><group key={side}>
        <mesh position={[side*.285,1.02,0]} rotation-z={side*.16}><capsuleGeometry args={[.083,.36,4,8]}/><meshStandardMaterial color={coat}/></mesh>
        <mesh position={[side*.33,.76,.015]}><sphereGeometry args={[.066,9,8]}/><meshStandardMaterial color={skin}/></mesh>
        <group ref={side<0?leftLeg:rightLeg} position={[side*.124,.75,0]}><mesh position={[0,-.32,0]}><capsuleGeometry args={[.094,.54,4,8]}/><meshStandardMaterial color="#5b5246"/></mesh>
        <mesh position={[0,-.66,.055]} scale={[.11,.07,.18]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#332b24"/></mesh></group>
      </group>)}
    </group>
  </group>
}

export default function KingStreet({modern,onReturn}:{modern:ExplorationConfig;onReturn:()=>void}) {
  const [walking,setWalking]=useState(false)
  const [encounter,setEncounter]=useState<Encounter|null>(null)
  const [near,setNear]=useState<Encounter|null>(null)
  const [notice,setNotice]=useState('')
  const [nod,setNod]=useState({id:'',sequence:0})
  const nearby=useRef<Encounter|null>(null)
  const points=useMemo(()=>[
    ...records.witnesses.filter(w=>w.id!=='printer').map(w=>({position:w.position,encounter:{kind:'witness',id:w.id} as Encounter})),
    {position:[35,0,-6],encounter:{kind:'press',id:'printer'} as Encounter},
    {position:[18,0,-6],encounter:{kind:'site',id:'H01'} as Encounter},
    {position:[22,0,3],encounter:{kind:'site',id:'H02'} as Encounter},
  ],[])
  const onPosition=(x:number,y:number,z:number)=>{
    const point=points.map(p=>({p,distance:Math.hypot(x-p.position[0],z-p.position[2],y-1.68)})).sort((a,b)=>a.distance-b.distance)[0]
    const next=point&&point.distance<4.5?point.p.encounter:null
    if(next!==nearby.current){nearby.current=next;setNear(next)}
  }
  useEffect(()=>{
    if(!notice)return
    const timer=window.setTimeout(()=>setNotice(''),3200)
    return ()=>window.clearTimeout(timer)
  },[notice])
  useEffect(()=>{
    const keys=(e:KeyboardEvent)=>{
      if(encounter||e.repeat||e.ctrlKey||e.metaKey||(e.target as HTMLElement)?.closest('input,textarea,select'))return
      if(e.code==='KeyJ')setEncounter({kind:'journal'})
      if(e.code==='Escape')setWalking(false)
    }
    window.addEventListener('keydown',keys)
    return ()=>window.removeEventListener('keydown',keys)
  },[encounter])
  const canvas=useRef<HTMLCanvasElement|null>(null)
  useEffect(()=>{if(walking&&!encounter)canvas.current?.focus()},[walking,encounter])
  const npcs=useRef<NpcPositions>({})
  const config=useMemo(()=>createKingStreetConfig(modern),[modern])
  const box=(position:Position,size:Position,color:string)=><mesh position={position}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.93}/></mesh>
  return <section className="osh-experience history-arrival" aria-label="King Street historical reconstruction">
    <div className="osh-world" inert={!!encounter}>
      <Canvas onCreated={({gl})=>{canvas.current=gl.domElement}} camera={{fov:65,near:.12,far:150}} dpr={[1,1.5]}>
        <color attach="background" args={['#b9b7aa']}/><fog attach="fog" args={['#b9b7aa',45,105]}/>
        <hemisphereLight args={['#fff1d9','#6f5947',2.1]}/><directionalLight position={[18,22,9]} intensity={2.4} color="#ffe1b1"/>
        {box([0,-.17,0],[110,.3,60],'#887b6c')}
        <CobbledStreet/>
        <TownHouse config={modern}/>
        {rows.map(({x,z,h,w},i)=><group key={i} position={[x,0,z]}>
          {box([0,h/2,0],[w,h,10],['#805147','#a59077','#716b61','#966c58'][i%4])}
          <mesh position-y={h+1.1} rotation-y={Math.PI/4}><coneGeometry args={[7.15,2.5,4]}/><meshStandardMaterial color="#514542"/></mesh>
          {box([2,h+1.9,1],[.85,2.5,.9],'#83594d')}
          {box([0,1,-Math.sign(z)*5.05],[1.23,2,.13],'#4e382e')}
          {box([0,.10,-Math.sign(z)*5.3],[1.55,.20,.6],'#817565')}
          {box([0,2.25,-Math.sign(z)*5.23],[.18,.32,.25],'#c2a06a')}
          {box([0,2.47,-Math.sign(z)*5.23],[.24,.11,.31],'#4e4236')}
          {box([0,3.05,-Math.sign(z)*5.02],[8.95,.11,.13],'#bfab90')}
          {[0,1,2].flatMap(col=>[0,1,2].map(level=><group key={col*3+level}>
            {box([(col-1)*2.6,1.55+level*2.2,-Math.sign(z)*5.04],[1.25,1.45,.12],'#b7a78d')}
            {box([(col-1)*2.6,1.55+level*2.2,-Math.sign(z)*5.12],[1.02,1.22,.07],'#393a35')}
          </group>))}
        </group>)}
        <Text position={[17,3.5,-10.8]} fontSize={.43} color="#efe2b9">CUSTOM HOUSE · INTERPRETED</Text>
        <Text position={[37,3.5,-10.8]} fontSize={.44} color="#efe2b9">PRINT SHOP</Text>
        {[[16,-8],[19,-8],[34,-8],[-18,8]].map(([x,z])=><mesh key={x} position={[x,.48,z]}><cylinderGeometry args={[.42,.37,.96,10]}/><meshStandardMaterial color="#5d4633"/></mesh>)}
        {points.map(({position,encounter:target},i)=><group key={target.id} position={position as Position}>
          {target.kind!=='site'&&<Townsperson position={[0,0,0]} index={i} engaged={encounter?.id===target.id} pace={target.kind==='press'} nod={nod.id===target.id?nod.sequence:0}/>}
          <Html position={[0,target.kind==='site'?1:2.1,0]} center distanceFactor={9}>
            <button className="history-action" disabled={near?.id!==target.id} onClick={()=>setEncounter(target)}>
              {target.kind==='site'?(target.id==='H01'?'Custom House notes':'Town House notes'):target.kind==='press'?'Print shop':records.witnesses.find(w=>w.id===target.id)?.name}
            </button>
          </Html>
        </group>)}
        <Townsperson position={[22,0,9]} index={0}/><Townsperson position={[23,0,9.8]} index={2}/>
        <Townsperson position={[12,0,-8]} index={1}/><Townsperson position={[11,0,-8.8]} index={3}/>
        {box([36,.46,-8],[2.8,.12,1.1],'#604632')}
        {[-1,1].map(side=><group key={side}>{box([36+side,.22,-8],[.12,.46,.76],'#634731')}{box([36+side,.55,-8],[.54,.04,.44],'#dbc6a1')}</group>)}
        <group position={cart}>
          {box([0,.69,0],[2.75,.14,1.12],'#60442e')}
          {[-1,1].map(side=><group key={side}>
            {box([0,.95,side*.51],[2.7,.39,.11],'#715039')}
            <group position={[0,.49,side*.70]}>
              <mesh><torusGeometry args={[.46,.047,8,24]}/><meshStandardMaterial color="#50392c"/></mesh>
              {[0,1,2,3].map(spoke=><group key={spoke} rotation-z={spoke*Math.PI/4}>{box([0,0,0],[.043,.91,.06],'#795638')}</group>)}
            </group>
            {box([1.9,.54,side*.42],[1.7,.08,.08],'#705038')}
          </group>)}
        </group>
        <Player sceneLabel="King Street" config={config} enabled={walking&&!encounter} mode={walking?'drag':'paused'} onNearby={noop} onInteract={()=>{if(nearby.current)setEncounter(nearby.current)}} onPosition={onPosition} npcPositions={npcs} onNearbyNpc={noop}/>
      </Canvas>
      <header className="osh-header"><div><span className="osh-eyebrow">MINIATURE BOSTON · HISTORICAL RECONSTRUCTION</span><h1>King Street</h1><p>Boston · Late December 1770</p></div><button className="osh-return" onClick={onReturn}>← Return to present day</button></header>
      {!walking?<div className="osh-pause-panel"><span className="osh-eyebrow">BOSTON, 1770</span><h2>The Evidence Hunt</h2><p>Explore a curated reconstruction of King Street after the trials. The street and its buildings are interpreted.</p><p>What happened on King Street? Who ordered the soldiers to fire? Why do accounts disagree?</p><button className="osh-info-done" onClick={()=>{setWalking(true)}}>Walk King Street</button></div>:<><div className="osh-reticle" aria-hidden/><div className="osh-walking-hint">WASD to move · Drag to look · E to inspect · J for journal</div></>}
      <nav className="history-actions" aria-label="Investigation">
        {walking&&near&&<button className="history-action" onClick={()=>setEncounter(near)}>E · {near.kind==='witness'?'Talk':near.kind==='press'?'Browse publications':'Inspect the street'}</button>}
        <button className="history-action" onClick={()=>setEncounter({kind:'journal'})}>Evidence journal · J</button>
      </nav>
    </div>
    {notice&&<p className="history-discovery" role="status">Evidence recorded · {notice}</p>}
    <EvidenceHunt encounter={encounter} close={()=>setEncounter(null)} onDiscovery={setNotice} onNod={id=>setNod(last=>({id,sequence:last.sequence+1}))}/>
  </section>
}
