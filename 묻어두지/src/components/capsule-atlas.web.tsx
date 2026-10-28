import type React from 'react';
import type * as MapLibre from 'maplibre-gl';
import { version as mapVersion } from 'maplibre-gl/package.json';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Capsule } from '@/components/capsule';
import type { CapsuleAtlasProps } from '@/components/capsule-atlas.types';
import { capsuleCountdown } from '@/lib/capsule-countdown';
import { accuracyFootprint, mapOrientation } from '@/lib/map-presentation';
import { townStyle } from '@/lib/map-style.web';
import type { CapsuleSummary } from '@/shared/contracts';

import 'maplibre-gl/dist/maplibre-gl.css';
import './capsule-atlas.css';
import { Colors, THEME } from '@/constants/theme';

function FloatingCapsule({ capsule, now, element }: { capsule: CapsuleSummary; now: number; element: HTMLElement }) {
  const countdown = capsuleCountdown(capsule, now);
  const timerId = useId();
  useEffect(() => { element.parentElement?.setAttribute('aria-describedby', timerId); }, [element, timerId]);
  return (
    <div className="dooji-floating-capsule" data-state={countdown.state} data-capsule-id={capsule.id}>
      <div className="dooji-capsule-float">
        <div className="dooji-capsule-clock" id={timerId}>
          <span className="dooji-capsule-clock-title">{capsule.title}</span>
          <span className="dooji-capsule-countdown" role="timer" aria-live="off">{countdown.text}</span>
        </div>
        <div className="dooji-capsule-figure" aria-hidden="true"><Capsule state={countdown.state === "opened" ? "open" : "closed"} size={78} /></div>
      </div>
      <div className="dooji-capsule-ground" aria-hidden="true"><div className="dooji-capsule-shadow" /><div className="dooji-capsule-point" /></div>
    </div>
  );
}


/** 시안 팔레트를 CSS 변수로 넘긴다(capsule-atlas.css 가 var(--dooji-*) 로 읽는다). */
const ATLAS_VARS = {
  '--dooji-ink': Colors.ink,
  '--dooji-ink-20': `${Colors.ink}33`,
  '--dooji-ink-13': `${Colors.ink}22`,
  '--dooji-ink-25': `${Colors.ink}40`,
  '--dooji-white': Colors.white,
  '--dooji-white-75': `${Colors.white}bf`,
  '--dooji-white-94': `${Colors.white}ef`,
  '--dooji-muted': Colors.muted,
  '--dooji-yellow': Colors.yellow,
  '--dooji-yellow-40': `${Colors.yellow}66`,
  '--dooji-cyan-ink': Colors.cyanInk,
  '--dooji-mint': Colors.mint,
  '--dooji-water': THEME === 'analog90' ? '#BFD6D2' : '#CFEFF8',
  '--dooji-haze-a': `${Colors.cream}cc`,
  '--dooji-haze-b': `${Colors.cream}38`,
} as React.CSSProperties;

export function CapsuleAtlas({ capsules, fix, center, recenterKey, bottomInset, active, now, perspective, onSelect, pin, onPick }: CapsuleAtlasProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre.Map | null>(null);
  const library = useRef<typeof MapLibre | null>(null);
  const pinMarker = useRef<MapLibre.Marker | null>(null);
  const [markerRoots, setMarkerRoots] = useState<{ capsule: CapsuleSummary; element: HTMLDivElement }[]>([]);
  const select = useRef(onSelect);
  const pick = useRef(onPick);
  useEffect(() => { select.current = onSelect; pick.current = onPick; });
  const initial = useRef({ center, perspective, zoom: capsules.length || pin ? 16.4 : 15.7 });
  const zoom = capsules.length || pin ? 16.4 : 15.7;
  const [restart, setRestart] = useState(0);
  // Keyed by restart: a stale "ready" from a removed map never leaks into the next one.
  const [state, setState] = useState<{ restart: number; ready: boolean; failed: 'tiles' | 'graphics' | null }>({ restart: 0, ready: false, failed: null });
  const ready = state.restart === restart && state.ready;
  const failed = state.restart === restart ? state.failed : null;
  const setReady = (value: boolean) => setState((previous) => ({ ...previous, restart, ready: value }));
  const setFailed = (value: 'tiles' | 'graphics' | null) => setState((previous) => ({ ...previous, restart, failed: value }));
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    // Expo serves these version-matched ESM assets from public/. Keep import.meta
    // and the module worker outside Metro's CommonJS transformation.
    const moduleUrl = `/maplibre/${mapVersion}/maplibre-gl.mjs`;
    void (import(/* @metro-ignore */ moduleUrl) as Promise<typeof MapLibre>).then((M) => {
      if (disposed || !host.current) return;
      library.current = M;
      M.setWorkerUrl(`/maplibre/${mapVersion}/maplibre-gl-worker.mjs`);
      const view = new M.Map({
        container: host.current, attributionControl: false,
        center: [initial.current.center.longitude, initial.current.center.latitude], zoom: initial.current.zoom,
        ...mapOrientation(initial.current.perspective), minZoom: 3, maxZoom: 19, maxPitch: 60,
        dragRotate: false, touchPitch: false, pitchWithRotate: false,
        renderWorldCopies: false, maxTileCacheZoomLevels: 3,
        canvasContextAttributes: { antialias: true },
        style: townStyle(),
      });
      map.current = view;
      const reportCamera = () => {
        if (!host.current) return;
        host.current.dataset.pitch = String(view.getPitch());
        host.current.dataset.bearing = String(view.getBearing());
        host.current.dataset.zoom = String(view.getZoom());
      };
      reportCamera(); view.on('moveend', reportCamera);
      view.getCanvas().setAttribute('aria-label', '구덩이 지도. 방향키로 이동하고 더하기·빼기로 확대할 수 있어요.');
      view.touchZoomRotate.disableRotation();
      view.keyboard.disableRotation();
      view.on('error', () => { if (!disposed) setFailed('tiles'); });
      view.on('webglcontextlost', () => { if (!disposed) setFailed('graphics'); });
      view.on('webglcontextrestored', () => { if (!disposed) setFailed(null); });
      view.on('idle', () => { if (host.current) host.current.dataset.tilesReady = String(view.areTilesLoaded()); });
      view.on('click', (event) => { pick.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }); });
      view.on('style.load', () => {
        if (disposed) return;
        view.addSource('location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        view.addLayer({ id: 'location-accuracy', type: 'fill', source: 'location', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2FD3B0', 'fill-opacity': 0.18, 'fill-outline-color': '#111111' } });
        view.addLayer({ id: 'location-point', type: 'circle', source: 'location', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#2FD3B0', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3, 'circle-pitch-alignment': 'viewport', 'circle-pitch-scale': 'viewport' } });
        view.addSource('pin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        view.addLayer({ id: 'pin-radius', type: 'fill', source: 'pin', paint: { 'fill-color': '#FFE07A', 'fill-opacity': 0.3, 'fill-outline-color': '#111111' } });
        setReady(true);
      });
      observer = new ResizeObserver(() => view.resize());
      observer.observe(host.current);
    }).catch(() => { if (!disposed) setFailed('graphics'); });
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
    // The map is created once per restart; everything else updates through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restart]);
  useEffect(() => {
    if (ready) map.current?.jumpTo({ center: [center.longitude, center.latitude], zoom });
  }, [ready, center.latitude, center.longitude, recenterKey, zoom]);
  useEffect(() => {
    if (ready) map.current?.jumpTo(mapOrientation(perspective));
  }, [ready, perspective]);
  useEffect(() => {
    const M = library.current;
    const view = map.current;
    if (!ready || !M || !view) return;
    const roots: typeof markerRoots = [];
    const markers: MapLibre.Marker[] = [];
    for (const capsule of capsules) {
      const pinElement = document.createElement('div');
      pinElement.className = 'dooji-map-pin'; pinElement.tabIndex = 0; pinElement.setAttribute('role', 'button');
      pinElement.setAttribute('aria-label', `${capsule.title}, 지도에서 캡슐 보기`);
      const element = document.createElement('div');
      pinElement.appendChild(element);
      pinElement.addEventListener('click', (event) => { if (pick.current) return; event.stopPropagation(); select.current(capsule); });
      pinElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select.current(capsule); }
      });
      // Billboard art stays upright; the projection anchors its ground ring to the coordinate.
      const marker = new M.Marker({ element: pinElement, anchor: 'bottom', offset: [0, 11], pitchAlignment: 'viewport', rotationAlignment: 'viewport', subpixelPositioning: true })
        .setLngLat([capsule.longitude, capsule.latitude]).addTo(view);
      markers.push(marker);
      roots.push({ capsule, element });
    }
    setMarkerRoots(roots);
    return () => { for (const marker of markers) marker.remove(); };
    // Clock ticks update only React portals, not map objects or the camera.
  }, [ready, capsules]);
  useEffect(() => {
    if (!ready) return;
    map.current?.getSource<MapLibre.GeoJSONSource>('location')?.setData({ type: 'FeatureCollection', features: fix ? [accuracyFootprint(fix), { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [fix.longitude, fix.latitude] } }] : [] });
  }, [ready, fix]);
  useEffect(() => {
    const M = library.current;
    const view = map.current;
    if (!ready || !M || !view) return;
    pinMarker.current?.remove(); pinMarker.current = null;
    view.getSource<MapLibre.GeoJSONSource>('pin')?.setData({ type: 'FeatureCollection', features: pin ? [accuracyFootprint({ ...pin, accuracy: 150, timestamp: 0 })] : [] });
    if (!pin) return;
    const element = document.createElement('div');
    element.className = 'dooji-pick-pin';
    element.innerHTML = '<div class="dooji-pick-pin-head">여기</div><div class="dooji-pick-pin-leg"></div>';
    pinMarker.current = new M.Marker({ element, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([pin.longitude, pin.latitude]).addTo(view);
  }, [ready, pin]);
  useEffect(() => {
    const view = map.current;
    if (!view) return;
    for (const handler of [view.dragPan, view.scrollZoom, view.doubleClickZoom, view.touchZoomRotate, view.keyboard, view.boxZoom]) {
      if (active) handler.enable(); else handler.disable();
    }
    view.touchZoomRotate.disableRotation(); view.keyboard.disableRotation();
  }, [active, ready]);
  return (
    <div className="dooji-atlas" aria-label="구덩이 지도" inert={!active} data-paused={!active || hidden} data-perspective={perspective} data-picking={!!onPick} style={ATLAS_VARS}>
      <div ref={host} className="dooji-map-surface" data-ready={ready} />
      <div className="dooji-map-distance-haze" aria-hidden="true" />
      {markerRoots.map(({ capsule, element }) => createPortal(<FloatingCapsule capsule={capsule} now={now} element={element} />, element, capsule.id))}
      {!ready && !failed && <div className="dooji-map-message">동네를 펼치고 있어요…</div>}
      {failed && (
        <div className="dooji-map-message" role="status">
          {failed === 'graphics' ? '이 환경에서 입체 지도를 표시하지 못했어요.' : '지도 연결을 확인해 주세요.'} 아래 목록은 계속 사용할 수 있어요.
          <button onClick={() => setRestart((value) => value + 1)}>지도 다시 불러오기</button>
        </div>
      )}
      <div className="dooji-map-credits" style={{ bottom: bottomInset + 7 }}>
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </div>
    </div>
  );
}
