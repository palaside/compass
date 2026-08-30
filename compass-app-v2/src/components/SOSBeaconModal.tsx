import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Radio,
  Volume2,
  VolumeX,
  Copy,
  Check,
  PhoneCall,
} from 'lucide-react';
import { GPSPosition } from '../types';
import { formatMGRS, formatDMS, formatDD } from '../utils/geo';
import { playHazardAlarm, playTacticalClick } from '../utils/audio';

interface SOSBeaconModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPosition: GPSPosition;
  soundEnabled: boolean;
}

export function SOSBeaconModal({
  isOpen,
  onClose,
  currentPosition,
  soundEnabled,
}: SOSBeaconModalProps) {
  const [isStrobeActive, setIsStrobeActive] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && isStrobeActive) {
      const timer = setInterval(() => {
        playHazardAlarm(soundEnabled);
      }, 1800);
      return () => clearInterval(timer);
    }
  }, [isOpen, isStrobeActive, soundEnabled]);

  if (!isOpen) return null;

  const handleCopyCoordinates = () => {
    const text = `🚨 EMERGENCY SOS 🚨\nMGRS: ${formatMGRS(currentPosition.lat, currentPosition.lng)}\nPOS: ${formatDMS(currentPosition.lat, currentPosition.lng)}\nALT: ${currentPosition.altitude ? Math.round(currentPosition.altitude) : 480}m MSL\nTIME: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    playTacticalClick(soundEnabled);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 font-mono select-none">
      <div className="bg-[#120505] border-2 border-red-600 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.5)] flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-red-950/80 border-b border-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-red-400 animate-bounce" />
            <h3 className="font-black text-base text-red-100 tracking-wider">
              EMERGENCY SOS BEACON (ขอความช่วยเหลือฉุกเฉิน)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-red-400 hover:text-white p-1 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Flashing Morse Code Strobe */}
        <div className="p-4 text-center">
          <div className="py-2 bg-red-900/40 border border-red-500 rounded-xl mb-4 animate-pulse">
            <span className="text-2xl font-black text-red-200 tracking-widest">
              • • • — — — • • • (SOS)
            </span>
            <span className="text-[11px] text-red-300 block mt-1">
              ไฟกระพริบสัญญาณขอความช่วยเหลือตามรหัสมอร์สสากล
            </span>
          </div>

          {/* Tactical Emergency Location Telemetry Box */}
          <div className="bg-[#1a0a0a] border-2 border-red-600 rounded-xl p-4 text-left flex flex-col gap-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-red-900 pb-2">
              <span className="text-xs font-bold text-red-400">
                พิกัดสำหรับแจ้งเจ้าหน้าที่กู้ภัย / ว.สื่อสาร VHF:
              </span>
              <button
                type="button"
                onClick={handleCopyCoordinates}
                className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-xs flex items-center gap-1 font-bold"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกพิกัด'}</span>
              </button>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block font-sans">MGRS GRID (ทหาร/กู้ภัยสากล):</span>
              <span className="text-xl sm:text-2xl font-black text-yellow-300 block tracking-wider">
                {formatMGRS(currentPosition.lat, currentPosition.lng)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block font-sans">COORDINATES (DMS):</span>
              <span className="text-sm font-bold text-white block">
                {formatDMS(currentPosition.lat, currentPosition.lng)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block font-sans">ALTITUDE MSL:</span>
                <span className="font-bold text-white">
                  {currentPosition.altitude ? `${Math.round(currentPosition.altitude)} เมตร` : '480 เมตร'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-sans">DECIMAL (DD):</span>
                <span className="font-mono text-gray-300 text-[11px]">
                  {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-red-950/60 border-t border-red-900 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsStrobeActive(!isStrobeActive)}
            className="text-xs text-red-300 hover:underline"
          >
            {isStrobeActive ? '🔇 ปิดเสียงไซเรนฉุกเฉิน' : '🔊 เปิดเสียงไซเรนฉุกเฉิน'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-lg"
          >
            ปิดหน้าต่าง SOS
          </button>
        </div>
      </div>
    </div>
  );
}
