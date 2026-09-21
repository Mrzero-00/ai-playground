import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as MapLibre from 'maplibre-gl';
import { version as mapVersion } from 'maplibre-gl/package.json';
import type { CapsuleAtlasProps } from './CapsuleAtlas.types';
import type { CapsuleSummary } from '../shared/contracts';
import { capsuleCountdown } from '../lib/capsuleCountdown';
import { accuracyFootprint, mapOrientation } from '../lib/mapPresentation';
import CapsuleArt from './CapsuleArt';
import 'maplibre-gl/dist/maplibre-gl.css';
import './capsule-atlas.css';

function FloatingCapsule({ capsule, now, element }: { capsule: CapsuleSummary; now: number; element: HTMLElement }) {
  const countdown = capsuleCountdown(capsule, now);
  const timerId = useId();
  useEffect(() => {
    element.parentElement?.setAttribute('aria-describedby', timerId);
  }, [element, timerId]);
  return <div className="dooji-floating-capsule" data-state={countdown.state} data-capsule-id={capsule.id}>
    <div className="dooji-capsule-float">
      <div className="dooji-capsule-clock" id={timerId}>
        <span className="dooji-capsule-clock-title">{capsule.title}</span>
        <span className="dooji-capsule-countdown" role="timer" aria-live="off">{countdown.text}</span>
      </div>
      <div className="dooji-capsule-figure" aria-hidden="true"><CapsuleArt size={68} small compact/></div>
    </div>
    <div className="dooji-capsule-ground" aria-hidden="true"><div className="dooji-capsule-shadow"/><div className="dooji-capsule-point"/></div>
  </div>;
}

export default function CapsuleAtlas({ capsules, fix, center, recenterKey, bottomInset, active, now, perspective, onSelect }: CapsuleAtlasProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre.Map | null>(null);
  const library = useRef<typeof MapLibre | null>(null);
  const [markerRoots, setMarkerRoots] = useState<{ capsule: CapsuleSummary; element: HTMLDivElement }[]>([]);
  const callback = useRef(onSelect); callback.current = onSelect;
  const initialCenter = useRef(center);
  const zoom = capsules.length ? 16.4 : 15.7;
  const initialZoom = useRef(zoom);
  const initialPerspective = useRef(perspective);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<'tiles' | 'graphics' | null>(null);
  const [restart, setRestart] = useState(0);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setReady(false); setFailed(null);
    // Expo serves these version-matched ESM assets from public/. Keep import.meta
    // and the module worker outside Metro's CommonJS transformation.
    const moduleUrl = `/maplibre/${mapVersion}/maplibre-gl.mjs`;
    void (import(/* @metro-ignore */ moduleUrl) as Promise<typeof MapLibre>).then(M => {
      if (disposed || !host.current) return;
      library.current = M;
      M.setWorkerUrl(`/maplibre/${mapVersion}/maplibre-gl-worker.mjs`);
      const view = new M.Map({
        container: host.current, attributionControl: false,
        center: [initialCenter.current.longitude, initialCenter.current.latitude], zoom: initialZoom.current,
        ...mapOrientation(initialPerspective.current), minZoom: 3, maxZoom: 19, maxPitch: 60,
        dragRotate: false, touchPitch: false, pitchWithRotate: false,
        renderWorldCopies: false, maxTileCacheZoomLevels: 3,
        canvasContextAttributes: { antialias: true },
        style: {
          version: 8,
          sources: { ground: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 } },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#E4EDDF' } },
            { id: 'ground', type: 'raster', source: 'ground', paint: { 'raster-saturation': -.45, 'raster-contrast': -.08, 'raster-fade-duration': 0 } },
          ],
        },
      });
      map.current = view;
      const reportCamera = () => {
        if (!host.current) return;
        host.current.dataset.pitch = String(view.getPitch());
        host.current.dataset.bearing = String(view.getBearing());
        host.current.dataset.zoom = String(view.getZoom());
      };
      reportCamera(); view.on('moveend', reportCamera);
      view.getCanvas().setAttribute('aria-label', '내 캡슐 주변 지도. 방향키로 이동하고 더하기·빼기로 확대할 수 있어요.');
      view.touchZoomRotate.disableRotation();
      view.keyboard.disableRotation();
      view.on('error', () => { if (!disposed) setFailed('tiles'); });
      view.on('webglcontextlost', () => { if (!disposed) setFailed('graphics'); });
      view.on('webglcontextrestored', () => { if (!disposed) setFailed(null); });
      view.on('idle', () => { if (host.current) host.current.dataset.tilesReady = String(view.areTilesLoaded()); });
      view.on('style.load', () => {
        if (disposed) return;
        view.addSource('location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        view.addLayer({ id: 'location-accuracy', type: 'fill', source: 'location', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#316C85', 'fill-opacity': .12, 'fill-outline-color': '#316C85' } });
        view.addLayer({ id: 'location-point', type: 'circle', source: 'location', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#316C85', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3, 'circle-pitch-alignment': 'viewport', 'circle-pitch-scale': 'viewport' } });
        setReady(true);
      });
      observer = new ResizeObserver(() => view.resize());
      observer.observe(host.current);
    }).catch(() => { if (!disposed) setFailed('graphics'); });
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
  }, [restart]);
  useEffect(() => {
    if (ready) map.current?.jumpTo({ center: [center.longitude, center.latitude], zoom });
  }, [ready, center.latitude, center.longitude, recenterKey, zoom]);
  useEffect(() => {
    if (ready) map.current?.jumpTo(mapOrientation(perspective));
  }, [ready, perspective]);
  useEffect(() => {
    const M = library.current, view = map.current;
    if (!ready || !M || !view) return;
    const roots: typeof markerRoots = [];
    const markers: MapLibre.Marker[] = [];
    for (const capsule of capsules) {
      const pin = document.createElement('div');
      pin.className = 'dooji-map-pin'; pin.tabIndex = 0; pin.setAttribute('role', 'button');
      pin.setAttribute('aria-label', `${capsule.title}, 지도에서 캡슐 보기`);
      const element = document.createElement('div');
      pin.appendChild(element);
      pin.addEventListener('click', event => { event.stopPropagation(); callback.current(capsule); });
      pin.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); callback.current(capsule); }
      });
      // Billboard art stays upright; the projection anchors its ground ring to GPS.
      const marker = new M.Marker({ element: pin, anchor: 'bottom', offset: [0, 11], pitchAlignment: 'viewport', rotationAlignment: 'viewport', subpixelPositioning: true })
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
    const view = map.current;
    if (!view) return;
    for (const handler of [view.dragPan, view.scrollZoom, view.doubleClickZoom, view.touchZoomRotate, view.keyboard, view.boxZoom]) {
      if (active) handler.enable(); else handler.disable();
    }
    view.touchZoomRotate.disableRotation(); view.keyboard.disableRotation();
  }, [active, ready]);
  return <div className="dooji-atlas" aria-label="내 캡슐 지도" inert={!active} data-paused={!active || hidden} data-perspective={perspective}>
    <div ref={host} className="dooji-map-surface" data-ready={ready}/>
    <div className="dooji-map-distance-haze" aria-hidden="true"/>
    {markerRoots.map(({ capsule, element }) => createPortal(<FloatingCapsule capsule={capsule} now={now} element={element}/>, element, capsule.id))}
    {!ready && !failed && <div className="dooji-map-message">동네를 펼치고 있어요…</div>}
    {failed && <div className="dooji-map-message" role="status">{failed === 'graphics' ? '이 환경에서 입체 지도를 표시하지 못했어요.' : '지도 연결을 확인해 주세요.'} 아래 캡슐 목록은 계속 사용할 수 있어요.
      <button onClick={() => setRestart(value => value + 1)}>지도 다시 불러오기</button>
    </div>}
    <div className="dooji-map-credits" style={{ bottom: bottomInset + 7 }}>
      © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
    </div>
  </div>;
}
