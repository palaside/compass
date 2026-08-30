import React from 'react';
import {
  Camera,
  Compass,
  FileText,
  ShieldAlert,
  MapPin,
  AlertOctagon,
  Gauge,
  Sparkles,
  HardDrive,
  Footprints,
  Square,
  Volume2,
  VolumeX,
  Target,
} from 'lucide-react';
import { HUDMode, Waypoint, GPSPosition } from '../types';
import { playTacticalClick } from '../utils/audio';

interface TopNavigationBarProps {
  mode: HUDMode;
  onModeChange: (mode: HUDMode) => void;
  activeWaypoint: Waypoint | null;
  currentPosition: GPSPosition;
  isRecordingTrack: boolean;
  onToggleRecordTrack: () => void;
  onOpenWaypoints?: () => void;
  onOpenOfflineMaps: () => void;
  onOpenSOS: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function TopNavigationBar({
  mode,
  onModeChange,
  activeWaypoint,
  currentPosition,
  isRecordingTrack,
  onToggleRecordTrack,
  onOpenOfflineMaps,
  onOpenSOS,
  soundEnabled,
  onToggleSound,
}: TopNavigationBarProps) {
  const navTabs: { id: HUDMode; label: string; icon: React.ReactNode }[] = [
    { id: 'AR', label: 'กล้อง AR (AR HUD)', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'COMPASS', label: 'เข็มทิศ (Compass)', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'MAP', label: 'แผนที่ยุทธวิธี (GIS Map)', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'REPORT', label: 'รายงาน (Report)', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'GAUGES', label: 'มาตรวัด (Cockpit)', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'CELESTIAL', label: 'ดวงดาว (Celestial)', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'CLINOMETER', label: 'วัดเอียง 4x4 (Tilt)', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'CRATER_ANALYSIS', label: 'วิเคราะห์หลุมระเบิด', icon: <Target className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="relative z-40 w-full bg-[#0a140e]/95 backdrop-blur-md border-b border-[#1b2f21] px-2.5 sm:px-5 py-2 shadow-2xl font-mono select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        
        {/* Left: App Title & GPS Satellite Lock Status */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-7 rounded-lg bg-[#14291a] border border-[#10b981] flex items-center justify-center text-[#CEDE62] shadow-[0_0_12px_rgba(206,222,98,0.3)] font-black text-[10px]">
              ARTY
            </div>
            <div className="text-left">
              <span className="font-black text-xs sm:text-sm text-gray-100 block tracking-wide">
                ARTY Compass
              </span>
              <span className="text-[9px] text-[#3be099] flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                GPS ออฟไลน์ความแม่นยำสูง (±{Math.round(currentPosition.accuracy)}m)
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Tabs as Clickable Horizontal Scrollable Buttons */}
        <div className="flex overflow-x-auto whitespace-nowrap gap-1.5 bg-[#060e08] p-1.5 rounded-xl border border-[#1b2f21] w-full md:w-auto hide-scrollbar">
          {navTabs.map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onModeChange(tab.id);
                  playTacticalClick(soundEnabled);
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-[#1b2f21] text-[#CEDE62] border border-[#3be099]/60 shadow-[0_0_15px_rgba(206,222,98,0.25)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#0c1910]'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}

