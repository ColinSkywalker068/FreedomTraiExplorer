import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, CylinderGeometry, DataTexture, DoubleSide, Float32BufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, Object3D, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three'
import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createFootprints, createRibbons } from '../../lib/geometry'
import type { ExplorationConfig, SceneAnchor } from './config'
import { useSiteAssets } from './assets'
import { createDeferredDisposal } from './lifetime'

function pavementTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const seam = x % 32 === 0 || y % 32 === 0
    const tone = seam ? 147 : 189 + ((x * 13 + y * 7) % 5)
    const i = (y * size + x) * 4
    pixels[i] = tone; pixels[i+1] = tone-3; pixels[i+2] = tone-10; pixels[i+3] = 255
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.colorSpace = SRGBColorSpace; texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping; texture.repeat.set(70, 70);texture.generateMipmaps=true;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.needsUpdate = true
  return texture
}

function WindowFacades({ config }: { config: ExplorationConfig }) {
  const ref = useRef<InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)
  const matrices = useMemo(() => {
    const items: Matrix4[] = [], dummy = new Object3D()
    for (const building of config.contextBuildings) {
      const ring = building.rings[0], height = building.height ?? 12
      for (let edge = 1; edge < ring.length; edge++) {
        const [ax, an] = ring[edge-1], [bx, bn] = ring[edge]
        const dx = bx-ax, dn = bn-an, length = Math.hypot(dx,dn), columns = Math.floor(length/3.8)
        for (let floor = 0; floor < Math.floor((height-2)/3.6); floor++) for (let column = 0; column < columns; column++) {
          const fraction = (column+0.5)/columns
          dummy.position.set(ax+dx*fraction, 2.1+floor*3.6, -(an+dn*fraction))
          dummy.rotation.set(0,Math.atan2(dn,dx),0); dummy.updateMatrix(); items.push(dummy.matrix.clone())
        }
      }
    }
    return items
  }, [config])
  useLayoutEffect(() => { if (!ref.current) return; matrices.forEach((matrix,index) => ref.current!.setMatrixAt(index,matrix)); ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); invalidate() }, [matrices,invalidate])
  return <instancedMesh ref={ref} args={[undefined,undefined,matrices.length]} frustumCulled><planeGeometry args={[1.35,1.7]} /><meshStandardMaterial color="#425866" roughness={0.38} metalness={0.35} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} /></instancedMesh>
}

function InfoMarker({ anchor, onInspect }: { anchor: SceneAnchor; onInspect: (anchor: SceneAnchor) => void }) {
  const massacre = anchor.id === 'boston-massacre-site'
  return <group position={anchor.position}>
    {massacre ? <group onClick={event => { event.stopPropagation(); onInspect(anchor) }}>
      <mesh rotation-x={-Math.PI/2} position-y={0.045}><circleGeometry args={[0.72,48]} /><meshStandardMaterial color="#a08d69" roughness={0.85} /></mesh>
      <mesh rotation-x={Math.PI/2} position-y={0.055}><torusGeometry args={[0.57,0.035,8,48]} /><meshStandardMaterial color="#655b49" roughness={0.75} /></mesh>
      <mesh rotation-x={-Math.PI/2} position-y={0.06}><ringGeometry args={[0.22,0.27,32]} /><meshStandardMaterial color="#6e6047" side={DoubleSide} /></mesh>
    </group> : <group onClick={event => { event.stopPropagation(); onInspect(anchor) }}>
      <mesh position-y={0.63}><boxGeometry args={[0.065,1.26,0.065]} /><meshStandardMaterial color="#48524b" roughness={0.7} metalness={0.5} /></mesh>
      <mesh position={[0,1.3,0]} rotation-x={-0.3}><boxGeometry args={[0.62,0.32,0.055]} /><meshStandardMaterial color="#b5a27a" roughness={0.55} metalness={0.5} /></mesh>
    </group>}
  </group>
}

function StreetFurniture({ library, config }: { library: Object3D; config: ExplorationConfig }) {
  const instances = useMemo(() => config.props.filter(placement=>placement.kind==='planter'||placement.kind==='bollard').map(placement => {
    const object = library.getObjectByName(placement.kind==='planter'?'Planter':'Bollard')?.clone(true)
    return { placement, object }
  }), [library,config])
  return <group dispose={null}>{instances.map(({placement,object}) => object ? <group key={placement.id} position={placement.position} rotation-y={placement.yawRadians}><primitive object={object} dispose={null} /></group> : null)}</group>
}

function ProceduralFurniture({ config }: { config: ExplorationConfig }) {
  const geometries=useMemo(()=>{
    const wood:BufferGeometry[]=[],metal:BufferGeometry[]=[],glass:BufferGeometry[]=[]
    for(const prop of config.props){
      const [x,,z]=prop.position
      const box=(target:BufferGeometry[],size:[number,number,number],position:[number,number,number])=>target.push(new BoxGeometry(...size).translate(position[0]+x,position[1],position[2]+z))
      if(prop.kind==='bench'){
        box(wood,[2.2,0.095,0.46],[0,0.48,0]);box(wood,[2.2,0.28,0.075],[0,0.83,0.22])
        for(const side of [-0.8,0.8]){box(metal,[0.075,0.45,0.35],[side,0.23,0]);box(metal,[0.06,0.76,0.055],[side,0.52,0.22])}
      }else if(prop.kind==='lamp'){
        metal.push(new CylinderGeometry(0.055,0.075,4.1,8).translate(x,2.05,z))
        box(metal,[0.85,0.065,0.065],[0.38,4.08,0]);box(metal,[0.44,0.10,0.3],[0.67,4.04,0]);box(glass,[0.35,0.025,0.23],[0.67,3.975,0])
      }
    }
    const result={wood:wood.length?mergeGeometries(wood)!:null,metal:metal.length?mergeGeometries(metal)!:null,glass:glass.length?mergeGeometries(glass)!:null}
    ;[...wood,...metal,...glass].forEach(item=>item.dispose());return result
  },[config])
  const lifetime=useMemo(()=>createDeferredDisposal(()=>Object.values(geometries).forEach(item=>item?.dispose())),[geometries])
  useEffect(()=>lifetime.retain(),[lifetime])
  return <group>{geometries.wood&&<mesh geometry={geometries.wood} castShadow receiveShadow><meshStandardMaterial color="#8c7459" roughness={0.85}/></mesh>}{geometries.metal&&<mesh geometry={geometries.metal} castShadow receiveShadow><meshStandardMaterial color="#414d4b" roughness={0.55} metalness={0.5}/></mesh>}{geometries.glass&&<mesh geometry={geometries.glass}><meshStandardMaterial color="#e8e6cf" roughness={0.4}/></mesh>}</group>
}

function ReadyAfterRender({ onReady }: { onReady: () => void }) {
  const sent = useRef(false)
  const alive = useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useFrame(() => { if (!sent.current) { sent.current = true; queueMicrotask(()=>{if(alive.current)onReady()}) } })
  return null
}

export default function Environment({ config, onReady, onInspect, showPlacements }: { config: ExplorationConfig; onReady: () => void; onInspect: (anchor: SceneAnchor) => void; showPlacements: boolean }) {
  const assets = useSiteAssets(config.modelUrl,config.propsUrl)
  const texture = useMemo(()=>pavementTexture(),[])
  const geometry = useMemo(() => {
    const streetParts = config.roads.filter(road => !/footway|path|pedestrian|steps/.test(road.kind)).map(road => createRibbons(road.paths,road.width,0.018))
    const pathParts = config.roads.filter(road => /footway|path|pedestrian|steps/.test(road.kind)).map(road => createRibbons(road.paths,Math.max(road.width,1.5),0.025))
    const streets = streetParts.length ? mergeGeometries(streetParts)! : null
    const paths = pathParts.length ? mergeGeometries(pathParts)! : null
    ;[...streetParts,...pathParts].forEach(part => part.dispose())
    const paved=createFootprints(config.pavedAreas)
    const positions=paved.getAttribute('position'),uvs:number[]=[]
    if(positions){for(let i=0;i<positions.count;i++)uvs.push(positions.getX(i)/350+0.5,-positions.getZ(i)/350+0.5);paved.setAttribute('uv',new Float32BufferAttribute(uvs,2))}
    return { buildings:createFootprints(config.contextBuildings,true), greens:createFootprints(config.greens), paved, streets, paths, trail:createRibbons(config.routePaths,0.22,0.047) }
  },[config])
  const lifetime=useMemo(()=>createDeferredDisposal(()=>{texture.dispose();Object.values(geometry).forEach(item=>item?.dispose())}),[texture,geometry])
  useEffect(()=>lifetime.retain(),[lifetime])
  if (!assets) return null
  return <group>
    <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[350,350]} /><meshStandardMaterial map={texture} color="#e8e2d5" roughness={0.95} /></mesh>
    {geometry.streets && <mesh geometry={geometry.streets} receiveShadow><meshStandardMaterial color="#727b7b" roughness={0.94} side={DoubleSide} /></mesh>}
    {geometry.paths && <mesh geometry={geometry.paths} receiveShadow><meshStandardMaterial color="#c3bcaa" roughness={0.93} side={DoubleSide} /></mesh>}
    <mesh geometry={geometry.greens} position-y={0.03} receiveShadow><meshStandardMaterial color="#7e9478" side={DoubleSide} roughness={1} /></mesh>
    <mesh geometry={geometry.paved} position-y={0.034} receiveShadow><meshStandardMaterial map={texture} color="#e8dfcd" side={DoubleSide} roughness={0.92}/></mesh>
    <mesh geometry={geometry.buildings} receiveShadow><meshStandardMaterial color="#b6b3a8" roughness={0.85} flatShading /></mesh>
    <WindowFacades config={config} />
    <mesh geometry={geometry.trail}><meshStandardMaterial color="#a74a3c" roughness={0.95} side={DoubleSide} /></mesh>
    <group rotation-y={config.buildingRotationY} dispose={null}><primitive object={assets.building} dispose={null} /></group>
    <StreetFurniture library={assets.streetscape} config={config} />
    <ProceduralFurniture config={config}/>
    {config.anchors.filter(anchor => anchor.available).map(anchor => <InfoMarker key={anchor.id} anchor={anchor} onInspect={onInspect} />)}
    {showPlacements && config.npcSpawns.map(npc => <group key={npc.id} position={npc.position}><mesh rotation-x={-Math.PI/2} position-y={0.07}><ringGeometry args={[0.4,0.46,24]} /><meshBasicMaterial color="#607c73" side={DoubleSide} /></mesh><mesh position-y={0.8}><cylinderGeometry args={[0.025,0.025,1.6,6]} /><meshBasicMaterial color="#607c73" /></mesh></group>)}
    <ReadyAfterRender onReady={onReady} />
  </group>
}
