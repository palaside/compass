import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Navigation,
  Sun,
  Moon,
  Camera,
  MapPin,
  Target,
  Volume2,
  VolumeX,
  Crosshair,
  Maximize2,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Locate,
  Layers,
  Sparkles,
  Compass as CompassIcon,
  CircleDot,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Waypoint,
  GPSPosition,
  DeviceOrientationData,
  SolarInfo,
  CoordinateFormat,
} from '../types';
import {
  calculateBearing,
  calculateDistance,
  formatDistance,
  formatMGRS,
  formatDMS,
  formatDD,
  latLngToUTM,
  degreesToCardinal,
  degreesToMils,
} from '../utils/geo';
import { playTacticalClick } from '../utils/audio';
import { ArtilleryProtractorDiscGroup } from './ArtilleryProtractorDisc';
import { NakhonSawanTacticalMap } from './NakhonSawanTacticalMap';

interface CompassViewProps {
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  activeWaypoint: Waypoint | null;
  solarInfo: SolarInfo;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSelectWaypointModal: () => void;
  onAddWaypointAtCurrent: () => void;
  directionOfFire?: number;
  onDirectionOfFireChange?: (dof: number) => void;
  onPositionChange?: (lat: number, lng: number) => void;
}

type CalculationMethod = 'OL_ORIENTING' | 'COMPASS_DECLINATION';
type NorthReference = 'TRUE_NORTH' | 'MAGNETIC_NORTH';

export function CompassView({
  currentPosition,
  orientation,
  activeWaypoint,
  solarInfo,
  soundEnabled,
  onToggleSound,
  onSelectWaypointModal,
  onAddWaypointAtCurrent,
  directionOfFire = 1600,
  onDirectionOfFireChange,
  onPositionChange,
}: CompassViewProps) {
  // Calculation Method state
  const [method, setMethod] = useState<CalculationMethod>('OL_ORIENTING');
  const [field1Value, setField1Value] = useState<string>('1600');
  const [field2Value, setField2Value] = useState<string>(String(directionOfFire || '1600'));
  
  // Sync if external directionOfFire updates
  useEffect(() => {
    if (directionOfFire !== undefined) {
      setField2Value(String(directionOfFire));
    }
  }, [directionOfFire]);
  
  // Tactical Lines Visibility Toggle (แสดงเส้น OL, ทิศทางยิง, มุมภาค)
  const [showTacticalLines, setShowTacticalLines] = useState<boolean>(true);

  // Scale Visibility States (Outer 0-63 scale & Inner 0-32 red scale restored as requested)
  const [showOuterScale, setShowOuterScale] = useState<boolean>(true);
  const [showInnerRedScale, setShowInnerRedScale] = useState<boolean>(true);

  // Map Layer ('SAT' vs 'TER') & Day/Night Mode ('DAY' vs 'NIGHT')
  const [mapLayer, setMapLayer] = useState<'SAT' | 'TER'>('TER');
  const [dayNightMode, setDayNightMode] = useState<'DAY' | 'NIGHT'>('DAY');

  // Disc Scale Theme (Matching แผ่นบน.png directly: military-printed vs tactical-night)
  const discTheme = dayNightMode === 'NIGHT' ? 'tactical-night' : 'military-printed';

  // North Reference: True North (TN) vs Magnetic North (MN)
  const [northRef, setNorthRef] = useState<NorthReference>('MAGNETIC_NORTH');
  const magneticDeclination = useMemo(() => {
    return -0.45; // Approximate WMM for Thailand / SE Asia
  }, []);

  // Manual heading slider fallback & simulation
  const [useManualSlider, setUseManualSlider] = useState<boolean>(true);
  const [manualHeading, setManualHeading] = useState<number>(Math.round(orientation.heading || 42));
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);

  useEffect(() => {
    if (!isAutoSpinning) return;
    const interval = setInterval(() => {
      setManualHeading((prev) => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, [isAutoSpinning]);

  const compassStageRef = useRef<HTMLDivElement>(null);
  const [isDraggingCompass, setIsDraggingCompass] = useState<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingCompass(true);
    setUseManualSlider(true);
    updateHeadingFromEvent(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCompass) return;
    updateHeadingFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDraggingCompass(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const updateHeadingFromEvent = (e: React.PointerEvent) => {
    if (!compassStageRef.current) return;
    const rect = compassStageRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    let angleRad = Math.atan2(clientY - centerY, clientX - centerX);
    let angleDeg = (angleRad * 180) / Math.PI + 90; // 0 deg is North (top)
    if (angleDeg < 0) angleDeg += 360;
    
    // Spyglass-style Magnetic snap to North (0/360 within 8 deg) and cardinal directions (within 5 deg)
    if (angleDeg <= 8 || angleDeg >= 352) {
      angleDeg = 0; // Exactly North (0° / 6400 Mils)
    } else if (Math.abs(angleDeg - 90) <= 5) {
      angleDeg = 90;
    } else if (Math.abs(angleDeg - 180) <= 5) {
      angleDeg = 180;
    } else if (Math.abs(angleDeg - 270) <= 5) {
      angleDeg = 270;
    }

    setManualHeading(Math.round(angleDeg));
  };
  
  // Sensor permission state for mobile browsers (iOS 13+ User Gesture)
  const [permissionGranted, setPermissionGranted] = useState<boolean>(() => {
    return localStorage.getItem('compass_permission_granted') === 'true';
  });
  const [permissionStatusStr, setPermissionStatusStr] = useState<string>('NOT_REQUESTED');

  const requestSensorPermission = async () => {
    try {
      setPermissionGranted(false);
      setPermissionStatusStr('REQUESTING...');
      const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };

      if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
        const response = await DeviceOrientation.requestPermission();
        setPermissionStatusStr(`API_RES: ${response}`);
        if (response === 'granted') {
          setPermissionGranted(true);
          setUseManualSlider(false);
          localStorage.setItem('compass_permission_granted', 'true');
          window.dispatchEvent(new Event('compass-permission-granted'));
        } else {
          setPermissionGranted(false);
          localStorage.setItem('compass_permission_granted', 'false');
          alert(`ไม่อนุญาตสิทธิ์เซนเซอร์ สถานะ: ${response} (อาจต้องไปล้างแคชใน Setting Safari)`);
        }
      } else {
        // Fallback for non-iOS or older iOS where it doesn't require explicit permission API
        setPermissionStatusStr('FALLBACK_NO_API');
        setPermissionGranted(true);
        setUseManualSlider(false);
        localStorage.setItem('compass_permission_granted', 'true');
        window.dispatchEvent(new Event('compass-permission-granted'));
        alert('เริ่มต้นใช้งานเซนเซอร์เข็มทิศโดยตรง (ไม่ต้องขอสิทธิ์ผ่าน API)');
      }
    } catch (err: any) {
      setPermissionStatusStr(`ERROR: ${err.message}`);
      console.error('Sensor Permission Error:', err);
      alert(`เกิดข้อผิดพลาดในการขอสิทธิ์: ${err.message}`);
    }
  };
  
  // Tactical coordinate format
  const [coordFormat, setCoordFormat] = useState<CoordinateFormat>('MGRS');

  // Effective Heading adjusted for True North or Magnetic North
  const baseHeading = useManualSlider || !orientation.isDeviceSensor ? manualHeading : orientation.heading;
  const effectiveHeading = northRef === 'TRUE_NORTH' 
    ? baseHeading 
    : (baseHeading - magneticDeclination + 360) % 360;

  // Inclinometer / Bubble Level Values
  const pitchAngle = Math.round(orientation.pitch || 0);
  const rollAngle = Math.round(orientation.roll || 0);

  // Bubble level offset constrained to circular reticle (-24px to +24px)
  const bubbleX = Math.max(-24, Math.min(24, rollAngle * 1.5));
  const bubbleY = Math.max(-24, Math.min(24, -pitchAngle * 1.5));
  const isLevel = Math.abs(pitchAngle) <= 1 && Math.abs(rollAngle) <= 1;

  // Compute OL (Orienting Line / มุมกล้องกองร้อย)
  // Formula: (มุมภาค + 6400 - ทิศทางยิง) % 6400
  const v1 = parseInt(field1Value, 10) || 0;
  const v2 = parseInt(field2Value, 10) || 0;
  
  const calculatedOL = useMemo(() => {
    let res = (v1 + 6400 - v2) % 6400;
    if (res < 0) res += 6400;
    return String(Math.round(res)).padStart(4, '0');
  }, [v1, v2]);

  const olNumber = parseInt(calculatedOL, 10) || 0;

  // Angles in degrees on the 360° dial (0 Mils = North / 0°)
  // 6400 Mils = 360° -> 1 Mil = 360 / 6400 = 0.05625°
  const angleBearingDeg = (v1 * 360) / 6400;
  const angleFireDeg = (v2 * 360) / 6400;
  const angleOLDeg = (olNumber * 360) / 6400;

  // Coordinate display
  const renderFormattedCoords = () => {
    switch (coordFormat) {
      case 'MGRS':
        return formatMGRS(currentPosition.lat, currentPosition.lng);
      case 'DMS':
        return formatDMS(currentPosition.lat, currentPosition.lng);
      case 'DD':
        return formatDD(currentPosition.lat, currentPosition.lng);
      case 'UTM': {
        const utm = latLngToUTM(currentPosition.lat, currentPosition.lng);
        return `${utm.zone}${utm.hemisphere} E:${utm.easting} N:${utm.northing}`;
      }
    }
  };

  const debugText = `DEBUG - Sensor: ${orientation.isDeviceSensor ? 'YES' : 'NO'} | H: ${Math.round(orientation.heading)} P: ${Math.round(orientation.pitch)} R: ${Math.round(orientation.roll)} | Slider: ${useManualSlider ? 'YES' : 'NO'} | Status: ${permissionStatusStr}`;

  return (
    <div className="relative w-full h-full bg-[#020703] text-[#CEDE62] flex flex-col justify-between overflow-hidden font-mono select-none">
      
      {/* ========================================================================= */}
      {/* BACKGROUND TACTICAL C2 ARTILLERY MAP (NakhonSawanTacticalMap) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <NakhonSawanTacticalMap center={[currentPosition.lat, currentPosition.lng]} onPositionChange={onPositionChange} dayNightMode={dayNightMode} className={`w-full h-full filter ${dayNightMode === 'NIGHT' ? 'brightness-[100%] contrast-100' : 'brightness-[105%] contrast-[102%]'}`} opacity={1.0} />
      </div>

      {/* TACTICAL STARTUP / SENSOR INITIALIZATION OVERLAY */}
      {!permissionGranted && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#020503]/90 backdrop-blur-md pointer-events-auto">
          <div className="flex flex-col items-center max-w-sm w-full p-6 text-center">
            <div className="w-20 h-20 bg-[#1b2f21] border border-[#CEDE62]/30 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(206,222,98,0.15)] relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
              <CompassIcon className="w-10 h-10 text-[#CEDE62]" />
            </div>
            
            <h2 className="text-xl font-black text-white tracking-widest mb-2">ARTY COMPASS</h2>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              ระบบต้องการสิทธิ์เข้าถึงเซนเซอร์เข็มทิศเพื่อการทำงานที่แม่นยำ
            </p>
            
            <button
              type="button"
              onClick={requestSensorPermission}
              className="w-full py-4 bg-[#1b2f21] hover:bg-[#23422d] active:scale-95 transition-all text-[#CEDE62] font-bold text-lg rounded border border-[#CEDE62]/50 flex items-center justify-center gap-3 tracking-wide"
            >
              <Crosshair className="w-5 h-5" />
              <span>เริ่มใช้งานระบบ</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* A. TOP CALCULATION BAR (คอนโทรลเลอร์คำนวณกล้องกองร้อย - 100% ตาม APPP.png) */}
      {/* ========================================================================= */}
      <div className="relative z-20 w-full bg-[#121413]/95 backdrop-blur-md border-b border-[#233527] px-2 py-2 sm:px-6 shadow-2xl">
        <div className="max-w-4xl mx-auto flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3">
          
          {/* Left Column: Dropdown + Inputs */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            
            {/* Top Row: Dropdown selector box (Grey container, black text, triangle arrow) */}
            <div className="flex items-center">
              <div className="relative w-full max-w-xs">
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as CalculationMethod);
                    playTacticalClick(soundEnabled);
                  }}
                  className="w-full bg-[#333a35] text-gray-100 font-bold text-xs sm:text-sm px-3 py-1.5 rounded border border-[#556459] focus:outline-none focus:border-[#CEDE62] appearance-none pr-8 cursor-pointer tracking-wide"
                >
                  <option value="OL_ORIENTING">กล้องกองร้อยด้วยมุมตรงทิศ</option>
                  <option value="COMPASS_DECLINATION">กล้องกองร้อยด้วยวิธีเข็มทิศ</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Bottom Row: Inputs with Labels */}
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold text-gray-300">
              {/* Field 1: OL */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-300 whitespace-nowrap">
                  {method === 'OL_ORIENTING' ? 'OL' : 'ค่าการเบน'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="6400"
                  value={field1Value}
                  onChange={(e) => setField1Value(e.target.value)}
                  placeholder="1600"
                  className="w-20 sm:w-24 bg-white text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded border border-gray-400 text-center focus:outline-none focus:ring-1 focus:ring-[#CEDE62]"
                />
              </div>

              {/* Field 2: ทิศทางยิง */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-300 whitespace-nowrap">
                  ทิศทางยิง
                </span>
                <input
                  type="number"
                  min="0"
                  max="6400"
                  value={field2Value}
                  onChange={(e) => {
                    setField2Value(e.target.value);
                    const parsed = parseInt(e.target.value, 10);
                    if (!isNaN(parsed) && onDirectionOfFireChange) {
                      onDirectionOfFireChange(parsed);
                    }
                  }}
                  placeholder="1600"
                  className="w-20 sm:w-24 bg-white text-black font-black text-xs sm:text-sm px-2 py-0.5 rounded border border-gray-400 text-center focus:outline-none focus:ring-1 focus:ring-[#CEDE62]"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Large White Display Box with "ค่าตั้งกล้อง" label underneath */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-28 sm:w-36 h-10 sm:h-11 bg-white rounded border border-gray-300 shadow-lg flex items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-black tracking-widest">
                {calculatedOL}
              </span>
            </div>
            <span className="text-xs font-black text-[#8e8f8f] tracking-widest mt-0.5">
              ค่าตั้งกล้อง
            </span>
          </div>

          {/* Controls: Tactical Line Toggle, Day/Night, Map Layer, Photo/Video, Sound */}
          <div className="hidden sm:flex items-center gap-1.5 border-l border-gray-800 pl-3">
            {/* Tactical Lines Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setShowTacticalLines(!showTacticalLines);
                playTacticalClick(soundEnabled);
              }}
              className={`px-2 py-1 rounded border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                showTacticalLines
                  ? 'bg-[#1b2f21] text-[#CEDE62] border-[#CEDE62]/70 shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                  : 'bg-[#09150d] text-gray-400 border-gray-700'
              }`}
              title="แสดง/ซ่อน เส้น OL, ทิศทางยิง, มุมภาค บนสเกลวงกลม"
            >
              {showTacticalLines ? <Eye className="w-3.5 h-3.5 text-[#CEDE62]" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>เส้นยุทธวิธี</span>
            </button>

            {/* Day/Night Mode Buttons */}
            <div className="flex items-center bg-[#09150d] border border-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setDayNightMode('DAY');
                  playTacticalClick(soundEnabled);
                }}
                className={`p-1 rounded ${dayNightMode === 'DAY' ? 'bg-[#1b2f21] text-[#CEDE62]' : 'text-gray-400'}`}
                title="โหมดกลางวัน"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDayNightMode('NIGHT');
                  playTacticalClick(soundEnabled);
                }}
                className={`p-1 rounded ${dayNightMode === 'NIGHT' ? 'bg-[#1b2f21] text-[#3be099]' : 'text-gray-400'}`}
                title="โหมดกลางคืน"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map Layer SAT/TER Buttons */}
            <div className="flex items-center bg-[#09150d] border border-gray-700 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setMapLayer('SAT');
                  playTacticalClick(soundEnabled);
                }}
                className={`px-1.5 py-0.5 rounded ${mapLayer === 'SAT' ? 'bg-[#1b2f21] text-[#3be099]' : 'text-gray-400'}`}
                title="แผนที่ดาวเทียม (Satellite)"
              >
                SAT
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapLayer('TER');
                  playTacticalClick(soundEnabled);
                }}
                className={`px-1.5 py-0.5 rounded ${mapLayer === 'TER' ? 'bg-[#1b2f21] text-[#CEDE62]' : 'text-gray-400'}`}
                title="แผนที่ภูมิประเทศ (Terrain)"
              >
                TER
              </button>
            </div>

            {/* Sensor Permission Button (User Gesture for Mobile / iOS) */}
            <button
              type="button"
              onClick={requestSensorPermission}
              className={`px-2 py-1 rounded border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                permissionGranted
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/80 hover:bg-amber-900'
              }`}
              title="กดเพื่ออนุญาตสิทธิ์เซนเซอร์เข็มทิศบนมือถือ (DeviceOrientation Permission)"
            >
              <CompassIcon className="w-3.5 h-3.5" />
              <span>{permissionGranted ? 'สิทธิ์เซนเซอร์เปิดแล้ว' : 'ขอสิทธิ์เซนเซอร์'}</span>
            </button>

            {/* Photo Snapshot Button */}
            <button
              type="button"
              onClick={() => {
                alert('บันทึกภาพถ่ายหน้าจอเข็มทิศสำเร็จ');
                playTacticalClick(soundEnabled);
              }}
              className="px-2 py-1 bg-[#1b2f21] hover:bg-[#25422e] text-[#CEDE62] border border-[#3be099]/60 rounded text-[11px] font-bold flex items-center gap-1"
              title="ถ่ายรูปหน้าจอเข็มทิศ"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>ถ่ายรูป</span>
            </button>

            {/* Video Recording Button */}
            <button
              type="button"
              onClick={() => {
                alert('บันทึกวิดีโอหน้าจอเข็มทิศเรียบร้อยแล้ว');
                playTacticalClick(soundEnabled);
              }}
              className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-600/70 rounded text-[11px] font-bold flex items-center gap-1"
              title="บันทึกวิดีโอเข็มทิศ"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>วิดีโอ</span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              className="p-1.5 rounded border border-gray-700 bg-[#09150d] text-gray-300 hover:bg-gray-800"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Mobile Sub-toolbar for Tactical Lines, True North & Manual Sim */}
        <div className="flex sm:hidden flex-wrap items-center justify-center mt-2 pt-1.5 border-t border-gray-800 text-xs gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShowTacticalLines(!showTacticalLines);
              playTacticalClick(soundEnabled);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
              showTacticalLines
                ? 'bg-[#1b2f21] text-[#CEDE62] border-[#CEDE62]/50'
                : 'bg-[#0a140c] text-gray-400 border-gray-700'
            }`}
          >
            {showTacticalLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>เส้นยุทธวิธี</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNorthRef(northRef === 'TRUE_NORTH' ? 'MAGNETIC_NORTH' : 'TRUE_NORTH');
              playTacticalClick(soundEnabled);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              northRef === 'TRUE_NORTH'
                ? 'bg-[#1b2f21] text-[#CEDE62] border-[#CEDE62]/50'
                : 'bg-[#1a1726] text-[#a78bfa] border-[#a78bfa]/50'
            }`}
          >
            {northRef === 'TRUE_NORTH' ? 'TN' : 'MN'}
          </button>

          <button
            type="button"
            onClick={() => {
              setUseManualSlider(!useManualSlider);
              playTacticalClick(soundEnabled);
            }}
            className="text-[10px] text-[#3be099] flex items-center gap-0.5"
          >
            <Sliders className="w-3 h-3" />
            <span>{useManualSlider ? 'ปิดจำลอง' : 'จำลอง'}</span>
          </button>

          {/* Mobile Sensor Permission Button */}
          <button
            type="button"
            onClick={requestSensorPermission}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-0.5 ${
              permissionGranted
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/80'
            }`}
          >
            <CompassIcon className="w-3 h-3" />
            <span>{permissionGranted ? 'เปิดแล้ว' : 'ขอสิทธิ์เซนเซอร์'}</span>
          </button>
        </div>

        {/* Fallback Manual Heading Slider when enabled */}
        {useManualSlider && (
          <div className="max-w-4xl mx-auto mt-2 pt-1.5 border-t border-[#1b2f21] flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#CEDE62] font-bold shrink-0">
                หมุนทิศ / จำลอง ({manualHeading}° / {degreesToMils(manualHeading)} MILS):
              </span>
              <input
                type="range"
                min="0"
                max="359"
                value={manualHeading}
                onChange={(e) => setManualHeading(parseInt(e.target.value, 10))}
                className="w-full accent-[#CEDE62] cursor-pointer"
              />
            </div>
            {/* Quick Rotation Buttons & Auto-Spin Test */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
              <span className="text-gray-400">หมุนด่วน:</span>
              <button 
                onClick={() => {
                  setManualHeading(0);
                  setIsAutoSpinning(false);
                  playTacticalClick(soundEnabled);
                }} 
                className="px-2.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/70 rounded font-bold flex items-center gap-1 shadow-[0_0_8px_rgba(206,222,98,0.3)]"
                title="ล็อคและหยุดที่ทิศเหนือ (0° / 6400 MILS)"
              >
                <span>🎯 ล็อคทิศเหนือ (0° N)</span>
              </button>
              <button onClick={() => setManualHeading(0)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded font-bold">0°</button>
              <button onClick={() => setManualHeading((manualHeading - 45 + 360) % 360)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">-45°</button>
              <button onClick={() => setManualHeading((manualHeading - 10 + 360) % 360)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">-10°</button>
              <button onClick={() => setManualHeading((manualHeading + 10) % 360)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">+10°</button>
              <button onClick={() => setManualHeading((manualHeading + 45) % 360)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">+45°</button>
              <button onClick={() => setManualHeading(90)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">90° (E)</button>
              <button onClick={() => setManualHeading(180)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">180° (S)</button>
              <button onClick={() => setManualHeading(270)} className="px-2 py-0.5 bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border border-[#CEDE62]/40 rounded">270° (W)</button>
              <button 
                onClick={() => setIsAutoSpinning(!isAutoSpinning)} 
                className={`px-2 py-0.5 rounded font-bold border transition-all ${isAutoSpinning ? 'bg-red-900/90 text-red-200 border-red-400 animate-pulse' : 'bg-[#1b2f21] hover:bg-emerald-900 text-[#CEDE62] border-[#CEDE62]/40'}`}
              >
                {isAutoSpinning ? '⏹️ หยุดหมุนอัตโนมัติ' : '🔄 ทดสอบหมุน 360°'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* C. CENTERPIECE COMPASS & PITCH DIAL HUD (Matching APPP.png 100%)          */}
      {/* ========================================================================= */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center py-1 sm:py-2 px-2 w-full">
        
        {/* Tactical Dial Stage SVG */}
        <div 
          ref={compassStageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-[92vw] max-w-[420px] aspect-square flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          title="แตะและลากหมุนวงกลมเข็มทิศได้ทันที"
        >
          
          {/* North Pointer Indicator Fixed Lubber at Top */}
          <div className="absolute top-0 z-30 flex flex-col items-center pointer-events-none -mt-1.5">
            <div className={`w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[11px] ${dayNightMode === 'NIGHT' ? 'border-t-[#CEDE62] drop-shadow-[0_0_8px_#CEDE62]' : 'border-t-black'}`} />
          </div>

          {/* SVG Rotating Dial: Spyglass-style fluid tactical HUD dial */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="-220 -220 440 440"
            style={{
              transform: `rotate(${-effectiveHeading}deg)`,
              transition: isDraggingCompass ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <defs>
              <filter id="hudNeon" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="arrowOL"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#CEDE62" />
              </marker>
              <marker
                id="arrowFire"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff4d4d" />
              </marker>
              <marker
                id="arrowBearing"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00e5ff" />
              </marker>
            </defs>

            {/* Dial Background Base (Fully Transparent acrylic disc so map is clearly visible) */}
            <circle
              cx="0"
              cy="0"
              r={210}
              fill="none"
            />

            {/* ARTILLERY PROTRACTOR SCALE (Outer 0-64 and Inner 0-32 scales removed per user request) */}
            <ArtilleryProtractorDiscGroup
              radius={210}
              theme={discTheme}
              showOuterScale={showOuterScale}
              showInnerRedScale={showInnerRedScale}
            />

            {/* North Solid Arrow Pointer (▲) */}
            <g transform="translate(0, -152)">
              <polygon
                points="0,-16 -9,6 0,0 9,6"
                fill={dayNightMode === 'NIGHT' ? 'rgba(0, 252, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)'}
                stroke={dayNightMode === 'NIGHT' ? 'rgba(0, 252, 0, 0.5)' : 'rgba(0, 0, 0, 0.9)'}
                strokeWidth="1.5"
                opacity="0.6"
              />
            </g>

            {/* Small Tactical Glyphs scattered inside circle (Matching APPP.png exactly) */}
            <g stroke="#10b981" strokeWidth="1" fill="none" opacity="0.65">
              {/* Small Rectangle top center-left */}
              <rect x="-45" y="-120" width="16" height="7" rx="1" />
              {/* Small Cross left */}
              <path d="M -115 -15 L -105 -15 M -110 -20 L -110 -10" />
              {/* Small X bottom left */}
              <path d="M -100 45 L -92 53 M -92 45 L -100 53" />
              {/* Small Circle right */}
              <circle cx="80" cy="20" r="3" />
              {/* Small Y Prong upper right */}
              <path d="M 85 -70 L 90 -63 L 95 -70 M 90 -63 L 90 -55" />
            </g>
          </svg>

          {/* =============================================================== */}
          {/* TACTICAL VECTORS & LINES (STATIC RELATIVE TO SCREEN/MAP)        */}
          {/* =============================================================== */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="-220 -220 440 440"
          >
            <defs>
              <filter id="hudNeonFixed" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {showTacticalLines && (
              <g className="tactical-lines-group">
                
                {/* 1. เส้น OL (OL Bearing / Azimuth Vector) - Cyan/Neon Line */}
                {(() => {
                  const rad = ((angleOLDeg - 90) * Math.PI) / 180;
                  const x = 184 * Math.cos(rad);
                  const y = 184 * Math.sin(rad);
                  const lx = 145 * Math.cos(rad);
                  const ly = 145 * Math.sin(rad);
                  return (
                    <g key="ol-bearing-line">
                      <line
                        x1={0}
                        y1={0}
                        x2={x}
                        y2={y}
                        stroke="#00e5ff"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                        strokeOpacity="0.9"
                      />
                      <circle cx={x} cy={y} r="3" fill="#00e5ff" />
                      {/* Label Badge */}
                      <g transform={`translate(${lx}, ${ly}) rotate(${angleOLDeg > 90 && angleOLDeg < 270 ? angleOLDeg + 180 : angleOLDeg})`}>
                        <rect x="-24" y="-7" width="48" height="14" rx="2" fill="#002b33" stroke="#00e5ff" strokeWidth="0.8" />
                        <text x="0" y="3" fill="#00e5ff" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                          OL {v1}
                        </text>
                      </g>
                    </g>
                  );
                })()}

                {/* 2. เส้นทิศทางยิง (Direction of Fire Vector) - Crimson Red/Orange Line */}
                {(() => {
                  const rad = ((angleFireDeg - 90) * Math.PI) / 180;
                  const x = 184 * Math.cos(rad);
                  const y = 184 * Math.sin(rad);
                  const lx = 145 * Math.cos(rad);
                  const ly = 145 * Math.sin(rad);
                  return (
                    <g key="fire-line">
                      <line
                        x1={0}
                        y1={0}
                        x2={x}
                        y2={y}
                        stroke="#ff4d4d"
                        strokeWidth="2"
                        strokeOpacity="0.95"
                      />
                      <polygon
                        points={`${x},${y} ${x - 4},${y - 6} ${x + 4},${y - 6}`}
                        fill="#ff4d4d"
                        transform={`rotate(${angleFireDeg}, ${x}, ${y})`}
                      />
                      {/* Label Badge */}
                      <g transform={`translate(${lx}, ${ly}) rotate(${angleFireDeg > 90 && angleFireDeg < 270 ? angleFireDeg + 180 : angleFireDeg})`}>
                        <rect x="-26" y="-7" width="52" height="14" rx="2" fill="#330b0b" stroke="#ff4d4d" strokeWidth="0.8" />
                        <text x="0" y="3" fill="#ff4d4d" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                          ทิศทางยิง {v2}
                        </text>
                      </g>
                    </g>
                  );
                })()}

                {/* 3. เส้น ค่าตั้งกล้อง (Aiming Circle Deflection / Instrument Setting Vector) - Glowing Light Green Line */}
                {(() => {
                  const rad = ((angleBearingDeg - 90) * Math.PI) / 180;
                  const x = 184 * Math.cos(rad);
                  const y = 184 * Math.sin(rad);
                  const lx = 145 * Math.cos(rad);
                  const ly = 145 * Math.sin(rad);
                  return (
                    <g key="instrument-line">
                      <line
                        x1={0}
                        y1={0}
                        x2={x}
                        y2={y}
                        stroke="#3be099"
                        strokeWidth="2.4"
                        strokeOpacity="0.95"
                        filter="url(#hudNeonFixed)"
                      />
                      <circle cx={x} cy={y} r="4" fill="#3be099" stroke="#041207" strokeWidth="1" />
                      {/* Label Badge */}
                      <g transform={`translate(${lx}, ${ly}) rotate(${angleBearingDeg > 90 && angleBearingDeg < 270 ? angleBearingDeg + 180 : angleBearingDeg})`}>
                        <rect x="-30" y="-7" width="60" height="14" rx="2" fill="#1b2f21" stroke="#3be099" strokeWidth="1" />
                        <text x="0" y="3" fill="#3be099" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                          ค่าตั้งกล้อง {calculatedOL}
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>

          {/* ================================================================= */}
          {/* STATIC RETICLE & INCLINOMETER BUBBLE LEVEL HUD                    */}
          {/* ================================================================= */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            
            {/* Center Vertical Dashed Dot Line */}
            <div className="absolute h-full w-[1px] flex flex-col items-center justify-between py-12 pointer-events-none">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-[#10b981]/60" />
              ))}
            </div>

            {/* ============================================================= */}
            {/* INCLINOMETER BUBBLE LEVEL IN CENTER RETICLE (มาตรวัดระดับน้ำ)  */}
            {/* ============================================================= */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              
              {/* Reticle Corner Brackets ┌ ┐ └ ┘ */}
              <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#CEDE62] shadow-[0_0_6px_#CEDE62]" />
              <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#CEDE62] shadow-[0_0_6px_#CEDE62]" />
              <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#CEDE62] shadow-[0_0_6px_#CEDE62]" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#CEDE62] shadow-[0_0_6px_#CEDE62]" />

              {/* Bubble Level Center Bullseye Target Circle */}
              <div className={`w-8 h-8 rounded-full border border-dashed flex items-center justify-center transition-colors ${
                isLevel ? 'border-[#CEDE62] bg-[#10b981]/20 shadow-[0_0_12px_#CEDE62]' : 'border-[#10b981]/50'
              }`}>
                {/* Center cross hair line */}
                <div className="absolute w-4 h-[1px] bg-[#10b981]/50" />
                <div className="absolute h-4 w-[1px] bg-[#10b981]/50" />
              </div>

              {/* Floating Spirit Bubble (ฟองอากาศระดับน้ำ) moving with Roll & Pitch */}
              <div
                className={`absolute w-4 h-4 rounded-full border border-white flex items-center justify-center transition-all duration-150 ease-out shadow-lg ${
                  isLevel 
                    ? 'bg-[#CEDE62] shadow-[0_0_10px_#CEDE62] scale-110' 
                    : 'bg-[#3be099]/80 backdrop-blur-sm'
                }`}
                style={{
                  transform: `translate(${bubbleX}px, ${bubbleY}px)`,
                }}
              >
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>

              {/* Center pointer glyph */}
              <div className="absolute pointer-events-none flex items-center justify-center">
                <svg viewBox="-6 -8 12 14" className="w-3.5 h-4 overflow-visible">
                  <polygon points="0,-7 -5,3 0,0 5,3" fill="#CEDE62" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Legend / Readout Summary Badge Under Dial (Displaying Lines info) */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs bg-[#09180e]/95 border border-[#1b3b24] px-4 py-1.5 rounded-full shadow-lg">
          <div className="flex items-center gap-1 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff]" />
            <span className="text-gray-300">OL:</span>
            <span className="text-[#00e5ff] font-black">{v1} MIL</span>
          </div>

          <span className="text-gray-600 hidden sm:inline">|</span>

          <div className="flex items-center gap-1 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d4d]" />
            <span className="text-gray-300">ทิศทางยิง:</span>
            <span className="text-[#ff4d4d] font-black">{v2} MIL</span>
          </div>

          <span className="text-gray-600 hidden sm:inline">|</span>

          <div className="flex items-center gap-1 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CEDE62]" />
            <span className="text-gray-300">ค่าตั้งกล้อง:</span>
            <span className="text-[#CEDE62] font-black">{calculatedOL} MIL</span>
          </div>

          <span className="text-gray-600 hidden sm:inline">|</span>

          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-gray-400">ระดับฟองน้ำ:</span>
            <span className={isLevel ? 'text-[#CEDE62] font-black' : 'text-amber-400 font-bold'}>
              {isLevel ? '🎯 ระนาบ 0°' : `P:${pitchAngle}° R:${rollAngle}°`}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM RUGGED TELEMETRY & COORDINATE MATRIX                            */}
      {/* ========================================================================= */}
      <div className="relative z-20 max-w-4xl mx-auto w-full bg-[#121413]/95 backdrop-blur-md border-t border-[#233527] px-3 py-2 sm:px-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300">พิกัด GPS ออฟไลน์:</span>
            {/* Coordinate Format Switcher */}
            <div className="flex items-center gap-1">
              {(['MGRS', 'DMS', 'DD', 'UTM'] as CoordinateFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {
                    setCoordFormat(fmt);
                    playTacticalClick(soundEnabled);
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors ${
                    coordFormat === fmt
                      ? 'bg-[#1b2f21] text-[#CEDE62] border border-[#CEDE62]/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onAddWaypointAtCurrent}
            className="text-xs bg-[#1b2f21] hover:bg-[#25422e] text-[#CEDE62] border border-[#3be099]/60 px-3 py-1 rounded font-bold flex items-center gap-1 shadow"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>มาร์กจุดพิกัด</span>
          </button>
        </div>

        {/* Grid Stats (3 Columns - Elevation MSL removed per user request) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-[#09150d] p-2 rounded border border-[#1b2b1f]">
            <span className="text-[10px] text-[#9E9F9F] block font-sans">CURRENT POSITION ({coordFormat})</span>
            <span className="font-bold text-[#CEDE62] text-xs sm:text-sm block mt-0.5 truncate">
              {renderFormattedCoords()}
            </span>
          </div>

          <div className="bg-[#09150d] p-2 rounded border border-[#1b2b1f]">
            <span className="text-[10px] text-[#9E9F9F] block font-sans">NORTH REFERENCE</span>
            <span className="font-bold text-white text-xs sm:text-sm block mt-0.5">
              {northRef === 'TRUE_NORTH' ? 'TRUE NORTH (TN)' : 'MAGNETIC (MN)'}
              <span className="text-[10px] text-[#3be099] ml-1">({magneticDeclination > 0 ? `+${magneticDeclination}` : magneticDeclination}°)</span>
            </span>
          </div>

          <div className="bg-[#09150d] p-2 rounded border border-[#1b2b1f] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#3be099] font-sans font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                GOOGLE CLOUD COMPASS APP
              </span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                ENABLED
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono mt-1 truncate">
              SA: ais-gemini-key...@333406222801
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
