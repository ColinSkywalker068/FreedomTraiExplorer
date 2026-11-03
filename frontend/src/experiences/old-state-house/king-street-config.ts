import type { ExplorationConfig, Position } from './config.ts'

export const rows = [-1,1].flatMap(side => Array.from({length:8},(_,i)=>({x:-33+i*10,z:side*16,h:7+i%3,w:9})))
export const cart:Position = [30,0,8.4]


export function createKingStreetConfig(modern:ExplorationConfig):ExplorationConfig {
  return {...modern,
    playerSpawn:{position:[33,1.68,0],target:[0,3,0]},anchors:[],
    collision:{bounds:[-40,-24,44,24],colliders:[
      ...modern.collision.colliders.filter(c=>c.id==='way-29608515-0'),
      ...[[16,-8,.47,.47],[19,-8,.47,.47],[34,-8,.47,.47],[-18,8,.47,.47],[36,-8,1.4,.55],[cart[0],cart[2],1.5,.9]].map(([x,z,w,d],i)=>{
        const bounds:[number,number,number,number]=[x-w,z-d,x+w,z+d]
        return {id:'prop-'+i,bounds,rings:[[[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]] as [number,number][]]}
      }),
      ...rows.map(({x,z,w},i)=>{
        const bounds:[number,number,number,number]=[x-w/2,z-5,x+w/2,z+5]
        const [a,b,c,d]=bounds
        return {id:'facade-'+i,bounds,rings:[[[a,b],[c,b],[c,d],[a,d]] as [number,number][]]}
      })]}
  }
}
