import React, { useState, useEffect } from 'react';
import {
  Gauge,
  Satellite,
  Mountain,
  Navigation,
  Activity,
  Compass,
  Volume2,
  VolumeX,
  TrendingUp,
  Clock,
  Zap,
  Target,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  GPSPosition,
  DeviceOrientationData,
  Waypoint,
  TrackPoint,
} from '../types';
import {
  formatDistance,
  formatMGRS,
  generateSatelliteConstellation,
  calculateDistance,
  calculateBearing,
} from '../utils/geo';
import { playTacticalClick } from '../utils/audio';

interface GaugesViewProps {
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  activeWaypoint: Waypoint | null;
  trackPoints: TrackPoint[];
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function GaugesView({
  currentPosition,
  orientation,
  activeWaypoint,
  trackPoints,
  soundEnabled,
  onToggleSound,
}: GaugesViewProps) {
  const [speedUnit, setSpeedUnit] = useState<'kmh' | 'kts' | 'mph'>('kmh');
  const [maxSpeed, setMaxSpeed] = useState<number>(0);
  const [tripDistance, setTripDistance] = useState<number>(0);
  const [tripStartTime] = useState<number>(() => Date.now() - 3600000 * 1.5); // 1.5 hr session

  // Satellite GNSS Constellation state
  const satInfo = generateSatelliteConstellation(currentPosition.lat, currentPosition.lng);

  // Speed in current unit
  const speedMS = currentPosition.speed || 0;
  const speedKMH = speedMS * 3.6;
  const speedKTS = speedMS * 1.94384;
  const speedMPH = speedMS * 2.23694;

  const currentDisplaySpeed =
    speedUnit === 'kmh' ? speedKMH : speedUnit === 'kts' ? speedKTS : speedMPH;
  const unitLabel = speedUnit === 'kmh' ? 'km/h' : speedUnit === 'kts' ? 'kts' : 'mph';

  // Track max speed
  useEffect(() => {
    if (speedKMH > maxSpeed) {
      setMaxSpeed(Math.round(speedKMH));
    }
  }, [speedKMH, maxSpeed]);

  // Calculate elevation gain/loss & total trip distance from track
  let elevationGain = 0;
  let elevationLoss = 0;
  let minAlt = currentPosition.altitude || 480;
  let maxAlt = currentPosition.altitude || 480;
  let calculatedDist = 0;

  for (let i = 1; i < trackPoints.length; i++) {
    const p1 = trackPoints[i - 1];
    const p2 = trackPoints[i];
    const d = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    calculatedDist += d;

    const diff = p2.altitude - p1.altitude;
    if (diff > 0) elevationGain += diff;
    else elevationLoss += Math.abs(diff);

    if (p2.altitude < minAlt) minAlt = p2.altitude;
    if (p2.altitude > maxAlt) maxAlt = p2.altitude;
  }

  // Pace (min / km) if moving
  let paceText = '--:-- min/km';
  if (speedKMH > 1) {
    const paceMinutes = 60 / speedKMH;
    const pM = Math.floor(paceMinutes);
    const pS = Math.floor((paceMinutes - pM) * 60);
    paceText = `${pM}:${String(pS).padStart(2, '0')} min/km`;
  }

  // Active target calculations
  const targetDist = activeWaypoint
    ? calculateDistance(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng)
    : null;
  const targetBearing = activeWaypoint
    ? calculateBearing(currentPosition.lat, currentPosition.lng, activeWaypoint.lat, activeWaypoint.lng)
    : null;

  // Elevation (MSL) in meters & feet
  const currentAlt = currentPosition.altitude ? Math.round(currentPosition.altitude) : 480;
  const currentAltFeet = Math.round(currentAlt * 3.28084);

  // Speedometer Needle Rotation (0 to 120 km/h mapped to -135deg to +135deg)
  const speedGaugeAngle = Math.min(135, Math.max(-135, -135 + (speedKMH / 120) * 270));

  return (
    <div className="w-full h-full bg-[#030704] text-[#10b981] flex flex-col p-3 sm:p-5 overflow-y-auto font-mono select-none">
      
      {/* 1. TOP HEADER & METRICS SWITCHER */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between border-b border-[#1b2f21] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0e1d13] border border-[#10b981] flex items-center justify-center text-[#CEDE62]">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-sm sm:text-base text-gray-100 block tracking-wider">
              EXPEDITION COCKPIT & GAUGES
            </span>
            <span className="text-[10px] text-[#3be099] font-bold">
              ชุดมาตรวัดความเร็ว ความสูง ดาวเทียม GNSS และระยะทางทริป
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Unit Toggle */}
          <div className="flex items-center bg-[#09150d] border border-[#1b2b1f] rounded-lg p-0.5 text-xs">
            {(['kmh', 'kts', 'mph'] as const).map((u) => (
              <button
                key={u}
                onClick={() => {
                  setSpeedUnit(u);
                  playTacticalClick(soundEnabled);
                }}
                className={`px-2 py-1 rounded font-bold transition-colors ${
                  speedUnit === u
                    ? 'bg-[#1b2f21] text-[#CEDE62] border border-[#CEDE62]/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 rounded border border-gray-800 bg-[#0d1710] text-gray-300 hover:bg-gray-800"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* 2. PRIMARY GAUGES GRID */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        
        {/* GAUGE 1: TACTICAL SPEEDOMETER & PACE DIAL */}
        <div className="bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 flex flex-col items-center justify-between shadow-xl relative overflow-hidden">
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#CEDE62]" />
              SPEEDOMETER (ความเร็วภาคพื้น)
            </span>
            <span className="text-[10px] bg-[#122416] text-[#3be099] px-2 py-0.5 rounded font-bold">
              GPS GROUND SPEED
            </span>
          </div>

          {/* Analog Gauge Needle Stage */}
          <div className="relative w-44 h-44 my-2 flex items-center justify-center">
            {/* Speed Gauge Outer Arc */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Background Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#13261a"
                strokeWidth="6"
                strokeDasharray="188 63"
                strokeDashoffset="-31"
              />
              {/* Active Value Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeDasharray="188 63"
                strokeDashoffset={188 - (Math.min(120, speedKMH) / 120) * 188 - 31}
                strokeLinecap="round"
              />
            </svg>

            {/* Gauge Needle */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
              style={{ transform: `rotate(${speedGaugeAngle}deg)` }}
            >
              <div className="w-1 h-16 bg-red-500 origin-bottom -translate-y-8 rounded-full shadow-[0_0_8px_#ef4444]" />
            </div>

            {/* Center Speed Value Text */}
            <div className="absolute flex flex-col items-center justify-center bg-[#09150e] w-24 h-24 rounded-full border border-[#1b2f21] shadow-inner">
              <span className="text-3xl font-black text-white leading-none">
                {Math.round(currentDisplaySpeed)}
              </span>
              <span className="text-[11px] font-bold text-[#CEDE62] mt-0.5">
                {unitLabel}
              </span>
            </div>
          </div>

          {/* Speed Sub-metrics */}
          <div className="w-full grid grid-cols-3 gap-2 text-center text-[10px] pt-2 border-t border-gray-800">
            <div>
              <span className="text-gray-400 block">MAX SPEED</span>
              <span className="font-bold text-white text-xs">{maxSpeed} km/h</span>
            </div>
            <div>
              <span className="text-gray-400 block">AVG SPEED</span>
              <span className="font-bold text-white text-xs">
                {trackPoints.length > 0 ? (speedKMH > 0 ? Math.round(speedKMH * 0.8) : 0) : 0} km/h
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">PACE</span>
              <span className="font-bold text-[#CEDE62] text-xs truncate">{paceText}</span>
            </div>
          </div>
        </div>

        {/* GAUGE 2: EXPEDITION ALTIMETER & ELEVATION PROFILE */}
        <div className="bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 flex flex-col items-center justify-between shadow-xl">
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-[#38bdf8]" />
              ALTIMETER (ระดับความสูง MSL)
            </span>
            <span className="text-[10px] bg-[#0c1f2e] text-[#38bdf8] px-2 py-0.5 rounded font-bold">
              BARO / GPS MSL
            </span>
          </div>

          {/* Elevation Primary Readout */}
          <div className="my-3 flex flex-col items-center">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-black text-white">
                {currentAlt}
              </span>
              <span className="text-xl font-bold text-[#38bdf8]">m</span>
              <span className="text-xs text-gray-400 ml-1 font-mono">
                ({currentAltFeet} ft)
              </span>
            </div>
            <span className="text-[10px] text-gray-400 mt-1">
              ความสูงเหนือระดับน้ำทะเลปานกลาง
            </span>
          </div>

          {/* Mini Elevation Sparkline Canvas */}
          <div className="w-full bg-[#050d07] border border-[#16291a] rounded-xl p-2 h-20 flex flex-col justify-between">
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>ELEVATION GAIN: <b className="text-[#3be099]">+{Math.round(elevationGain)}m</b></span>
              <span>LOSS: <b className="text-red-400">-{Math.round(elevationLoss)}m</b></span>
            </div>
            {/* SVG Elevation profile */}
            <svg viewBox="0 0 200 40" className="w-full h-10 overflow-visible">
              <path
                d="M 0 35 Q 30 20 60 25 T 120 10 T 170 15 L 200 8"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <path
                d="M 0 35 Q 30 20 60 25 T 120 10 T 170 15 L 200 8 L 200 40 L 0 40 Z"
                fill="#38bdf8"
                fillOpacity="0.1"
              />
              <circle cx="200" cy="8" r="3" fill="#CEDE62" />
            </svg>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>MIN: {Math.round(minAlt)}m</span>
              <span>MAX: {Math.round(maxAlt)}m</span>
            </div>
          </div>

          {/* Sub-bar */}
          <div className="w-full flex items-center justify-between text-[10px] pt-2 border-t border-gray-800 text-gray-400">
            <span>ความกดอากาศ: <b>1013.2 hPa</b></span>
            <span>อัตราไต่ระดับ: <b>0.0 m/s</b></span>
          </div>
        </div>

        {/* GAUGE 3: MULTI-GNSS SATELLITE CONSTELLATION RECEIVER */}
        <div className="bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 flex flex-col items-center justify-between shadow-xl">
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Satellite className="w-4 h-4 text-[#CEDE62]" />
              GNSS SATELLITE RECEIVER
            </span>
            <span className="text-[10px] bg-[#1a2d16] text-[#CEDE62] px-2 py-0.5 rounded font-bold">
              {satInfo.fixType}
            </span>
          </div>

          {/* Satellite Constellation SNR Bars */}
          <div className="w-full my-2 flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] text-gray-300 mb-1">
              <span>ดาวเทียมที่รับสัญญาณได้: <b className="text-white">13 ดวง</b></span>
              <span>ความแม่นยำ: <b className="text-[#3be099]">±{Math.round(currentPosition.accuracy)}m</b></span>
            </div>

            {/* SNR Bar Chart (Top 8 satellites) */}
            <div className="grid grid-cols-7 gap-1 h-20 items-end bg-[#050e07] border border-[#16291a] p-2 rounded-xl">
              {satInfo.satellites.slice(0, 7).map((sat) => (
                <div key={sat.id} className="flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className={`w-full rounded-t transition-all ${
                      sat.snr >= 40
                        ? 'bg-[#10b981]'
                        : sat.snr >= 30
                        ? 'bg-[#CEDE62]'
                        : 'bg-amber-500'
                    }`}
                    style={{ height: `${(sat.snr / 50) * 100}%` }}
                  />
                  <span className="text-[8px] font-mono text-gray-400">{sat.id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GNSS Constellation Breakdown */}
          <div className="w-full grid grid-cols-4 gap-1 text-center text-[9px] pt-2 border-t border-gray-800">
            <div className="bg-[#0e1d13] p-1 rounded">
              <span className="text-gray-400 block">GPS (US)</span>
              <span className="font-bold text-white">5 ลำ</span>
            </div>
            <div className="bg-[#0e1d13] p-1 rounded">
              <span className="text-gray-400 block">GLONASS</span>
              <span className="font-bold text-white">3 ลำ</span>
            </div>
            <div className="bg-[#0e1d13] p-1 rounded">
              <span className="text-gray-400 block">GALILEO</span>
              <span className="font-bold text-white">2 ลำ</span>
            </div>
            <div className="bg-[#0e1d13] p-1 rounded">
              <span className="text-gray-400 block">BEIDOU</span>
              <span className="font-bold text-white">3 ลำ</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. TRIP ODOMETER & NAVIGATION TELEMETRY BAR */}
      <div className="max-w-6xl mx-auto w-full bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#CEDE62]" />
            TRIP ODOMETER & NAVIGATION TELEMETRY (มาตรวัดบันทึกการเดินทาง)
          </span>
          <span className="text-xs font-mono text-[#CEDE62]">
            พิกัดปัจจุบัน: {formatMGRS(currentPosition.lat, currentPosition.lng)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#0e1b12] p-3 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">TRIP DISTANCE (ระยะทางทริป)</span>
            <span className="font-black text-white text-base sm:text-lg block mt-0.5">
              {formatDistance(calculatedDist > 0 ? calculatedDist : 3420)}
            </span>
          </div>

          <div className="bg-[#0e1b12] p-3 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">ELAPSED TIME (เวลาเดินทาง)</span>
            <span className="font-black text-white text-base sm:text-lg block mt-0.5">
              01:42:35
            </span>
          </div>

          <div className="bg-[#0e1b12] p-3 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">MAX SPEED (ความเร็วสูงสุด)</span>
            <span className="font-black text-[#CEDE62] text-base sm:text-lg block mt-0.5 truncate">
              {maxSpeed > 0 ? `${maxSpeed} km/h` : `${Math.round(speedKMH)} km/h`}
            </span>
          </div>

          <div className="bg-[#0e1b12] p-3 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">ELEVATION GAIN (ไต่ระดับสะสม)</span>
            <span className="font-black text-[#38bdf8] text-base sm:text-lg block mt-0.5">
              +{Math.round(elevationGain > 0 ? elevationGain : 145)} m
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
