import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { DeviceOrientationData } from '../types';
import { playTacticalClick, playHazardAlarm } from '../utils/audio';

interface InclinometerViewProps {
  orientation: DeviceOrientationData;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onManualPitchChange?: (pitch: number) => void;
  onManualRollChange?: (roll: number) => void;
}

export function InclinometerView({
  orientation,
  soundEnabled,
  onToggleSound,
  onManualPitchChange,
  onManualRollChange,
}: InclinometerViewProps) {
  const [pitchOffset, setPitchOffset] = useState<number>(0);
  const [rollOffset, setRollOffset] = useState<number>(0);
  const [maxLeftRoll, setMaxLeftRoll] = useState<number>(0);
  const [maxRightRoll, setMaxRightRoll] = useState<number>(0);

  // Calibrated roll & pitch
  const calibratedRoll = orientation.roll - rollOffset;
  const calibratedPitch = orientation.pitch - pitchOffset;

  // Track max angles
  if (calibratedRoll < -maxLeftRoll) {
    setMaxLeftRoll(Math.abs(Math.round(calibratedRoll)));
  }
  if (calibratedRoll > maxRightRoll) {
    setMaxRightRoll(Math.round(calibratedRoll));
  }

  const isRollDanger = Math.abs(calibratedRoll) >= 30;
  const isRollCaution = Math.abs(calibratedRoll) >= 18 && !isRollDanger;

  // Zero / Tare calibration on vehicle dashboard
  const handleTare = () => {
    setPitchOffset(orientation.pitch);
    setRollOffset(orientation.roll);
    setMaxLeftRoll(0);
    setMaxRightRoll(0);
    playTacticalClick(soundEnabled);
  };

  const handleResetCalibration = () => {
    setPitchOffset(0);
    setRollOffset(0);
    setMaxLeftRoll(0);
    setMaxRightRoll(0);
    playTacticalClick(soundEnabled);
  };

  return (
    <div className="w-full h-full bg-[#040805] text-[#10b981] flex flex-col justify-between p-3 sm:p-6 overflow-y-auto font-mono select-none">
      
      {/* 1. TOP HEADER */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-[#1b2b1f] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-5 h-5 ${isRollDanger ? 'text-red-500 animate-pulse' : 'text-[#CEDE62]'}`} />
          <span className="font-black text-sm sm:text-base text-gray-100 tracking-wider">
            4x4 OFF-ROAD INCLINOMETER HUD
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTare}
            className="px-3 py-1 bg-[#1b2f21] hover:bg-[#26442f] text-[#CEDE62] border border-[#3be099]/50 rounded text-xs font-bold"
            title="ตั้งศูนย์หน้าปัดใหม่อ้างอิงกับคอนโซลหน้ารถ (Tare Calibration)"
          >
            ตั้งศูนย์หน้าปัด (Tare)
          </button>
          {(pitchOffset !== 0 || rollOffset !== 0) && (
            <button
              type="button"
              onClick={handleResetCalibration}
              className="text-xs text-gray-400 hover:text-gray-200 underline"
            >
              รีเซ็ต
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 rounded border border-gray-800 bg-[#0d1710] text-gray-300 hover:bg-gray-800"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#10b981]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* 2. CENTER STAGE: DUAL 4x4 ROLL & PITCH GAUGES */}
      <div className="my-auto max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
        
        {/* GAUGE 1: LATERAL ROLL GAUGE (Rear View of 4x4 Rig) */}
        <div
          className={`relative bg-[#09130c] border-2 rounded-2xl p-5 flex flex-col items-center justify-between shadow-2xl transition-colors ${
            isRollDanger
              ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
              : isRollCaution
              ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
              : 'border-[#1b2b1f]'
          }`}
        >
          {/* Gauge Title */}
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-300">LATERAL ROLL (มุมเอียงข้าง)</span>
            <span
              className={`text-xs font-black px-2 py-0.5 rounded ${
                isRollDanger
                  ? 'bg-red-900 text-red-100 animate-pulse'
                  : isRollCaution
                  ? 'bg-amber-900 text-amber-100'
                  : 'bg-[#122416] text-[#3be099]'
              }`}
            >
              {isRollDanger ? '🚨 อันตรายพลิกคว่ำ' : isRollCaution ? '⚠️ ระวังความชัน' : '✓ ปลอดภัย'}
            </span>
          </div>

          {/* Large Degree readout */}
          <div className="my-3 flex items-baseline gap-1">
            <span
              className={`text-5xl font-black ${
                isRollDanger ? 'text-red-400' : isRollCaution ? 'text-amber-400' : 'text-white'
              }`}
            >
              {Math.abs(Math.round(calibratedRoll))}°
            </span>
            <span className="text-lg font-bold text-gray-400">
              {calibratedRoll < 0 ? 'ซ้าย ◀' : calibratedRoll > 0 ? '▶ ขวา' : 'ระดับกึ่งกลาง'}
            </span>
          </div>

          {/* 3D Rolling 4x4 Vehicle Graphical Stage */}
          <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-[#10b981]/40 flex items-center justify-center overflow-hidden">
            {/* Horizon Guideline */}
            <div className="absolute w-full h-[1px] bg-[#10b981]/30" />
            <div className="absolute h-full w-[1px] bg-[#10b981]/30" />

            {/* Tilt Arc Scale (0, 15, 30, 45 deg marks) */}
            <div className="absolute inset-2 pointer-events-none">
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold">0°</span>
              <span className="absolute top-4 left-6 text-[9px] text-amber-500 font-bold">-30°</span>
              <span className="absolute top-4 right-6 text-[9px] text-amber-500 font-bold">+30°</span>
            </div>

            {/* Rotating 4x4 Vehicle Wireframe */}
            <div
              className="transition-transform duration-75 flex flex-col items-center"
              style={{
                transform: `rotate(${calibratedRoll}deg)`,
              }}
            >
              {/* 4x4 Rig Rear SVG */}
              <svg viewBox="0 0 100 80" className="w-28 h-24 drop-shadow-[0_0_12px_#10b981]">
                {/* Roof Rack & Tires */}
                <rect x="25" y="10" width="50" height="4" fill="#CEDE62" rx="1" />
                <rect x="10" y="45" width="12" height="30" fill="#1b2f21" stroke="#10b981" strokeWidth="1.5" rx="2" />
                <rect x="78" y="45" width="12" height="30" fill="#1b2f21" stroke="#10b981" strokeWidth="1.5" rx="2" />
                {/* Vehicle Cabin & Windows */}
                <path d="M 24 20 L 76 20 L 84 52 L 16 52 Z" fill="#0d1f14" stroke="#10b981" strokeWidth="2" />
                <path d="M 28 25 L 72 25 L 76 40 L 24 40 Z" fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeWidth="1" />
                {/* Spare Tire on rear door */}
                <circle cx="50" cy="50" r="12" fill="#0d1810" stroke="#CEDE62" strokeWidth="2" />
                <circle cx="50" cy="50" r="4" fill="#CEDE62" />
                {/* Axle */}
                <line x1="22" y1="60" x2="78" y2="60" stroke="#10b981" strokeWidth="3" />
              </svg>
            </div>
          </div>

          {/* Roll Peak Memory */}
          <div className="w-full flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-800">
            <span>สถิติเอียงซ้ายสูงสุด: <b className="text-white">{maxLeftRoll}°</b></span>
            <span>สถิติเอียงขวาสูงสุด: <b className="text-white">{maxRightRoll}°</b></span>
          </div>
        </div>

        {/* GAUGE 2: LONGITUDINAL PITCH GAUGE (Side View of 4x4 Rig) */}
        <div className="relative bg-[#09130c] border-2 border-[#1b2b1f] rounded-2xl p-5 flex flex-col items-center justify-between shadow-2xl">
          {/* Gauge Title */}
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-300">GRADIENT PITCH (มุมความลาดชัน)</span>
            <span className="text-xs font-bold text-[#CEDE62] bg-[#122416] px-2 py-0.5 rounded">
              {calibratedPitch < -5 ? 'ไต่เขาขึ้น (Ascent)' : calibratedPitch > 5 ? 'ลงเขาชัน (Descent)' : 'ทางราบ (Flat)'}
            </span>
          </div>

          {/* Large Degree readout */}
          <div className="my-3 flex items-baseline gap-1">
            <span className="text-5xl font-black text-white">
              {Math.abs(Math.round(calibratedPitch))}°
            </span>
            <span className="text-lg font-bold text-gray-400">
              {calibratedPitch < 0 ? '▲ เชิดหน้า' : calibratedPitch > 0 ? '▼ ทิ่มลง' : '0° ระดับ'}
            </span>
          </div>

          {/* 3D Pitching 4x4 Vehicle Graphical Stage */}
          <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-[#10b981]/40 flex items-center justify-center overflow-hidden">
            {/* Horizon Guideline */}
            <div className="absolute w-full h-[1px] bg-[#10b981]/30" />
            <div className="absolute h-full w-[1px] bg-[#10b981]/30" />

            {/* Rotating Side 4x4 Vehicle Wireframe */}
            <div
              className="transition-transform duration-75 flex flex-col items-center"
              style={{
                transform: `rotate(${-calibratedPitch}deg)`,
              }}
            >
              {/* 4x4 Rig Side SVG */}
              <svg viewBox="0 0 120 70" className="w-32 h-20 drop-shadow-[0_0_12px_#10b981]">
                {/* Wheels */}
                <circle cx="30" cy="50" r="14" fill="#0d1810" stroke="#10b981" strokeWidth="2" />
                <circle cx="30" cy="50" r="5" fill="#CEDE62" />
                <circle cx="90" cy="50" r="14" fill="#0d1810" stroke="#10b981" strokeWidth="2" />
                <circle cx="90" cy="50" r="5" fill="#CEDE62" />
                {/* Chassis Body */}
                <path d="M 10 42 L 30 42 L 35 25 L 75 25 L 85 36 L 110 38 L 110 44 L 10 44 Z" fill="#0d1f14" stroke="#10b981" strokeWidth="2" />
                {/* Windows */}
                <polygon points="38,27 55,27 55,36 38,36" fill="#10b981" fillOpacity="0.3" stroke="#10b981" strokeWidth="1" />
                <polygon points="60,27 75,27 82,36 60,36" fill="#10b981" fillOpacity="0.3" stroke="#10b981" strokeWidth="1" />
                {/* Roof Rack */}
                <line x1="32" y1="20" x2="80" y2="20" stroke="#CEDE62" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="w-full text-center text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-800">
            <span>ความลาดชันทางภูมิประเทศ: <b>{Math.round(Math.tan(Math.abs(calibratedPitch) * Math.PI / 180) * 100)}% Grade</b></span>
          </div>
        </div>

      </div>

      {/* 3. FOOTER SAFETY RECOMMENDATION */}
      <div className="max-w-4xl mx-auto w-full bg-[#0a140d] border border-[#1b2b1f] rounded-xl p-3 text-xs text-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#3be099]" />
          <span>ขีดจำกัดความปลอดภัยออฟโรด: มุมเอียงข้าง (Roll) ไม่ควรเกิน 30° บนทางหินหรือดินทรายลอย</span>
        </div>
      </div>
    </div>
  );
}
