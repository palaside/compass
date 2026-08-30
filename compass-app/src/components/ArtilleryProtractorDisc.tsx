import React, { useMemo } from 'react';

interface ProtractorDiscProps {
  radius?: number;
  className?: string;
  theme?: 'military-printed' | 'tactical-night';
  showBackdrop?: boolean;
  showOuterScale?: boolean;
  showInnerRedScale?: boolean;
}

interface ProtractorDiscGroupProps {
  radius?: number;
  theme?: 'military-printed' | 'tactical-night';
  showOuterScale?: boolean;
  showInnerRedScale?: boolean;
}

/**
 * Military Artillery Mortar / Forward Observer Protractor Disc Scale (แผ่นบน.png)
 * - Outer 360° Ring: NATO Mils 0 to 63 (6,400 Mils total) with 640 subdivisions (10 mils/tick, 50 mils medium, 100 mils major)
 * - Inner Right 180° Semicircle (Red): 0 to 32 with 320 subdivisions (10 mils/tick, 50 mils medium, 100 mils major)
 * - Left 180° Hemisphere: Completely open / clear transparent acrylic
 */
export function ArtilleryProtractorDiscGroup({
  radius = 210,
  theme = 'military-printed',
  showOuterScale = true,
  showInnerRedScale = true,
}: ProtractorDiscGroupProps) {
  const isNight = theme === 'tactical-night';
  const outerColor = isNight ? 'rgba(0, 252, 0, 0.7)' : 'rgba(0, 0, 0, 0.95)';
  const outerTickColor = isNight ? 'rgba(0, 252, 0, 0.6)' : 'rgba(0, 0, 0, 0.85)';
  const outerBorderColor = isNight ? 'rgba(0, 252, 0, 0.7)' : 'rgba(0, 0, 0, 0.95)';
  const redColor = 'rgba(239, 68, 68, 0.5)';
  const redMinorColor = isNight ? 'rgba(248, 113, 113, 0.5)' : 'rgba(220, 38, 38, 0.5)';

  const rOuterRim = radius; // 210
  const rOuterMajorTickInner = radius - 16; // 194
  const rOuterMediumTickInner = radius - 11; // 199
  const rOuterMinorTickInner = radius - 6; // 204
  const rOuterText = radius - 26; // 184

  const rInnerRim = radius - 46; // 164
  const rInnerMajorTickInner = radius - 61; // 149
  const rInnerMediumTickInner = radius - 57; // 153
  const rInnerMinorTickInner = radius - 53; // 157
  const rInnerText = radius - 73; // 137

  const { outerTicks, innerRedTicks } = useMemo(() => {
    // 1. Generate exactly 640 ticks for outer ring (0 to 63, 10 subdivisions per unit)
    const outTicks = [];
    if (showOuterScale) {
      for (let i = 0; i < 640; i++) {
        const angleDeg = (i * 360) / 640 - 90; // 0 at Top (North)
        const angleRad = (angleDeg * Math.PI) / 180;
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;

        const rInner = isMajor
          ? rOuterMajorTickInner
          : isMedium
          ? rOuterMediumTickInner
          : rOuterMinorTickInner;

        const x1 = rOuterRim * Math.cos(angleRad);
        const y1 = rOuterRim * Math.sin(angleRad);
        const x2 = rInner * Math.cos(angleRad);
        const y2 = rInner * Math.sin(angleRad);

        outTicks.push(
          <line
            key={`ot-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={outerTickColor}
            strokeWidth={isMajor ? 1.4 : isMedium ? 0.9 : 0.55}
            strokeOpacity={isMajor ? 0.5 : isMedium ? 0.44 : 0.35}
          />
        );

        if (isMajor) {
          const unit = i / 10;
          const tx = rOuterText * Math.cos(angleRad);
          const ty = rOuterText * Math.sin(angleRad);

          outTicks.push(
            <text
              key={`on-${unit}`}
              x={tx}
              y={ty + 3}
              fill={outerColor}
              fillOpacity="0.5"
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="monospace, system-ui, sans-serif"
              textAnchor="middle"
              transform={`rotate(${angleDeg + 90}, ${tx}, ${ty})`}
            >
              {unit}
            </text>
          );
        }
      }
    }

    // 2. Generate exactly 320 ticks for inner red scale (0 to 32 on the right side)
    const inTicks = [];
    if (showInnerRedScale) {
      for (let i = 0; i <= 320; i++) {
        const angleDeg = (i * 180) / 320 - 90; // 0 at Top (-90°), 32 at Bottom (+90°)
        const angleRad = (angleDeg * Math.PI) / 180;
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;

        const rInner = isMajor
          ? rInnerMajorTickInner
          : isMedium
          ? rInnerMediumTickInner
          : rInnerMinorTickInner;

        const x1 = rInnerRim * Math.cos(angleRad);
        const y1 = rInnerRim * Math.sin(angleRad);
        const x2 = rInner * Math.cos(angleRad);
        const y2 = rInner * Math.sin(angleRad);

        inTicks.push(
          <line
            key={`it-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMajor ? redColor : redMinorColor}
            strokeWidth={isMajor ? 1.3 : isMedium ? 0.85 : 0.5}
            strokeOpacity={isMajor ? 0.5 : isMedium ? 0.425 : 0.35}
          />
        );

        if (isMajor) {
          const unit = i / 10;
          const tx = rInnerText * Math.cos(angleRad);
          const ty = rInnerText * Math.sin(angleRad);

          inTicks.push(
            <text
              key={`in-${unit}`}
              x={tx}
              y={ty + 2.8}
              fill={redColor}
              fillOpacity="0.5"
              fontSize="7.5"
              fontWeight="bold"
              fontFamily="monospace, system-ui, sans-serif"
              textAnchor="middle"
              transform={`rotate(${angleDeg + 90}, ${tx}, ${ty})`}
            >
              {unit}
            </text>
          );
        }
      }
    }

    return { outerTicks: outTicks, innerRedTicks: inTicks };
  }, [
    radius,
    outerColor,
    outerTickColor,
    redColor,
    redMinorColor,
    rOuterRim,
    rOuterMajorTickInner,
    rOuterMediumTickInner,
    rOuterMinorTickInner,
    rOuterText,
    rInnerRim,
    rInnerMajorTickInner,
    rInnerMediumTickInner,
    rInnerMinorTickInner,
    rInnerText,
    showOuterScale,
    showInnerRedScale,
  ]);

  return (
    <g className="protractor-scale-matching-image">
      {/* Outer Rim Circle (Outer boundary line in แผ่นบน.png) */}
      {showOuterScale && (
        <>
          <circle
            cx="0"
            cy="0"
            r={rOuterRim}
            fill="none"
            stroke={outerBorderColor}
            strokeWidth="1.6"
            strokeOpacity="0.5"
          />

          {/* Outer Scale Baseline Arc */}
          <circle
            cx="0"
            cy="0"
            r={rOuterMajorTickInner}
            fill="none"
            stroke={outerTickColor}
            strokeWidth="0.6"
            strokeOpacity="0.25"
          />

          {/* Outer Scale 640 Ticks & 0..63 Numerals */}
          <g>{outerTicks}</g>
        </>
      )}

      {/* Inner Red Baseline Semicircle (Right side: 12 o'clock to 6 o'clock) */}
      {showInnerRedScale && (
        <>
          <path
            d={`M 0 ${-rInnerRim} A ${rInnerRim} ${rInnerRim} 0 0 1 0 ${rInnerRim}`}
            fill="none"
            stroke={redColor}
            strokeWidth="1"
            strokeOpacity="0.5"
          />
          <path
            d={`M 0 ${-rInnerMajorTickInner} A ${rInnerMajorTickInner} ${rInnerMajorTickInner} 0 0 1 0 ${rInnerMajorTickInner}`}
            fill="none"
            stroke={redColor}
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />

          {/* Inner Red Scale 320 Ticks & 0..32 Numerals */}
          <g>{innerRedTicks}</g>
        </>
      )}
    </g>
  );
}

export function ArtilleryProtractorDisc({
  radius = 210,
  className = '',
  theme = 'military-printed',
  showBackdrop = false,
  showOuterScale = true,
  showInnerRedScale = true,
}: ProtractorDiscProps) {
  const isNight = theme === 'tactical-night';
  const size = radius * 2 + 60;
  const half = size / 2;

  return (
    <svg
      viewBox={`-${half} -${half} ${size} ${size}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      {showBackdrop && (
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill={isNight ? '#041006' : '#ffffff'}
          fillOpacity={isNight ? 0.88 : 0.94}
        />
      )}
      <ArtilleryProtractorDiscGroup
        radius={radius}
        theme={theme}
        showOuterScale={showOuterScale}
        showInnerRedScale={showInnerRedScale}
      />
    </svg>
  );
}
