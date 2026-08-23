import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HUDMode,
  Waypoint,
  GPSPosition,
  DeviceOrientationData,
  TrackPoint,
} from './types';
import { DEFAULT_EXPEDITION_WAYPOINTS } from './data/defaultWaypoints';
import { getSolarPosition } from './utils/geo';
import { TopNavigationBar } from './components/TopNavigationBar';
import { ARView } from './components/ARView';
import { CompassView } from './components/CompassView';
import { OffroadMap } from './components/OffroadMap';
import { GaugesView } from './components/GaugesView';
import { CelestialFinderView } from './components/CelestialFinderView';
import { InclinometerView } from './components/InclinometerView';
import { ArtilleryReportView } from './components/ArtilleryReportView';
import { OfflineMapsModal } from './components/OfflineMapsModal';
import { SOSBeaconModal } from './components/SOSBeaconModal';
import { CraterAnalysisView } from './components/CraterAnalysisView';
import { playWaypointMarkedChime } from './utils/audio';

export default function App() {
  // Navigation View Mode (AR HUD, Compass, Topo Map, Gauges, Celestial, Inclinometer)
  const [mode, setMode] = useState<HUDMode>('AR');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [compassOffset, setCompassOffset] = useState<number>(0);

  // GPS Position State (Defaults to realistic mountain trail coords, updated by real GPS)
  const [currentPosition, setCurrentPosition] = useState<GPSPosition>({
    lat: 14.4320,
    lng: 101.3720,
    altitude: 480,
    accuracy: 8,
    altitudeAccuracy: 3,
    heading: 45,
    speed: 0,
    timestamp: Date.now(),
    isSimulated: true,
  });

  // Device Orientation (Heading, Pitch, Roll)
  const [orientation, setOrientation] = useState<DeviceOrientationData>({
    heading: 42,
    pitch: -4,
    roll: 6,
    accuracy: 5,
    isDeviceSensor: false,
    compassOffset: 0,
  });

  // Waypoints & Navigation Target
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => {
    const saved = localStorage.getItem('offroad_waypoints_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_EXPEDITION_WAYPOINTS;
      }
    }
    return DEFAULT_EXPEDITION_WAYPOINTS;
  });

  const [activeWaypoint, setActiveWaypoint] = useState<Waypoint | null>(() => {
    return waypoints.length > 0 ? waypoints[0] : null;
  });

  // GPS Breadcrumb Track Recording
  const [isRecordingTrack, setIsRecordingTrack] = useState<boolean>(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([
    { lat: 14.4310, lng: 101.3705, altitude: 470, timestamp: Date.now() - 360000, speed: 1.2 },
    { lat: 14.4315, lng: 101.3712, altitude: 475, timestamp: Date.now() - 180000, speed: 1.5 },
    { lat: 14.4320, lng: 101.3720, altitude: 480, timestamp: Date.now(), speed: 0 },
  ]);

  // Modals
  const [isOfflineMapsModalOpen, setIsOfflineMapsModalOpen] = useState<boolean>(false);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState<boolean>(false);
  const [isCraterAnalysisOpen, setIsCraterAnalysisOpen] = useState<boolean>(false);

  // Tactical Artillery Parameters (Shared Direction of Fire / ทิศทางยิง)
  const [directionOfFire, setDirectionOfFire] = useState<number>(1600);

  const handlePositionChange = (lat: number, lng: number) => {
    setCurrentPosition((prev) => ({
      ...prev,
      lat,
      lng,
      timestamp: Date.now(),
      isSimulated: true,
    }));
  };

  // Apply True North Celestial Calibration Offset
  const handleApplyCompassOffset = (offset: number) => {
    setCompassOffset(offset);
    setOrientation((prev) => ({
      ...prev,
      compassOffset: offset,
      heading: ((prev.heading + offset + 360) % 360),
    }));
  };

  // Save waypoints to localStorage for complete offline capability
  useEffect(() => {
    localStorage.setItem('offroad_waypoints_v1', JSON.stringify(waypoints));
  }, [waypoints]);

  // Real Geolocation Watcher
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: GPSPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy || 10,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          isSimulated: false,
        };
        setCurrentPosition(newPos);

        // Record breadcrumb point if tracking is active
        if (isRecordingTrack) {
          setTrackPoints((prev) => [
            ...prev,
            {
              lat: newPos.lat,
              lng: newPos.lng,
              altitude: newPos.altitude || 480,
              timestamp: newPos.timestamp,
              speed: newPos.speed || 0,
            },
          ]);
        }
      },
      (err) => {
        console.warn('Geolocation access fallback to simulated GPS:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isRecordingTrack]);

  // Real Device Orientation Listener (Magnetometer & Gyroscope with Throttling to prevent flicker)
  const lastOrientationTimeRef = useRef<number>(0);
  const lastHeadingRef = useRef<number>(42);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastOrientationTimeRef.current < 60) return; // limit to ~16 updates per sec max

      if (e.alpha !== null || (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading !== undefined) {
        // iOS provides webkitCompassHeading (0 = North)
        let heading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
        if (heading === undefined && e.alpha !== null) {
          // Android standard alpha (360 - alpha for clockwise degrees)
          heading = (360 - e.alpha) % 360;
        }

        const newHeading = heading !== undefined ? heading : 45;
        if (Math.abs(newHeading - lastHeadingRef.current) < 0.4) {
          return; // skip micro-jitter
        }
        lastHeadingRef.current = newHeading;
        lastOrientationTimeRef.current = now;

        const pitch = e.beta !== null ? e.beta - 90 : 0; // beta: -180 to 180 (tilt front/back)
        const roll = e.gamma !== null ? e.gamma : 0; // gamma: -90 to 90 (tilt left/right)

        setOrientation({
          heading: newHeading,
          pitch: Math.max(-90, Math.min(90, pitch)),
          roll: Math.max(-180, Math.min(180, roll)),
          isDeviceSensor: true,
        });
      }
    };

    const setupListeners = () => {
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('deviceorientationabsolute' as unknown as keyof WindowEventMap, handleOrientation as unknown as EventListener, true);
    };
    
    const removeListeners = () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('deviceorientationabsolute' as unknown as keyof WindowEventMap, handleOrientation as unknown as EventListener, true);
    };

    setupListeners();

    const onPermissionGranted = () => {
      // Re-attach on iOS synchronously after permission is granted
      removeListeners();
      setupListeners();
    };
    
    window.addEventListener('compass-permission-granted', onPermissionGranted);

    return () => {
      removeListeners();
      window.removeEventListener('compass-permission-granted', onPermissionGranted);
    };
  }, []);

  // Solar Information (Offline Sun/Moon calculations based on current location)
  const solarInfo = useMemo(() => {
    return getSolarPosition(currentPosition.lat, currentPosition.lng);
  }, [currentPosition.lat, currentPosition.lng]);

  // Add Waypoint handler
  const handleAddWaypoint = (newWp: Waypoint) => {
    setWaypoints((prev) => [newWp, ...prev]);
    setActiveWaypoint(newWp);
  };

  const handleDeleteWaypoint = (id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    if (activeWaypoint?.id === id) {
      setActiveWaypoint(null);
    }
  };

  const handleAddWaypointAtCurrent = useCallback(() => {
    const newWp: Waypoint = {
      id: `wp-mark-${Date.now()}`,
      name: `จุดมาร์ก #${waypoints.length + 1}`,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      altitude: currentPosition.altitude || 480,
      category: 'custom',
      color: '#CEDE62',
      notes: `บันทึกเมื่อ ${new Date().toLocaleTimeString('th-TH')}`,
      createdAt: Date.now(),
      isCustom: true,
    };
    handleAddWaypoint(newWp);
    playWaypointMarkedChime(soundEnabled);
  }, [currentPosition, waypoints.length, soundEnabled]);

  const handleMapClickAddWaypoint = useCallback((lat: number, lng: number) => {
    const newWp: Waypoint = {
      id: `wp-map-${Date.now()}`,
      name: `พิกัดแผนที่ #${waypoints.length + 1}`,
      lat,
      lng,
      altitude: 500,
      category: 'custom',
      color: '#a855f7',
      notes: 'มาร์กโดยแตะบนแผนที่ภูมิประเทศ',
      createdAt: Date.now(),
      isCustom: true,
    };
    handleAddWaypoint(newWp);
    playWaypointMarkedChime(soundEnabled);
  }, [waypoints.length, soundEnabled]);

  // Simulation Manual Controls
  const handleManualHeading = (heading: number) => {
    setOrientation((prev) => ({ ...prev, heading, isDeviceSensor: false }));
  };
  const handleManualPitch = (pitch: number) => {
    setOrientation((prev) => ({ ...prev, pitch, isDeviceSensor: false }));
  };
  const handleManualRoll = (roll: number) => {
    setOrientation((prev) => ({ ...prev, roll, isDeviceSensor: false }));
  };

  return (
    <div className="relative w-screen h-screen bg-[#030704] text-[#10b981] overflow-hidden flex flex-col justify-between font-mono select-none">
      
      {/* 1. TOP TACTICAL NAVIGATION BAR */}
      <TopNavigationBar
        mode={mode}
        onModeChange={setMode}
        activeWaypoint={activeWaypoint}
        currentPosition={currentPosition}
        isRecordingTrack={isRecordingTrack}
        onToggleRecordTrack={() => setIsRecordingTrack(!isRecordingTrack)}
        onOpenOfflineMaps={() => setIsOfflineMapsModalOpen(true)}
        onOpenSOS={() => setIsSOSModalOpen(true)}
        onOpenCraterAnalysis={() => setIsCraterAnalysisOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      {/* 2. MAIN ACTIVE NAVIGATION VIEW */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {mode === 'AR' && (
          <ARView
            currentPosition={currentPosition}
            orientation={orientation}
            waypoints={waypoints}
            activeWaypoint={activeWaypoint}
            onSelectWaypoint={setActiveWaypoint}
            onAddWaypointAtCurrent={handleAddWaypointAtCurrent}
            solarInfo={solarInfo}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onManualHeadingChange={handleManualHeading}
            onManualPitchChange={handleManualPitch}
            onManualRollChange={handleManualRoll}
          />
        )}

        {mode === 'COMPASS' && (
          <CompassView
            currentPosition={currentPosition}
            orientation={orientation}
            activeWaypoint={activeWaypoint}
            solarInfo={solarInfo}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onSelectWaypointModal={() => {}}
            onAddWaypointAtCurrent={handleAddWaypointAtCurrent}
            directionOfFire={directionOfFire}
            onDirectionOfFireChange={setDirectionOfFire}
            onPositionChange={handlePositionChange}
          />
        )}

        {mode === 'MAP' && (
          <OffroadMap
            currentPosition={currentPosition}
            orientation={orientation}
            waypoints={waypoints}
            activeWaypoint={activeWaypoint}
            trackPoints={trackPoints}
            onSelectWaypoint={setActiveWaypoint}
            onMapClickAddWaypoint={handleMapClickAddWaypoint}
            onOpenOfflineMaps={() => setIsOfflineMapsModalOpen(true)}
            soundEnabled={soundEnabled}
          />
        )}

        {mode === 'REPORT' && (
          <ArtilleryReportView
            currentPosition={currentPosition}
            orientation={orientation}
            soundEnabled={soundEnabled}
            directionOfFire={directionOfFire}
            onDirectionOfFireChange={setDirectionOfFire}
          />
        )}

        {mode === 'GAUGES' && (
          <GaugesView
            currentPosition={currentPosition}
            orientation={orientation}
            activeWaypoint={activeWaypoint}
            trackPoints={trackPoints}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
          />
        )}

        {mode === 'CELESTIAL' && (
          <CelestialFinderView
            currentPosition={currentPosition}
            orientation={orientation}
            solarInfo={solarInfo}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onApplyCompassOffset={handleApplyCompassOffset}
          />
        )}

        {mode === 'CLINOMETER' && (
          <InclinometerView
            orientation={orientation}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onManualPitchChange={handleManualPitch}
            onManualRollChange={handleManualRoll}
          />
        )}
      </main>

      {/* 3. MODALS (OFFLINE MAPS & SOS BEACON) */}
      <OfflineMapsModal
        isOpen={isOfflineMapsModalOpen}
        onClose={() => setIsOfflineMapsModalOpen(false)}
        soundEnabled={soundEnabled}
      />

      <SOSBeaconModal
        isOpen={isSOSModalOpen}
        onClose={() => setIsSOSModalOpen(false)}
        currentPosition={currentPosition}
        soundEnabled={soundEnabled}
      />

      <CraterAnalysisView
        isOpen={isCraterAnalysisOpen}
        onClose={() => setIsCraterAnalysisOpen(false)}
        currentPosition={currentPosition}
        orientation={orientation}
        solarInfo={solarInfo}
        waypoints={waypoints}
        activeWaypoint={activeWaypoint}
        soundEnabled={soundEnabled}
      />
    </div>
  );
}
