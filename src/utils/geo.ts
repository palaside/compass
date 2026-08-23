// Geodesy and Offline Navigation Math Utilities

/**
 * Calculates distance between two coordinates in meters using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0 - 360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  return bearing;
}

/**
 * Converts Degrees (0-360) to NATO Mils (0-6400)
 */
export function degreesToMils(degrees: number): number {
  return Math.round(((degrees % 360 + 360) % 360) * (6400 / 360));
}

/**
 * Converts Degrees to 16-point Cardinal Direction
 */
export function degreesToCardinal(deg: number): string {
  const normalized = (deg % 360 + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Formats Distance nicely (e.g. "450 m", "3.8 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Formats Decimal Degrees (DD)
 */
export function formatDD(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}  ${lngStr}`;
}

/**
 * Formats Degrees Minutes Seconds (DMS)
 */
export function formatDMS(lat: number, lng: number): string {
  const toDms = (deg: number, isLat: boolean) => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    const direction = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };
  return `${toDms(lat, true)} ${toDms(lng, false)}`;
}

/**
 * Calculates UTM (Universal Transverse Mercator) Zone and coordinates
 */
export function latLngToUTM(lat: number, lon: number): { zone: number; hemisphere: string; easting: number; northing: number } {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'N' : 'S';

  // Simplified projection for high-speed offline tactical display
  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;
  const lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  const k0 = 0.9996;
  const a = 6378137.0; // WGS84 major axis
  const e = 0.081819191; // eccentricity

  const N = a / Math.sqrt(1 - Math.pow(e * Math.sin(radLat), 2));
  const T = Math.pow(Math.tan(radLat), 2);
  const C = (Math.pow(e, 2) / (1 - Math.pow(e, 2))) * Math.pow(Math.cos(radLat), 2);
  const A = Math.cos(radLat) * (radLon - lon0);

  const M =
    a *
    ((1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256) * radLat -
      ((3 * Math.pow(e, 2)) / 8 + (3 * Math.pow(e, 4)) / 32 + (45 * Math.pow(e, 6)) / 1024) *
        Math.sin(2 * radLat) +
      ((15 * Math.pow(e, 4)) / 256 + (45 * Math.pow(e, 6)) / 1024) * Math.sin(4 * radLat) -
      ((35 * Math.pow(e, 6)) / 3072) * Math.sin(6 * radLat));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + Math.pow(T, 2) + 72 * C - 58 * Math.pow(e, 2)) * Math.pow(A, 5)) / 120) +
    500000;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(radLat) *
        (Math.pow(A, 2) / 2 +
          ((5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + Math.pow(T, 2) + 600 * C - 330 * Math.pow(e, 2)) * Math.pow(A, 6)) / 720));

  if (lat < 0) {
    northing += 10000000; // false northing for southern hemisphere
  }

  return { zone, hemisphere, easting: Math.round(easting), northing: Math.round(northing) };
}

/**
 * Formats coordinate to Military Grid Reference System (MGRS)
 */
export function formatMGRS(lat: number, lng: number): string {
  const utm = latLngToUTM(lat, lng);
  const latBandLetters = 'CDEFGHJKLMNPQRSTUVWX';
  const bandIndex = Math.min(Math.max(Math.floor((lat + 80) / 8), 0), 19);
  const latBand = latBandLetters[bandIndex] || 'P';

  // 100k grid square letters
  const e100k = Math.floor(utm.easting / 100000);
  const n100k = Math.floor((utm.northing % 2000000) / 100000);
  
  const colLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rowLetters = 'ABCDEFGHJKLMNPQRSTUV';

  const colChar = colLetters[(utm.zone % 3) * 8 + (e100k - 1)] || 'Q';
  const rowChar = rowLetters[n100k % 20] || 'S';

  const east5 = String(Math.floor(utm.easting % 100000)).padStart(5, '0');
  const north5 = String(Math.floor(utm.northing % 100000)).padStart(5, '0');

  return `${utm.zone}${latBand} ${colChar}${rowChar} ${east5} ${north5}`;
}

/**
 * Offline Solar Positioning Algorithm (Sun Azimuth & Elevation)
 */
export function getSolarPosition(lat: number, lng: number, date = new Date()) {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );

  const localHours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  // Fractional year in radians
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (localHours - 12) / 24);

  // Equation of time in minutes
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination in radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timezoneOffset = -date.getTimezoneOffset(); // in minutes
  const timeOffset = eqtime + 4 * lng - timezoneOffset;
  const trueSolarTime = localHours * 60 + timeOffset;

  let hourAngle = (trueSolarTime / 4 - 180) * rad;
  if (hourAngle < -Math.PI) hourAngle += 2 * Math.PI;

  const latRad = lat * rad;
  const zenith = Math.acos(
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  );
  const altitude = 90 - zenith / rad;

  const azimuthRad = Math.acos(
    (Math.sin(decl) - Math.sin(latRad) * Math.cos(zenith)) / (Math.cos(latRad) * Math.sin(zenith))
  );

  let azimuth = (azimuthRad / rad);
  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  }

  // Approximate sunrise / sunset times
  const sunriseMinutes = 720 - 4 * lng - eqtime + timezoneOffset;
  const sunriseH = Math.floor(sunriseMinutes / 60) % 24;
  const sunriseM = Math.floor(sunriseMinutes % 60);

  const sunsetMinutes = sunriseMinutes + 720;
  const sunsetH = Math.floor(sunsetMinutes / 60) % 24;
  const sunsetM = Math.floor(sunsetMinutes % 60);

  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

  const goldenHourMinutes = sunsetMinutes - 60;
  const goldenHourH = Math.floor(goldenHourMinutes / 60) % 24;
  const goldenHourM = Math.floor(goldenHourMinutes % 60);

  return {
    azimuth: (azimuth + 360) % 360,
    altitude: Math.round(altitude * 10) / 10,
    sunrise: `${pad(sunriseH)}:${pad(sunriseM)}`,
    sunset: `${pad(sunsetH)}:${pad(sunsetM)}`,
    goldenHour: `${pad(goldenHourH)}:${pad(goldenHourM)}`,
    isDaytime: altitude > -0.833,
  };
}

/**
 * Offline Lunar Position and Phase Calculation
 */
export function getMoonPosition(lat: number, lng: number, date = new Date()) {
  // Known new moon epoch: Jan 11, 2024
  const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
  const synodicMonth = 29.53058867 * 86400000; // ms
  const diff = date.getTime() - knownNewMoon;
  const cyclePosition = (diff % synodicMonth) / synodicMonth;
  const phase = cyclePosition < 0 ? cyclePosition + 1 : cyclePosition;

  // Illumination %
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  // Phase Name and Icon
  let phaseName = 'จันทร์ดับ (New Moon)';
  let phaseIcon = '🌑';
  if (phase > 0.03 && phase < 0.22) {
    phaseName = 'เสี้ยวข้างขึ้น (Waxing Crescent)';
    phaseIcon = '🌒';
  } else if (phase >= 0.22 && phase < 0.28) {
    phaseName = 'ครึ่งดวงข้างขึ้น (First Quarter)';
    phaseIcon = '🌓';
  } else if (phase >= 0.28 && phase < 0.47) {
    phaseName = 'ค่อนดวงข้างขึ้น (Waxing Gibbous)';
    phaseIcon = '🌔';
  } else if (phase >= 0.47 && phase < 0.53) {
    phaseName = 'จันทร์เพ็ญเต็มดวง (Full Moon)';
    phaseIcon = '🌕';
  } else if (phase >= 0.53 && phase < 0.72) {
    phaseName = 'ค่อนดวงข้างแรม (Waning Gibbous)';
    phaseIcon = '🌖';
  } else if (phase >= 0.72 && phase < 0.78) {
    phaseName = 'ครึ่งดวงข้างแรม (Last Quarter)';
    phaseIcon = '🌗';
  } else if (phase >= 0.78 && phase < 0.97) {
    phaseName = 'เสี้ยวข้างแรม (Waning Crescent)';
    phaseIcon = '🌘';
  }

  // Moon approximate azimuth & altitude offset from Sun
  const sunPos = getSolarPosition(lat, lng, date);
  const moonAzimuth = (sunPos.azimuth + phase * 360) % 360;
  const moonAltitude = Math.round(Math.sin((moonAzimuth - 90) * (Math.PI / 180)) * 60 + (lat > 0 ? 15 : -15));

  const localHours = date.getHours();
  const moonriseH = (localHours + Math.floor((1 - phase) * 24)) % 24;
  const moonsetH = (moonriseH + 12) % 24;

  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

  return {
    azimuth: Math.round(moonAzimuth * 10) / 10,
    altitude: Math.max(-90, Math.min(90, moonAltitude)),
    phase: Math.round(phase * 100) / 100,
    phaseName,
    phaseIcon,
    illumination,
    moonrise: `${pad(moonriseH)}:15`,
    moonset: `${pad(moonsetH)}:45`,
  };
}

/**
 * Polaris (North Star) Position Calculation
 */
export function getPolarisPosition(lat: number, _lng: number) {
  // In Northern Hemisphere, Polaris altitude is almost exactly equal to observer's latitude.
  // Azimuth is within 0.7 degrees of True North (000°).
  const isNorthern = lat >= 0;
  return {
    azimuth: 0.2, // ~000.2° True North
    altitude: isNorthern ? Math.max(1, Math.min(89, Math.round(lat * 10) / 10)) : 0,
    isVisible: isNorthern,
    constellation: 'กลุ่มดาวหมีเล็ก (Ursa Minor)',
  };
}

/**
 * Estimated Magnetic Declination in Southeast Asia / Thailand region (WGS84 / IGRF Model)
 */
export function getMagneticDeclination(lat: number, lng: number): number {
  // For Thailand & Southeast Asia (lat 5..20, lng 97..106), declination is approx -0.5° to -0.8° West
  const approxDeclination = -0.65 + (lat - 14) * 0.02 - (lng - 100) * 0.03;
  return Math.round(approxDeclination * 100) / 100;
}

/**
 * Generates realistic Multi-GNSS Satellite Constellation Data (GPS, GLONASS, Galileo, BeiDou)
 */
export function generateSatelliteConstellation(lat: number, lng: number): {
  satellites: Array<{
    id: string;
    constellation: 'GPS' | 'GLONASS' | 'GALILEO' | 'BEIDOU';
    prn: number;
    snr: number;
    elevation: number;
    azimuth: number;
    usedInFix: boolean;
  }>;
  hdop: number;
  vdop: number;
  fixType: '3D High Precision' | '3D Standard' | '2D Fix' | 'Differential GPS (SBAS)';
} {
  const satellites: Array<{
    id: string;
    constellation: 'GPS' | 'GLONASS' | 'GALILEO' | 'BEIDOU';
    prn: number;
    snr: number;
    elevation: number;
    azimuth: number;
    usedInFix: boolean;
  }> = [
    { id: 'G14', constellation: 'GPS', prn: 14, snr: 44, elevation: 68, azimuth: 120, usedInFix: true },
    { id: 'G03', constellation: 'GPS', prn: 3, snr: 41, elevation: 52, azimuth: 280, usedInFix: true },
    { id: 'G22', constellation: 'GPS', prn: 22, snr: 39, elevation: 42, azimuth: 45, usedInFix: true },
    { id: 'G31', constellation: 'GPS', prn: 31, snr: 36, elevation: 33, azimuth: 210, usedInFix: true },
    { id: 'G08', constellation: 'GPS', prn: 8, snr: 31, elevation: 18, azimuth: 340, usedInFix: false },
    { id: 'R07', constellation: 'GLONASS', prn: 7, snr: 42, elevation: 75, azimuth: 80, usedInFix: true },
    { id: 'R19', constellation: 'GLONASS', prn: 19, snr: 38, elevation: 48, azimuth: 195, usedInFix: true },
    { id: 'R24', constellation: 'GLONASS', prn: 24, snr: 34, elevation: 25, azimuth: 310, usedInFix: true },
    { id: 'E05', constellation: 'GALILEO', prn: 5, snr: 43, elevation: 62, azimuth: 160, usedInFix: true },
    { id: 'E18', constellation: 'GALILEO', prn: 18, snr: 40, elevation: 55, azimuth: 240, usedInFix: true },
    { id: 'B02', constellation: 'BEIDOU', prn: 2, snr: 46, elevation: 82, azimuth: 100, usedInFix: true },
    { id: 'B09', constellation: 'BEIDOU', prn: 9, snr: 44, elevation: 60, azimuth: 30, usedInFix: true },
    { id: 'B16', constellation: 'BEIDOU', prn: 16, snr: 37, elevation: 35, azimuth: 260, usedInFix: true },
  ];

  return {
    satellites,
    hdop: 0.8,
    vdop: 1.1,
    fixType: '3D High Precision',
  };
}

/**
 * Pre-configured Offline Map Regional Packages for Wilderness & Off-Road Navigation
 */
export const DEFAULT_OFFLINE_MAP_PACKAGES = [
  {
    id: 'pack-khao-yai',
    name: 'อุทยานแห่งชาติเขาใหญ่ (Khao Yai National Park)',
    region: 'ภาคกลาง / ตะวันออกเฉียงเหนือ',
    province: 'นครราชสีมา, ปราจีนบุรี, นครนายก',
    sizeMB: 84,
    tileCount: 4200,
    isDownloaded: true,
    downloadedAt: Date.now() - 86400000 * 2,
    bounds: { north: 14.55, south: 14.20, east: 101.65, west: 101.20 },
  },
  {
    id: 'pack-inthanon',
    name: 'ดอยอินทนนท์ - แม่แจ่ม (Doi Inthanon 4x4 Trail)',
    region: 'ภาคเหนือ',
    province: 'เชียงใหม่',
    sizeMB: 112,
    tileCount: 5600,
    isDownloaded: false,
    bounds: { north: 18.65, south: 18.40, east: 98.60, west: 98.30 },
  },
  {
    id: 'pack-pha-tat',
    name: 'ผาตัด - เขาค้อ (Pha Tat Mountain Ridge 4WD)',
    region: 'ภาคเหนือตอนล่าง',
    province: 'เพชรบูรณ์',
    sizeMB: 68,
    tileCount: 3400,
    isDownloaded: true,
    downloadedAt: Date.now() - 86400000 * 5,
    bounds: { north: 16.90, south: 16.65, east: 101.15, west: 100.85 },
  },
  {
    id: 'pack-thong-pha-phum',
    name: 'ทองผาภูมิ - ปิล็อก - เหมืองสมศักดิ์ (Pilok Mine Trail)',
    region: 'ภาคตะวันตก',
    province: 'กาญจนบุรี',
    sizeMB: 96,
    tileCount: 4800,
    isDownloaded: false,
    bounds: { north: 14.80, south: 14.50, east: 98.60, west: 98.20 },
  },
];


/**
 * Generate GPX XML string for Waypoints and Tracks (For offline GPS export)
 */
export function exportToGPX(waypoints: Array<{ name: string; lat: number; lng: number; altitude?: number }>, trackPoints: Array<{ lat: number; lng: number; altitude: number; timestamp: number }>): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="OffRoad-AR-Compass" xmlns="http://www.topografix.com/GPX/1/1">\n`;

  // Waypoints
  waypoints.forEach((wp) => {
    gpx += `  <wpt lat="${wp.lat}" lon="${wp.lng}">\n`;
    if (wp.altitude) gpx += `    <ele>${wp.altitude}</ele>\n`;
    gpx += `    <name>${escapeXml(wp.name)}</name>\n`;
    gpx += `  </wpt>\n`;
  });

  // Track
  if (trackPoints.length > 0) {
    gpx += `  <trk>\n    <name>Offroad Trail Track</name>\n    <trkseg>\n`;
    trackPoints.forEach((tp) => {
      gpx += `      <trkpt lat="${tp.lat}" lon="${tp.lng}">\n`;
      gpx += `        <ele>${tp.altitude}</ele>\n`;
      gpx += `        <time>${new Date(tp.timestamp).toISOString()}</time>\n`;
      gpx += `      </trkpt>\n`;
    });
    gpx += `    </trkseg>\n  </trk>\n`;
  }

  gpx += `</gpx>`;
  return gpx;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
