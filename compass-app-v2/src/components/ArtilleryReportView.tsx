import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Target,
  Copy,
  Download,
  Compass,
  Sliders,
  Check,
  Layers,
  Flame,
  Grid,
} from 'lucide-react';
import { GPSPosition, DeviceOrientationData } from '../types';
import { playTacticalClick } from '../utils/audio';
import { ArtilleryProtractorDiscGroup } from './ArtilleryProtractorDisc';

export interface GunInput {
  id: number;
  name: string;
  azimuthFromCircle: number; // มุมทิศ จาก จก. (มิลเลียม 0-6400)
  angleAFromCircle: number;   // มุม ก. จาก จก. (มิลเลียม สำหรับคำนวณระยะ)
  calculatedDistance: number; // ระยะจาก จก. (เมตร) - ค่า default คือ 100
  maskAngle: number;          // มุมพื้นที่ยอดกำบัง (มิลเลียม - ขนาด 3 หลัก)
  maskDistance: number;       // ระยะยอดกำบัง (เมตร - ขนาด 3-4 หลัก)
}

interface ArtilleryReportViewProps {
  currentPosition?: GPSPosition;
  orientation?: DeviceOrientationData;
  soundEnabled?: boolean;
  directionOfFire?: number;
  onDirectionOfFireChange?: (dof: number) => void;
}

// 105mm Howitzer Standard Ballistic Data (ตารางยิง ป. ๑๐๕ มม. M101A1 / M102)
interface Charge105Data {
  name: string;
  chargeNum: number;
  label: string;
  elevationAngle2: number; // มุมสูง มุม ๒ (มิลเลียม)
  rangeFactor: number;     // แฟกเตอร์ตารางยิง มุม ค.
  onePe: number;           // ๑ ซ่อม (มิลเลียม)
  vtExtraClearance: number;// มุมเพิ่มเผื่อชนวน VT (มิลเลียม)
}

const CHARGES_105MM: Record<number, Charge105Data> = {
  1: { name: 'Charge 1', chargeNum: 1, label: 'บจ. ๑', elevationAngle2: 65, rangeFactor: 0.35, onePe: 4, vtExtraClearance: 25 },
  2: { name: 'Charge 2', chargeNum: 2, label: 'บจ. ๒', elevationAngle2: 95, rangeFactor: 0.32, onePe: 5, vtExtraClearance: 25 },
  3: { name: 'Charge 3', chargeNum: 3, label: 'บจ. ๓', elevationAngle2: 125, rangeFactor: 0.30, onePe: 6, vtExtraClearance: 20 },
  4: { name: 'Charge 4', chargeNum: 4, label: 'บจ. ๔', elevationAngle2: 155, rangeFactor: 0.28, onePe: 7, vtExtraClearance: 20 },
  5: { name: 'Charge 5', chargeNum: 5, label: 'บจ. ๕ (มาตรฐาน)', elevationAngle2: 190, rangeFactor: 0.26, onePe: 8, vtExtraClearance: 20 },
  6: { name: 'Charge 6', chargeNum: 6, label: 'บจ. ๖', elevationAngle2: 230, rangeFactor: 0.24, onePe: 9, vtExtraClearance: 15 },
  7: { name: 'Charge 7', chargeNum: 7, label: 'บจ. ๗', elevationAngle2: 280, rangeFactor: 0.22, onePe: 10, vtExtraClearance: 15 },
};

// Helper to round to nearest 5 meters (ปัดเต็ม 5 ม.)
export function roundTo5(val: number): number {
  return Math.round(val / 5) * 5;
}

// Calculate stadia distance from Angle ก. (in mils) -> R = 2037.2 / angleA (default = 100m)
export function calcDistanceFormAngleA(angleA: number): number {
  if (angleA <= 0) return 100;
  const rawDist = 2037.2 / angleA;
  return Math.round(rawDist * 10) / 10;
}

const LOCAL_STORAGE_KEY = 'artillery_fdc_report_state_v2';

const INITIAL_GUNS: GunInput[] = [
  { id: 1, name: 'หมู่ 1', azimuthFromCircle: 2760, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 42, maskDistance: 820 },
  { id: 2, name: 'หมู่ 2', azimuthFromCircle: 2640, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 48, maskDistance: 750 },
  { id: 3, name: 'หมู่ 3', azimuthFromCircle: 2520, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 45, maskDistance: 800 },
  { id: 4, name: 'หมู่ 4', azimuthFromCircle: 2400, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 50, maskDistance: 700 },
  { id: 5, name: 'หมู่ 5', azimuthFromCircle: 2280, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 55, maskDistance: 650 },
  { id: 6, name: 'หมู่ 6', azimuthFromCircle: 2150, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 52, maskDistance: 680 },
];

export function ArtilleryReportView({
  soundEnabled = true,
  directionOfFire: propDirectionOfFire = 1600,
  onDirectionOfFireChange,
}: ArtilleryReportViewProps) {
  // Load saved state from localStorage if available
  const savedState = useMemo(() => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  // -------------------------------------------------------------
  // BATTERY & MISSION PARAMETERS (Persistent)
  // -------------------------------------------------------------
  const [batteryName, setBatteryName] = useState<string>(
    savedState?.batteryName ?? 'ป.๔ พัน.๔ ร้อย.๒ (๑๐๕ มม.)'
  );
  const [commanderTitle, setCommanderTitle] = useState<string>(
    savedState?.commanderTitle ?? 'รอง ผบ.ร้อย ป.'
  );
  const [gridCoords, setGridCoords] = useState<string>(
    savedState?.gridCoords ?? '47Q PS 12345 67890'
  );

  // Direction of Fire (ทิศทางยิงหลัก)
  const [directionOfFire, setLocalDirectionOfFire] = useState<number>(
    savedState?.directionOfFire ?? propDirectionOfFire ?? 1600
  );

  useEffect(() => {
    if (propDirectionOfFire !== undefined && propDirectionOfFire !== directionOfFire) {
      setLocalDirectionOfFire(propDirectionOfFire);
    }
  }, [propDirectionOfFire]);

  const handleUpdateDirectionOfFire = (dof: number) => {
    setLocalDirectionOfFire(dof);
    if (onDirectionOfFireChange) {
      onDirectionOfFireChange(dof);
    }
  };

  // Center of Battery (ศก.ร้อย.) - กล้อง 1 และ กล้อง 2
  const [camera1Angle, setCamera1Angle] = useState<number>(
    savedState?.camera1Angle ?? 2400
  );
  const [camera2Angle, setCamera2Angle] = useState<number>(
    savedState?.camera2Angle ?? 2450
  );

  // Number of gun squads (จำนวนหมู่: 1-6) & Base gun (ปืนหมู่หลัก: 1-6)
  const [numSquads, setNumSquads] = useState<number>(
    savedState?.numSquads ?? 6
  );
  const [baseGunId, setBaseGunId] = useState<number>(
    savedState?.baseGunId ?? 1
  );

  // Battery Center Alignment Mode: 'ON_BC' (ทับ ศก.ร้อย), 'DISPLACED_BC' (คลาด ศก.ร้อย)
  const [batteryAlignmentMode, setBatteryAlignmentMode] = useState<'ON_BC' | 'DISPLACED_BC'>(
    savedState?.batteryAlignmentMode ?? 'ON_BC'
  );

  // Charge / Fuze selection
  const [selectedChargeNum, setSelectedChargeNum] = useState<number>(
    savedState?.selectedChargeNum ?? 5
  );
  const [fuzeType, setFuzeType] = useState<'ALL' | 'QUICK' | 'VT'>(
    savedState?.fuzeType ?? 'ALL'
  );

  // Current Command QE for safety interlock testing
  const [currentCommandQE, setCurrentCommandQE] = useState<number>(
    savedState?.currentCommandQE ?? 295
  );

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'RADAR' | 'MIN_QE' | 'FORM_REPORT'>(
    savedState?.activeTab ?? 'DASHBOARD'
  );

  // Guns Data
  const [guns, setGuns] = useState<GunInput[]>(() => {
    if (savedState?.guns && Array.isArray(savedState.guns) && savedState.guns.length > 0) {
      return savedState.guns.map((g: any, idx: number) => ({
        id: g.id || idx + 1,
        name: `หมู่ ${g.id || idx + 1}`,
        azimuthFromCircle: g.azimuthFromCircle ?? 2400,
        angleAFromCircle: g.angleAFromCircle ?? 20,
        calculatedDistance: g.calculatedDistance ?? 100,
        maskAngle: g.maskAngle ?? 45,
        maskDistance: g.maskDistance ?? 800,
      }));
    }
    return INITIAL_GUNS;
  });

  const [copiedNotification, setCopiedNotification] = useState(false);
  const [selectedGunForSim, setSelectedGunForSim] = useState<number | null>(null);

  // Rule 3: หากกรณีทับ ศก.ร้อย ค่าของกล้อง 1 จะต้องตรงกับปืนหมู่หลักเสมอ
  useEffect(() => {
    if (batteryAlignmentMode === 'ON_BC') {
      const basePiece = guns.find((g) => g.id === baseGunId) || guns[0];
      if (basePiece && camera1Angle !== basePiece.azimuthFromCircle) {
        setCamera1Angle(basePiece.azimuthFromCircle);
      }
    }
  }, [batteryAlignmentMode, baseGunId, guns, camera1Angle]);

  // Rule 4: ทุกการรีเฟรช ให้บันทึกค่าของช่องต่างๆที่เป็นล่าสุดเสมอ (Auto-save to localStorage)
  useEffect(() => {
    const stateToSave = {
      batteryName,
      commanderTitle,
      gridCoords,
      directionOfFire,
      camera1Angle,
      camera2Angle,
      numSquads,
      baseGunId,
      batteryAlignmentMode,
      selectedChargeNum,
      fuzeType,
      currentCommandQE,
      activeTab,
      guns,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [
    batteryName,
    commanderTitle,
    gridCoords,
    directionOfFire,
    camera1Angle,
    camera2Angle,
    numSquads,
    baseGunId,
    batteryAlignmentMode,
    selectedChargeNum,
    fuzeType,
    currentCommandQE,
    activeTab,
    guns,
  ]);

  // Update a single gun parameter
  const handleUpdateGun = (id: number, field: keyof GunInput, value: number) => {
    setGuns((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        if (field === 'angleAFromCircle') {
          const newDist = calcDistanceFormAngleA(value);
          return { ...g, angleAFromCircle: value, calculatedDistance: newDist };
        }
        return { ...g, [field]: value };
      })
    );
  };

  // -------------------------------------------------------------
  // DISPLACEMENT CALCULATION ENGINE (เครื่องคำนวณปืนคลาด ศก.ร้อย. & ระยะลดเหลื่อม)
  // -------------------------------------------------------------
  const displacementResults = useMemo(() => {
    const milsToRad = (mils: number) => (mils * 2 * Math.PI) / 6400;

    // Center of Battery reference vector:
    const basePiece = guns.find((g) => g.id === baseGunId) || guns[0];
    const bcAzimuth = batteryAlignmentMode === 'ON_BC' ? basePiece.azimuthFromCircle : camera1Angle;
    const bcDist = basePiece.calculatedDistance || 100;

    const bcRad = milsToRad(bcAzimuth);
    const bcX = bcDist * Math.sin(bcRad);
    const bcY = bcDist * Math.cos(bcRad);

    const dofRad = milsToRad(directionOfFire);
    const cosDof = Math.cos(dofRad);
    const sinDof = Math.sin(dofRad);

    const activeGuns = guns.slice(0, numSquads);

    return activeGuns.map((gun) => {
      const gRad = milsToRad(gun.azimuthFromCircle);
      const gDist = gun.calculatedDistance;
      const gX = gDist * Math.sin(gRad);
      const gY = gDist * Math.cos(gRad);

      const dX_raw = gX - bcX;
      const dY_raw = gY - bcY;

      // Rotate coordinates along Direction of Fire (DOF):
      // +X_rot = Right (ขวา), -X_rot = Left (ซ้าย)
      // +Y_rot = Front (หน้า), -Y_rot = Rear (หลัง)
      const dX_rot = dX_raw * cosDof - dY_raw * sinDof;
      const dY_rot = dX_raw * sinDof + dY_raw * cosDof;

      // Round all meters to full 5m (ปัดเต็ม 5 ม.)
      let lateralDisplacement = roundTo5(dX_rot);
      let rangeDisplacement = roundTo5(dY_rot);
      // Apply alternating front/back (zig-zag) for range displacement, except base gun
      if (gun.id !== baseGunId) {
        const sign = gun.id % 2 === 1 ? 1 : -1; // odd id = front (+), even = back (-)
        rangeDisplacement = Math.abs(rangeDisplacement) * sign;
      }

      // กฎการจัดวางตำแหน่งปืนคลาดทางข้าง (ซ้าย/ขวา) ตามลักษณะ ศก.ร้อย:
      if (batteryAlignmentMode === 'ON_BC') {
        if (gun.id === 1 || gun.id === 2) {
          lateralDisplacement = Math.abs(lateralDisplacement) === 0 ? (gun.id === 1 ? 30 : 15) : Math.abs(lateralDisplacement);
        } else if (gun.id === 4) {
          lateralDisplacement = -Math.abs(lateralDisplacement || 25);
        }
      } else if (batteryAlignmentMode === 'DISPLACED_BC') {
        if (gun.id === 1 || gun.id === 2) {
          lateralDisplacement = Math.abs(lateralDisplacement) === 0 ? (gun.id === 1 ? 30 : 15) : Math.abs(lateralDisplacement);
        } else if (gun.id === 3 || gun.id === 4) {
          lateralDisplacement = -Math.abs(lateralDisplacement || (gun.id === 3 ? 15 : 30));
        }
      }

      // Direct Distance from BC to this Gun
      const bcDirectDist = Math.sqrt(dX_raw * dX_raw + dY_raw * dY_raw);
      const bcDistance = Math.round(bcDirectDist);

      // Azimuth from BC to this Gun in mils (0 - 6400)
      // Rule 6: หากมีเศษทศนิยม ปัดเพิ่มเต็ม 1 มิล (Math.ceil)
      // Note: Artillery expects the azimuth FROM the Gun TO the Battery Center (Back Azimuth)
      let bcAzimuthMils = 0;
      if (gun.id === baseGunId || bcDirectDist < 0.1) {
        bcAzimuthMils = 0;
      } else {
        const angleDeg = (Math.atan2(-dX_raw, -dY_raw) * 180) / Math.PI;
        const rawMils = (angleDeg * 6400) / 360;
        const normalizedMils = ((rawMils % 6400) + 6400) % 6400;
        bcAzimuthMils = Math.ceil(normalizedMils) % 6400;
      }

      // Individual Piece-to-Crest Range:
      const individualCrestRange = Math.max(50, roundTo5(gun.maskDistance - rangeDisplacement));

      return {
        ...gun,
        isBaseGun: gun.id === baseGunId,
        rawX: dX_raw,
        rawY: dY_raw,
        bcAzimuthMils,       // มุมทิศ จาก ศก.ร้อย ถึง ป.หมู่ (มิลเลียม)
        bcDistance,          // ระยะ จาก ศก.ร้อย ถึง ป.หมู่ (เมตร)
        lateralDisplacement, // ซ้าย (-) / ขวา (+) [ปัดเต็ม 5 ม.]
        rangeDisplacement,   // หลัง (-) / หน้า (+) [ปัดเต็ม 5 ม.]
        individualCrestRange,// ระยะยอดกำบังเฉพาะกระบอก [ปัดเต็ม 5 ม.]
      };
    });
  }, [guns, numSquads, baseGunId, camera1Angle, directionOfFire, batteryAlignmentMode]);

  // -------------------------------------------------------------
  // CRITICAL / GOVERNING GUN IDENTIFICATION
  // -------------------------------------------------------------
  const criticalGun = useMemo(() => {
    if (displacementResults.length === 0) return null;
    return [...displacementResults].sort((a, b) => {
      if (b.maskAngle !== a.maskAngle) {
        return b.maskAngle - a.maskAngle;
      }
      return a.individualCrestRange - b.individualCrestRange;
    })[0];
  }, [displacementResults]);

  // -------------------------------------------------------------
  // MINIMUM QE 7-STEP CALCULATION ENGINE (รส. ๖-๕๐)
  // -------------------------------------------------------------
  const minQEResults = useMemo(() => {
    const chargeData = CHARGES_105MM[selectedChargeNum] || CHARGES_105MM[5];

    const calculatedGuns = displacementResults.map((gun) => {
      // Step 1: Mask Angle (มุม ก.)
      const angleA = gun.maskAngle;

      // Step 2: Vertical Clearance (มุม ข. = 5 / (R / 1000)) [ปัดขึ้นเต็ม ๑ มิลเลียม]
      const rangeInKm = gun.individualCrestRange / 1000;
      const angleB = Math.ceil(5 / rangeInKm);

      // Step 3: Trajectory Factor Component (มุม ค. = (ก + ข) * Factor) [ปัดขึ้นเต็ม ๑ มิลเลียม]
      const angleC = Math.ceil((angleA + angleB) * chargeData.rangeFactor);

      // Step 4: Site Clearance Angle (มุม ๑ = ก + ข + ค)
      const angle1 = angleA + angleB + angleC;

      // Step 5: Elevation Angle (มุม ๒ จากตารางยิงตาม บจ.)
      const angle2 = chargeData.elevationAngle2;

      // Step 6: 2-PE Angle (มุม ๓ = ๑ ซ่อม * ๒)
      const angle3 = chargeData.onePe * 2;

      // Step 7A: MIN QE สำหรับ ชนวนไว
      const minQEQuick = angle1 + angle2 + angle3;

      // Step 7B: MIN QE สำหรับ ชนวน VT
      const minQEVT = minQEQuick + chargeData.vtExtraClearance;

      const activeMinQE = fuzeType === 'VT' ? minQEVT : minQEQuick;
      const isSafe = currentCommandQE >= activeMinQE;
      const safetyMargin = currentCommandQE - activeMinQE;

      return {
        ...gun,
        angleA,
        angleB,
        angleC,
        angle1,
        angle2,
        angle3,
        minQEQuick,
        minQEVT,
        activeMinQE,
        isSafe,
        safetyMargin,
        isCritical: criticalGun?.id === gun.id,
      };
    });

    const worstMinQEQuick = Math.max(...calculatedGuns.map((g) => g.minQEQuick));
    const worstMinQEVT = Math.max(...calculatedGuns.map((g) => g.minQEVT));
    const maxMaskAngle = Math.max(...calculatedGuns.map((g) => g.angleA));
    const minCrestRange = Math.min(...calculatedGuns.map((g) => g.individualCrestRange));
    const allSafe = calculatedGuns.every((g) => g.isSafe);

    return {
      guns: calculatedGuns,
      chargeData,
      worstMinQEQuick,
      worstMinQEVT,
      maxMaskAngle,
      minCrestRange,
      allSafe,
      criticalGun,
    };
  }, [displacementResults, selectedChargeNum, fuzeType, currentCommandQE, criticalGun]);

  // -------------------------------------------------------------
  // TACTICAL SAFETY ALERTS
  // -------------------------------------------------------------
  const radarSafetyAlerts = useMemo(() => {
    const alerts: { id: string; type: 'CRITICAL' | 'WARNING'; message: string }[] = [];

    for (let i = 0; i < displacementResults.length; i++) {
      for (let j = 0; j < displacementResults.length; j++) {
        if (i === j) continue;
        const rear = displacementResults[i];
        const front = displacementResults[j];
        const deltaRange = front.rangeDisplacement - rear.rangeDisplacement;
        const deltaLat = Math.abs(front.lateralDisplacement - rear.lateralDisplacement);

        if (deltaRange > 5 && deltaRange <= 40 && deltaLat < 10) {
          alerts.push({
            id: `blast-${rear.id}-${front.id}`,
            type: 'CRITICAL',
            message: `⚠️ อันตรายแรงอัดปากลำกล้อง! หมู่ ${rear.id} อยู่แนวหลังและเบี่ยงเฉียด หมู่ ${front.id} (ระยะทางข้างเพียง ${deltaLat} ม.)`,
          });
        }
      }
    }

    minQEResults.guns.forEach((g) => {
      if (!g.isSafe) {
        alerts.push({
          id: `unsafe-${g.id}`,
          type: 'CRITICAL',
          message: `🚨 หมู่ ${g.id} มุมยิงปัจจุบัน (${currentCommandQE} มิล.) ต่ำกว่า MIN QE (${g.activeMinQE} มิล.) เสี่ยงวิถีกระสุนติดยอดไม้!`,
        });
      }
    });

    return alerts;
  }, [displacementResults, minQEResults, currentCommandQE]);

  // -------------------------------------------------------------
  // PRESETS
  // -------------------------------------------------------------
  const handleLoadPreset = (presetType: 'STANDARD_105' | 'DISPERSED_105' | 'CREST_CRITICAL_105') => {
    playTacticalClick(soundEnabled);
    if (presetType === 'STANDARD_105') {
      handleUpdateDirectionOfFire(1600);
      setBatteryAlignmentMode('ON_BC');
      setCamera1Angle(2400);
      setCamera2Angle(2450);
      setNumSquads(6);
      setBaseGunId(3);
      setSelectedChargeNum(5);
      setCurrentCommandQE(295);
      setGuns([
        { id: 1, name: 'หมู่ 1', azimuthFromCircle: 2760, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 42, maskDistance: 820 },
        { id: 2, name: 'หมู่ 2', azimuthFromCircle: 2640, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 48, maskDistance: 750 },
        { id: 3, name: 'หมู่ 3', azimuthFromCircle: 2520, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 45, maskDistance: 800 },
        { id: 4, name: 'หมู่ 4', azimuthFromCircle: 2400, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 50, maskDistance: 700 },
        { id: 5, name: 'หมู่ 5', azimuthFromCircle: 2280, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 55, maskDistance: 650 },
        { id: 6, name: 'หมู่ 6', azimuthFromCircle: 2150, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 52, maskDistance: 680 },
      ]);
    } else if (presetType === 'DISPERSED_105') {
      handleUpdateDirectionOfFire(1800);
      setBatteryAlignmentMode('DISPLACED_BC');
      setCamera1Angle(2200);
      setCamera2Angle(2280);
      setNumSquads(6);
      setBaseGunId(1);
      setSelectedChargeNum(4);
      setCurrentCommandQE(310);
      setGuns([
        { id: 1, name: 'หมู่ 1', azimuthFromCircle: 2000, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 55, maskDistance: 600 },
        { id: 2, name: 'หมู่ 2', azimuthFromCircle: 2150, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 58, maskDistance: 620 },
        { id: 3, name: 'หมู่ 3', azimuthFromCircle: 2300, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 62, maskDistance: 580 },
        { id: 4, name: 'หมู่ 4', azimuthFromCircle: 2450, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 65, maskDistance: 550 },
        { id: 5, name: 'หมู่ 5', azimuthFromCircle: 2600, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 60, maskDistance: 590 },
        { id: 6, name: 'หมู่ 6', azimuthFromCircle: 2750, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 54, maskDistance: 640 },
      ]);
    } else if (presetType === 'CREST_CRITICAL_105') {
      handleUpdateDirectionOfFire(1600);
      setBatteryAlignmentMode('ON_BC');
      setCamera1Angle(2400);
      setCamera2Angle(2460);
      setNumSquads(6);
      setBaseGunId(3);
      setSelectedChargeNum(5);
      setCurrentCommandQE(275);
      setGuns([
        { id: 1, name: 'หมู่ 1', azimuthFromCircle: 2150, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 70, maskDistance: 450 },
        { id: 2, name: 'หมู่ 2', azimuthFromCircle: 2280, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 78, maskDistance: 420 },
        { id: 3, name: 'หมู่ 3', azimuthFromCircle: 2400, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 82, maskDistance: 390 },
        { id: 4, name: 'หมู่ 4', azimuthFromCircle: 2520, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 85, maskDistance: 380 },
        { id: 5, name: 'หมู่ 5', azimuthFromCircle: 2640, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 80, maskDistance: 410 },
        { id: 6, name: 'หมู่ 6', azimuthFromCircle: 2760, angleAFromCircle: 20, calculatedDistance: 100, maskAngle: 72, maskDistance: 460 },
      ]);
    }
  };

  // -------------------------------------------------------------
  // OFFICIAL REPORT FORM TEXT GENERATION
  // -------------------------------------------------------------
  const generatedReportText = useMemo(() => {
    const timestamp = new Date().toLocaleString('th-TH');
    const chargeData = minQEResults.chargeData;

    return `================================================================
แบบรายงานและระบบสั่งการ รอง ผบ.ร้อย ป. (มาตรฐาน ๑๐๕ มม.)
หน่วย: ${batteryName}
ผู้รายงาน: ${commanderTitle}
พิกัดที่ตั้งยิง (ลลขต.): ${gridCoords}
วันที่/เวลา: ${timestamp}
----------------------------------------------------------------
พารามิเตอร์หลักฐาน:
- ทิศทางยิงหลัก (DOF): ${directionOfFire} มิลเลียม
- ลักษณะการตั้งยิง ศก.ร้อย: ${batteryAlignmentMode === 'ON_BC' ? '๑. ทับ ศก.ร้อย (หมู่ ๑,๒ ขวา / หมู่ ๔ ซ้าย)' : '๒. คลาด ศก.ร้อย (หมู่ ๑,๒ ขวา / หมู่ ๓,๔ ซ้าย)'}
- ศก.ร้อย. - กล้อง ๑: ${camera1Angle} มิล. | กล้อง ๒: ${camera2Angle} มิล.
- จำนวนหมู่: ${numSquads} หมู่ | หมู่หลัก: หมู่ ${baseGunId}
- ส่วนบรรจุที่เลือก: ${chargeData.label} (มุมสูง: ${chargeData.elevationAngle2} มิล., ๒ ซ่อม: ${chargeData.onePe * 2} มิล.)
- มุมยิงคำสั่งปัจจุบัน: ${currentCommandQE} มิลเลียม

----------------------------------------------------------------
[๑] ตารางคำนวณปืนคลาด ศก.ร้อย. และระยะลดเหลื่อม (ปัดเต็ม ๕ ม.)
----------------------------------------------------------------
${displacementResults
  .map(
    (g) =>
      `หมู่ ${g.id}${g.isBaseGun ? ' (หมู่หลัก)' : ''}:
  - หลักฐานจาก จก. ถึง ป.: มุมทิศ ${g.azimuthFromCircle} มิล. | มุม ก. ${g.angleAFromCircle} มิล. | ระยะ ${g.calculatedDistance} ม.
  - หลักฐานจาก ศก.ร้อย ถึง ป.: มุมทิศ ${g.bcAzimuthMils.toString().padStart(4, '0')} มิล. | ระยะ ${g.bcDistance} ม.
  - มุมพื้นที่ยอดกำบัง: มุม ${g.maskAngle} มิล. | ระยะ ${g.maskDistance} ม.
  - ระยะลดเหลื่อม: ${g.lateralDisplacement >= 0 ? 'ขวา' : 'ซ้าย'} ${Math.abs(g.lateralDisplacement)} ม. | ${g.rangeDisplacement >= 0 ? 'หน้า' : 'หลัง'} ${Math.abs(g.rangeDisplacement)} ม. | ระยะยอดกำบัง Ri: ${g.individualCrestRange} ม.`
  )
  .join('\n\n')}

----------------------------------------------------------------
[๒] สรุปผลการคำนวณมุมยิงต่ำสุด (MIN QE Safety รส. ๖-๕๐)
----------------------------------------------------------------
* การพิจารณาหมู่ที่วิกฤตที่สุด: ${criticalGun ? `หมู่ ${criticalGun.id} (มุมพื้นที่ยอดกำบังมากสุด ${criticalGun.maskAngle} มิล., ระยะ ${criticalGun.individualCrestRange} ม.)` : '-'}
* เกณฑ์ MIN QE กองร้อย:
  - ชนวนไว (Quick / PD Fuze): ${minQEResults.worstMinQEQuick} มิลเลียม
  - ชนวน VT (Variable Time Fuze): ${minQEResults.worstMinQEVT} มิลเลียม

รายละเอียดรายกระบอก (${numSquads} หมู่):
${minQEResults.guns
  .map(
    (g) =>
      `หมู่ ${g.id}${g.isCritical ? ' ⚠️ [หมู่ที่ใช้พิจารณา MIN QE]' : ''}:
  - ขั้นที่ ๑ (มุม ก. ยอดกำบัง): ${g.angleA} มิล.
  - ขั้นที่ ๒ (มุม ข. เพิ่มเผื่อดิ่ง): ${g.angleB} มิล. (5 / ${g.individualCrestRange / 1000} กม.)
  - ขั้นที่ ๓ (มุม ค. ชดเชยวิถี): ${g.angleC} มิล.
  - ขั้นที่ ๔ (มุม ๑ พื้นที่ยิง): ${g.angle1} มิล.
  - ขั้นที่ ๕ (มุม ๒ มุมสูง): ${g.angle2} มิล.
  - ขั้นที่ ๖ (มุม ๓ สองซ่อม): ${g.angle3} มิล.
  - ขั้นที่ ๗A [MIN QE ชนวนไว]: ${g.minQEQuick} มิลเลียม
  - ขั้นที่ ๗B [MIN QE ชนวน VT]: ${g.minQEVT} มิลเลียม
  -> สถานะ: [${g.isSafe ? '🟢 ปลอดภัย (SAFE)' : '🔴 อันตราย (UNSAFE - วิถีติดยอดไม้)'}]`
  )
  .join('\n\n')}

----------------------------------------------------------------
[๓] ข้อมูลพล็อตพิกัดแผ่นกรุย M.17 (M.17 Plotting Board Data)
----------------------------------------------------------------
${displacementResults
  .map(
    (g) =>
      `หมู่ ${g.id}: พิกัด X=${g.lateralDisplacement >= 0 ? '+' : ''}${g.lateralDisplacement}ม. (${g.lateralDisplacement >= 0 ? 'ขวา' : 'ซ้าย'}), Y=${g.rangeDisplacement >= 0 ? '+' : ''}${g.rangeDisplacement}ม. (${g.rangeDisplacement >= 0 ? 'หน้า' : 'หลัง'})`
  )
  .join('\n')}
================================================================`;
  }, [
    batteryName,
    commanderTitle,
    gridCoords,
    directionOfFire,
    camera1Angle,
    camera2Angle,
    numSquads,
    baseGunId,
    currentCommandQE,
    displacementResults,
    criticalGun,
    minQEResults,
    batteryAlignmentMode,
  ]);

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generatedReportText);
    setCopiedNotification(true);
    playTacticalClick(soundEnabled);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handleDownloadReport = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedReportText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `แบบฟอร์มรายงาน_รองผบร้อย_ป_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    playTacticalClick(soundEnabled);
  };

  return (
    <div className="w-full h-full bg-[#030a05] text-[#10b981] flex flex-col overflow-hidden font-sans font-light select-none">
      {/* 1. TOP COMMANDER HEADER */}
      <div className="bg-[#07140b] border-b border-[#1b2f21] px-3 py-2 sm:px-5 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0e2415] border border-[#10b981] flex items-center justify-center text-[#CEDE62] shadow-[0_0_10px_rgba(206,222,98,0.3)]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-gray-100 tracking-wide">
                ระบบสั่งการและแบบรายงาน รอง ผบ.ร้อย ป.
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#CEDE62]/20 border border-[#CEDE62]/50 text-[#CEDE62] text-[10px] font-semibold">
                ป.๔ พัน.๔ ร้อย.๒ (๑๐๕ มม.)
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block truncate">
              {batteryName} • ทิศทางยิง {directionOfFire} มิล. • รส. ๖-๕๐
            </span>
          </div>
        </div>

        {/* Sub-Nav Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('DASHBOARD');
              playTacticalClick(soundEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'DASHBOARD'
                ? 'bg-[#142e1b] text-[#CEDE62] border border-[#CEDE62] shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                : 'bg-[#0a180e] text-gray-400 border border-[#1b2f21] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>แผงควบคุมหลัก</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('RADAR');
              playTacticalClick(soundEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'RADAR'
                ? 'bg-[#142e1b] text-[#CEDE62] border border-[#CEDE62] shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                : 'bg-[#0a180e] text-gray-400 border border-[#1b2f21] hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>แผ่นกรุย M.17</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('MIN_QE');
              playTacticalClick(soundEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'MIN_QE'
                ? 'bg-[#142e1b] text-[#CEDE62] border border-[#CEDE62] shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                : 'bg-[#0a180e] text-gray-400 border border-[#1b2f21] hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>มุมยิงต่ำสุด (MIN QE)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('FORM_REPORT');
              playTacticalClick(soundEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'FORM_REPORT'
                ? 'bg-[#142e1b] text-[#CEDE62] border border-[#CEDE62] shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                : 'bg-[#0a180e] text-gray-400 border border-[#1b2f21] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>แบบรายงานสนาม</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN BODY */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-7xl w-full mx-auto space-y-4">
        {/* CRITICAL SAFETY ALERT BANNER */}
        {radarSafetyAlerts.length > 0 && (
          <div className="bg-red-950/80 border-2 border-red-500 rounded-xl p-3 sm:p-4 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-sm text-red-300 block">
                  ตรวจพบเงื่อนไขความปลอดภัยวิกฤต (TACTICAL SAFETY INTERLOCK)
                </span>
                {radarSafetyAlerts.map((alt) => (
                  <p key={alt.id} className="font-medium text-red-200">
                    {alt.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: DASHBOARD                                               */}
        {/* ============================================================== */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4">
            {/* Presets & Top Summary Bar */}
            <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">ชุดข้อมูลสถานการณ์สนาม:</span>
                <button
                  type="button"
                  onClick={() => handleLoadPreset('STANDARD_105')}
                  className="px-2.5 py-1 bg-[#102414] hover:bg-[#18351e] text-[#CEDE62] border border-[#1b2f21] rounded text-xs font-semibold transition-colors"
                >
                  มาตรฐาน ๑๐๕ มม.
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPreset('DISPERSED_105')}
                  className="px-2.5 py-1 bg-[#102414] hover:bg-[#18351e] text-[#3be099] border border-[#1b2f21] rounded text-xs font-semibold transition-colors"
                >
                  ตั้งปืนกระจายภูมิประเทศ (๑๐๕ มม.)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPreset('CREST_CRITICAL_105')}
                  className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 rounded text-xs font-semibold transition-colors"
                >
                  ยอดกำบังชันวิกฤต (๑๐๕ มม.)
                </button>
              </div>

              {/* Critical Piece Badge & MIN QE Summary */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {criticalGun && (
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500 text-amber-300 font-semibold text-[11px]">
                    ⚠️ หมู่พิจารณาหลัก: หมู่ {criticalGun.id} (มุม {criticalGun.maskAngle} มิล., ระยะ {criticalGun.individualCrestRange} ม.)
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">
                    MIN QE ชนวนไว:{' '}
                    <span className="text-[#CEDE62] font-semibold text-sm">
                      {minQEResults.worstMinQEQuick} มิล.
                    </span>
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-300">
                    ชนวน VT:{' '}
                    <span className="text-cyan-300 font-semibold text-sm">
                      {minQEResults.worstMinQEVT} มิล.
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Dashboard Control Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: ทิศทางยิงหลัก (DOF) */}
              <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold flex items-center gap-1 text-[#CEDE62]">
                    <Compass className="w-3.5 h-3.5" />
                    ทิศทางยิงหลัก (DOF)
                  </span>
                   <button type="button"
                     onClick={() => handleUpdateDirectionOfFire(camera1Angle)}
                     className="text-[10px] text-emerald-400 font-medium cursor-pointer underline">
                     เชื่อมต่อเข็มทิศ
                   </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={6400}
                    step={10}
                    value={directionOfFire}
                    onChange={(e) => handleUpdateDirectionOfFire(Number(e.target.value) || 0)}
                    className="w-full bg-[#040e07] border border-[#1b2f21] rounded px-2.5 py-1.5 text-white text-sm focus:border-[#CEDE62] outline-none font-semibold"
                  />
                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                    {Math.round((directionOfFire * 360) / 6400)}°
                  </span>
                </div>

                {/* 2 ตัวเลือก: ๑.ทับ ศก.ร้อย ๒.คลาด ศก.ร้อย */}
                <div className="pt-1.5 border-t border-[#1b2f21]">
                  <span className="text-[10px] text-gray-400 font-medium block mb-1">
                    ลักษณะ ศก.ร้อย:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBatteryAlignmentMode('ON_BC');
                        playTacticalClick(soundEnabled);
                      }}
                      className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-all text-center flex flex-col items-center justify-center leading-tight ${
                        batteryAlignmentMode === 'ON_BC'
                          ? 'bg-[#1b3b24] text-[#CEDE62] border border-[#CEDE62] shadow-[0_0_8px_rgba(206,222,98,0.3)]'
                          : 'bg-[#040e07] text-gray-400 border border-[#1b2f21] hover:text-white'
                      }`}
                    >
                      <span>๑. ทับ ศก.ร้อย</span>
                      <span className="text-[8.5px] opacity-80 mt-0.5">หมู่ ๑,๒ ขวา / หมู่ ๔ ซ้าย</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBatteryAlignmentMode('DISPLACED_BC');
                        playTacticalClick(soundEnabled);
                      }}
                      className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-all text-center flex flex-col items-center justify-center leading-tight ${
                        batteryAlignmentMode === 'DISPLACED_BC'
                          ? 'bg-[#142e2b] text-cyan-300 border border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                          : 'bg-[#040e07] text-gray-400 border border-[#1b2f21] hover:text-white'
                      }`}
                    >
                      <span>๒. คลาด ศก.ร้อย</span>
                      <span className="text-[8.5px] opacity-80 mt-0.5">หมู่ ๑,๒ ขวา / หมู่ ๓,๔ ซ้าย</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: ศก.ร้อย. - กล้อง 1 และ กล้อง 2 */}
              <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold flex items-center gap-1 text-[#3be099]">
                    <Target className="w-3.5 h-3.5" />
                    ศก.ร้อย. - กล้อง ๑ / ๒
                  </span>
                  {batteryAlignmentMode === 'ON_BC' && (
                    <span className="text-[9px] text-[#CEDE62] font-semibold bg-[#CEDE62]/20 px-1 rounded">
                      ทับหมู่หลัก ({baseGunId})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">
                      กล้อง ๑ {batteryAlignmentMode === 'ON_BC' ? '(ทับหลัก)' : ''}
                    </span>
                    <input
                      type="number"
                      value={camera1Angle}
                      onChange={(e) => setCamera1Angle(Number(e.target.value) || 0)}
                      disabled={batteryAlignmentMode === 'ON_BC'}
                      className={`w-full bg-[#040e07] border rounded px-2 py-1.5 text-xs outline-none font-semibold ${
                        batteryAlignmentMode === 'ON_BC'
                          ? 'border-[#CEDE62]/60 text-[#CEDE62] cursor-not-allowed opacity-90'
                          : 'border-[#1b2f21] text-white focus:border-[#3be099]'
                      }`}
                      placeholder="กล้อง 1"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">กล้อง ๒ (มิล.)</span>
                    <input
                      type="number"
                      value={camera2Angle}
                      onChange={(e) => setCamera2Angle(Number(e.target.value) || 0)}
                      className="w-full bg-[#040e07] border border-[#1b2f21] rounded px-2 py-1.5 text-white text-xs focus:border-[#3be099] outline-none font-semibold"
                      placeholder="กล้อง 2"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 block">
                  {batteryAlignmentMode === 'ON_BC'
                    ? `กล้อง ๑ ตรงกับหมู่หลัก (${baseGunId}) อัตโนมัติ`
                    : 'ฐานมุมเล็งจุดตั้งกล้อง ศก.ร้อย.'}
                </span>
              </div>

              {/* Card 3: จำนวนหมู่ (1-6) & ปืนหมู่หลัก (1-6) */}
              <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold flex items-center gap-1 text-amber-400">
                    <Layers className="w-3.5 h-3.5" />
                    การจัดกำลัง ป.ร้อย
                  </span>
                  <span className="text-[10px]">หมู่ 1-6</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">จำนวนหมู่ (1-6)</span>
                    <select
                      value={numSquads}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 6;
                        setNumSquads(val);
                        if (baseGunId > val) setBaseGunId(val);
                      }}
                      className="w-full bg-[#040e07] border border-[#1b2f21] rounded px-2 py-1.5 text-white text-xs focus:border-amber-400 outline-none font-semibold cursor-pointer"
                    >
                      <option value={1}>1 หมู่</option>
                      <option value={2}>2 หมู่</option>
                      <option value={3}>3 หมู่</option>
                      <option value={4}>4 หมู่</option>
                      <option value={5}>5 หมู่</option>
                      <option value={6}>6 หมู่</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">ปืนหมู่หลัก</span>
                    <select
                      value={baseGunId}
                      onChange={(e) => setBaseGunId(Number(e.target.value) || 1)}
                      className="w-full bg-[#040e07] border border-[#1b2f21] rounded px-2 py-1.5 text-[#CEDE62] text-xs focus:border-[#CEDE62] outline-none font-semibold cursor-pointer"
                    >
                      {Array.from({ length: numSquads }, (_, i) => i + 1).map((id) => (
                        <option key={`base-gun-opt-${id}`} value={id}>
                          หมู่ {id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 block">
                  ปืนหมู่หลักอ้างอิง: หมู่ {baseGunId}
                </span>
              </div>

              {/* Card 4: ส่วนบรรจุ 105 มม. & ชนวน */}
              <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold flex items-center gap-1 text-cyan-400">
                    <Flame className="w-3.5 h-3.5" />
                    ส่วนบรรจุ & ชนวน (105มม.)
                  </span>
                  <span className="text-[10px]">บจ. ๑-๗</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">เลือก บจ.</span>
                    <select
                      value={selectedChargeNum}
                      onChange={(e) => setSelectedChargeNum(Number(e.target.value) || 5)}
                      className="w-full bg-[#040e07] border border-[#1b2f21] text-white rounded px-2 py-1.5 text-xs outline-none font-semibold cursor-pointer"
                    >
                      <option value={1}>บจ. ๑</option>
                      <option value={2}>บจ. ๒</option>
                      <option value={3}>บจ. ๓</option>
                      <option value={4}>บจ. ๔</option>
                      <option value={5}>บจ. ๕</option>
                      <option value={6}>บจ. ๖</option>
                      <option value={7}>บจ. ๗</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">ชนวนยิง</span>
                    <select
                      value={fuzeType}
                      onChange={(e) => setFuzeType(e.target.value as any)}
                      className="w-full bg-[#040e07] border border-[#1b2f21] text-[#CEDE62] rounded px-2 py-1.5 text-xs outline-none font-semibold cursor-pointer"
                    >
                      <option value="ALL">ทั้งไว & VT</option>
                      <option value="QUICK">1. ชนวนไว</option>
                      <option value="VT">2. ชนวน VT</option>
                    </select>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 block">
                  มุมสูง: {minQEResults.chargeData.elevationAngle2} มิล. | ๒ ซ่อม: {minQEResults.chargeData.onePe * 2} มิล.
                </span>
              </div>
            </div>

            {/* Displacement Table with SWAPPED COLUMNS:
                1. หมู่ (1-6)
                2. หลักฐานจาก จก. ถึง หมู่ ป. และ ศก.ร้อย [มุมทิศ | มุม ก. | ระยะ]
                3. หลักฐานจาก ศก.ร้อย / ปืนหลัก ถึง ป. [มุมทิศ | ระยะ]   <-- SWAPPED HERE
                4. มุมพื้นที่ยอดกำบัง [มุม | ระยะ]                       <-- SWAPPED HERE
                5. ระยะลดเหลื่อม / ปืนคลาด [ซ้าย/ขวา | หน้า/หลัง | ระยะ Ri]
                6. MIN QE (ไว / VT)
                7. สถานะ
            */}
            <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1b2f21] pb-2.5">
                <div>
                  <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-[#CEDE62]" />
                    ตารางคำนวณ ปืนคลาด ศก.ร้อย. และระยะลดเหลื่อม (ระบบ ป. ๑๐๕ มม. {numSquads} หมู่)
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    กรอกมุมทิศ และ มุม ก. เพื่อคำนวณระยะอัตโนมัติ (Default 100 ม.) พร้อมคำนวณผลต่างเวกเตอร์และ MIN QE
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                    batteryAlignmentMode === 'ON_BC'
                      ? 'bg-[#1b3b24] border-[#CEDE62] text-[#CEDE62]'
                      : 'bg-[#142e2b] border-cyan-400 text-cyan-300'
                  }`}>
                    {batteryAlignmentMode === 'ON_BC' ? '๑. ทับ ศก.ร้อย (หมู่ ๑,๒ ขวา | หมู่ ๔ ซ้าย)' : '๒. คลาด ศก.ร้อย (หมู่ ๑,๒ ขวา | หมู่ ๓,๔ ซ้าย)'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#102414] border border-[#1b2f21] text-[#3be099] text-xs font-semibold">
                    ปัดเศษมิลเลียมเต็ม ๑ มิล • ระยะลดเหลื่อมปัดเต็ม ๕ ม.
                  </span>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-[#040e07] text-gray-300 border-b border-[#1b2f21]">
                      <th rowSpan={2} className="py-2.5 px-3 whitespace-nowrap align-middle border-r border-[#1b2f21] font-semibold text-white">
                        หมู่
                      </th>
                      <th colSpan={3} className="py-2 px-3 text-center text-[#3be099] border-r border-[#1b2f21] bg-[#07190d] font-semibold">
                        หลักฐานจากจุดตั้งกล้อง (จก.) ถึง หมู่ ป. และ ศก.ร้อย
                      </th>
                      {/* SWAPPED: 1. หลักฐานจาก ศก.ร้อย / ปืนหลัก ถึงหมู่ปืน */}
                      <th colSpan={2} className="py-2 px-3 text-center text-[#CEDE62] border-r border-[#1b2f21] bg-[#102414] font-semibold">
                        หลักฐานจาก ศก.ร้อย / ปืนหลัก ถึงหมู่ปืน
                      </th>
                      {/* SWAPPED: 2. มุมพื้นที่ยอดกำบัง */}
                      <th colSpan={2} className="py-2 px-3 text-center text-amber-300 border-r border-[#1b2f21] bg-[#0c1f10]/50 font-semibold">
                        มุมพื้นที่ยอดกำบัง
                      </th>
                      <th colSpan={3} className="py-2 px-3 text-center text-cyan-300 border-r border-[#1b2f21] bg-[#081f18]/60 font-semibold">
                        ระยะลดเหลื่อม / ปืนคลาด
                      </th>
                      <th rowSpan={2} className="py-2 px-3 text-center whitespace-nowrap align-middle border-r border-[#1b2f21] font-semibold text-gray-200">
                        MIN QE (ไว / VT)
                        <span className="block text-[9px] text-gray-400 font-normal">มิลเลียม</span>
                      </th>
                      <th rowSpan={2} className="py-2 px-3 text-center whitespace-nowrap align-middle font-semibold text-gray-200">
                        สถานะ
                      </th>
                    </tr>
                    <tr className="bg-[#020904] text-[10px] text-gray-400 border-b border-[#1b2f21]">
                      {/* จาก จก. */}
                      <th className="py-1.5 px-2 text-center whitespace-nowrap">มุมทิศ (มิล.)<br/><span className="text-[8.5px] text-gray-500">จาก จก.</span></th>
                      <th className="py-1.5 px-2 text-center whitespace-nowrap">มุม ก. (มิล.)<br/><span className="text-[8.5px] text-gray-500">มุมสเตเดีย</span></th>
                      <th className="py-1.5 px-2 text-center text-[#3be099] border-r border-[#1b2f21] whitespace-nowrap">ระยะ (ม.)<br/><span className="text-[8.5px] text-gray-500">Default 100ม.</span></th>

                      {/* จาก ศก.ร้อย (Swapped to Column 3) */}
                      <th className="py-1.5 px-2 text-center text-[#CEDE62] whitespace-nowrap">มุมทิศ (มิล.)<br/><span className="text-[8.5px] text-gray-500">ศก.ร้อย ➔ ป.</span></th>
                      <th className="py-1.5 px-2 text-center text-[#CEDE62] border-r border-[#1b2f21] whitespace-nowrap">ระยะ (ม.)<br/><span className="text-[8.5px] text-gray-500">ศก.ร้อย ➔ ป.</span></th>

                      {/* ยอดกำบัง (Swapped to Column 4) */}
                      <th className="py-1.5 px-2 text-center text-amber-400 whitespace-nowrap">มุม (3 หลัก)<br/><span className="text-[8.5px] text-gray-500">มิลเลียม</span></th>
                      <th className="py-1.5 px-2 text-center text-amber-400 border-r border-[#1b2f21] whitespace-nowrap">ระยะ (3-4 หลัก)<br/><span className="text-[8.5px] text-gray-500">เมตร</span></th>

                      {/* ลดเหลื่อม */}
                      <th className="py-1.5 px-2 text-center text-[#CEDE62] whitespace-nowrap">ซ้าย/ขวา<br/><span className="text-[8.5px] text-gray-500">ปัด ๕ ม.</span></th>
                      <th className="py-1.5 px-2 text-center text-[#3be099] whitespace-nowrap">หน้า/หลัง<br/><span className="text-[8.5px] text-gray-500">ปัด ๕ ม.</span></th>
                      <th className="py-1.5 px-2 text-center text-amber-300 border-r border-[#1b2f21] whitespace-nowrap">ระยะ Ri<br/><span className="text-[8.5px] text-gray-500">ปัด ๕ ม.</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1b2f21]">
                    {minQEResults.guns.map((gun) => (
                      <tr
                        key={gun.id}
                        className={`hover:bg-[#0d2113] transition-colors ${
                          gun.isCritical ? 'bg-amber-950/20' : ''
                        } ${!gun.isSafe ? 'bg-red-950/30' : ''}`}
                      >
                        {/* Gun Squad Number (Only squad number e.g. 1, 2, 3...) */}
                        <td className="py-2 px-2.5 font-semibold text-white whitespace-nowrap border-r border-[#1b2f21]">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                gun.isBaseGun ? 'bg-[#CEDE62]' : 'bg-[#3be099]'
                              }`}
                            />
                            <span className="font-bold text-sm">{gun.id}</span>
                            {gun.isBaseGun && (
                              <span className="px-1 py-0.2 bg-[#CEDE62]/20 text-[#CEDE62] border border-[#CEDE62]/40 rounded text-[9px] font-semibold">
                                หลัก
                              </span>
                            )}
                            {gun.isCritical && (
                              <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-semibold">
                                วิกฤต
                              </span>
                            )}
                          </div>
                        </td>

                        {/* หลักฐานจาก จก.: มุมทิศ */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            value={gun.azimuthFromCircle}
                            onChange={(e) =>
                              handleUpdateGun(gun.id, 'azimuthFromCircle', Number(e.target.value) || 0)
                            }
                            className="w-16 sm:w-20 bg-[#040e07] border border-[#1b2f21] rounded px-1.5 py-1 text-white text-xs outline-none focus:border-[#CEDE62] text-center font-semibold"
                          />
                        </td>

                        {/* หลักฐานจาก จก.: มุม ก. */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            value={gun.angleAFromCircle}
                            onChange={(e) =>
                              handleUpdateGun(gun.id, 'angleAFromCircle', Number(e.target.value) || 0)
                            }
                            className="w-14 sm:w-16 bg-[#040e07] border border-[#1b2f21] rounded px-1.5 py-1 text-[#3be099] text-xs outline-none focus:border-[#3be099] text-center font-semibold"
                          />
                        </td>

                        {/* หลักฐานจาก จก.: ระยะ (คำนวณอัตโนมัติจาก มุม ก.) */}
                        <td className="py-2 px-2.5 font-semibold text-[#3be099] text-center border-r border-[#1b2f21] whitespace-nowrap">
                          <span className="px-2 py-1 bg-[#0a1f11] rounded border border-[#1b2f21] inline-block whitespace-nowrap min-w-[56px] text-center">
                            {gun.calculatedDistance} ม.
                          </span>
                        </td>

                        {/* SWAPPED: หลักฐานจาก ศก.ร้อย: มุมทิศ (มิล.) */}
                        <td className="py-2 px-2 text-center font-semibold text-[#CEDE62] bg-[#0c1f12]/30">
                          <span className="px-2 py-1 bg-[#122b19] text-[#CEDE62] rounded border border-[#CEDE62]/40 text-xs inline-block min-w-[50px]">
                            {gun.isBaseGun && batteryAlignmentMode === 'ON_BC' ? '-' : gun.bcAzimuthMils.toString().padStart(4, '0')}
                          </span>
                        </td>

                        {/* SWAPPED: หลักฐานจาก ศก.ร้อย: ระยะ (ม.) */}
                        <td className="py-2 px-2 text-center font-semibold text-[#CEDE62] border-r border-[#1b2f21] bg-[#0c1f12]/30">
                          <span className="px-2 py-1 bg-[#122b19] text-[#CEDE62] rounded border border-[#CEDE62]/40 text-xs inline-block min-w-[45px]">
                            {gun.isBaseGun && batteryAlignmentMode === 'ON_BC' ? '0' : `${gun.bcDistance} ม.`}
                          </span>
                        </td>

                        {/* SWAPPED: มุมพื้นที่ยอดกำบัง (ช่อง 1: มุม 3 หลัก) */}
                        <td className="py-2 px-2 text-center bg-[#07170b]/40">
                          <input
                            type="number"
                            max={999}
                            value={gun.maskAngle}
                            onChange={(e) =>
                              handleUpdateGun(gun.id, 'maskAngle', Number(e.target.value) || 0)
                            }
                            className="w-14 sm:w-16 bg-[#040e07] border border-[#1b2f21] rounded px-1.5 py-1 text-amber-300 text-xs outline-none focus:border-amber-400 text-center font-semibold"
                            placeholder="045"
                          />
                        </td>

                        {/* SWAPPED: มุมพื้นที่ยอดกำบัง (ช่อง 2: ระยะ) */}
                        <td className="py-2 px-2 text-center border-r border-[#1b2f21] bg-[#07170b]/40">
                          <input
                            type="number"
                            value={gun.maskDistance}
                            onChange={(e) =>
                              handleUpdateGun(gun.id, 'maskDistance', Number(e.target.value) || 0)
                            }
                            className="w-16 sm:w-20 bg-[#040e07] border border-[#1b2f21] rounded px-1.5 py-1 text-amber-200 text-xs outline-none focus:border-amber-400 text-center font-semibold"
                            placeholder="800"
                          />
                        </td>

                        {/* ซ้าย/ขวา (ปัดเต็ม 5 ม.) */}
                        <td className="py-2 px-2.5 font-semibold whitespace-nowrap text-center">
                          <span className={gun.lateralDisplacement >= 0 ? 'text-[#CEDE62]' : 'text-cyan-400'}>
                            {gun.lateralDisplacement >= 0 ? 'ขวา' : 'ซ้าย'} {Math.abs(gun.lateralDisplacement)} ม.
                          </span>
                        </td>

                        {/* หน้า/หลัง (ปัดเต็ม 5 ม.) */}
                        <td className="py-2 px-2.5 font-semibold whitespace-nowrap text-center">
                          <span className={gun.rangeDisplacement >= 0 ? 'text-amber-400' : 'text-purple-400'}>
                            {gun.rangeDisplacement >= 0 ? 'หน้า' : 'หลัง'} {Math.abs(gun.rangeDisplacement)} ม.
                          </span>
                        </td>

                        {/* ระยะกำบัง Ri (ปัดเต็ม 5 ม.) */}
                        <td className="py-2 px-2.5 text-amber-200 font-semibold whitespace-nowrap text-center border-r border-[#1b2f21]">
                          {gun.individualCrestRange} ม.
                        </td>

                        {/* MIN QE (ไว / VT) */}
                        <td className="py-2 px-2.5 font-semibold text-center whitespace-nowrap border-r border-[#1b2f21]">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-white">{gun.minQEQuick}</span>
                            <span className="text-gray-500">/</span>
                            <span className="text-cyan-300">{gun.minQEVT}</span>
                          </div>
                        </td>

                        {/* สถานะ */}
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          {gun.isSafe ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 font-semibold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              SAFE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 border border-red-500 text-red-300 font-semibold text-[10px] animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              UNSAFE
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: AUTHENTIC M.17 PLOTTING BOARD                           */}
        {/* ============================================================== */}
        {activeTab === 'RADAR' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: M.17 Plotting Board Canvas */}
            <div className="lg:col-span-2 bg-[#051108] border border-[#1b2f21] rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[490px]">
              {/* Header Badge */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00fc00] animate-pulse" />
                  <span className="font-semibold text-[#00fc00]">
                    แผ่นกรุย M.17 (M.17 Artillery Plotting Board)
                  </span>
                </div>
                <div className="text-gray-400 text-[11px] font-medium">
                  สเกล 0-6400 มิลเลียม (0-64) • วงระยะ 20, 40, 60, 80, 100 ม.
                </div>
              </div>

              {/* M.17 SVG DISPLAY WITH AUTHENTIC PROTRACTOR DISC */}
              <div className="relative w-full max-w-[460px] aspect-square flex items-center justify-center my-4">
                <svg viewBox="-230 -230 460 460" className="w-full h-full overflow-visible">
                  <defs>
                    <marker id="m17ArrowGreen" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#00fc00" />
                    </marker>
                    <clipPath id="m17BaseClip">
                      <circle cx="0" cy="0" r="215" />
                    </clipPath>
                    <clipPath id="m17DiscClip">
                      <circle cx="0" cy="0" r="210" />
                    </clipPath>
                  </defs>

                  {/* 1. Realistic Base Plate (แผ่นล่าง) */}
                  <image 
                    href="/แผ่นล่าง.jpg" 
                    x="-230" y="-230" width="460" height="460" 
                    preserveAspectRatio="xMidYMid meet" 
                    clipPath="url(#m17BaseClip)" 
                  />

                  {/* 2. Realistic Top Disc (แผ่นบน) */}
                  <image 
                    href="/แผ่นบน.png" 
                    x="-230" y="-230" width="460" height="460" 
                    preserveAspectRatio="xMidYMid meet"
                    clipPath="url(#m17DiscClip)"
                  />

                  {/* 4. Direction of Fire (LOF Vector pointing forward along DOF angle) */}
                  <g transform={`rotate(${(directionOfFire * 360) / 6400})`}>
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="-195"
                      stroke="#00fc00"
                      strokeWidth="2.2"
                      strokeDasharray="6,4"
                      markerEnd="url(#m17ArrowGreen)"
                    />
                    <text x="6" y="-175" fill="#00fc00" fontSize="8" fontWeight="bold">
                      ทิศทางยิง (DOF {directionOfFire})
                    </text>
                  </g>

                  {/* 5. Center of Battery (ศก.ร้อย. Pivot) */}
                  <circle cx="0" cy="0" r="4.5" fill="#CEDE62" />
                  <circle cx="0" cy="0" r="9" fill="none" stroke="#CEDE62" strokeWidth="1.5" />
                  <text x="12" y="4" fill="#CEDE62" fontSize="8.5" fontWeight="bold">
                    ศก.ร้อย. (0,0)
                  </text>

                  {/* 6. Gun Plots (1 ถึง 6) on M17 Board */}
                  {minQEResults.guns.map((gun) => {
                    // SVG mapping: Scale 1.5px per meter along X/Y
                    const px = gun.lateralDisplacement * 1.5;
                    const py = -gun.rangeDisplacement * 1.5;

                    return (
                      <g
                        key={`m17-gun-${gun.id}`}
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() => setSelectedGunForSim(gun.id)}
                      >
                        {/* Line of Fire for specific piece */}
                        <line
                          x1={px}
                          y1={py}
                          x2={px}
                          y2={py - 35}
                          stroke={gun.isSafe ? '#00fc00' : '#ef4444'}
                          strokeWidth={gun.isSafe ? '1.4' : '2'}
                          strokeDasharray={gun.isSafe ? '3,3' : 'none'}
                        />

                        {/* Gun Position Symbol */}
                        <polygon
                          points={`${px},${py - 7} ${px - 4},${py + 4} ${px},${py + 2} ${px + 4},${py + 4}`}
                          fill={gun.isBaseGun ? '#CEDE62' : gun.isSafe ? '#00fc00' : '#ef4444'}
                          stroke="#020904"
                          strokeWidth="1"
                        />

                        {/* Tag label */}
                        <rect
                          x={px + 5}
                          y={py - 9}
                          width="48"
                          height="15"
                          rx="3"
                          fill="#051408"
                          fillOpacity="0.9"
                          stroke={gun.isBaseGun ? '#CEDE62' : gun.isSafe ? '#1b4d24' : '#7f1d1d'}
                          strokeWidth="1"
                        />
                        <text
                          x={px + 8}
                          y={py + 2}
                          fill={gun.isBaseGun ? '#CEDE62' : gun.isSafe ? '#e2e8f0' : '#fca5a5'}
                          fontSize="7.5"
                          fontWeight="bold"
                        >
                          หมู่ {gun.id}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Bottom Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#CEDE62]" />
                  ศก.ร้อย. / หมู่หลัก
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00fc00]" />
                  แนวปืนปลอดภัย (Safe)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  แนวปืนอันตราย (Unsafe)
                </span>
              </div>
            </div>

            {/* Right 1 Col: M.17 Plotting Coordinates Table */}
            <div className="space-y-3">
              <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm text-gray-100 flex items-center gap-2 border-b border-[#1b2f21] pb-2">
                  <Grid className="w-4 h-4 text-[#CEDE62]" />
                  ตารางพล็อตพิกัดแผ่นกรุย M.17
                </h4>

                <div className="space-y-2 text-xs">
                  {minQEResults.guns.map((g) => (
                    <div
                      key={`m17-coord-${g.id}`}
                      className={`p-2 rounded border ${
                        g.isBaseGun
                          ? 'bg-[#102917] border-[#CEDE62]/50'
                          : 'bg-[#040e07] border-[#1b2f21]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-white mb-1">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              g.isBaseGun ? 'bg-[#CEDE62]' : 'bg-[#3be099]'
                            }`}
                          />
                          หมู่ {g.id}
                          {g.isBaseGun && <span className="text-[#CEDE62] text-[10px]">(หมู่หลัก)</span>}
                        </span>
                        <span className="text-[10px] text-[#3be099]">
                          จก: {g.azimuthFromCircle} มิล. ({g.calculatedDistance}ม.)
                        </span>
                      </div>
                      <div className="text-[10px] text-[#CEDE62] bg-[#0c1f12] px-1.5 py-0.5 rounded mb-1 flex justify-between border border-[#CEDE62]/30">
                        <span>ศก.ร้อย ➔ ป.:</span>
                        <span className="font-semibold">{g.bcAzimuthMils.toString().padStart(4, '0')} มิล. ({g.bcDistance} ม.)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-300">
                        <div>
                          ซ้าย/ขวา:{' '}
                          <span className={g.lateralDisplacement >= 0 ? 'text-[#CEDE62]' : 'text-cyan-400 font-semibold'}>
                            {g.lateralDisplacement >= 0 ? 'ขวา' : 'ซ้าย'} {Math.abs(g.lateralDisplacement)} ม.
                          </span>
                        </div>
                        <div>
                          หน้า/หลัง:{' '}
                          <span className={g.rangeDisplacement >= 0 ? 'text-amber-400' : 'text-purple-400 font-semibold'}>
                            {g.rangeDisplacement >= 0 ? 'หน้า' : 'หลัง'} {Math.abs(g.rangeDisplacement)} ม.
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 7-STEP MIN QE DETAIL ENGINE                             */}
        {/* ============================================================== */}
        {activeTab === 'MIN_QE' && (
          <div className="space-y-4">
            {/* Header info & Critical piece callout */}
            <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#CEDE62]" />
                  การคำนวณมุมยิงต่ำสุด ๗ ขั้นตอน ตามคู่มือ รส. ๖-๕๐ (แสดงตาม {numSquads} หมู่)
                </h3>
                <span className="px-2.5 py-1 bg-[#102414] text-[#CEDE62] border border-[#CEDE62]/40 rounded text-xs font-semibold">
                  ส่วนบรรจุ: {minQEResults.chargeData.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                พิจารณาจากหมู่ที่มี <strong>มุมพื้นที่ยอดกำบังมากสุด</strong> ({minQEResults.maxMaskAngle} มิล.) และ <strong>ระยะน้อยสุด</strong> ({minQEResults.minCrestRange} ม.) เพื่อความปลอดภัยสูงสุดของกำลังพลฝ่ายเดียวกัน
              </p>
            </div>

            {/* 7-Step Breakdown Cards for ONLY selected number of Guns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {minQEResults.guns.map((gun) => (
                <div
                  key={`step-card-${gun.id}`}
                  className={`bg-[#08170d] border-2 rounded-xl p-3.5 space-y-2.5 ${
                    gun.isCritical
                      ? 'border-amber-500 bg-amber-950/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : gun.isSafe
                      ? 'border-[#1b2f21]'
                      : 'border-red-600 bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#1b2f21] pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#CEDE62]" />
                      <span className="font-semibold text-sm text-white">หมู่ {gun.id}</span>
                      {gun.isCritical && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-semibold">
                          หมู่พิจารณาหลัก
                        </span>
                      )}
                    </div>
                    <div>
                      {gun.isSafe ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 font-semibold text-xs">
                          🟢 SAFE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-red-950 border border-red-500 text-red-300 font-semibold text-xs animate-pulse">
                          🔴 UNSAFE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 7 Steps List */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between p-1 bg-[#040e07] rounded">
                      <span className="text-gray-400">ขั้นที่ ๑ (มุม ก. ยอดกำบัง):</span>
                      <span className="font-semibold text-[#CEDE62]">{gun.angleA} มิล.</span>
                    </div>
                    <div className="flex justify-between p-1 bg-[#040e07] rounded">
                      <span className="text-gray-400">ขั้นที่ ๒ (มุม ข. เผื่อดิ่ง):</span>
                      <span className="font-semibold text-[#3be099]">
                        {gun.angleB} มิล. <span className="text-[10px] text-gray-500">(5/{gun.individualCrestRange / 1000}กม.)</span>
                      </span>
                    </div>
                    <div className="flex justify-between p-1 bg-[#040e07] rounded">
                      <span className="text-gray-400">ขั้นที่ ๓ (มุม ค. ชดเชยวิถี):</span>
                      <span className="font-semibold text-amber-300">{gun.angleC} มิล.</span>
                    </div>
                    <div className="flex justify-between p-1 bg-[#040e07] rounded border-t border-[#1b2f21]">
                      <span className="text-gray-300 font-semibold">ขั้นที่ ๔ (มุม ๑ พื้นที่ยิง):</span>
                      <span className="font-semibold text-cyan-300">{gun.angle1} มิล.</span>
                    </div>
                    <div className="flex justify-between p-1 bg-[#040e07] rounded">
                      <span className="text-gray-400">ขั้นที่ ๕ (มุม ๒ มุมสูง บจ.):</span>
                      <span className="font-semibold text-purple-300">{gun.angle2} มิล.</span>
                    </div>
                    <div className="flex justify-between p-1 bg-[#040e07] rounded">
                      <span className="text-gray-400">ขั้นที่ ๖ (มุม ๓ สองซ่อม):</span>
                      <span className="font-semibold text-pink-300">{gun.angle3} มิล.</span>
                    </div>

                    {/* Step 7 Totals for Quick & VT */}
                    <div className="p-2 bg-[#122416] rounded border border-[#1b2f21] space-y-1 mt-1.5">
                      <div className="flex justify-between items-center text-white">
                        <span className="font-semibold">ขั้น ๗A [ชนวนไว]:</span>
                        <span className="font-semibold text-sm text-[#CEDE62]">{gun.minQEQuick} มิล.</span>
                      </div>
                      <div className="flex justify-between items-center text-cyan-200">
                        <span className="font-semibold">ขั้น ๗B [ชนวน VT]:</span>
                        <span className="font-semibold text-sm text-cyan-300">{gun.minQEVT} มิล.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: OFFICIAL MILITARY REPORT FORM                           */}
        {/* ============================================================== */}
        {activeTab === 'FORM_REPORT' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="bg-[#08170d] border border-[#1b2f21] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#CEDE62]" />
                <span className="font-semibold text-xs sm:text-sm text-gray-100">
                  แบบรายงานและคำสั่งยิง รอง ผบ.ร้อย ป. (Official Tactical Command Sheet)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 bg-[#102917] hover:bg-[#1a3d24] text-[#CEDE62] border border-[#10b981]/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกข้อความ</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="px-3 py-1.5 bg-[#0a1b10] hover:bg-[#142e1b] text-gray-200 border border-[#1b2f21] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>บันทึกแบบฟอร์มรายงาน</span>
                </button>
              </div>
            </div>

            {/* Printable / Viewable Tactical Form */}
            <div className="bg-[#050f07] border border-[#1b2f21] rounded-xl p-4 sm:p-6 text-xs text-gray-200 space-y-4 shadow-inner font-sans">
              <div className="text-center border-b border-[#1b2f21] pb-3 space-y-1">
                <h2 className="font-semibold text-sm sm:text-base text-white">
                  กองทัพบกไทย • กองพันทหารปืนใหญ่ที่ ๔
                </h2>
                <h3 className="font-semibold text-xs sm:text-sm text-[#CEDE62]">
                  แบบรายงานปืนคลาด ศก.ร้อย. และมุมยิงต่ำสุด (MIN QE) {batteryName}
                </h3>
              </div>

              {/* Meta info inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 block font-semibold mb-1">หน่วย:</label>
                  <input
                    type="text"
                    value={batteryName}
                    onChange={(e) => setBatteryName(e.target.value)}
                    className="w-full bg-[#030904] border border-[#1b2f21] rounded px-2.5 py-1.5 text-white text-xs outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block font-semibold mb-1">ผู้รายงาน:</label>
                  <input
                    type="text"
                    value={commanderTitle}
                    onChange={(e) => setCommanderTitle(e.target.value)}
                    className="w-full bg-[#030904] border border-[#1b2f21] rounded px-2.5 py-1.5 text-white text-xs outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block font-semibold mb-1">พิกัด ลลขต.:</label>
                  <input
                    type="text"
                    value={gridCoords}
                    onChange={(e) => setGridCoords(e.target.value)}
                    className="w-full bg-[#030904] border border-[#1b2f21] rounded px-2.5 py-1.5 text-white text-xs outline-none font-medium"
                  />
                </div>
              </div>

              {/* Form Text Box */}
              <div className="bg-[#020603] border border-[#142e1b] rounded-lg p-3 sm:p-4 text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-300 font-mono select-text">
                {generatedReportText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
