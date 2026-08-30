import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  Compass,
  CheckCircle2,
  AlertCircle,
  Sliders,
  RotateCcw,
  Volume2,
  VolumeX,
  Target,
  Eye,
  Info,
  Clock,
} from 'lucide-react';
import {
  GPSPosition,
  DeviceOrientationData,
  SolarInfo,
} from '../types';
import {
  getSolarPosition,
  getMoonPosition,
  getPolarisPosition,
  getMagneticDeclination,
  degreesToCardinal,
  degreesToMils,
} from '../utils/geo';
import { playTacticalClick, playWaypointMarkedChime } from '../utils/audio';

interface CelestialFinderViewProps {
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  solarInfo: SolarInfo;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onApplyCompassOffset: (offset: number) => void;
}

export function CelestialFinderView({
  currentPosition,
  orientation,
  solarInfo,
  soundEnabled,
  onToggleSound,
  onApplyCompassOffset,
}: CelestialFinderViewProps) {
  const [selectedBody, setSelectedBody] = useState<'sun' | 'moon' | 'polaris'>('sun');
  const [calibrationSuccessMsg, setCalibrationSuccessMsg] = useState<string | null>(null);

  const moonInfo = getMoonPosition(currentPosition.lat, currentPosition.lng);
  const polarisInfo = getPolarisPosition(currentPosition.lat, currentPosition.lng);
  const estimatedDeclination = getMagneticDeclination(currentPosition.lat, currentPosition.lng);

  // Active target body
  const activeBody =
    selectedBody === 'sun'
      ? {
          name: 'ดวงอาทิตย์ (The Sun)',
          azimuth: solarInfo.azimuth,
          altitude: solarInfo.altitude,
          icon: <Sun className="w-6 h-6 text-amber-400 animate-pulse" />,
          color: '#f59e0b',
          timeInfo: `ขึ้น ${solarInfo.sunrise} • ตก ${solarInfo.sunset}`,
          subInfo: `Golden Hour: ${solarInfo.goldenHour}`,
          isVisible: solarInfo.isDaytime,
          methodDesc: 'ใช้เงาแดดหรือเล็งตรงดวงอาทิตย์เพื่อปรับเทียบมุมทิศเหนือจริง',
        }
      : selectedBody === 'moon'
      ? {
          name: `ดวงจันทร์ (${moonInfo.phaseName})`,
          azimuth: moonInfo.azimuth,
          altitude: moonInfo.altitude,
          icon: <span className="text-2xl">{moonInfo.phaseIcon}</span>,
          color: '#38bdf8',
          timeInfo: `สว่าง ${moonInfo.illumination}% • ขึ้น ${moonInfo.moonrise} • ตก ${moonInfo.moonset}`,
          subInfo: `ข้างขึ้น-ข้างแรม: ${(moonInfo.phase * 100).toFixed(0)}%`,
          isVisible: moonInfo.altitude > 0,
          methodDesc: 'เล็งกึ่งกลางดวงจันทร์ยามค่ำคืนเพื่อเทียบทิศทางดาราศาสตร์',
        }
      : {
          name: 'ดาวเหนือ (Polaris / North Star)',
          azimuth: polarisInfo.azimuth,
          altitude: polarisInfo.altitude,
          icon: <Sparkles className="w-6 h-6 text-yellow-300 animate-spin" />,
          color: '#fde047',
          timeInfo: `ทิศเหนือจริง 000° (True North) • ${polarisInfo.constellation}`,
          subInfo: `มุมเงยดาวเหนือ = ละติจูด (${polarisInfo.altitude}°)`,
          isVisible: !solarInfo.isDaytime && polarisInfo.isVisible,
          methodDesc: 'ดาวเหนืออยู่ตรงจุดขั้วฟ้าเหนือพอดี ให้ค่าทิศเหนือจริงแม่นยำ 100%',
        };

  // Heading deviation relative to selected celestial body
  const headingDiff = ((activeBody.azimuth - orientation.heading + 540) % 360) - 180;
  const isAlignedWithBody = Math.abs(headingDiff) <= 4;

  // Calibrate Compass based on Celestial Alignment
  const handleCalibrateNow = () => {
    // Offset = True Azimuth - Device Heading
    const offset = Math.round(((activeBody.azimuth - orientation.heading + 540) % 360) - 180);
    onApplyCompassOffset(offset);
    playWaypointMarkedChime(soundEnabled);
    setCalibrationSuccessMsg(`ปรับเทียบสำเร็จ! ชดเชยมุมแม่เหล็ก ${offset > 0 ? `+${offset}` : offset}° อ้างอิงจาก ${activeBody.name}`);
    setTimeout(() => setCalibrationSuccessMsg(null), 4000);
  };

  const handleResetCalibration = () => {
    onApplyCompassOffset(0);
    playTacticalClick(soundEnabled);
    setCalibrationSuccessMsg('รีเซ็ตการปรับเทียบเข็มทิศเป็นค่าเซนเซอร์มาตรฐาน');
    setTimeout(() => setCalibrationSuccessMsg(null), 3000);
  };

  return (
    <div className="w-full h-full bg-[#030704] text-[#10b981] flex flex-col justify-between p-3 sm:p-5 overflow-y-auto font-mono select-none">
      
      {/* 1. TOP HEADER */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-[#1b2b1f] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0e1d13] border border-[#10b981] flex items-center justify-center text-[#CEDE62]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-sm sm:text-base text-gray-100 block tracking-wider">
              CELESTIAL FINDER & TRUE NORTH CALIBRATION
            </span>
            <span className="text-[10px] text-[#3be099] font-bold">
              ตัวค้นหาดวงดาวและปรับเทียบเข็มทิศด้วยวัตถุท้องฟ้า
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 rounded border border-gray-800 bg-[#0d1710] text-gray-300 hover:bg-gray-800"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* 2. CELESTIAL TARGET SELECTOR TABS */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-3 gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setSelectedBody('sun');
            playTacticalClick(soundEnabled);
          }}
          className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
            selectedBody === 'sun'
              ? 'bg-[#1b2f21] border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#08120b] border-[#182a1c] text-gray-400 hover:bg-[#0e1c12]'
          }`}
        >
          <Sun className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-xs">ดวงอาทิตย์ (Sun)</span>
          <span className="text-[10px] text-gray-400">{Math.round(solarInfo.azimuth)}° • สูง {solarInfo.altitude}°</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedBody('moon');
            playTacticalClick(soundEnabled);
          }}
          className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
            selectedBody === 'moon'
              ? 'bg-[#1b2f21] border-[#38bdf8] text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
              : 'bg-[#08120b] border-[#182a1c] text-gray-400 hover:bg-[#0e1c12]'
          }`}
        >
          <Moon className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-xs">ดวงจันทร์ (Moon)</span>
          <span className="text-[10px] text-gray-400">{Math.round(moonInfo.azimuth)}° • สว่าง {moonInfo.illumination}%</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedBody('polaris');
            playTacticalClick(soundEnabled);
          }}
          className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
            selectedBody === 'polaris'
              ? 'bg-[#1b2f21] border-yellow-400 text-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.25)]'
              : 'bg-[#08120b] border-[#182a1c] text-gray-400 hover:bg-[#0e1c12]'
          }`}
        >
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span className="font-bold text-xs">ดาวเหนือ (Polaris)</span>
          <span className="text-[10px] text-gray-400">ทิศเหนือจริง 000° • สูง {polarisInfo.altitude}°</span>
        </button>
      </div>

      {/* 3. CELESTIAL SKY DOME & RADAR HUD */}
      <div className="max-w-4xl mx-auto w-full bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 sm:p-5 flex flex-col items-center shadow-2xl mb-4 relative">
        
        {/* Active Body Badge */}
        <div className="w-full flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            {activeBody.icon}
            <div>
              <span className="font-black text-white text-sm sm:text-base block">
                {activeBody.name}
              </span>
              <span className="text-[11px] text-gray-400">
                {activeBody.timeInfo}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 block">มุมทิศดาราศาสตร์ (Azimuth)</span>
            <span className="text-lg font-black text-[#CEDE62]">
              {Math.round(activeBody.azimuth)}° ({degreesToCardinal(activeBody.azimuth)})
            </span>
          </div>
        </div>

        {/* 2D Celestial Sky Polar Dome (90° zenith center to 0° horizon outer ring) */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-2">
          {/* Outer Compass Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-[#10b981]/50 bg-[#050c07] shadow-inner flex items-center justify-center">
            {/* Concentric Altitude Rings (30°, 60°, 90° Zenith) */}
            <div className="absolute inset-6 rounded-full border border-dashed border-[#10b981]/25" />
            <div className="absolute inset-16 rounded-full border border-dashed border-[#10b981]/35" />
            <div className="absolute w-2 h-2 rounded-full bg-[#10b981]" />

            {/* Cardinals on Sky Dome */}
            <span className="absolute top-2 font-bold text-xs text-red-500">N (0°)</span>
            <span className="absolute right-2 font-bold text-xs text-[#CEDE62]">E (90°)</span>
            <span className="absolute bottom-2 font-bold text-xs text-[#CEDE62]">S (180°)</span>
            <span className="absolute left-2 font-bold text-xs text-[#CEDE62]">W (270°)</span>

            {/* Sun Marker on Polar Dome */}
            <div
              className="absolute inset-0 flex justify-center pointer-events-none transition-transform"
              style={{ transform: `rotate(${solarInfo.azimuth}deg)` }}
            >
              <div
                className="flex flex-col items-center mt-3"
                style={{
                  transform: `translateY(${((90 - Math.max(0, solarInfo.altitude)) / 90) * 105}px)`,
                }}
              >
                <Sun className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_#f59e0b]" />
                <span className="text-[8px] bg-black/80 text-amber-300 px-1 rounded font-bold">SUN</span>
              </div>
            </div>

            {/* Moon Marker on Polar Dome */}
            <div
              className="absolute inset-0 flex justify-center pointer-events-none transition-transform"
              style={{ transform: `rotate(${moonInfo.azimuth}deg)` }}
            >
              <div
                className="flex flex-col items-center mt-3"
                style={{
                  transform: `translateY(${((90 - Math.max(0, moonInfo.altitude)) / 90) * 105}px)`,
                }}
              >
                <span className="text-xs">{moonInfo.phaseIcon}</span>
                <span className="text-[8px] bg-black/80 text-sky-300 px-1 rounded font-bold">MOON</span>
              </div>
            </div>

            {/* Polaris Marker on Polar Dome (Near true north) */}
            {polarisInfo.isVisible && (
              <div
                className="absolute inset-0 flex justify-center pointer-events-none"
                style={{ transform: `rotate(0deg)` }}
              >
                <div
                  className="flex flex-col items-center mt-3"
                  style={{
                    transform: `translateY(${((90 - polarisInfo.altitude) / 90) * 105}px)`,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 drop-shadow-[0_0_8px_#fde047]" />
                  <span className="text-[8px] bg-black/80 text-yellow-300 px-1 rounded font-bold">POLARIS</span>
                </div>
              </div>
            )}

            {/* Current Device Pointing Reticle Line */}
            <div
              className="absolute inset-0 flex justify-center pointer-events-none transition-transform duration-75"
              style={{ transform: `rotate(${orientation.heading}deg)` }}
            >
              <div className="w-0.5 h-full bg-[#3be099]/80 shadow-[0_0_8px_#3be099]" />
              <div className="absolute top-0 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
            </div>
          </div>
        </div>

        {/* Alignment Guidance Callout */}
        <div className="mt-2 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold">
            <span className="text-gray-300">ทิศทางเครื่อง: <b className="text-white">{Math.round(orientation.heading)}°</b></span>
            <span className="text-gray-500">•</span>
            <span className="text-[#CEDE62]">
              {isAlignedWithBody
                ? '🎯 ตรงตำแหน่งวัตถุท้องฟ้าพอดี'
                : `หัน${headingDiff > 0 ? 'ขวา' : 'ซ้าย'}อีก ${Math.round(Math.abs(headingDiff))}° เพื่อเล็งตรง`}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 max-w-lg mx-auto">
            {activeBody.methodDesc}
          </p>
        </div>

        {/* Action Button: One-Click Celestial True North Calibration */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCalibrateNow}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl transition-all ${
              isAlignedWithBody
                ? 'bg-[#CEDE62] text-black hover:bg-yellow-300 shadow-[0_0_20px_rgba(206,222,98,0.4)]'
                : 'bg-[#1b2f21] hover:bg-[#25422e] text-[#CEDE62] border border-[#3be099]/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ปรับเทียบเข็มทิศด้วย {activeBody.name.split(' ')[0]} (Calibrate True North)</span>
          </button>

          {orientation.compassOffset && orientation.compassOffset !== 0 ? (
            <button
              type="button"
              onClick={handleResetCalibration}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              รีเซ็ตค่าชดเชย
            </button>
          ) : null}
        </div>

        {calibrationSuccessMsg && (
          <div className="mt-3 text-xs bg-[#122b19] border border-[#10b981] text-[#CEDE62] px-4 py-2 rounded-xl animate-fade-in font-bold">
            ✓ {calibrationSuccessMsg}
          </div>
        )}
      </div>

      {/* 4. ASTRONOMICAL DATA MATRIX & MAGNETIC DECLINATION */}
      <div className="max-w-4xl mx-auto w-full bg-[#08120b] border border-[#1b2f21] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#CEDE62]" />
            ข้อมูลดาราศาสตร์และมุมเยื้องแม่เหล็กโลก (Geomagnetic Declination)
          </span>
          <span className="text-xs font-mono text-[#CEDE62]">
            โมเดล IGRF / WGS84
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#0e1b12] p-2.5 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">MAGNETIC DECLINATION</span>
            <span className="font-bold text-white text-xs sm:text-sm block mt-0.5">
              {estimatedDeclination}° W
            </span>
            <span className="text-[9px] text-gray-400">มุมเยื้องแม่เหล็กประเทศไทย</span>
          </div>

          <div className="bg-[#0e1b12] p-2.5 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">POLARIS ALTITUDE</span>
            <span className="font-bold text-yellow-300 text-xs sm:text-sm block mt-0.5">
              {polarisInfo.altitude}° จากขอบฟ้า
            </span>
            <span className="text-[9px] text-gray-400">ละติจูดผู้สังเกตการณ์</span>
          </div>

          <div className="bg-[#0e1b12] p-2.5 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">LUNAR ILLUMINATION</span>
            <span className="font-bold text-sky-300 text-xs sm:text-sm block mt-0.5">
              {moonInfo.illumination}% สว่าง
            </span>
            <span className="text-[9px] text-gray-400">{moonInfo.phaseName}</span>
          </div>

          <div className="bg-[#0e1b12] p-2.5 rounded-xl border border-[#18291c]">
            <span className="text-[10px] text-gray-400 block font-sans">CALIBRATION OFFSET</span>
            <span className="font-bold text-[#CEDE62] text-xs sm:text-sm block mt-0.5">
              {orientation.compassOffset ? `${orientation.compassOffset > 0 ? `+${orientation.compassOffset}` : orientation.compassOffset}°` : '0° (ตรง)'}
            </span>
            <span className="text-[9px] text-gray-400">ชดเชยเซนเซอร์ปัจจุบัน</span>
          </div>
        </div>
      </div>

    </div>
  );
}
