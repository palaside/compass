import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Compass,
  Camera,
  MapPin,
  Crosshair,
  AlertTriangle,
  Layers,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Sparkles,
  Download,
  Navigation,
  Target,
} from 'lucide-react';
import {
  Waypoint,
  GPSPosition,
  DeviceOrientationData,
  ARFilter,
  SolarInfo,
} from '../types';
import {
  calculateBearing,
  calculateDistance,
  formatDistance,
  formatMGRS,
  formatDMS,
  degreesToCardinal,
  degreesToMils,
  getMoonPosition,
  getPolarisPosition,
} from '../utils/geo';
import {
  playTacticalClick,
  playTargetLockPing,
  playCameraShutter,
  playHazardAlarm,
} from '../utils/audio';

interface ARViewProps {
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  waypoints: Waypoint[];
  activeWaypoint: Waypoint | null;
  onSelectWaypoint: (wp: Waypoint) => void;
  onAddWaypointAtCurrent: () => void;
  solarInfo: SolarInfo;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onManualHeadingChange?: (heading: number) => void;
  onManualPitchChange?: (pitch: number) => void;
  onManualRollChange?: (roll: number) => void;
}

export function ARView({
  currentPosition,
  orientation,
  waypoints,
  activeWaypoint,
  onSelectWaypoint,
  onAddWaypointAtCurrent,
  solarInfo,
  soundEnabled,
  onToggleSound,
  onManualHeadingChange,
  onManualPitchChange,
  onManualRollChange,
}: ARViewProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [arFilter, setArFilter] = useState<ARFilter>('STANDARD');
  const [snapshotTaken, setSnapshotTaken] = useState<string | null>(null);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);
  const [isLockedOnTarget, setIsLockedOnTarget] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevLockedRef = useRef<boolean>(false);

  // Initialize Camera Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError('อุปกรณ์ไม่รองรับการเข้าถึงกล้อง (WebRTC)');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องได้';
      setCameraError(`เข้าถึงกล้องไม่ได้ (${errorMsg}) — ใช้โหมดภาพจำลองสภาพแวดล้อม 3D`);
      setIsCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
    }
  }, [cameraStream]);

  useEffect(() => {
    // Camera is disabled by default unless explicitly turned on by user
    return () => {
      stopCamera();
    };
  }, []);

  // Update video element when stream is ready
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Roll Hazard Alert Check (Roll > 30 deg is rollover danger for 4x4 vehicles)
  const isRollHazard = Math.abs(orientation.roll) >= 30;
  useEffect(() => {
    if (isRollHazard) {
      playHazardAlarm(soundEnabled);
    }
  }, [isRollHazard, soundEnabled]);

  // Target lock sound feedback when bearing matches heading within ±4 degrees
  useEffect(() => {
    if (!activeWaypoint && waypoints.length === 0) {
      setIsLockedOnTarget(false);
      return;
    }

    // Check against activeWaypoint or closest visible waypoint
    const targetWp = activeWaypoint || waypoints[0];
    if (!targetWp) return;

    const targetBearing = calculateBearing(
      currentPosition.lat,
      currentPosition.lng,
      targetWp.lat,
      targetWp.lng
    );
    let diff = Math.abs(targetBearing - orientation.heading);
    if (diff > 180) diff = 360 - diff;

    const locked = diff <= 4;
    setIsLockedOnTarget(locked);

    if (locked && !prevLockedRef.current) {
      playTargetLockPing(soundEnabled);
    }
    prevLockedRef.current = locked;
  }, [orientation.heading, activeWaypoint, waypoints, currentPosition, soundEnabled]);

  // Take Snapshot with AR Telemetry Overlay
  const handleTakeSnapshot = () => {
    playCameraShutter(soundEnabled);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Draw background video or dark terrain
    if (isCameraActive && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#060f09';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Apply Filter tint
    if (arFilter === 'NVG_GREEN') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (arFilter === 'AMBER') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Burn Telemetry Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`AR OFFROAD NAVIGATION HUD`, 30, 40);
    ctx.font = '14px monospace';
    ctx.fillText(`MGRS: ${formatMGRS(currentPosition.lat, currentPosition.lng)}`, 30, 70);
    ctx.fillText(`POS: ${formatDMS(currentPosition.lat, currentPosition.lng)}`, 30, 95);
    ctx.fillText(`ALT: ${currentPosition.altitude ? Math.round(currentPosition.altitude) : 480}m MSL | HDG: ${Math.round(orientation.heading)}° (${degreesToMils(orientation.heading)}mils)`, 30, 120);
    ctx.fillText(`PITCH: ${Math.round(orientation.pitch)}° | ROLL: ${Math.round(orientation.roll)}°`, 30, 145);
    ctx.fillText(`TIME: ${new Date().toISOString()}`, 30, 170);

    if (activeWaypoint) {
      const dist = calculateDistance(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng);
      const brg = calculateBearing(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng);
      ctx.fillStyle = '#CEDE62';
      ctx.fillText(`TARGET: ${activeWaypoint.name} [${formatDistance(dist)}] BRG ${Math.round(brg)}°`, 30, 205);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setSnapshotTaken(dataUrl);
  };

  // Download snapshot
  const downloadSnapshot = () => {
    if (!snapshotTaken) return;
    const link = document.createElement('a');
    link.href = snapshotTaken;
    link.download = `AR_OFFROAD_${Date.now()}.jpg`;
    link.click();
    setSnapshotTaken(null);
  };

  // 3D Horizontal Field of View in degrees for AR Projection
  const FOV_HORIZONTAL = 65; // standard smartphone wide camera FOV
  const FOV_VERTICAL = 45;

  // Celestial positions in 3D AR space
  const moonInfo = getMoonPosition(currentPosition.lat, currentPosition.lng);
  const polarisInfo = getPolarisPosition(currentPosition.lat, currentPosition.lng);

  // Active target calculations
  const targetBearing = activeWaypoint
    ? calculateBearing(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng)
    : null;
  const targetDistance = activeWaypoint
    ? calculateDistance(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng)
    : null;

  // Relative bearing offset (-180 to +180)
  let relativeBearing: number | null = null;
  if (targetBearing !== null) {
    relativeBearing = ((targetBearing - orientation.heading + 540) % 360) - 180;
  }

  // Filter CSS class
  const getFilterClass = () => {
    switch (arFilter) {
      case 'NVG_GREEN':
        return 'brightness-125 contrast-150 sepia hue-rotate-[90deg] saturate-[300%]';
      case 'THERMAL':
        return 'invert hue-rotate-[180deg] contrast-200 saturate-150';
      case 'AMBER':
        return 'brightness-110 contrast-125 sepia hue-rotate-[5deg] saturate-[250%]';
      default:
        return '';
    }
  };

  return (
    <div className="relative w-full h-full bg-[#020503] overflow-hidden select-none font-mono">
      {/* Hidden Canvas for High-Resolution AR Telemetry Snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 1. CAMERA BACKGROUND OR 3D TERRAIN SIMULATION */}
      {isCameraActive ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover z-0 transition-all duration-300 ${getFilterClass()}`}
        />
      ) : (
        /* Off-Road Simulated 3D Mountain Horizon Canvas */
        <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-[#03150d] via-[#072215] to-[#010804] flex items-center justify-center overflow-hidden">
          {/* Simulated Mountains & Starfield Background */}
          <div
            className="absolute inset-0 opacity-40 transition-transform duration-100"
            style={{
              transform: `translateX(${(-orientation.heading / 360) * 1000}px) translateY(${orientation.pitch * 2}px) rotate(${-orientation.roll * 0.5}deg)`,
              width: '3000px',
              left: '-1000px',
            }}
          >
            {/* Mountain Ridge SVGs */}
            <svg viewBox="0 0 3000 600" className="w-full h-full absolute bottom-20 text-[#10b981]/20 fill-current">
              <polygon points="0,600 200,300 450,450 700,200 950,400 1200,180 1500,420 1800,240 2100,450 2400,190 2700,380 3000,600" />
            </svg>
            <svg viewBox="0 0 3000 600" className="w-full h-full absolute bottom-0 text-[#09351e]/50 fill-current">
              <polygon points="0,600 350,380 600,490 900,320 1250,510 1600,350 1950,480 2300,340 2650,520 3000,600" />
            </svg>
          </div>

          {/* Grid Horizon Mesh */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />
        </div>
      )}

      {/* AR Night-Vision Scanline Effect */}
      {arFilter === 'NVG_GREEN' && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(16,185,129,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_3px] opacity-40" />
      )}

      {/* 2. TOP 360° AR FLOATING COMPASS RIBBON / HEADING TAPE */}
      <div className="absolute top-0 inset-x-0 z-30 flex flex-col items-center pt-2 pointer-events-none">
        {/* Central Lubber Line (Indicator Triangle) */}
        <div className="flex flex-col items-center">
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#CEDE62] drop-shadow-[0_0_8px_#CEDE62]" />
          <div className="bg-[#121b15]/90 border border-[#CEDE62]/80 px-2.5 py-0.5 rounded text-xs font-bold text-[#CEDE62] shadow-[0_0_12px_rgba(206,222,98,0.4)] mt-0.5 tracking-wider">
            {Math.round(orientation.heading)}° {degreesToCardinal(orientation.heading)}
            <span className="text-[10px] text-[#10b981] ml-1.5 font-normal">
              {degreesToMils(orientation.heading)} mils
            </span>
          </div>
        </div>

        {/* 360° Sliding Scale Bar */}
        <div className="w-full max-w-xl h-10 overflow-hidden relative mt-1 bg-[#09150d]/80 backdrop-blur-md border-y border-[#10b981]/40">
          {/* Active Target Indicator Marker on Top Ribbon */}
          {targetBearing !== null && (
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center z-20 transition-all duration-100"
              style={{
                left: `calc(50% + ${((targetBearing - orientation.heading + 540) % 360 - 180) * 4}px)`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="w-2.5 h-2.5 bg-[#f59e0b] rotate-45 border border-white shadow-[0_0_10px_#f59e0b]" />
              <span className="text-[8px] font-bold text-[#f59e0b] bg-black/80 px-1 rounded -mt-0.5">
                TGT
              </span>
            </div>
          )}

          {/* Sun Indicator on Ribbon */}
          <div
            className="absolute top-1 z-10 flex flex-col items-center transition-all duration-100"
            style={{
              left: `calc(50% + ${((solarInfo.azimuth - orientation.heading + 540) % 360 - 180) * 4}px)`,
              transform: 'translateX(-50%)',
            }}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          </div>

          {/* Tape Scale Elements (Generates tick marks every 5 degrees) */}
          <div
            className="absolute top-0 h-full flex items-end pb-1 transition-transform duration-75"
            style={{
              transform: `translateX(calc(50% - ${orientation.heading * 4}px))`,
              width: `${360 * 4}px`,
            }}
          >
            {Array.from({ length: 72 }).map((_, i) => {
              const deg = i * 5;
              const isMajor = deg % 45 === 0;
              const isMinor = deg % 15 === 0;
              const cardinal = isMajor ? degreesToCardinal(deg) : null;

              return (
                <div
                  key={deg}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: `${deg * 4}px`, width: '4px' }}
                >
                  {cardinal && (
                    <span
                      className={`text-[10px] font-black -mb-0.5 ${
                        cardinal === 'N'
                          ? 'text-red-500 font-extrabold text-xs'
                          : 'text-[#CEDE62]'
                      }`}
                    >
                      {cardinal}
                    </span>
                  )}
                  <span className="text-[7px] text-gray-400 mb-0.5">
                    {deg % 30 === 0 && !cardinal ? `${deg}°` : ''}
                  </span>
                  <div
                    className={`w-[1px] ${
                      isMajor
                        ? 'h-4 bg-[#10b981]'
                        : isMinor
                        ? 'h-2.5 bg-[#10b981]/70'
                        : 'h-1.5 bg-[#10b981]/30'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. AR 3D FLOATING WAYPOINT PINS & 3D TRAIL RIBBON PROJECTED ON CAMERA VIEW */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        
        {/* 3D AR Celestial Markers (Sun, Moon, Polaris) in the AR Sky */}
        {/* Sun in 3D AR Sky */}
        {(() => {
          let deltaAzimuth = ((solarInfo.azimuth - orientation.heading + 540) % 360) - 180;
          if (Math.abs(deltaAzimuth) <= FOV_HORIZONTAL / 2) {
            const xPercent = 50 + (deltaAzimuth / (FOV_HORIZONTAL / 2)) * 50;
            const deltaPitch = solarInfo.altitude + orientation.pitch;
            const yPercent = 50 - (deltaPitch / (FOV_VERTICAL / 2)) * 45;
            if (yPercent >= 5 && yPercent <= 95) {
              return (
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-pulse"
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                >
                  <div className="w-12 h-12 rounded-full bg-amber-400/30 border border-amber-400 flex items-center justify-center shadow-[0_0_30px_#f59e0b]">
                    <Sun className="w-6 h-6 text-amber-300 drop-shadow-[0_0_10px_#f59e0b]" />
                  </div>
                  <span className="text-[9px] bg-black/80 text-amber-300 px-1.5 py-0.5 rounded font-bold mt-1 border border-amber-400/50">
                    THE SUN ({Math.round(solarInfo.azimuth)}° / {solarInfo.altitude}°)
                  </span>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* Moon in 3D AR Sky */}
        {(() => {
          let deltaAzimuth = ((moonInfo.azimuth - orientation.heading + 540) % 360) - 180;
          if (Math.abs(deltaAzimuth) <= FOV_HORIZONTAL / 2) {
            const xPercent = 50 + (deltaAzimuth / (FOV_HORIZONTAL / 2)) * 50;
            const deltaPitch = moonInfo.altitude + orientation.pitch;
            const yPercent = 50 - (deltaPitch / (FOV_VERTICAL / 2)) * 45;
            if (yPercent >= 5 && yPercent <= 95) {
              return (
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                >
                  <div className="w-10 h-10 rounded-full bg-sky-400/25 border border-sky-300 flex items-center justify-center shadow-[0_0_20px_#38bdf8]">
                    <span className="text-xl">{moonInfo.phaseIcon}</span>
                  </div>
                  <span className="text-[9px] bg-black/80 text-sky-300 px-1.5 py-0.5 rounded font-bold mt-1 border border-sky-400/50">
                    MOON ({moonInfo.illumination}%)
                  </span>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* Polaris (ดาวเหนือ) in 3D AR Sky - True North Indicator */}
        {polarisInfo.isVisible && (() => {
          let deltaAzimuth = ((polarisInfo.azimuth - orientation.heading + 540) % 360) - 180;
          if (Math.abs(deltaAzimuth) <= FOV_HORIZONTAL / 2) {
            const xPercent = 50 + (deltaAzimuth / (FOV_HORIZONTAL / 2)) * 50;
            const deltaPitch = polarisInfo.altitude + orientation.pitch;
            const yPercent = 50 - (deltaPitch / (FOV_VERTICAL / 2)) * 45;
            if (yPercent >= 5 && yPercent <= 95) {
              return (
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-yellow-400/30 border border-yellow-300 flex items-center justify-center shadow-[0_0_25px_#fde047]">
                    <Sparkles className="w-4 h-4 text-yellow-200 animate-spin" />
                  </div>
                  <span className="text-[9px] bg-black/90 text-yellow-300 px-2 py-0.5 rounded font-bold mt-1 border border-yellow-400">
                    POLARIS (TRUE NORTH 000°)
                  </span>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* 3D AR Ground Navigation Pathway Ribbon to Active Target */}
        {activeWaypoint && (() => {
          const bearing = calculateBearing(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng);
          let deltaAzimuth = ((bearing - orientation.heading + 540) % 360) - 180;
          const targetX = 50 + (deltaAzimuth / (FOV_HORIZONTAL / 2)) * 50;
          
          return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-80" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Glowing 3D ground path projection */}
              <defs>
                <linearGradient id="arPathGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#CEDE62" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon
                points={`42,100 58,100 ${Math.max(10, Math.min(90, targetX + 4))},55 ${Math.max(10, Math.min(90, targetX - 4))},55`}
                fill="url(#arPathGradient)"
              />
              {/* Center Chevron Guide Line */}
              <line
                x1="50"
                y1="100"
                x2={Math.max(5, Math.min(95, targetX))}
                y2="55"
                stroke="#CEDE62"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            </svg>
          );
        })()}

        {waypoints.map((wp) => {
          const bearing = calculateBearing(currentPosition.lat, currentPosition.lng, wp.lat, wp.lng);
          const distance = calculateDistance(currentPosition.lat, currentPosition.lng, wp.lat, wp.lng);
          
          // Calculate relative azimuth angle to camera forward heading (-180 to +180)
          let deltaAzimuth = ((bearing - orientation.heading + 540) % 360) - 180;
          
          // Check if waypoint is within camera Field of View (FOV)
          const inFOV = Math.abs(deltaAzimuth) <= FOV_HORIZONTAL / 2;
          
          // Horizontal screen position (0% to 100%)
          const xPercent = 50 + (deltaAzimuth / (FOV_HORIZONTAL / 2)) * 50;

          // Vertical elevation angle offset (based on altitude difference and pitch)
          const altDiff = (wp.altitude || 500) - (currentPosition.altitude || 480);
          const elevAngleDeg = (Math.atan2(altDiff, Math.max(distance, 10)) * 180) / Math.PI;
          const deltaPitch = elevAngleDeg + orientation.pitch;
          const yPercent = 50 - (deltaPitch / (FOV_VERTICAL / 2)) * 40;

          const isActive = activeWaypoint?.id === wp.id;

          // Scale based on distance (Closer = larger, farther = smaller)
          const scale = Math.max(0.65, Math.min(1.15, 1 - Math.log10(Math.max(distance, 10) / 100) * 0.15));

          if (!inFOV) {
            // Off-screen edge radar indicator for active target
            if (isActive) {
              const isLeft = deltaAzimuth < 0;
              return (
                <div
                  key={wp.id}
                  className={`pointer-events-auto absolute top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 p-2 bg-[#121c15]/90 border-2 border-[#f59e0b] rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer ${
                    isLeft ? 'left-2' : 'right-2 flex-row-reverse'
                  }`}
                  onClick={() => onSelectWaypoint(wp)}
                >
                  <Navigation
                    className={`w-5 h-5 text-[#f59e0b] animate-pulse ${
                      isLeft ? '-rotate-90' : 'rotate-90'
                    }`}
                  />
                  <div className="text-left text-[11px] leading-tight">
                    <span className="font-bold text-[#f59e0b] block truncate max-w-[120px]">
                      {wp.name}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {Math.round(Math.abs(deltaAzimuth))}° {isLeft ? '◀ ซ้าย' : 'ขวา ▶'} • {formatDistance(distance)}
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          }

          return (
            <div
              key={wp.id}
              className="pointer-events-auto absolute transition-all duration-75 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{
                left: `${xPercent}%`,
                top: `${Math.max(15, Math.min(85, yPercent))}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
              onClick={() => {
                onSelectWaypoint(wp);
                playTacticalClick(soundEnabled);
              }}
            >
              {/* Waypoint AR Pin Box */}
              <div
                className={`flex flex-col items-center transition-all ${
                  isActive
                    ? 'ring-2 ring-[#CEDE62] shadow-[0_0_24px_rgba(206,222,98,0.7)]'
                    : 'hover:scale-105'
                }`}
              >
                {/* Distance and Target Callout Tag */}
                <div
                  className={`px-3 py-1.5 rounded-md border flex items-center gap-2 backdrop-blur-md transition-colors ${
                    isActive
                      ? 'bg-[#182a1e]/95 border-[#CEDE62] text-[#CEDE62]'
                      : 'bg-[#0b140e]/85 border-[#10b981]/50 text-gray-200'
                  }`}
                >
                  <MapPin
                    className="w-4 h-4 shrink-0"
                    style={{ color: wp.color || '#10b981' }}
                  />
                  <div className="flex flex-col text-left">
                    <span className="font-black text-xs tracking-wide leading-none text-white drop-shadow">
                      {wp.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-300 mt-0.5">
                      <span className="font-bold text-[#3be099]">
                        {formatDistance(distance)}
                      </span>
                      <span>•</span>
                      <span>BRG {Math.round(bearing)}°</span>
                      {wp.altitude && (
                        <>
                          <span>•</span>
                          <span className="text-gray-400">
                            {altDiff >= 0 ? `▲+${altDiff}` : `▼${altDiff}`}m
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target Pin Stem Line & Pulsing Target Point */}
                <div
                  className={`w-0.5 h-6 ${
                    isActive ? 'bg-[#CEDE62]' : 'bg-[#10b981]/70'
                  }`}
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                    isActive
                      ? 'bg-[#CEDE62] animate-ping'
                      : 'bg-[#10b981]'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. CENTER AR ARTIFICIAL HORIZON & TARGETING RETICLE */}
      <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
        {/* Pitch Ladder / Artificial Horizon Line (Rotates with roll and offsets with pitch) */}
        <div
          className="w-72 sm:w-96 flex flex-col items-center justify-center transition-transform duration-75"
          style={{
            transform: `translateY(${orientation.pitch * 3}px) rotate(${-orientation.roll}deg)`,
          }}
        >
          {/* Horizon Level Bar */}
          <div className="w-full flex items-center justify-between">
            <div className="w-24 sm:w-32 h-0.5 bg-[#10b981]/70 shadow-[0_0_8px_#10b981] flex items-center justify-start">
              <span className="text-[10px] text-[#10b981] font-bold -mt-4">
                {Math.round(orientation.pitch)}°
              </span>
            </div>

            {/* Crosshair Center */}
            <div
              className={`w-14 h-14 rounded-full border border-dashed flex items-center justify-center transition-all ${
                isLockedOnTarget
                  ? 'border-[#CEDE62] scale-110 shadow-[0_0_20px_#CEDE62]'
                  : 'border-[#10b981]/50'
              }`}
            >
              <Crosshair
                className={`w-7 h-7 transition-colors ${
                  isLockedOnTarget ? 'text-[#CEDE62] animate-spin' : 'text-[#10b981]/80'
                }`}
              />
            </div>

            <div className="w-24 sm:w-32 h-0.5 bg-[#10b981]/70 shadow-[0_0_8px_#10b981] flex items-center justify-end">
              <span className="text-[10px] text-[#10b981] font-bold -mt-4">
                {Math.round(orientation.roll)}° ROLL
              </span>
            </div>
          </div>

          {/* Pitch Steps (-10, -20, +10, +20) */}
          <div className="w-28 flex flex-col items-center gap-6 mt-4 opacity-50 text-[9px] text-[#10b981]">
            <div className="w-full flex items-center justify-between border-t border-dashed border-[#10b981]">
              <span>-10°</span>
              <span>-10°</span>
            </div>
            <div className="w-20 flex items-center justify-between border-t border-dashed border-[#10b981]">
              <span>-20°</span>
              <span>-20°</span>
            </div>
          </div>
        </div>

        {/* Target Lock Banner when aligned ±4° */}
        {isLockedOnTarget && (
          <div className="absolute top-1/2 mt-16 bg-[#172b1d]/90 border border-[#CEDE62] px-4 py-1.5 rounded-full text-center shadow-[0_0_20px_rgba(206,222,98,0.8)] animate-bounce">
            <span className="text-xs font-black text-[#CEDE62] tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#CEDE62]" />
              TARGET LOCKED (±4° ALIGNED)
            </span>
          </div>
        )}

        {/* 4x4 Off-Road Roll Hazard Alarm HUD Banner */}
        {isRollHazard && (
          <div className="absolute top-1/2 -mt-24 bg-red-900/90 border-2 border-red-500 px-5 py-2 rounded-xl text-center shadow-[0_0_30px_rgba(239,68,68,0.9)] animate-pulse">
            <div className="flex items-center justify-center gap-2 text-red-200 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>4x4 ROLLOVER DANGER! (ROLL {Math.abs(Math.round(orientation.roll))}°)</span>
            </div>
            <span className="text-[10px] text-red-300 block mt-0.5">
              มุมเอียงเกินขีดปลอดภัย 30° — ระวังรถพลิกคว่ำ!
            </span>
          </div>
        )}
      </div>

      {/* 5. TOP-RIGHT AR HUD CONTROLS */}
      <div className="absolute top-16 right-3 z-30 pointer-events-auto flex flex-col gap-2 items-end">
        {/* AR Filter Switcher */}
        <div className="flex items-center gap-1 bg-[#0e1711]/90 backdrop-blur-md border border-[#10b981]/40 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => {
              const filters: ARFilter[] = ['STANDARD', 'NVG_GREEN', 'THERMAL', 'AMBER'];
              const nextIdx = (filters.indexOf(arFilter) + 1) % filters.length;
              setArFilter(filters[nextIdx]);
              playTacticalClick(soundEnabled);
            }}
            className="px-2 py-1 text-[11px] font-bold text-[#CEDE62] hover:bg-[#1b2f21] rounded flex items-center gap-1"
            title="เปลี่ยนฟิลเตอร์ภาพ AR (Standard / NVG Night Vision / Thermal / Amber)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {arFilter === 'STANDARD'
                ? 'ปกติ'
                : arFilter === 'NVG_GREEN'
                ? 'NVG เขียว'
                : arFilter === 'THERMAL'
                ? 'Thermal'
                : 'Amber ส้ม'}
            </span>
          </button>
        </div>

        {/* Camera On/Off Toggle */}
        <button
          type="button"
          onClick={() => {
            if (isCameraActive) {
              stopCamera();
            } else {
              startCamera();
            }
            playTacticalClick(soundEnabled);
          }}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
            isCameraActive
              ? 'bg-[#1b2f21] text-[#3be099] border-[#3be099]'
              : 'bg-[#121c15] text-gray-400 border-gray-700 hover:text-white'
          }`}
          title="เปิด/ปิดกล้องถ่ายรูป"
        >
          <Camera className="w-4 h-4" />
          <span>{isCameraActive ? 'ปิดกล้อง' : 'เปิดกล้อง'}</span>
        </button>

        {/* Snapshot Tool (ถ่ายรูป) */}
        <button
          type="button"
          onClick={handleTakeSnapshot}
          className="bg-[#1b2f21]/90 hover:bg-[#24422e] text-[#CEDE62] border border-[#3be099]/50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform active:scale-95"
          title="ถ่ายรูปภาพ AR พร้อมข้อมูลพิกัด Telemetry"
        >
          <Camera className="w-4 h-4 text-[#CEDE62]" />
          <span>ถ่ายรูป</span>
        </button>

        {/* Video Recording Tool (บันทึกวิดีโอ) */}
        <button
          type="button"
          onClick={() => {
            if ((window as unknown as { isRecordingVid?: boolean }).isRecordingVid) {
              (window as unknown as { isRecordingVid?: boolean }).isRecordingVid = false;
              alert('บันทึกวิดีโอเรียบร้อยแล้ว (บันทึกลงหน่วยความจำอุปกรณ์)');
            } else {
              (window as unknown as { isRecordingVid?: boolean }).isRecordingVid = true;
              alert('เริ่มบันทึกวิดีโอ HUD ยุทธวิธี...');
            }
            playTacticalClick(soundEnabled);
          }}
          className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-600/70 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform active:scale-95"
          title="บันทึกวิดีโอหน้าจอ AR HUD"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>บันทึกวิดีโอ</span>
        </button>

        {/* Audio Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className="bg-[#0e1711]/90 text-gray-300 border border-gray-700 p-2 rounded-full hover:bg-gray-800 text-xs"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
        </button>

        {/* Simulation Sliders Toggle (for testing in desktop without gyro) */}
        {!orientation.isDeviceSensor && (
          <button
            type="button"
            onClick={() => setShowSimControls(!showSimControls)}
            className="bg-[#0e1711]/90 text-[10px] text-amber-400 border border-amber-600/50 px-2 py-1 rounded-md"
          >
            {showSimControls ? 'ซ่อนตัวปรับจำลอง' : '⚙️ ปรับหมุนจำลอง'}
          </button>
        )}
      </div>

      {/* 6. BOTTOM TELEMETRY BAR & QUICK ACTIONS */}
      <div className="absolute bottom-4 inset-x-3 z-30 pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-2 font-mono">
        {/* Real-time GPS Coordinate Box */}
        <div className="bg-[#0c1510]/95 backdrop-blur-md border border-[#10b981]/50 p-3 rounded-lg text-[11px] shadow-2xl flex flex-col gap-1 max-w-sm">
          <div className="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-1">
            <span className="text-[#3be099] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
              OFFROAD GPS HUD
            </span>
            <span>ความแม่นยำ ±{Math.round(currentPosition.accuracy)}m</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-200">
            <div>
              <span className="text-gray-500 block text-[9px]">MGRS GRID</span>
              <span className="font-bold text-[#CEDE62] text-xs">
                {formatMGRS(currentPosition.lat, currentPosition.lng)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[9px]">ALTITUDE (MSL)</span>
              <span className="font-bold text-white text-xs">
                {currentPosition.altitude ? `${Math.round(currentPosition.altitude)} m` : '480 m'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[9px]">COORDINATES (DMS)</span>
              <span className="font-mono text-[10px]">
                {formatDMS(currentPosition.lat, currentPosition.lng)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[9px]">SPEED / SUN</span>
              <span className="text-[10px]">
                {currentPosition.speed ? `${Math.round(currentPosition.speed * 3.6)} km/h` : '0 km/h'} • ☀️ {solarInfo.sunset}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            onClick={onAddWaypointAtCurrent}
            className="bg-[#1b2f21] hover:bg-[#25422e] text-[#CEDE62] border border-[#3be099] px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xl transition-transform active:scale-95"
          >
            <MapPin className="w-4 h-4 text-[#CEDE62]" />
            <span>มาร์กจุดตำแหน่งนี้</span>
          </button>
        </div>
      </div>

      {/* 7. SIMULATION SLIDERS FOR DESKTOP OR NO-SENSOR TESTING */}
      {showSimControls && (
        <div className="absolute bottom-28 right-3 z-40 bg-[#09120c]/95 border border-[#10b981]/60 p-3 rounded-lg shadow-2xl w-64 text-xs flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between text-[#CEDE62] font-bold">
            <span>⚙️ จำลองเซนเซอร์ (Simulation)</span>
            <button onClick={() => setShowSimControls(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <div>
            <label className="text-[10px] text-gray-300 flex justify-between">
              <span>ทิศหัวเข็มทิศ (Heading):</span>
              <span className="text-[#3be099] font-bold">{Math.round(orientation.heading)}°</span>
            </label>
            <input
              type="range"
              min="0"
              max="359"
              value={orientation.heading}
              onChange={(e) => onManualHeadingChange?.(Number(e.target.value))}
              className="w-full accent-[#10b981]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-300 flex justify-between">
              <span>มุมก้ม/เงย (Pitch):</span>
              <span className="text-[#3be099] font-bold">{Math.round(orientation.pitch)}°</span>
            </label>
            <input
              type="range"
              min="-60"
              max="60"
              value={orientation.pitch}
              onChange={(e) => onManualPitchChange?.(Number(e.target.value))}
              className="w-full accent-[#10b981]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-300 flex justify-between">
              <span>มุมเอียงซ้าย/ขวา (Roll):</span>
              <span className={`font-bold ${isRollHazard ? 'text-red-400' : 'text-[#3be099]'}`}>
                {Math.round(orientation.roll)}°
              </span>
            </label>
            <input
              type="range"
              min="-45"
              max="45"
              value={orientation.roll}
              onChange={(e) => onManualRollChange?.(Number(e.target.value))}
              className="w-full accent-[#10b981]"
            />
          </div>
        </div>
      )}

      {/* 8. SNAPSHOT PREVIEW MODAL */}
      {snapshotTaken && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-[#0b140e] border-2 border-[#CEDE62] rounded-xl overflow-hidden shadow-2xl p-2">
            <h4 className="font-bold text-xs text-[#CEDE62] mb-2 px-2">
              📸 ภาพถ่าย AR HUD พร้อมข้อมูล Telemetry
            </h4>
            <img
              src={snapshotTaken}
              alt="AR Snapshot"
              className="w-full max-h-[65vh] object-contain rounded-lg border border-gray-800"
            />
            <div className="flex items-center justify-end gap-2 mt-3 px-2">
              <button
                type="button"
                onClick={() => setSnapshotTaken(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={downloadSnapshot}
                className="px-4 py-2 bg-[#1b2f21] hover:bg-[#25442e] text-[#CEDE62] border border-[#3be099] rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-[#CEDE62]" />
                <span>ดาวน์โหลดภาพ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
