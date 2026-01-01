'use client';

import { useMemo } from 'react';
import { getRiskLevel } from '@/lib/fatigue';

interface FatigueDataPoint {
  day: number;
  riskIndex: number;
  startTime: string;
  endTime: string;
  dutyLength: number;
  cumulative: number;
  timing: number;
  jobBreaks: number;
  riskLevel: { level: string; label: string; color: string };
}

interface FatigueChartProps {
  data: FatigueDataPoint[];
  height?: number;
  showThresholds?: boolean;
  showComponents?: boolean;
}

// Risk threshold constants (HSE RR446)
const THRESHOLD_LOW = 1.0;
const THRESHOLD_ELEVATED = 1.1;
const THRESHOLD_CRITICAL = 1.2;

// Color map for risk levels
const RISK_COLORS = {
  low: '#22c55e',      // green-500
  moderate: '#eab308', // yellow-500
  elevated: '#f97316', // orange-500
  critical: '#ef4444', // red-500
};

export function FatigueChart({
  data,
  height = 280,
  showThresholds = true,
  showComponents = false,
}: FatigueChartProps) {
  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { xScale, yScale, maxY, minY } = useMemo(() => {
    if (data.length === 0) {
      return {
        xScale: (d: number) => 0,
        yScale: (v: number) => chartHeight,
        maxY: 1.5,
        minY: 0.5,
      };
    }

    const days = data.map(d => d.day);
    const minDay = Math.min(...days);
    const maxDay = Math.max(...days);
    const dayRange = maxDay - minDay || 1;

    // Y-axis: include some padding above max value
    const values = data.map(d => d.riskIndex);
    const dataMaxY = Math.max(...values, THRESHOLD_CRITICAL);
    const dataMinY = Math.min(...values, THRESHOLD_LOW - 0.2);
    const maxY = Math.ceil(dataMaxY * 10) / 10 + 0.1;
    const minY = Math.floor(dataMinY * 10) / 10;
    const yRange = maxY - minY || 0.5;

    const xScale = (day: number) => {
      return ((day - minDay) / dayRange) * chartWidth;
    };

    const yScale = (value: number) => {
      return chartHeight - ((value - minY) / yRange) * chartHeight;
    };

    return { xScale, yScale, maxY, minY };
  }, [data, chartWidth, chartHeight]);

  // Generate Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = 0.1;
    for (let v = Math.ceil(minY * 10) / 10; v <= maxY; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return ticks;
  }, [minY, maxY]);

  // Generate path for line
  const linePath = useMemo(() => {
    if (data.length === 0) return '';

    const sortedData = [...data].sort((a, b) => a.day - b.day);
    const points = sortedData.map(d => `${xScale(d.day)},${yScale(d.riskIndex)}`);
    return `M ${points.join(' L ')}`;
  }, [data, xScale, yScale]);

  // Generate area fill path (gradient under line)
  const areaPath = useMemo(() => {
    if (data.length === 0) return '';

    const sortedData = [...data].sort((a, b) => a.day - b.day);
    const points = sortedData.map(d => `${xScale(d.day)},${yScale(d.riskIndex)}`);
    const firstX = xScale(sortedData[0].day);
    const lastX = xScale(sortedData[sortedData.length - 1].day);
    const bottomY = chartHeight;

    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  }, [data, xScale, yScale, chartHeight]);

  // Generate component lines if showing
  const componentPaths = useMemo(() => {
    if (!showComponents || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => a.day - b.day);

    const cumPath = sortedData.map(d => `${xScale(d.day)},${yScale(d.cumulative)}`).join(' L ');
    const timPath = sortedData.map(d => `${xScale(d.day)},${yScale(d.timing)}`).join(' L ');
    const jobPath = sortedData.map(d => `${xScale(d.day)},${yScale(d.jobBreaks)}`).join(' L ');

    return {
      cumulative: `M ${cumPath}`,
      timing: `M ${timPath}`,
      jobBreaks: `M ${jobPath}`,
    };
  }, [data, showComponents, xScale, yScale]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200"
        style={{ height }}
      >
        <p className="text-slate-400">No data to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Gradient for area fill */}
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>

          {/* Risk zone gradients */}
          <linearGradient id="criticalZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="elevatedZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="moderateZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Risk zone backgrounds */}
          {showThresholds && maxY > THRESHOLD_CRITICAL && (
            <rect
              x={0}
              y={yScale(maxY)}
              width={chartWidth}
              height={yScale(THRESHOLD_CRITICAL) - yScale(maxY)}
              fill="url(#criticalZone)"
            />
          )}
          {showThresholds && maxY > THRESHOLD_ELEVATED && (
            <rect
              x={0}
              y={yScale(THRESHOLD_CRITICAL)}
              width={chartWidth}
              height={yScale(THRESHOLD_ELEVATED) - yScale(THRESHOLD_CRITICAL)}
              fill="url(#elevatedZone)"
            />
          )}
          {showThresholds && maxY > THRESHOLD_LOW && (
            <rect
              x={0}
              y={yScale(THRESHOLD_ELEVATED)}
              width={chartWidth}
              height={yScale(THRESHOLD_LOW) - yScale(THRESHOLD_ELEVATED)}
              fill="url(#moderateZone)"
            />
          )}

          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={0}
                y1={yScale(tick)}
                x2={chartWidth}
                y2={yScale(tick)}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray={tick === 1.0 || tick === 1.1 || tick === 1.2 ? "0" : "4 4"}
              />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[10px] fill-slate-500"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Threshold lines with labels */}
          {showThresholds && (
            <>
              {/* Low threshold (1.0) */}
              <line
                x1={0}
                y1={yScale(THRESHOLD_LOW)}
                x2={chartWidth}
                y2={yScale(THRESHOLD_LOW)}
                stroke="#eab308"
                strokeWidth={2}
                strokeDasharray="8 4"
              />
              <text
                x={chartWidth + 4}
                y={yScale(THRESHOLD_LOW)}
                dominantBaseline="middle"
                className="text-[9px] fill-yellow-600 font-medium"
              >
                Mod
              </text>

              {/* Elevated threshold (1.1) */}
              <line
                x1={0}
                y1={yScale(THRESHOLD_ELEVATED)}
                x2={chartWidth}
                y2={yScale(THRESHOLD_ELEVATED)}
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="8 4"
              />
              <text
                x={chartWidth + 4}
                y={yScale(THRESHOLD_ELEVATED)}
                dominantBaseline="middle"
                className="text-[9px] fill-orange-600 font-medium"
              >
                Elev
              </text>

              {/* Critical threshold (1.2) */}
              {maxY >= THRESHOLD_CRITICAL && (
                <>
                  <line
                    x1={0}
                    y1={yScale(THRESHOLD_CRITICAL)}
                    x2={chartWidth}
                    y2={yScale(THRESHOLD_CRITICAL)}
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                  />
                  <text
                    x={chartWidth + 4}
                    y={yScale(THRESHOLD_CRITICAL)}
                    dominantBaseline="middle"
                    className="text-[9px] fill-red-600 font-medium"
                  >
                    Crit
                  </text>
                </>
              )}
            </>
          )}

          {/* Component lines (if enabled) */}
          {componentPaths && (
            <>
              <path
                d={componentPaths.cumulative}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.6}
              />
              <path
                d={componentPaths.timing}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.6}
              />
              <path
                d={componentPaths.jobBreaks}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.6}
              />
            </>
          )}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Main FRI line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {[...data].sort((a, b) => a.day - b.day).map((d) => {
            const cx = xScale(d.day);
            const cy = yScale(d.riskIndex);
            const color = RISK_COLORS[d.riskLevel.level as keyof typeof RISK_COLORS] || RISK_COLORS.low;

            return (
              <g key={d.day}>
                {/* Outer ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill={color}
                  fillOpacity={0.2}
                />
                {/* Inner dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                />
                {/* Day label */}
                <text
                  x={cx}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-600"
                >
                  D{d.day}
                </text>
                {/* Value label above point */}
                <text
                  x={cx}
                  y={cy - 14}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-700 font-medium"
                >
                  {d.riskIndex.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          {/* Y-axis */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          {/* Axis labels */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 35}
            textAnchor="middle"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Day of Pattern
          </text>
          <text
            x={-chartHeight / 2}
            y={-35}
            textAnchor="middle"
            transform="rotate(-90)"
            className="text-[11px] fill-slate-500 font-medium"
          >
            Fatigue Risk Index (FRI)
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[10px] text-slate-600">{'<1.0 Low'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-[10px] text-slate-600">1.0-1.1 Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-[10px] text-slate-600">1.1-1.2 Elevated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-[10px] text-slate-600">{'>1.2 Critical'}</span>
        </div>
      </div>

      {/* Component legend if showing components */}
      {showComponents && (
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[10px] text-slate-500">Cumulative</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[10px] text-slate-500">Timing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[10px] text-slate-500">Job/Breaks</span>
          </div>
        </div>
      )}
    </div>
  );
}
