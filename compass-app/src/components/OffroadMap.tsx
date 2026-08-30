import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Plus,
  Minus,
  RotateCcw,
  Compass,
  Layers,
  Target,
  Flame,
  Shield,
  Send,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Share2,
  Trash2,
  Eye,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  Waypoint,
  GPSPosition,
  DeviceOrientationData,
  TrackPoint,
  TacticalTarget,
  CoordinateFormat,
} from '../types';
import {
  calculateBearing,
  calculateDistance,
  formatDistance,
  formatMGRS,
  degreesToMils,
  latLngToUTM,
  formatDMS,
  formatDD,
} from '../utils/geo';
import { playTacticalClick, playWaypointMarkedChime } from '../utils/audio';
import { NakhonSawanTacticalMap } from './NakhonSawanTacticalMap';

interface OffroadMapProps {
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  waypoints: Waypoint[];
  activeWaypoint: Waypoint | null;
  trackPoints: TrackPoint[];
  onSelectWaypoint: (wp: Waypoint) => void;
  onMapClickAddWaypoint: (lat: number, lng: number) => void;
  onOpenOfflineMaps?: () => void;
  soundEnabled: boolean;
}

// Battery Center coordinates (ศก.ร้อย: นครสวรรค์)
const DEFAULT_BATTERY_CENTER = {
  lat: 15.6980,
  lng: 100.1200,
  name: 'ศก.ร้อย (Battery Center)',
  easting: 830000,
  northing: 205000,
};

// Initial preset tactical targets (พิกัดเป้าหมายข้าศึก)
const INITIAL_TARGETS: TacticalTarget[] = [
  {
    id: 'กข-101',
    name: 'ฐานที่มั่นข้าศึก (Nong Pling Ridge)',
    lat: 15.6820,
    lng: 100.1550,
    easting: 833750,
    northing: 203200,
    rangeM: 4120,
    azimuthMils: 2040,
    targetType: 'ที่มั่นทหารราบ / ป้อมค่าย',
    status: 'APPROVED',
    timestamp: Date.now() - 600000,
  },
  {
    id: 'กข-102',
    name: 'คลังส่งกำลังข้าศึก (Bueng Boraphet Bay)',
    lat: 15.7150,
    lng: 100.1700,
    easting: 835360,
    northing: 206890,
    rangeM: 5640,
    azimuthMils: 1180,
    targetType: 'ยานยนต์ส่งกำลังบำรุง',
    status: 'PENDING',
    timestamp: Date.now() - 300000,
  },
  {
    id: 'กข-103',
    name: 'จุดสกัดยานเกราะ (West Bank Crossroad)',
    lat: 15.6750,
    lng: 100.0850,
    easting: 826250,
    northing: 202450,
    rangeM: 4510,
    azimuthMils: 4280,
    targetType: 'ขบวนรถเกราะลาดตระเวน',
    status: 'PENDING',
    timestamp: Date.now() - 120000,
  },
];

export function OffroadMap({
  currentPosition,
  orientation,
  waypoints,
  activeWaypoint,
  trackPoints,
  onSelectWaypoint,
  onMapClickAddWaypoint,
  onOpenOfflineMaps,
  soundEnabled,
}: OffroadMapProps) {
  // Map Engine: Interactive Leaflet vs Dual-Layer Lithos Terrain
  const [mapEngine, setMapEngine] = useState<'LEAFLET_GIS' | 'LITHOS_GEOLOGY'>('LEAFLET_GIS');
  const [tileLayerType, setTileLayerType] = useState<'DARK_MATTER' | 'SATELLITE' | 'OSM_NIGHT'>('DARK_MATTER');

  // Tactical Artillery State
  const [targets, setTargets] = useState<TacticalTarget[]>(() => {
    const saved = localStorage.getItem('tactical_targets_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_TARGETS;
      }
    }
    return INITIAL_TARGETS;
  });

  const [activeTargetId, setActiveTargetId] = useState<string>(INITIAL_TARGETS[0].id);
  const [simulatingFireTargetId, setSimulatingFireTargetId] = useState<string | null>(null);
  const [splashCountdown, setSplashCountdown] = useState<number>(0);
  const [impactHappened, setImpactHappened] = useState<boolean>(false);

  // Google Sheets Target Sync State
  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('tactical_gas_url') || '';
  });
  const [isSyncingGas, setIsSyncingGas] = useState<boolean>(false);
  const [gasSyncStatus, setGasSyncStatus] = useState<string | null>(null);
  const [showGasModal, setShowGasModal] = useState<boolean>(false);

  // UI Panels & HUD
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [coordFormat, setCoordFormat] = useState<CoordinateFormat>('MGRS');
  const [showIcmSafetyZone, setShowIcmSafetyZone] = useState<boolean>(true);
  const [showTrajectoryLines, setShowTrajectoryLines] = useState<boolean>(true);

  // Leaflet Container & Instance References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Save targets to local storage
  useEffect(() => {
    localStorage.setItem('tactical_targets_v1', JSON.stringify(targets));
  }, [targets]);

  const activeTarget = useMemo(() => {
    return targets.find((t) => t.id === activeTargetId) || targets[0] || null;
  }, [targets, activeTargetId]);

  // Telemetry from Battery Center to Active Target
  const targetTelemetry = useMemo(() => {
    if (!activeTarget) return null;
    const distance = calculateDistance(
      DEFAULT_BATTERY_CENTER.lat,
      DEFAULT_BATTERY_CENTER.lng,
      activeTarget.lat,
      activeTarget.lng
    );
    const bearingDeg = calculateBearing(
      DEFAULT_BATTERY_CENTER.lat,
      DEFAULT_BATTERY_CENTER.lng,
      activeTarget.lat,
      activeTarget.lng
    );
    const azimuthMils = degreesToMils(bearingDeg);
    const utm = latLngToUTM(activeTarget.lat, activeTarget.lng);

    return {
      distance,
      bearingDeg,
      azimuthMils,
      utm,
    };
  }, [activeTarget]);

  // =========================================================================
  // LEAFLET INITIALIZATION & TILE MANAGEMENT
  // =========================================================================
  useEffect(() => {
    if (mapEngine !== 'LEAFLET_GIS' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentPosition.lat, currentPosition.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Layer group for dynamic tactical markers and lines
      const layersGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      leafletMapRef.current = map;

      // Click on map to acquire new Target coordinate
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const bearing = calculateBearing(DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng, lat, lng);
        const distance = calculateDistance(DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng, lat, lng);
        const utm = latLngToUTM(lat, lng);

        const newTargetId = `กข-${101 + targets.length}`;
        const newTarget: TacticalTarget = {
          id: newTargetId,
          name: `เป้าหมายพล็อต #${targets.length + 1}`,
          lat,
          lng,
          easting: utm.easting,
          northing: utm.northing,
          rangeM: Math.round(distance),
          azimuthMils: degreesToMils(bearing),
          targetType: 'ตรวจพบพิกัดจุดตรวจการณ์',
          status: 'PENDING',
          timestamp: Date.now(),
        };

        setTargets((prev) => [newTarget, ...prev]);
        setActiveTargetId(newTarget.id);
        playWaypointMarkedChime(soundEnabled);
      });
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [mapEngine]);

  // Switch Tile Provider
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    let tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    let subdomains = '';
    let maxZoom = 19;
    let className = 'tactical-dark-tiles';

    if (tileLayerType === 'SATELLITE') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = '';
      maxZoom = 18;
      className = '';
    } else if (tileLayerType === 'OSM_NIGHT') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      maxZoom = 19;
      className = 'tactical-night-tiles';
    }

    const newTileLayer = L.tileLayer(tileUrl, {
      subdomains,
      maxZoom,
      className,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [tileLayerType, mapEngine]);

  // =========================================================================
  // RENDER TACTICAL OVERLAYS (Friendly Battery, Targets, Safety Zone, Lines)
  // =========================================================================
  const updateTacticalLayers = useCallback(() => {
    const map = leafletMapRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Friendly Battery Center (ศก.ร้อย) Marker & Pulse Ring
    const batteryIcon = L.divIcon({
      className: 'battery-center-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full border border-[#3be099] bg-[#3be099]/20 tactical-pulse-ring pointer-events-none"></div>
          <div class="w-7 h-7 rounded-full bg-[#0a1f12] border-2 border-[#3be099] shadow-[0_0_15px_#3be099] flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-[#3be099]"></div>
          </div>
          <div class="absolute -bottom-6 whitespace-nowrap px-2 py-0.5 rounded bg-[#061409]/90 border border-[#3be099]/60 text-[10px] font-bold text-[#3be099] shadow-lg">
            ศก.ร้อย (BC)
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const batteryMarker = L.marker([DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng], {
      icon: batteryIcon,
    }).bindPopup(`
      <div class="p-1 font-mono text-xs">
        <div class="font-bold text-[#3be099] text-sm mb-1">ศก.ร้อย (Battery Center)</div>
        <div class="text-gray-300">พิกัด ตอ.: ${DEFAULT_BATTERY_CENTER.easting}</div>
        <div class="text-gray-300">พิกัด ตน.: ${DEFAULT_BATTERY_CENTER.northing}</div>
        <div class="text-amber-400 mt-1 text-[10px]">ICM Safety Zone: รัศมี 600m ปลอดภัย</div>
      </div>
    `);
    group.addLayer(batteryMarker);

    // 2. ICM Safety Zone (600m radius around friendly battery)
    if (showIcmSafetyZone) {
      const safetyCircle = L.circle([DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng], {
        radius: 600,
        color: '#8A852B',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#CEDE62',
        fillOpacity: 0.08,
      }).bindTooltip('ICM Safety Zone (600m)', { permanent: false, direction: 'top' });
      group.addLayer(safetyCircle);
    }

    // 3. User Observer GPS Position Marker
    const userIcon = L.divIcon({
      className: 'user-observer-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-5 h-5 rounded-full bg-[#1e40af] border-2 border-[#60a5fa] shadow-[0_0_10px_#60a5fa] flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#09182b]/90 border border-[#60a5fa]/50 text-[9px] font-bold text-[#93c5fd]">
            ผตน. (FO)
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const userMarker = L.marker([currentPosition.lat, currentPosition.lng], {
      icon: userIcon,
    }).bindPopup(`
      <div class="p-1 font-mono text-xs">
        <div class="font-bold text-[#60a5fa] mb-1">ผู้ตรวจการณ์หน้า (Forward Observer)</div>
        <div class="text-gray-300">Lat/Lng: ${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}</div>
        <div class="text-gray-300">Alt: ${Math.round(currentPosition.altitude || 0)}m</div>
      </div>
    `);
    group.addLayer(userMarker);

    // 4. Hostile Target Markers & Trajectory Curves
    targets.forEach((tgt) => {
      const isSelected = tgt.id === activeTargetId;
      const isSimulating = tgt.id === simulatingFireTargetId;

      const targetIcon = L.divIcon({
        className: 'tactical-target-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            ${
              isSimulating
                ? `<div class="absolute w-20 h-20 rounded-full border-4 border-[#ff3b30] bg-[#ff3b30]/40 animate-ping"></div>`
                : isSelected
                ? `<div class="absolute w-12 h-12 rounded-full border border-[#ff3b30] bg-[#ff3b30]/20 tactical-pulse-ring"></div>`
                : ''
            }
            <div class="w-7 h-7 rounded bg-[#2b0808] border-2 ${
              isSelected ? 'border-[#ff3b30] shadow-[0_0_18px_#ff3b30]' : 'border-[#ef4444]/70'
            } flex items-center justify-center transform rotate-45">
              <div class="w-2.5 h-2.5 bg-[#ff3b30] transform -rotate-45"></div>
            </div>
            <div class="absolute -bottom-6 whitespace-nowrap px-2 py-0.5 rounded bg-[#180808]/95 border ${
              isSelected ? 'border-[#ff3b30] text-[#fca5a5]' : 'border-[#ef4444]/50 text-[#f87171]'
            } text-[10px] font-bold shadow-lg">
              ${tgt.id} (${tgt.rangeM}m)
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([tgt.lat, tgt.lng], { icon: targetIcon });
      marker.on('click', () => {
        setActiveTargetId(tgt.id);
        playTacticalClick(soundEnabled);
      });

      marker.bindPopup(`
        <div class="p-1 font-mono text-xs">
          <div class="font-bold text-[#ff3b30] text-sm mb-1">${tgt.id}: ${tgt.name}</div>
          <div class="text-gray-300">ชนิด: ${tgt.targetType}</div>
          <div class="text-gray-300">ระยะยิง: <span class="text-[#fef08a] font-bold">${tgt.rangeM} เมตร</span></div>
          <div class="text-gray-300">มุมทิศ: <span class="text-[#3be099] font-bold">${tgt.azimuthMils} มิลเลียม</span></div>
          <div class="text-gray-400 mt-1">สถานะ: <span class="font-bold text-amber-400">${tgt.status}</span></div>
        </div>
      `);
      group.addLayer(marker);

      // Trajectory Curved / Parabolic Line from Battery Center to Target
      if (showTrajectoryLines) {
        // Calculate an intermediate control point for curved ballistic trajectory appearance
        const midLat = (DEFAULT_BATTERY_CENTER.lat + tgt.lat) / 2 + (tgt.lng - DEFAULT_BATTERY_CENTER.lng) * 0.15;
        const midLng = (DEFAULT_BATTERY_CENTER.lng + tgt.lng) / 2 - (tgt.lat - DEFAULT_BATTERY_CENTER.lat) * 0.15;

        const trajectoryLine = L.polyline(
          [
            [DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng],
            [midLat, midLng],
            [tgt.lat, tgt.lng],
          ],
          {
            color: isSelected ? '#f59e0b' : '#d97706',
            weight: isSelected ? 3.5 : 2,
            opacity: isSelected ? 0.95 : 0.6,
            className: isSelected ? 'tactical-trajectory-line' : '',
            dashArray: isSelected ? '8, 8' : '4, 6',
          }
        );
        group.addLayer(trajectoryLine);
      }
    });
  }, [
    targets,
    activeTargetId,
    simulatingFireTargetId,
    showIcmSafetyZone,
    showTrajectoryLines,
    currentPosition,
    soundEnabled,
  ]);

  useEffect(() => {
    updateTacticalLayers();
  }, [updateTacticalLayers]);

  // =========================================================================
  // FIRE MISSION SIMULATION
  // =========================================================================
  const handleExecuteFireMission = (targetId: string) => {
    const tgt = targets.find((t) => t.id === targetId);
    if (!tgt) return;

    setSimulatingFireTargetId(targetId);
    setSplashCountdown(4);
    setImpactHappened(false);
    playTacticalClick(soundEnabled);

    // Countdown loop (4 seconds ToF)
    const timer = setInterval(() => {
      setSplashCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setImpactHappened(true);
          playWaypointMarkedChime(soundEnabled);

          // Update target status to FIRED
          setTargets((prevTargets) =>
            prevTargets.map((t) => (t.id === targetId ? { ...t, status: 'FIRED' } : t))
          );

          // Reset simulation animation after 3 seconds
          setTimeout(() => {
            setSimulatingFireTargetId(null);
            setImpactHappened(false);
          }, 3000);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // =========================================================================
  // GOOGLE SHEETS / GAS SYNC BRIDGE
  // =========================================================================
  const handleSyncTargetToGoogleSheets = async (targetToSync: TacticalTarget) => {
    if (!gasUrl.trim()) {
      setShowGasModal(true);
      return;
    }

    setIsSyncingGas(true);
    setGasSyncStatus('กำลังส่งพิกัดไปยัง Google Sheets...');

    try {
      const payload = {
        targetId: targetToSync.id,
        timestamp: new Date().toISOString(),
        easting: targetToSync.easting,
        northing: targetToSync.northing,
        lat: targetToSync.lat,
        lng: targetToSync.lng,
        range_m: targetToSync.rangeM,
        azimuth_mils: targetToSync.azimuthMils,
        targetType: targetToSync.targetType,
      };

      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setGasSyncStatus(`ส่งเป้าหมาย ${targetToSync.id} เข้า Google Sheets สำเร็จ!`);
      playWaypointMarkedChime(soundEnabled);
    } catch (err: unknown) {
      console.error('GAS Sync Error:', err);
      setGasSyncStatus('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Apps Script');
    } finally {
      setIsSyncingGas(false);
      setTimeout(() => setGasSyncStatus(null), 4000);
    }
  };

  const handleSaveGasUrl = (url: string) => {
    setGasUrl(url);
    localStorage.setItem('tactical_gas_url', url);
    setShowGasModal(false);
    playTacticalClick(soundEnabled);
  };

  const gpxFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportGPX = () => {
    const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FDC Tactical HUD - iOS-Open-GPX-Tracker Engine" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Tactical Mission Waypoints & Targets - iOS-Open-GPX-Tracker</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  ${targets.map(t => `
  <wpt lat="${t.lat}" lon="${t.lng}">
    <name>${t.id}: ${t.name}</name>
    <desc>Range: ${t.rangeM}m, Azimuth: ${t.azimuthMils} Mils, Type: ${t.targetType}</desc>
  </wpt>`).join('')}
</gpx>`;

    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tactical_waypoints_${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playTacticalClick(soundEnabled);
  };

  const handleImportGPX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const wpts = xmlDoc.getElementsByTagName('wpt');
        const newTargets: TacticalTarget[] = [];
        for (let i = 0; i < wpts.length; i++) {
          const wpt = wpts[i];
          const lat = parseFloat(wpt.getAttribute('lat') || '0');
          const lng = parseFloat(wpt.getAttribute('lon') || '0');
          const nameEl = wpt.getElementsByTagName('name')[0];
          const descEl = wpt.getElementsByTagName('desc')[0];
          const name = nameEl ? nameEl.textContent || 'Imported Wpt' : `GPX Wpt ${i+1}`;
          const desc = descEl ? descEl.textContent || '' : '';
          
          const bearing = calculateBearing(DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng, lat, lng);
          const distance = calculateDistance(DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng, lat, lng);
          const utm = latLngToUTM(lat, lng);

          newTargets.push({
            id: `GPX-${Math.floor(Math.random()*9000)+1000}`,
            name,
            lat,
            lng,
            easting: utm.easting,
            northing: utm.northing,
            rangeM: Math.round(distance),
            azimuthMils: degreesToMils(bearing),
            targetType: desc || 'นำเข้าจาก GPX Tracker',
            status: 'PENDING',
            timestamp: Date.now(),
          });
        }
        if (newTargets.length > 0) {
          setTargets(prev => [...newTargets, ...prev]);
          setActiveTargetId(newTargets[0].id);
          playWaypointMarkedChime(soundEnabled);
          alert(`นำเข้า GPX Waypoints สำเร็จ ${newTargets.length} จุด! (iOS-Open-GPX-Tracker)`);
        } else {
          alert('ไม่พบข้อมูลจุดพิกัด <wpt> ในไฟล์ GPX นี้');
        }
      } catch (err) {
        console.error('GPX Parse Error:', err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ GPX');
      }
    };
    reader.readAsText(file);
    playTacticalClick(soundEnabled);
  };

  const handlePanToTarget = (lat: number, lng: number) => {
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([lat, lng], 14, { duration: 1.2 });
    }
    playTacticalClick(soundEnabled);
  };

  const handlePanToUserGPS = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([currentPosition.lat, currentPosition.lng], 16, { duration: 1.2 });
    }
    playTacticalClick(soundEnabled);
  };

  const handlePanToBattery = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([DEFAULT_BATTERY_CENTER.lat, DEFAULT_BATTERY_CENTER.lng], 13, { duration: 1.2 });
    }
    playTacticalClick(soundEnabled);
  };

  const handleDeleteTarget = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargets((prev) => prev.filter((t) => t.id !== id));
    if (activeTargetId === id && targets.length > 1) {
      setActiveTargetId(targets.find((t) => t.id !== id)?.id || '');
    }
    playTacticalClick(soundEnabled);
  };

  return (
    <div className="relative w-full h-full bg-[#040404] text-[#10b981] overflow-hidden select-none font-mono flex">
      
      {/* ========================================================================= */}
      {/* 1. LEFT TACTICAL HUD SIDEBAR                                              */}
      {/* ========================================================================= */}
      <div
        className={`absolute top-0 bottom-0 left-0 z-30 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-80 sm:w-96 translate-x-0' : 'w-80 sm:w-96 -translate-x-full'
        } bg-[#08130c]/95 backdrop-blur-xl border-r border-[#10b981]/40 flex flex-col justify-between shadow-2xl pointer-events-auto`}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[#1b2f21] bg-[#061009] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center text-[#CEDE62]">
              <Crosshair className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-100 tracking-wide">
                TACTICAL C2 ARTILLERY MAP
              </h2>
              <p className="text-[9px] text-[#3be099]">ศูนย์บัญชาการและควบคุมการยิง</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#152a1c]"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry Readout & Active Target Controller */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          
          {/* Active Target Banner */}
          {activeTarget && targetTelemetry && (
            <div className="bg-[#121c15] border border-[#ff3b30]/60 rounded-lg p-3 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff3b30]/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[11px] font-black">
                  เป้าหมายหลัก: {activeTarget.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    activeTarget.status === 'APPROVED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : activeTarget.status === 'FIRED'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                      : 'bg-red-950 text-red-300 border border-red-500/50'
                  }`}
                >
                  {activeTarget.status}
                </span>
              </div>

              <div className="text-xs font-bold text-gray-100 mb-1">{activeTarget.name}</div>
              <div className="text-[10px] text-gray-400 mb-3">{activeTarget.targetType}</div>

              {/* FDC Calculation Readouts (Range, Azimuth, Grid) */}
              <div className="grid grid-cols-2 gap-2 bg-[#060e08] p-2.5 rounded border border-[#1b2f21] mb-3">
                <div>
                  <div className="text-[9px] text-gray-400 uppercase">ระยะยิง (Range)</div>
                  <div className="text-sm sm:text-base font-black text-[#fef08a]">
                    {formatDistance(targetTelemetry.distance)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 uppercase">มุมทิศ (Azimuth)</div>
                  <div className="text-sm sm:text-base font-black text-[#3be099]">
                    {targetTelemetry.azimuthMils} <span className="text-[10px]">มิล</span>
                  </div>
                </div>
                <div className="col-span-2 border-t border-[#15271b] pt-1.5 flex justify-between text-[10px] text-gray-300">
                  <span>ตอ.: {targetTelemetry.utm.easting}</span>
                  <span>ตน.: {targetTelemetry.utm.northing}</span>
                  <span>โซน: {targetTelemetry.utm.zone}N</span>
                </div>
              </div>

              {/* Action Buttons: Fire Mission & Google Sheets Sync */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteFireMission(activeTarget.id)}
                  disabled={simulatingFireTargetId !== null}
                  className="w-full py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs rounded shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Flame className="w-4 h-4" />
                  <span>{simulatingFireTargetId === activeTarget.id ? `ยิง! (${splashCountdown}s)` : 'สั่งยิง (FIRE)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSyncTargetToGoogleSheets(activeTarget)}
                  disabled={isSyncingGas}
                  className="w-full py-2 bg-[#14291a] hover:bg-[#1d3d27] border border-[#10b981]/60 text-[#3be099] font-bold text-xs rounded flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isSyncingGas ? 'กำลังส่ง...' : 'ลงชีต (GAS)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Splash Countdown Alert Banner */}
          {simulatingFireTargetId && (
            <div className="p-2.5 rounded-lg bg-[#2a0d0d] border-2 border-[#ff3b30] text-center animate-pulse">
              <div className="text-xs font-bold text-[#fca5a5]">🚨 อยู่ระหว่างภารกิจยิง (FIRE MISSION IN PROGRESS)</div>
              <div className="text-lg font-black text-[#fef08a] mt-0.5">
                {splashCountdown > 0 ? `เวลาเตรียมตรวจ (SPLASH): ${splashCountdown} วินาที` : '💥 แตกอากาศกระทบเป้าหมาย (IMPACT CONFIRMED!)'}
              </div>
            </div>
          )}

          {/* Target List DB */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-[#3be099]" />
                บัญชีเป้าหมาย ({targets.length})
              </span>
              <button
                type="button"
                onClick={() => handlePanToBattery()}
                className="text-[10px] text-[#3be099] hover:underline"
              >
                ศูนย์กลางกองร้อย
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {targets.map((tgt) => (
                <div
                  key={tgt.id}
                  onClick={() => {
                    setActiveTargetId(tgt.id);
                    handlePanToTarget(tgt.lat, tgt.lng);
                  }}
                  className={`p-2 rounded border cursor-pointer transition-all flex items-center justify-between ${
                    tgt.id === activeTargetId
                      ? 'bg-[#15291b] border-[#10b981] text-white shadow'
                      : 'bg-[#0a150e] border-[#183321] text-gray-400 hover:border-[#10b981]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-[#fca5a5]">{tgt.id}</span>
                      <span className="text-[11px] truncate max-w-[140px] text-gray-200">{tgt.name}</span>
                    </div>
                    <div className="text-[9px] text-gray-400">
                      ระยะ: {tgt.rangeM}m | ทิศ: {tgt.azimuthMils} มิล
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTarget(tgt.id, e)}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-[#201010] rounded"
                      title="ลบเป้าหมาย"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Settings & Layers */}
          <div className="bg-[#0b1710] border border-[#16301e] rounded-lg p-2.5 space-y-2 text-xs">
            <div className="text-[10px] font-bold text-gray-300 uppercase flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#CEDE62]" />
              การแสดงผลชั้นข้อมูล (Map Layers)
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMapEngine('LEAFLET_GIS');
                  setTileLayerType('DARK_MATTER');
                  playTacticalClick(soundEnabled);
                }}
                className={`py-1.5 px-2 rounded text-[10px] font-bold text-center border ${
                  mapEngine === 'LEAFLET_GIS' && tileLayerType === 'DARK_MATTER'
                    ? 'bg-[#142e1b] border-[#10b981] text-[#3be099]'
                    : 'bg-[#061009] border-[#183321] text-gray-400'
                }`}
              >
                Dark Matter GIS
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapEngine('LEAFLET_GIS');
                  setTileLayerType('SATELLITE');
                  playTacticalClick(soundEnabled);
                }}
                className={`py-1.5 px-2 rounded text-[10px] font-bold text-center border ${
                  mapEngine === 'LEAFLET_GIS' && tileLayerType === 'SATELLITE'
                    ? 'bg-[#142e1b] border-[#10b981] text-[#3be099]'
                    : 'bg-[#061009] border-[#183321] text-gray-400'
                }`}
              >
                ภาพถ่ายดาวเทียม
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapEngine('LITHOS_GEOLOGY');
                  playTacticalClick(soundEnabled);
                }}
                className={`col-span-2 py-1.5 px-2 rounded text-[10px] font-bold text-center border ${
                  mapEngine === 'LITHOS_GEOLOGY'
                    ? 'bg-[#142e1b] border-[#CEDE62] text-[#CEDE62]'
                    : 'bg-[#061009] border-[#183321] text-gray-400'
                }`}
              >
                แผนที่ธรณีวิทยา Lithos (Spotlight Reveal)
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#152a1c] text-[10px]">
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={showIcmSafetyZone}
                  onChange={(e) => setShowIcmSafetyZone(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>เขตปลอดภัย ICM (600m)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={showTrajectoryLines}
                  onChange={(e) => setShowTrajectoryLines(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>เส้นวิถียิงพาราโบลา</span>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Google Apps Script Webhook & iOS-Open-GPX-Tracker */}
        <div className="p-3 border-t border-[#1b2f21] bg-[#061009] space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowGasModal(true)}
              className="text-[11px] text-[#3be099] hover:underline flex items-center gap-1"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>ตั้งค่า Google Sheets API</span>
            </button>
            <span className="text-[9px] text-gray-500 font-mono">
              {gasUrl ? '🟢 พร้อมส่ง' : '⚪ ปิด'}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#112417]">
            <input 
              type="file" 
              ref={gpxFileInputRef} 
              accept=".gpx" 
              onChange={handleImportGPX} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => gpxFileInputRef.current?.click()}
              className="flex-1 py-1 px-2 rounded bg-[#102416] hover:bg-[#193b23] text-[#3be099] border border-[#10b981]/50 text-[10px] font-bold flex items-center justify-center gap-1"
              title="นำเข้าไฟล์ GPX Waypoints"
            >
              <Share2 className="w-3 h-3 rotate-180" />
              <span>นำเข้า GPX</span>
            </button>
            <button
              type="button"
              onClick={handleExportGPX}
              className="flex-1 py-1 px-2 rounded bg-[#102416] hover:bg-[#193b23] text-[#CEDE62] border border-[#CEDE62]/50 text-[10px] font-bold flex items-center justify-center gap-1"
              title="ส่งออกเป้าหมายเป็น GPX (Open-GPX-Tracker)"
            >
              <Share2 className="w-3 h-3" />
              <span>ส่งออก GPX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Handle (When closed) */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-4 left-4 z-30 p-2.5 rounded-lg bg-[#0a1f12]/95 border border-[#10b981] text-[#3be099] shadow-2xl hover:bg-[#122e1b] pointer-events-auto flex items-center gap-1.5 text-xs font-bold"
        >
          <Maximize2 className="w-4 h-4" />
          <span>แผงควบคุม C2</span>
        </button>
      )}

      {/* ========================================================================= */}
      {/* 2. MAP CANVAS: LEAFLET OR DUAL-LAYER LITHOS GEOLOGY                      */}
      {/* ========================================================================= */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {mapEngine === 'LEAFLET_GIS' ? (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        ) : (
          <div className="w-full h-full relative z-0">
            <NakhonSawanTacticalMap center={[currentPosition.lat, currentPosition.lng]} className="w-full h-full" opacity={1.0} />
          </div>
        )}

        {/* Top-Right Quick Map Tools Float */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
          <div className="bg-[#09150d]/90 backdrop-blur-md border border-[#10b981]/50 p-1 rounded-lg flex flex-col gap-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                if (leafletMapRef.current) leafletMapRef.current.zoomIn();
                playTacticalClick(soundEnabled);
              }}
              className="w-8 h-8 rounded bg-[#102416] hover:bg-[#193b23] text-[#3be099] flex items-center justify-center font-bold"
              title="ซูมเข้า"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (leafletMapRef.current) leafletMapRef.current.zoomOut();
                playTacticalClick(soundEnabled);
              }}
              className="w-8 h-8 rounded bg-[#102416] hover:bg-[#193b23] text-[#3be099] flex items-center justify-center font-bold"
              title="ซูมออก"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePanToBattery}
              className="w-8 h-8 rounded bg-[#102416] hover:bg-[#193b23] text-[#fef08a] flex items-center justify-center font-bold"
              title="กลับสู่ ศก.ร้อย"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePanToUserGPS}
              className="w-8 h-8 rounded bg-[#102416] hover:bg-[#193b23] text-[#60a5fa] flex items-center justify-center font-bold"
              title="ตำแหน่ง GPS จริงของคุณ"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Notification for GAS Sync Status */}
        {gasSyncStatus && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#0a1f12]/95 border border-[#10b981] text-[#3be099] text-xs font-bold shadow-2xl animate-bounce">
            {gasSyncStatus}
          </div>
        )}

        {/* Bottom Coordinates & Military Compass Bar */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-[#07130a]/90 backdrop-blur-md border border-[#10b981]/50 text-gray-200 text-xs shadow-xl pointer-events-auto flex items-center gap-3">
            <span className="text-[#3be099] font-bold">พิกัดทหาร:</span>
            <span>{formatMGRS(currentPosition.lat, currentPosition.lng)}</span>
            <span className="text-gray-500">|</span>
            <span className="text-[#CEDE62]">เข็มทิศ: {Math.round(orientation.heading)}° ({degreesToMils(orientation.heading)} มิล)</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#07130a]/90 backdrop-blur-md border border-[#10b981]/50 text-[#3be099] text-xs shadow-xl pointer-events-auto">
            <span>แตะบนแผนที่เพื่อพล็อตเป้าหมายใหม่ (Click to Acquire Target)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. GOOGLE APPS SCRIPT WEBHOOK CONFIG MODAL                               */}
      {/* ========================================================================= */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#09150d] border border-[#10b981] rounded-xl p-5 max-w-lg w-full shadow-2xl font-mono text-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <CloudUpload className="w-5 h-5 text-[#3be099]" />
              <h3 className="text-sm font-bold text-white">ตั้งค่า Google Sheets API Webhook</h3>
            </div>

            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              ใส่ URL ของ Google Apps Script Web App (ที่ Deploy ด้วยสิทธิ์ Anyone) เพื่อให้ระบบส่งพิกัดเป้าหมาย, ระยะยิง, และมุมทิศ (มิลเลียม) เข้าสู่ชีต `TargetListDB` โดยอัตโนมัติ:
            </p>

            <input
              type="text"
              defaultValue={gasUrl}
              placeholder="https://script.google.com/macros/s/.../exec"
              id="gasUrlInput"
              className="w-full px-3 py-2 bg-[#040805] border border-[#10b981]/60 rounded text-xs text-[#3be099] font-mono focus:outline-none focus:border-[#CEDE62] mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 text-xs hover:bg-gray-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('gasUrlInput') as HTMLInputElement;
                  handleSaveGasUrl(input ? input.value : '');
                }}
                className="px-4 py-1.5 rounded bg-[#10b981] text-black font-bold text-xs hover:bg-[#059669]"
              >
                บันทึกการเชื่อมต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
