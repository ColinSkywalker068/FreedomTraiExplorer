import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { interpolateCameraPose, cameraTransitionDuration } from '../src/lib/camera-transition.ts'

const start = { position: new Vector3(100,150,0), target: new Vector3(), zoom: 1 }
const end = { position: new Vector3(-100,150,0), target: new Vector3(20,0,20), zoom: 3 }
test('camera focus reaches exact endpoints and avoids cutting through the city', () => {
  const a = interpolateCameraPose(start,end,0), b = interpolateCameraPose(start,end,1)
  assert.ok(a.position.distanceTo(start.position)<1e-8)
  assert.ok(b.position.distanceTo(end.position)<1e-8)
  assert.equal(b.zoom,3)
  const mid=interpolateCameraPose(start,end,.5)
  assert.ok(mid.position.distanceTo(mid.target)>170)
  assert.ok(mid.zoom>1 && mid.zoom<3)
})
test('a new focus begins at the interrupted camera pose and reduced motion skips travel', () => {
  const current=interpolateCameraPose(start,end,.4)
  const redirect=interpolateCameraPose(current,start,0)
  assert.ok(current.position.distanceTo(redirect.position)<1e-8)
  assert.ok(current.target.equals(redirect.target))
  assert.equal(current.zoom,redirect.zoom)
  assert.equal(cameraTransitionDuration(true),0)
  assert.ok(cameraTransitionDuration(false)>0 && cameraTransitionDuration(false)<1)
})

test('long focus travels continuously inside the real trail corridor', async () => {
  const { readFileSync } = await import('node:fs')
  const { createCameraTargetPath } = await import('../src/lib/camera-transition.ts')
  const { distanceToRoute } = await import('../src/lib/scene-camera.ts')
  const scene=JSON.parse(readFileSync(new URL('../public/data/scene.json',import.meta.url)))
  const point=site=>new Vector3(site.position[0],0,-site.position[1])
  const from=point(scene.landmarks[0]),to=point(scene.landmarks[15])
  const routes=scene.route.segments.map(s=>s.coordinates)
  const path=createCameraTargetPath(from,to,routes)
  const a={position:from.clone().add(new Vector3(1000,2000,1000)),target:from,zoom:.2}
  const b={position:to.clone().add(new Vector3(1000,2000,1000)),target:to,zoom:.5}
  let previous=from
  for(let i=0;i<=200;i++) {
    const pose=interpolateCameraPose(a,b,i/200,path)
    assert.ok(distanceToRoute([pose.target.x,-pose.target.z],routes)<=450)
    assert.ok(pose.target.distanceTo(previous)<80)
    previous=pose.target
  }
  assert.ok(previous.distanceTo(to)<1e-6)
})


test('repeated focus holds its target and short permitted moves stay direct', async () => {
  const { createCameraTargetPath } = await import('../src/lib/camera-transition.ts')
  const route=[[[0,0],[0,1000]]]
  const target=new Vector3(192,0,0)
  const path=createCameraTargetPath(target,target,route)
  const pose={position:new Vector3(1000,2000,1000),target,zoom:.5}
  assert.ok(interpolateCameraPose(pose,pose,.5,path).target.equals(target))
  assert.equal(createCameraTargetPath(target,new Vector3(192,0,-100),route).length,2)
})
