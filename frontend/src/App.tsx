import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import CityScene from './CityScene'
import type { ViewAction, CityNavigationHandle } from './CityScene'
import type { CameraPose } from './lib/camera-transition'
import { canExploreSite, explorationReducer } from './lib/exploration-navigation'
import ExperienceBoundary from './ExperienceBoundary'
import './ExplorationNavigation.css'
import SceneBoundary from './SceneBoundary'
import { validateScene } from './lib/scene-data'
import type { SceneData } from './lib/scene-data'
import { landmarkContent } from './lib/landmark-content'
import { experienceForLandmark } from './lib/experiences'
import './App.css'

const createSiteComponent = () => lazy(() => import('./experiences/old-state-house/OldStateHouseExperience'))

const number = new Intl.NumberFormat('en-US')

function App() {
  const navigation = useRef<CityNavigationHandle | null>(null)
  const savedPose = useRef<CameraPose | null>(null)
  const exploreButton = useRef<HTMLButtonElement>(null)
  const selectedCard = useRef<HTMLElement>(null)
  const [phase, dispatch] = useReducer(explorationReducer, 'map')
  const [experienceAttempt, setExperienceAttempt] = useState(0)
  const [OldStateHouseExperience, setSiteComponent] = useState(createSiteComponent)
  const [data, setData] = useState<SceneData | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [buildings, setBuildings] = useState(true)
  const [ready, setReady] = useState(false)
  const [rendererFailed, setRendererFailed] = useState(false)
  const [viewAction, setViewAction] = useState<ViewAction>({ id: 0, type: 'reset' })
  const [renderAttempt, setRenderAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/data/scene.json', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`City data request failed (${response.status}).`); return response.json() })
      .then(value => { const scene = validateScene(value); setData(scene); setSelectedId([...scene.landmarks].sort((a, b) => a.order - b.order)[0].id); setError('') })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'City data could not be loaded.') })
    return () => controller.abort()
  }, [attempt])

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const onExperienceReady = useCallback(() => dispatch('ready'), [])
  const onExperienceError = useCallback(() => dispatch('failed'), [])
  const returnToMap = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock()
    dispatch('return')
  }, [])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (phase === 'approach') timer = setTimeout(() => dispatch('load'), reducedMotion() ? 0 : 740)
    if (phase === 'revealing' || phase === 'map-revealing') timer = setTimeout(() => { dispatch('settled'); if (phase === 'map-revealing') requestAnimationFrame(() => exploreButton.current?.focus({ preventScroll: true })) }, reducedMotion() ? 0 : 420)
    if (phase === 'loading') timer = setTimeout(() => dispatch('failed'), 60000)
    if (phase === 'returning' || phase === 'returning-covered') {
      // The map has stayed mounted at its original viewport size throughout.
      timer = setTimeout(() => {
        if (savedPose.current) navigation.current?.restore(savedPose.current)
        dispatch('restored')
      }, reducedMotion() || phase === 'returning-covered' ? 0 : 240)
    }
    return () => clearTimeout(timer)
  }, [phase])
  useEffect(() => {
    if (phase === 'map') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [phase])
  const selectSite = (id: string) => {
    setSelectedId(id)
    if (canExploreSite(id)) {
      setViewAction(previous => ({ id: previous.id + 1, type: 'focus' }))
      requestAnimationFrame(() => selectedCard.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' }))
    }
  }
  const enterSite = () => {
    if (phase !== 'map' || !canExploreSite(selectedId) || !navigation.current) return
    savedPose.current = navigation.current.capture()
    if (!savedPose.current) return
    navigation.current.approach()
    dispatch('enter')
  }

  const action = (type: ViewAction['type']) => setViewAction(previous => ({ id: previous.id + 1, type }))
  const onReady = useCallback(() => setReady(true), [])
  const onFailure = useCallback(() => setRendererFailed(true), [])
  const retryRenderer = () => { setRendererFailed(false); setReady(false); setRenderAttempt(value => value + 1) }
  const sites = data ? [...data.landmarks].sort((a, b) => a.order - b.order) : []
  const selected = sites.find(site => site.id === selectedId) ?? sites[0]
  const selectedIndex = selected ? sites.indexOf(selected) : 0
  const selectedContent = selected ? landmarkContent[selected.id] : undefined
  const description = selectedContent?.description ?? (typeof selected?.description === 'string' ? selected.description : undefined)
  const experience = selected ? experienceForLandmark(selected.id) : undefined
  const estimated = data?.buildings.filter(building => /estimat|default|level/i.test(building.heightSource ?? '')).length ?? 0

  return <>
  <div className="app-shell" inert={phase !== 'map'} aria-hidden={phase === 'loading' || phase === 'revealing' || phase === 'exploring' || phase === 'error'}>
    <header className="masthead">
      <a className="brand" href="/" aria-label="Miniature Boston home"><svg width="26" height="28" viewBox="0 0 26 28" fill="none" aria-hidden><path d="M3 25V12h6V6h6v19M0 25h26M18 25V15h5v10M12 6V0" stroke="currentColor" strokeWidth="1.5"/><path d="M7 16h2M7 20h2M12 11h1M12 15h1M12 19h1M20 19h1" stroke="currentColor"/></svg><span>MINIATURE<span className="brand-light"> BOSTON</span></span></a>
      <div className="edition"><span className="live-dot" /> A CITY AT WALKING PACE</div>
      <a className="header-link" href="https://www.thefreedomtrail.org/" target="_blank" rel="noreferrer">About the trail <span aria-hidden>↗</span></a>
    </header>

    <main className="atlas-layout">
      <aside className="sidebar" aria-label="Freedom Trail guide">
        <div className="intro">
          <div className="eyebrow"><span className="red-rule" /> THE FREEDOM TRAIL</div>
          <h1>History, one<br />red line at a time.</h1>
          <p>A different perspective on Boston.<br /> Explore the city and the places that<br className="desktop-break" /> shaped a nation.</p>
          <div className="trail-stats"><div><strong>{sites.length || '16'}</strong><span>HISTORIC STOPS</span></div><div title="Mapped network includes branches and site spurs. The official visitor trail is 2.5 miles (about 4.0 km)."><strong>{data ? (data.route.lengthMeters / 1000).toFixed(1) : '—'}<small> km</small></strong><span>MAPPED NETWORK</span></div></div>
        </div>

        {selected && <section ref={selectedCard} className="selected-card" aria-label="Selected landmark" data-selected-site={selected.id}>
          <div className="card-top"><span className="eyebrow">YOUR NEXT DISCOVERY</span><span className="stop-count">{String(selected.order).padStart(2, '0')} / {sites.length}</span></div>
          <h2>{selected.name}</h2>
          <p className="site-type">{selected.type.replaceAll('_', ' ')}</p>
          {description && <p className="site-description">{description}</p>}
          {experience && <p className="experience-preview" data-experience-id={experience.id} title={`${experience.title} · ${experience.setting}. ${experience.premise}`}>{selected.id === 'old-state-house' ? 'Includes Boston, 1770 · The Evidence Hunt' : 'Experience coming soon'}</p>}
          {canExploreSite(selected.id) && <button ref={exploreButton} className="explore-site-button" onClick={enterSite} disabled={!ready || rendererFailed}>Explore Site <span aria-hidden>↗</span><small>Walk around the Old State House</small></button>}
          <div className="site-coordinates">{selected.lat.toFixed(4)}° N &nbsp; {Math.abs(selected.lon).toFixed(4)}° W</div>
          <div className="card-actions"><button className="focus-button" onClick={() => action('focus')}>Find on map <span aria-hidden>↗</span></button><div className="stop-pagination"><button aria-label="Previous landmark" disabled={selectedIndex === 0} onClick={() => selectSite(sites[selectedIndex - 1].id)}>←</button><button aria-label="Next landmark" disabled={selectedIndex === sites.length - 1} onClick={() => selectSite(sites[selectedIndex + 1].id)}>→</button></div></div>
          {(selectedContent || selected.sources.length > 0) && <div className="site-sources">{selectedContent && <a className="site-source" href={selectedContent.source.url} target="_blank" rel="noreferrer">History · {selectedContent.source.label} <span aria-hidden>↗</span></a>}{selected.sources.length > 0 && <a className="site-source" href={selected.sources[0].url} target="_blank" rel="noreferrer">View on OpenStreetMap <span aria-hidden>↗</span></a>}</div>}
        </section>}

        <section className="stops-section" aria-label="All historic stops"><div className="section-title"><span className="eyebrow">ALONG THE RED LINE</span><span>{sites.length || '16'} places</span></div>
          {sites.length > 0 ? <ol className="stop-list">{sites.map(site => <li key={site.id}><button className={selected?.id === site.id ? 'active' : ''} onClick={() => selectSite(site.id)} aria-pressed={selected?.id === site.id}><span className="list-number">{String(site.order).padStart(2, '0')}</span><span>{site.name}</span><span className="list-arrow" aria-hidden>↗</span></button></li>)}</ol> : <p className="list-loading">The city is coming into view…</p>}
        </section>
        <div className="sidebar-footer"><span className="footer-mark">M / B</span><span>Old stories. New perspectives.<br />Boston, Massachusetts.</span></div>
      </aside>

      <section className="map-panel" aria-label="Interactive Boston city atlas" aria-busy={!data && !error}>
        <div className="map-heading"><div className="eyebrow">BOSTON, MASSACHUSETTS</div><h2>A walk through history.</h2><span className="map-subtitle">A geographically grounded miniature city</span></div>
        {data && selected && !rendererFailed && <SceneBoundary key={renderAttempt} onRetry={retryRenderer}><CityScene data={data} selected={selected} onSelect={selectSite} navigation={navigation} interactive={phase === 'map'} viewAction={viewAction} buildings={buildings} onReady={onReady} onFailure={onFailure} /></SceneBoundary>}
        {rendererFailed && <div className="scene-message" role="alert"><span className="eyebrow">3D VIEW INTERRUPTED</span><h2>Let’s bring Boston back.</h2><p>The graphics connection was lost. Your selected stop is saved.</p><button className="primary-button" onClick={retryRenderer}>Reload 3D view ↗</button></div>}
        {!data && <div className="scene-message" role={error ? 'alert' : 'status'}><span className={`loading-orbit ${error ? 'has-error' : ''}`} aria-hidden>{error ? '!' : ''}</span><span className="eyebrow">{error ? 'CITY DATA UNAVAILABLE' : 'ASSEMBLING THE CITY'}</span><h2>{error ? 'The trail is still here.' : 'A little Boston. A lot of history.'}</h2><p>{error || 'Loading real streets, building footprints and the red line.'}</p>{error && <button className="primary-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again ↗</button>}</div>}

        <div className="map-top-tools"><span className="view-badge"><span className={ready && !rendererFailed ? 'live-dot' : 'pending-dot'} /> {ready && !rendererFailed ? 'LIVE 3D VIEW' : '3D CITY ATLAS'}</span><button className={`layer-button ${buildings ? 'enabled' : ''}`} onClick={() => setBuildings(value => !value)} aria-pressed={buildings} title="Toggle building layer"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m10 2 8 4-8 4-8-4 8-4Zm-8 9 8 4 8-4M2 15l8 4 8-4" stroke="currentColor" strokeWidth="1.4"/></svg> Buildings</button></div>

        <div className="map-controls" aria-label="Map controls"><button onClick={() => action('in')} aria-label="Zoom in">+</button><button onClick={() => action('out')} aria-label="Zoom out">−</button><span /><button className="reset-button" onClick={() => action('reset')} aria-label="Reset map view"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 7a6 6 0 1 1-.3 5M4 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>

        <div className="map-bottom"><div className="legend"><span><i className="legend-route" /> Freedom Trail</span><span><i className="legend-landmark" /> Historic site</span><span><i className="legend-park" /> Green space</span><span><i className="legend-water" /> Water</span></div><div className="interaction-hint">Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom</div></div>
        <div className="map-attribution"><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>{data?.backdrop && <> · <a href="https://www.usgs.gov/programs/national-geospatial-program" target="_blank" rel="noreferrer">Imagery: USGS / USDA NAIP</a></>}</div><span>Local meters · EPSG:26986</span></div>
      </section>
    </main>

    <footer className="data-footer"><span><span className="live-dot" /> REAL GEOGRAPHY. A NEW POINT OF VIEW.</span><details><summary>Map data & model notes</summary><div className="data-notes" data-testid="data-diagnostics"><strong>Geographic scene</strong><p>{data ? `${number.format(data.buildings.length)} building footprints · ${number.format(data.roads.length)} road features · ${data.route.segments.length} route segments · ${sites.length} historic sites` : 'Waiting for city data.'}</p><p>Footprints, streets, parks and water follow mapped coordinates. Building heights combine source tags and estimates{data && estimated > 0 ? ` (${number.format(estimated)} estimated or level-derived)` : ''}; this is an exploratory model, not a survey.</p><p>The displayed {data ? `${(data.route.lengthMeters / 1000).toFixed(1)} km` : 'distance'} is the mapped network, including branches and short site spurs. The <a href="https://www.thefreedomtrail.org/" target="_blank" rel="noreferrer">official visitor trail is 2.5 miles</a> (about 4.0 km).</p><p>Data sources and processing notes are included with the local scene dataset.</p></div></details></footer>
  </div>
  {data && ['loading','revealing','exploring','returning'].includes(phase) && <ExperienceBoundary key={experienceAttempt} onError={onExperienceError}><Suspense fallback={null}><OldStateHouseExperience data={data} onReady={onExperienceReady} onReturn={returnToMap} active={phase === 'exploring'} /></Suspense></ExperienceBoundary>}
  {phase !== 'map' && phase !== 'exploring' && <div className={`exploration-veil phase-${phase}`} role="status" aria-live="polite">
    {phase === 'loading' && <div className="exploration-loading"><span className="eyebrow">AT STREET LEVEL</span><h2>Old State House</h2><p>Bringing the city a little closer…</p><span className="loading-orbit" aria-hidden /><button onClick={returnToMap}>Return to Miniature Boston</button></div>}
    {phase === 'error' && <div className="exploration-loading" role="alert"><span className="eyebrow">A MOMENT ON THE TRAIL</span><h2>The site couldn’t load.</h2><p>Your place in Miniature Boston is saved.</p><button onClick={() => { setSiteComponent(() => createSiteComponent()); setExperienceAttempt(n => n + 1); dispatch('retry') }}>Try the site again ↗</button><button onClick={returnToMap}>Return to Miniature Boston</button></div>}
  </div>}
  </>
}

export default App
