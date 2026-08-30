import React, { useState } from 'react';
import { X, ShieldAlert, Compass, MapPin, Target, Send, CheckCircle2, Loader2, AlertTriangle, Crosshair, ZoomIn, FileText } from 'lucide-react';
import { NakhonSawanTacticalMap } from './NakhonSawanTacticalMap';
import { CompassView } from './CompassView';
import { GPSPosition, DeviceOrientationData, SolarInfo, Waypoint } from '../types';
import { playTacticalClick } from '../utils/audio';
import bombAnalysisImg from '../assets/bomb-analysis.webp';

interface CraterAnalysisViewProps {
  isOpen: boolean;
  onClose: () => void;
  currentPosition: GPSPosition;
  orientation: DeviceOrientationData;
  solarInfo: SolarInfo;
  waypoints: Waypoint[];
  activeWaypoint: Waypoint | null;
  soundEnabled: boolean;
}

export function CraterAnalysisView({
  isOpen,
  onClose,
  currentPosition,
  orientation,
  solarInfo,
  waypoints,
  activeWaypoint,
  soundEnabled,
}: CraterAnalysisViewProps) {
  // Input states for crater analysis
  const [angle1, setAngle1] = useState<string>('45'); // Trajectory Angle
  const [angle2, setAngle2] = useState<string>('45'); // Descent Angle
  const [angle3, setAngle3] = useState<string>('90'); // Plumb Bob Angle (must be 90)
  const [azimuth, setAzimuth] = useState<string>('1600'); // Mils or Deg
  const [azimuthUnit, setAzimuthUnit] = useState<'mils' | 'deg'>('mils');

  // Weapon Evidence selection
  const [selectedEvidence, setSelectedEvidence] = useState<{
    tailBand: boolean;
    tailFins: boolean;
    driveBand: boolean;
    fuseType: boolean;
  }>({
    tailBand: true,
    tailFins: false,
    driveBand: false,
    fuseType: false,
  });

  // Submission states
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const [step2Method, setStep2Method] = useState<'fuse' | 'side'>('fuse');

  if (!isOpen) return null;

  // Geometric validation
  const numAngle1 = parseFloat(angle1) || 0;
  const numAngle2 = parseFloat(angle2) || 0;
  const numAngle3 = parseFloat(angle3) || 0;
  const numAzimuth = parseFloat(azimuth) || 0;

  // Rules:
  // 1. Angle 3 must be 90 degrees (Plumb bob right angle)
  // 2. Angle 1 should equal Angle 2 (Trajectory symmetry)
  const isAngle3Valid = Math.abs(numAngle3 - 90) < 0.5;
  const isTrajectoryValid = Math.abs(numAngle1 - numAngle2) < 2.0;
  const isGeometryValid = isAngle3Valid && isTrajectoryValid && numAngle1 > 0 && numAngle2 > 0;

  // Weapon identification logic based on evidence and impact characteristics
  const identifyWeapon = () => {
    if (selectedEvidence.tailFins) return 'เครื่องยิงลูกระเบิด 81 มม. / 82 มม. (Mortar HE)';
    if (selectedEvidence.tailBand) return 'ปืนใหญ่สนาม 105 มม. M101A1 (HE M1) [โซเวียต/ตะวันตก]';
    if (selectedEvidence.driveBand) return 'ปืนใหญ่สนาม 155 มม. M198 / M777 (High Explosive)';
    return numAngle1 > 60 ? 'เครื่องยิงลูกระเบิดหนัก 120 มม.' : 'ปืนใหญ่อัตตาจร 122 มม. D-30';
  };

  const handleSendReport = () => {
    if (!isGeometryValid) return;
    setIsSending(true);
    playTacticalClick(soundEnabled);

    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      setTimeout(() => {
        setIsSent(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-mono select-none overflow-hidden animate-fadeIn">
      
      {/* Tri-Panel Layout Container */}
      <div className="relative w-full max-w-[1700px] h-[92dvh] flex items-stretch justify-center gap-3">
        
        {/* LEFT WING: Tactical Mini-Map */}
        <div className="hidden lg:flex flex-col w-80 bg-[#0d1612]/95 border border-emerald-500/40 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)] shrink-0">
          <div className="bg-[#14261c] px-3 py-2 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              TACTICAL MINI-MAP (GIS)
            </span>
            <span className="text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700">SRV-01</span>
          </div>
          <div className="flex-1 relative overflow-hidden pointer-events-none opacity-90 scale-95 origin-center">
            <NakhonSawanTacticalMap
              center={[currentPosition.lat, currentPosition.lng]}
              className="w-full h-full"
              interactive={false}
              opacity={1.0}
            />
          </div>
          <div className="p-2 bg-[#09110d] border-t border-emerald-500/20 text-[10px] text-gray-400 text-center">
            พิกัดอ้างอิง: {currentPosition.lat.toFixed(4)}°N, {currentPosition.lng.toFixed(4)}°E
          </div>
        </div>

        {/* CENTER PANEL: Main Crater Analysis Module */}
        <div className="flex-1 max-w-5xl h-full bg-[#0a110f] border-2 border-orange-500/80 rounded-2xl shadow-[0_0_40px_rgba(249,115,22,0.35)] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-950/80 via-[#1a140d] to-[#0a110f] px-4 py-3 border-b border-orange-500/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-900/50 border border-orange-500 flex items-center justify-center text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-orange-300 tracking-wider">
                  CRATER ANALYSIS MODULE — ระบบวิเคราะห์หลุมระเบิด
                </h2>
                <p className="text-[10px] text-orange-400/80 tracking-tight">
                  FDC FIELD ARTILLERY BALLISTICS SECTION • 360° TRAJECTORY RECONSTRUCTION
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/60 transition-colors"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
            
            {/* Hero 3D Crater Graphic Simulation */}
            <div className="relative w-full h-56 sm:h-72 rounded-xl bg-[#060b09] border border-orange-500/40 overflow-hidden group shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
              <img
                src={bombAnalysisImg}
                alt="Tactical Crater Cross-Section"
                className="w-full h-full object-contain filter contrast-125 brightness-90 group-hover:scale-105 transition-transform duration-700"
              />
              
              {/* HUD Overlay elements on Hero Image */}
              <div className="absolute inset-0 z-20 p-4 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between items-start">
                  <span className="px-2.5 py-1 bg-black/70 border border-orange-500/60 text-orange-400 text-[10px] rounded backdrop-blur-md">
                    [CRATER CROSS-SECTION DIAGRAM]
                  </span>
                  <span className="px-2.5 py-1 bg-orange-950/80 border border-orange-600 text-orange-200 text-[10px] rounded font-bold animate-pulse">
                    LIVE MEASUREMENT ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-black/80 border border-orange-500/40 p-1.5 rounded backdrop-blur-md">
                    <span className="text-[9px] text-gray-400 block">มุม 1 (ลูกดิ่ง)</span>
                    <span className="text-sm font-bold text-orange-300">{angle1}°</span>
                  </div>
                  <div className="bg-black/80 border border-orange-500/40 p-1.5 rounded backdrop-blur-md">
                    <span className="text-[9px] text-gray-400 block">มุม 2 (มุมตก)</span>
                    <span className="text-sm font-bold text-orange-300">{angle2}°</span>
                  </div>
                  <div className="bg-black/80 border border-orange-500/40 p-1.5 rounded backdrop-blur-md">
                    <span className="text-[9px] text-gray-400 block">มุม 3 (มุมฉาก 90°)</span>
                    <span className="text-sm font-bold text-orange-300">{angle3}°</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Entry Section: มุมตกกระทบ และทิศทาง Azimuth */}
            <div className="bg-[#0f1915] border border-orange-500/30 rounded-xl p-4 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-orange-500/20 pb-2">
                <span className="text-xs font-bold text-orange-300 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-400" />
                  1. ป้อนค่าวัดมุมที่วัดได้ (Survey & Inclinometer Data):
                </span>
                <span className="text-[10px] text-gray-400">หน่วย: องศา (Degrees) & มิลเลียม (Mils)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* มุม 1 */}
                <div className="space-y-1">
                  <label className="text-[11px] text-orange-200 font-bold block">
                    มุม 1 (ลูกดิ่ง / Trajectory)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={angle1}
                      onChange={(e) => setAngle1(e.target.value)}
                      className="w-full bg-[#060b09] border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-orange-300 font-bold focus:outline-none focus:border-orange-400"
                      placeholder="เช่น 45"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">°</span>
                  </div>
                </div>

                {/* มุม 2 */}
                <div className="space-y-1">
                  <label className="text-[11px] text-orange-200 font-bold block">
                    มุม 2 (มุมตก / Descent Angle)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={angle2}
                      onChange={(e) => setAngle2(e.target.value)}
                      className="w-full bg-[#060b09] border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-orange-300 font-bold focus:outline-none focus:border-orange-400"
                      placeholder="เช่น 45"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">°</span>
                  </div>
                </div>

                {/* มุม 3 */}
                <div className="space-y-1">
                  <label className="text-[11px] text-orange-200 font-bold block">
                    มุม 3 (มุมฉาก / Plumb Bob 90°)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={angle3}
                      onChange={(e) => setAngle3(e.target.value)}
                      className={`w-full bg-[#060b09] border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none ${
                        isAngle3Valid ? 'border-orange-500/50 text-orange-300' : 'border-red-500 text-red-400'
                      }`}
                      placeholder="90"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">°</span>
                  </div>
                </div>
              </div>

              {/* Azimuth / Direction */}
              <div className="pt-2">
                <label className="text-[11px] text-orange-200 font-bold block mb-1">
                  ทิศระนาบกิศทาง (Azimuth / Direction of Fire)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={azimuth}
                    onChange={(e) => setAzimuth(e.target.value)}
                    className="flex-1 bg-[#060b09] border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-orange-300 font-bold focus:outline-none focus:border-orange-400"
                    placeholder="ระบุทิศทาง"
                  />
                  <select
                    value={azimuthUnit}
                    onChange={(e) => setAzimuthUnit(e.target.value as 'mils' | 'deg')}
                    className="bg-[#060b09] border border-orange-500/50 rounded-lg px-3 py-2 text-xs text-orange-300 font-bold focus:outline-none"
                  >
                    <option value="mils">mils (6400)</option>
                    <option value="deg">deg (360°)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Weapon Identification Section */}
            <div className="bg-[#0f1915] border border-orange-500/30 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-orange-400" />
                2. คัดกรองชนิดอาวุธข้าศึก (Weapon Identification & Evidence)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'tailBand', label: 'ปลอกรัดท้าย / เกลียว' },
                  { key: 'tailFins', label: 'ครีบหางนำทิศ (Mortar)' },
                  { key: 'driveBand', label: 'แถบนำวิถี (Drive Band)' },
                  { key: 'fuseType', label: 'ชนวนหัวกระสุน (Point Fuse)' },
                ].map((item) => {
                  const isChecked = selectedEvidence[item.key as keyof typeof selectedEvidence];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setSelectedEvidence((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof typeof prev],
                        }));
                        playTacticalClick(soundEnabled);
                      }}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-orange-950/60 border-orange-500 text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                          : 'bg-[#060b09] border-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                        isChecked ? 'bg-orange-500 border-orange-400 text-black font-black' : 'border-gray-700'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Report & Real-time Validation Summary Panel */}
            <div className={`p-4 rounded-xl border transition-all ${
              isGeometryValid
                ? 'bg-[#0e1d13] border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-red-950/40 border-red-600/80 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isGeometryValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce" />
                    )}
                    <span className={`text-xs sm:text-sm font-bold ${isGeometryValid ? 'text-emerald-300' : 'text-red-300'}`}>
                      {isGeometryValid
                        ? 'สถานะ: ข้อมูลเรขาคณิตถูกต้องตามหลักวิถีกระสุน (VALIDATED)'
                        : 'แจ้งเตือน: มุมที่ 3 ต้องเป็น 90° และมุมวิถี 1-2 ต้องสอดคล้องตามกฎเรขาคณิต'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    ทิศทาง: <strong className="text-orange-300">{numAzimuth} {azimuthUnit}</strong> | มุมตก: <strong className="text-orange-300">{numAngle2}°</strong> | อาวุธคาดการณ์: <strong className="text-emerald-300">{identifyWeapon()}</strong>
                  </p>
                </div>

                {/* Submit Report Button */}
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={!isGeometryValid || isSending || isSent}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg ${
                    isSent
                      ? 'bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                      : isGeometryValid && !isSending
                      ? 'bg-orange-600 hover:bg-orange-500 text-white border border-orange-400 cursor-pointer shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                      : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-orange-200" />
                      <span>กำลังส่งสัญญาณวิทยุไป ศอย....</span>
                    </>
                  ) : isSent ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>ส่งรายงานสำเร็จ (SENT TO FDC)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ส่งรายงานไป ศอย.</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Procedure Instructions Section (Bottom Layer) */}
            <div className="bg-[#0f1915] border border-orange-500/30 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" />
                ขั้นตอนการปฏิบัติงานวิเคราะห์หลุมระเบิด
              </span>

              <div className="space-y-2 text-xs text-gray-300">
                <div className="p-2 bg-[#060b09] rounded-lg border border-gray-800">
                  <span className="font-bold text-orange-200">1. การหาทิศทาง</span>
                </div>
                
                <div className="p-3 bg-[#0a110f] rounded-lg border border-orange-500/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-orange-200">2. วิธีการหาระยะและทิศทาง</span>
                    <div className="flex bg-[#060b09] border border-orange-500/40 rounded-lg overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => { setStep2Method('fuse'); playTacticalClick(soundEnabled); }}
                        className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${
                          step2Method === 'fuse' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        วิธีรูหัวชนวนและศูนย์กลางหลุมระเบิด
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStep2Method('side'); playTacticalClick(soundEnabled); }}
                        className={`px-3 py-1.5 text-[10px] font-bold transition-colors border-l border-orange-500/40 ${
                          step2Method === 'side' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        วิธีการสาดทางข้าง
                      </button>
                    </div>
                  </div>

                  <div className="pl-2 border-l-2 border-orange-500/40 space-y-2 text-[11px]">
                    {step2Method === 'fuse' ? (
                      <>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 1 (การเคลียร์รอยถาก):</strong> เจ้าหน้าที่ใช้มือค่อยๆ กอบเศษดินร่วนและหินออกจากรอยถากทั้งหมดอย่างระมัดระวัง เพื่อเปิดให้เห็นผิวดินแข็งที่เป็นแนวรอยถากเรียบแท้จริง</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 2 (การปักหลักที่ ๑ บนรอยถาก):</strong> นำหลักไม้หลักที่ ๑ ปักลงตรงกึ่งกลางของปลายรอยถากด้านหน้าในส่วนที่เป็นแนวตรง</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 3 (การปักหลักที่ ๒ บนรอยถาก):</strong> นำหลักไม้หลักที่ ๒ ปักลงตรงกึ่งกลางของปลายรอยถากอีกด้านหนึ่ง ให้เป็นแนวเส้นตรงเดียวกันกับหลักที่ ๑</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 4 (การตั้งเครื่องมือวัดมุมบนแนวรอยถาก):</strong> นำกล้องกองร้อยหรือเข็มทิศมาตั้งทางด้านหลังให้อยู่ในแนวระนาบตรงเป๊ะกับหลักไม้ทั้งสอง</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 5 (การเล็งและอ่านมุมภาค):</strong> ส่องกล้องทาบผ่านหลักทั้งสองไปยังทิศทางข้างหน้า อ่านค่ามุมภาคทิศทางยิงมิลเลียม (Azimuth) ซึ่งค่านี้คือแนวทิศทางพุ่งตรงไปยังปืนข้าศึก</p>
                      </>
                    ) : (
                      <>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 1 (การตรวจหารูหัวชนวน):</strong> กวาดเศษดินร่วนบริเวณก้นหลุมระเบิดเบาๆ จนพบรูที่หัวชนวนเจาะฝังลึกลงไปในเนื้อดินแข็ง</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 2 (การปักหลักศูนย์กลางหลุม):</strong> ปักหลักไม้หลักที่ ๑ ลงตรงจุดกึ่งกลางทางเรขาคณิตของปากหลุมระเบิด</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 3 (การสอดหลักในรูหัวชนวน):</strong> สอดหลักไม้อีกอันหนึ่งเข้าไปในรูหัวชนวนให้ลึกและแน่นตามแนวรูเดิม</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 4 (การตั้งกล้องเล็งทาบแนวหลัก):</strong> ตั้งเครื่องมือวัดมุม (กล้องกองร้อยหรือเข็มทิศ) ให้อยู่ในแนวเส้นตรงเดียวกับหลักศูนย์กลางและหลักในรูหัวชนวน</p>
                        <p><strong className="text-emerald-400">ขั้นตอนที่ 5 (การอ่านมุมภาคทิศทางยิง):</strong> ทำการส่องตรวจและอ่านค่ามุมภาคทิศทางตามแนวหลักทั้งสอง ซึ่งคือทิศทางตรงไปยังที่ตั้งปืนใหญ่ข้าศึก</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-2 bg-[#060b09] rounded-lg border border-gray-800">
                  <span className="font-bold text-orange-200">3. การวิเคราะห์หลุมระเบิด ค.</span>
                </div>
                <div className="p-2 bg-[#060b09] rounded-lg border border-gray-800">
                  <span className="font-bold text-orange-200">4. การหามุมกระสุนตกเพื่อประมาณระยะยิง</span>
                </div>
                <div className="p-2 bg-[#060b09] rounded-lg border border-gray-800">
                  <span className="font-bold text-orange-200">5. การเก็บกู้และพิสูจน์ทราบชิ้นส่วนสะเก็ดระเบิด</span>
                </div>
                <div className="p-2 bg-[#060b09] rounded-lg border border-gray-800">
                  <span className="font-bold text-orange-200">6. การจัดทำรายงานและส่งมอบข้อมูล</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT WING: Digital M.2 Compass */}
        <div className="hidden lg:flex flex-col w-80 bg-[#0d1612]/95 border border-emerald-500/40 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.15)] shrink-0">
          <div className="bg-[#14261c] px-3 py-2 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '10s' }} />
              DIGITAL M.2 COMPASS
            </span>
            <span className="text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700">MILS</span>
          </div>
          <div className="flex-1 relative overflow-hidden transform scale-[0.8] origin-top-left w-[125%] h-[125%] pointer-events-none">
            <CompassView
              currentPosition={currentPosition}
              orientation={orientation}
              activeWaypoint={activeWaypoint}
              solarInfo={solarInfo}
              soundEnabled={false}
              onToggleSound={() => {}}
              onSelectWaypointModal={() => {}}
              onAddWaypointAtCurrent={() => {}}
              directionOfFire={1600}
              onDirectionOfFireChange={() => {}}
            />
          </div>
          <div className="p-2 bg-[#09110d] border-t border-emerald-500/20 text-[10px] text-gray-400 text-center">
            มุมภาคทิศเหนือ: {orientation.heading.toFixed(1)}° ({Math.round(orientation.heading * 17.7778)} mils)
          </div>
        </div>

      </div>
    </div>
  );
}
