import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface NakhonSawanTacticalMapProps {
  className?: string;
  opacity?: number;
  interactive?: boolean;
  dayNightMode?: 'DAY' | 'NIGHT';
  center?: [number, number];
  zoom?: number;
  onPositionChange?: (lat: number, lng: number) => void;
}

export function NakhonSawanTacticalMap({
  className = 'w-full h-full',
  opacity = 1.0,
  interactive = true,
  dayNightMode = 'NIGHT',
  center = [15.7000, 100.1333],
  zoom = 14,
  onPositionChange,
}: NakhonSawanTacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [simPos, setSimPos] = useState<[number, number]>(center);
  const [isSimulatingMove, setIsSimulatingMove] = useState<boolean>(false);

  // Keep simPos synced with center prop when prop changes
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number') {
      setSimPos(center);
    }
  }, [center[0], center[1]]);

  // Initialize Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const initialCenter = simPos && simPos[0] && simPos[1] ? simPos : [15.7000, 100.1333];
      const map = L.map(mapContainerRef.current, {
        center: initialCenter as [number, number],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
      });

      const tileUrl = dayNightMode === 'NIGHT'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      const subdomains = dayNightMode === 'NIGHT' ? [] : ['mt0', 'mt1', 'mt2', 'mt3'];

      const tileLayer = L.tileLayer(tileUrl, {
        subdomains,
        maxZoom: 20,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const layersGroup = L.layerGroup().addTo(map);

      // Real user location marker (Draggable or Clickable for simulation)
      const userIcon = L.divIcon({
        className: 'real-user-gps-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" title="ตำแหน่งปัจจุบัน (คลิกหรือลากเพื่อย้ายพิกัด)">
            <div class="absolute w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-500/30 animate-ping pointer-events-none"></div>
            <div class="w-5 h-5 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_15px_#06b6d4] flex items-center justify-center">
              <div class="w-2 h-2 rounded-full bg-white"></div>
            </div>
            <div class="absolute -top-7 px-1.5 py-0.5 bg-black/80 border border-cyan-500 text-[10px] text-cyan-300 rounded whitespace-nowrap font-mono shadow-md">
              GPS ตำแหน่งจริง
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker(initialCenter as [number, number], { 
        icon: userIcon,
        draggable: true 
      }).addTo(layersGroup);

      // Handle marker drag event to update position
      marker.on('dragend', (e) => {
        const latLng = e.target.getLatLng();
        setSimPos([latLng.lat, latLng.lng]);
        if (onPositionChange) {
          onPositionChange(latLng.lat, latLng.lng);
        }
      });

      // Handle map click to reposition marker / simulate movement
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setSimPos([lat, lng]);
        marker.setLatLng([lat, lng]);
        if (onPositionChange) {
          onPositionChange(lat, lng);
        }
      });

      markerRef.current = marker;
      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Update map center & marker instantly whenever simPos or zoom changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (simPos && typeof simPos[0] === 'number' && typeof simPos[1] === 'number') {
      mapRef.current.setView(simPos, zoom, { animate: true });
      if (markerRef.current) {
        markerRef.current.setLatLng(simPos);
      }
    }
  }, [simPos[0], simPos[1], zoom]);

  // Update tile layer URL when dayNightMode changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const tileUrl = dayNightMode === 'NIGHT'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    const subdomains = dayNightMode === 'NIGHT' ? [] : ['mt0', 'mt1', 'mt2', 'mt3'];
    tileLayerRef.current.setUrl(tileUrl);
  }, [dayNightMode]);

  // Quick Simulation movement handlers
  const handleMoveNorth = () => {
    const newLat = simPos[0] + 0.002;
    const newLng = simPos[1];
    setSimPos([newLat, newLng]);
    if (onPositionChange) onPositionChange(newLat, newLng);
  };

  const handleMoveSouth = () => {
    const newLat = simPos[0] - 0.002;
    const newLng = simPos[1];
    setSimPos([newLat, newLng]);
    if (onPositionChange) onPositionChange(newLat, newLng);
  };

  const handleMoveEast = () => {
    const newLat = simPos[0];
    const newLng = simPos[1] + 0.002;
    setSimPos([newLat, newLng]);
    if (onPositionChange) onPositionChange(newLat, newLng);
  };

  const handleMoveWest = () => {
    const newLat = simPos[0];
    const newLng = simPos[1] - 0.002;
    setSimPos([newLat, newLng]);
    if (onPositionChange) onPositionChange(newLat, newLng);
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ opacity }}>
      <div ref={mapContainerRef} className="w-full h-full" />


    </div>
  );
}
