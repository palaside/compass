export type HUDMode = 'AR' | 'COMPASS' | 'MAP' | 'REPORT' | 'GAUGES' | 'CELESTIAL' | 'CLINOMETER' | 'CRATER_ANALYSIS';

export type ARFilter = 'STANDARD' | 'NVG_GREEN' | 'THERMAL' | 'AMBER';

export type WaypointCategory = 
  | 'vehicle'
  | 'basecamp'
  | 'summit'
  | 'water'
  | 'hazard'
  | 'canyon'
  | 'trail'
  | 'custom';

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitude?: number; // meters MSL
  category: WaypointCategory;
  color?: string;
  notes?: string;
  createdAt: number;
  isCustom?: boolean;
}

export interface GPSPosition {
  lat: number;
  lng: number;
  altitude: number | null; // meters
  accuracy: number; // meters
  altitudeAccuracy: number | null;
  heading: number | null; // degrees 0-360 from GPS velocity
  speed: number | null; // m/s
  timestamp: number;
  isSimulated?: boolean;
}

export interface DeviceOrientationData {
  heading: number; // 0 - 360 degrees (magnetic or true)
  pitch: number; // -90 to +90 degrees (nose up/down)
  roll: number; // -180 to +180 degrees (tilt left/right)
  accuracy?: number; // degrees if provided
  isDeviceSensor: boolean;
  compassOffset?: number; // Celestial / True North calibration offset
}

export interface TrackPoint {
  lat: number;
  lng: number;
  altitude: number;
  timestamp: number;
  speed: number;
}

export interface RecordedTrack {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  points: TrackPoint[];
  totalDistance: number; // meters
  maxSpeed: number; // km/h
  elevationGain: number; // meters
  elevationLoss: number; // meters
}

export interface SolarInfo {
  azimuth: number; // 0-360 deg
  altitude: number; // deg above horizon
  sunrise: string;
  sunset: string;
  goldenHour: string;
  isDaytime: boolean;
}

export interface MoonInfo {
  azimuth: number;
  altitude: number;
  phase: number; // 0 to 1
  phaseName: string;
  phaseIcon: string;
  illumination: number; // percentage 0-100%
  moonrise: string;
  moonset: string;
}

export interface PolarisInfo {
  azimuth: number; // ~0 degrees True North
  altitude: number; // equal to observer's latitude in Northern Hemisphere
  isVisible: boolean;
  constellation: string;
}

export interface CelestialSummary {
  sun: SolarInfo;
  moon: MoonInfo;
  polaris: PolarisInfo;
  magneticDeclination: number; // degrees
}

export interface SatelliteItem {
  id: string;
  constellation: 'GPS' | 'GLONASS' | 'GALILEO' | 'BEIDOU';
  prn: number;
  snr: number; // dB-Hz (0 - 50)
  elevation: number; // deg (0 - 90)
  azimuth: number; // deg (0 - 360)
  usedInFix: boolean;
}

export interface GPSFixInfo {
  fixType: '3D High Precision' | '3D Standard' | '2D Fix' | 'Differential GPS (SBAS)';
  satellitesInView: number;
  satellitesUsed: number;
  hdop: number; // Horizontal Dilution of Precision
  vdop: number; // Vertical Dilution of Precision
  pdop: number;
  satellites: SatelliteItem[];
}

export interface OfflineMapPackage {
  id: string;
  name: string;
  region: string;
  province: string;
  sizeMB: number;
  tileCount: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  downloadedAt?: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export type MapLayerType = 'TOPO' | 'SATELLITE' | 'NIGHT_TACTICAL' | 'OUTDOOR';

export type CoordinateFormat = 'MGRS' | 'DMS' | 'DD' | 'UTM';

export interface TacticalTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  easting: number;
  northing: number;
  altitude?: number;
  rangeM: number;
  azimuthMils: number;
  targetType: string;
  status: 'PENDING' | 'APPROVED' | 'FIRED' | 'DESTROYED';
  timestamp: number;
  notes?: string;
}


