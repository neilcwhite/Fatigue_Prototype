'use client';

import { useMemo } from 'react';
import { getRiskLevel } from '@/lib/fatigue';

interface FatigueDataPoint {
  day: number;
  riskIndex: number;
  fatigueIndex?: number;
  startTime: string;
  endTime: string;
  dutyLength: number;
  cumulative: number;
  timing: number;
  jobBreaks: number;
  riskLevel: { level: string; label: string; color: string };
  fatigueLevel?: { level: string; label: string; color: string };
}

interface FatigueChartProps {
  data: FatigueDataPoint[];
  worstCaseData?: FatigueDataPoint[];
  height?: number;
  showThresholds?: boolean;
  showComponents?: boolean;
  showWorstCase?: boolean;
  chartType?: 'FRI' | 'FGI';  // FRI = Risk Index, FGI = Fatigue Index
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
  worstCaseData,
  height = 180,
  showThresholds = true,
  showComponents = false,
  showWorstCase = false,
  chartType = 'FRI',
}: FatigueChartProps) {
  // Helper to get the value based on chart type
  const getValue = (d: FatigueDataPoint): number => {
    if (chartType === 'FGI') {
      return d.fatigueIndex ?? 0;
    }
    return d.riskIndex;
  };

  const getLevel = (d: FatigueDataPoint) => {
    if (chartType === 'FGI') {
      return d.fatigueLevel ?? { level: 'low', label: 'Low', color: '#22c55e' };
    }
    return d.riskLevel;
  };

  // FGI thresholds are different - based on % of 35 (day) or 30 (night)
  // Using day threshold (35) as default: Low <17.5, Moderate 17.5-26.25, Elevated 26.25-35, Critical >35
  const FGI_THRESHOLD_LOW = 17.5;
  const FGI_THRESHOLD_MODERATE = 26.25;
  const FGI_THRESHOLD_CRITICAL = 35;
  // Chart dimensions - compact technical look
  const padding = { top: 12, right: 30, bottom: 28, left: 36 };
  const width = 400;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { xScale, yScale, maxY, minY } = useMemo(() => {
    if (data.length === 0) {
      const defaultMax = chartType === 'FGI' ? 40 : 1.5;
      const defaultMin = chartType === 'FGI' ? 0 : 0.5;
      return {
        xScale: (d: number) => 0,
        yScale: (v: number) => chartHeight,
        maxY: defaultMax,
        minY: defaultMin,
      };
    }

    const days = data.map(d => d.day);
    const minDay = Math.min(...days);
    const maxDay = Math.max(...days);
    const dayRange = maxDay - minDay || 1;

    // Y-axis: include some padding above max value
    // Also consider worst case data for proper scaling
    const values = data.map(d => getValue(d));
    const worstCaseValues = worstCaseData?.map(d => getValue(d)) || [];
    const allValues = [...values, ...worstCaseValues];

    // Different thresholds for FRI vs FGI
    const thresholdCritical = chartType === 'FGI' ? FGI_THRESHOLD_CRITICAL : THRESHOLD_CRITICAL;
    const thresholdLow = chartType === 'FGI' ? FGI_THRESHOLD_LOW : THRESHOLD_LOW;

    const dataMaxY = Math.max(...allValues, thresholdCritical);
    const dataMinY = Math.min(...allValues, chartType === 'FGI' ? 0 : thresholdLow - 0.2);

    // Round differently for FGI (whole numbers) vs FRI (tenths)
    const maxY = chartType === 'FGI'
      ? Math.ceil(dataMaxY / 5) * 5 + 5
      : Math.ceil(dataMaxY * 10) / 10 + 0.1;
    const minY = chartType === 'FGI'
      ? Math.max(0, Math.floor(dataMinY / 5) * 5)
      : Math.floor(dataMinY * 10) / 10;
    const yRange = maxY - minY || (chartType === 'FGI' ? 10 : 0.5);

    const xScale = (day: number) => {
      return ((day - minDay) / dayRange) * chartWidth;
    };

    const yScale = (value: number) => {
      return chartHeight - ((value - minY) / yRange) * chartHeight;
    };

    return { xScale, yScale, maxY, minY };
  }, [data, worstCaseData, chartWidth, chartHeight, chartType, getValue, FGI_THRESHOLD_CRITICAL, FGI_THRESHOLD_LOW]);

  // Generate Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = chartType === 'FGI' ? 5 : 0.1;
    const start = chartType === 'FGI' ? Math.ceil(minY / 5) * 5 : Math.ceil(minY * 10) / 10;
    for (let v = start; v <= maxY; v += step) {
      ticks.push(chartType === 'FGI' ? Math.round(v) : Math.round(v * 100) / 100);
    }
    return ticks;
  }, [minY, maxY, chartType]);

  // Generate path for line
  const linePath = useMemo(() => {
    if (data.length === 0) return '';

    const sortedData = [...data].sort((a, b) => a.day - b.day);
    const points = sortedData.map(d => `${xScale(d.day)},${yScale(getValue(d))}`);
    return `M ${points.join(' L ')}`;
  }, [data, xScale, yScale, getValue]);

  // Generate area fill path (gradient under line)
  const areaPath = useMemo(() => {
    if (data.length === 0) return '';

    const sortedData = [...data].sort((a, b) => a.day - b.day);
    const points = sortedData.map(d => `${xScale(d.day)},${yScale(getValue(d))}`);
    const firstX = xScale(sortedData[0].day);
    const lastX = xScale(sortedData[sortedData.length - 1].day);
    const bottomY = chartHeight;

    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  }, [data, xScale, yScale, chartHeight, getValue]);

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

  // Generate worst case line path
  const worstCaseLinePath = useMemo(() => {
    if (!worstCaseData || worstCaseData.length === 0) return '';

    const sortedData = [...worstCaseData].sort((a, b) => a.day - b.day);
    const points = sortedData.map(d => `${xScale(d.day)},${yScale(getValue(d))}`);
    return `M ${points.join(' L ')}`;
  }, [worstCaseData, xScale, yScale, getValue]);

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

  // Generate accessible description
  const chartLabel = chartType === 'FGI' ? 'Fatigue Index' : 'Fatigue Risk Index';
  const accessibleDescription = data.length > 0
    ? `${chartLabel} chart showing ${data.length} data points. ` +
      `Values range from ${Math.min(...data.map(d => getValue(d))).toFixed(chartType === 'FGI' ? 1 : 2)} to ${Math.max(...data.map(d => getValue(d))).toFixed(chartType === 'FGI' ? 1 : 2)}. ` +
      `Levels: ${data.map(d => `Day ${d.day}: ${getValue(d).toFixed(chartType === 'FGI' ? 1 : 2)} (${getLevel(d).label})`).join(', ')}.`
    : 'No data to display';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4" role="figure" aria-label={`${chartLabel} Chart`}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={accessibleDescription}
      >
        <title>{chartLabel} ({chartType}) Over Time</title>
        <desc>{accessibleDescription}</desc>
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
          {/* Risk zone backgrounds - use appropriate thresholds for FRI vs FGI */}
          {(() => {
            const tLow = chartType === 'FGI' ? FGI_THRESHOLD_LOW : THRESHOLD_LOW;
            const tMod = chartType === 'FGI' ? FGI_THRESHOLD_MODERATE : THRESHOLD_ELEVATED;
            const tCrit = chartType === 'FGI' ? FGI_THRESHOLD_CRITICAL : THRESHOLD_CRITICAL;
            return (
              <>
                {showThresholds && maxY > tCrit && (
                  <rect x={0} y={yScale(maxY)} width={chartWidth} height={yScale(tCrit) - yScale(maxY)} fill="url(#criticalZone)" />
                )}
                {showThresholds && maxY > tMod && (
                  <rect x={0} y={yScale(tCrit)} width={chartWidth} height={yScale(tMod) - yScale(tCrit)} fill="url(#elevatedZone)" />
                )}
                {showThresholds && maxY > tLow && (
                  <rect x={0} y={yScale(tMod)} width={chartWidth} height={yScale(tLow) - yScale(tMod)} fill="url(#moderateZone)" />
                )}
              </>
            );
          })()}

          {/* Grid lines */}
          {yTicks.map(tick => {
            const tLow = chartType === 'FGI' ? FGI_THRESHOLD_LOW : THRESHOLD_LOW;
            const tMod = chartType === 'FGI' ? FGI_THRESHOLD_MODERATE : THRESHOLD_ELEVATED;
            const tCrit = chartType === 'FGI' ? FGI_THRESHOLD_CRITICAL : THRESHOLD_CRITICAL;
            const isThreshold = tick === tLow || tick === tMod || tick === tCrit;
            return (
              <g key={tick}>
                <line
                  x1={0}
                  y1={yScale(tick)}
                  x2={chartWidth}
                  y2={yScale(tick)}
                  stroke="#e2e8f0"
                  strokeWidth={0.5}
                  strokeDasharray={isThreshold ? "0" : "2 2"}
                />
                <text
                  x={-4}
                  y={yScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[7px] fill-slate-400"
                >
                  {chartType === 'FGI' ? tick.toFixed(0) : tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Threshold lines with labels */}
          {showThresholds && (
            <>
              {(() => {
                const tLow = chartType === 'FGI' ? FGI_THRESHOLD_LOW : THRESHOLD_LOW;
                const tMod = chartType === 'FGI' ? FGI_THRESHOLD_MODERATE : THRESHOLD_ELEVATED;
                const tCrit = chartType === 'FGI' ? FGI_THRESHOLD_CRITICAL : THRESHOLD_CRITICAL;
                return (
                  <>
                    {/* Low threshold */}
                    <line x1={0} y1={yScale(tLow)} x2={chartWidth} y2={yScale(tLow)} stroke="#eab308" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={chartWidth + 2} y={yScale(tLow)} dominantBaseline="middle" className="text-[6px] fill-yellow-600">M</text>

                    {/* Elevated threshold */}
                    <line x1={0} y1={yScale(tMod)} x2={chartWidth} y2={yScale(tMod)} stroke="#f97316" strokeWidth={1} strokeDasharray="4 2" />
                    <text x={chartWidth + 2} y={yScale(tMod)} dominantBaseline="middle" className="text-[6px] fill-orange-600">E</text>

                    {/* Critical threshold */}
                    {maxY >= tCrit && (
                      <>
                        <line x1={0} y1={yScale(tCrit)} x2={chartWidth} y2={yScale(tCrit)} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
                        <text x={chartWidth + 2} y={yScale(tCrit)} dominantBaseline="middle" className="text-[6px] fill-red-600">C</text>
                      </>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* Component lines (if enabled) */}
          {componentPaths && (
            <>
              <path
                d={componentPaths.cumulative}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={0.75}
                strokeDasharray="3 2"
                opacity={0.5}
              />
              <path
                d={componentPaths.timing}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={0.75}
                strokeDasharray="3 2"
                opacity={0.5}
              />
              <path
                d={componentPaths.jobBreaks}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={0.75}
                strokeDasharray="3 2"
                opacity={0.5}
              />
            </>
          )}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Worst case line (behind main line) */}
          {showWorstCase && worstCaseLinePath && (
            <path
              d={worstCaseLinePath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
              opacity={0.7}
            />
          )}

          {/* Main FRI line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {[...data].sort((a, b) => a.day - b.day).map((d) => {
            const value = getValue(d);
            const level = getLevel(d);
            const cx = xScale(d.day);
            const cy = yScale(value);
            const color = RISK_COLORS[level.level as keyof typeof RISK_COLORS] || RISK_COLORS.low;

            return (
              <g key={d.day}>
                {/* Inner dot only - small and clean */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={color}
                  stroke="white"
                  strokeWidth={1}
                />
                {/* Day label */}
                <text
                  x={cx}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="text-[8px] fill-slate-500"
                >
                  D{d.day}
                </text>
                {/* Value label above point */}
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  className="text-[7px] fill-slate-600 font-medium"
                >
                  {value.toFixed(chartType === 'FGI' ? 1 : 2)}
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
            y={chartHeight + 24}
            textAnchor="middle"
            className="text-[8px] fill-slate-400"
          >
            Day
          </text>
          <text
            x={-chartHeight / 2}
            y={-26}
            textAnchor="middle"
            transform="rotate(-90)"
            className="text-[8px] fill-slate-400"
          >
            {chartType}
          </text>
        </g>
      </svg>

      {/* Compact Legend - different for FRI vs FGI */}
      <div className="flex items-center justify-center gap-2 mt-1 pt-1 border-t border-slate-100">
        {chartType === 'FRI' ? (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[8px] text-slate-500">{'<1.0'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-[8px] text-slate-500">1.0-1.1</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[8px] text-slate-500">1.1-1.2</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[8px] text-slate-500">{'>1.2'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[8px] text-slate-500">{'<17.5'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-[8px] text-slate-500">17.5-26</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[8px] text-slate-500">26-35</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[8px] text-slate-500">{'>35'}</span>
            </div>
          </>
        )}
        {showWorstCase && (
          <>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <svg width="12" height="6" className="overflow-visible">
                <line x1="0" y1="3" x2="12" y2="3" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
              </svg>
              <span className="text-[8px] text-slate-500">Worst</span>
            </div>
          </>
        )}
      </div>

      {/* Component legend if showing components */}
      {showComponents && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[7px] text-slate-500">Cum</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[7px] text-slate-500">Time</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-[7px] text-slate-500">Job</span>
          </div>
        </div>
      )}
    </div>
  );
}
