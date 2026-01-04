/**
 * Fatigue Export Utilities
 * Handles CSV export and print functionality for fatigue analysis
 */

import { getRiskLevel, parseTimeToHours, calculateDutyLength } from '@/lib/fatigue';
import type { FatigueResult } from '@/lib/types';

interface Shift {
  day: number;
  startTime: string;
  endTime: string;
  isRestDay?: boolean;
  commuteIn?: number;
  commuteOut?: number;
  workload?: number;
  attention?: number;
  breakFreq?: number;
  breakLen?: number;
}

interface FatigueParams {
  commuteTime: number;
  workload: number;
  attention: number;
  breakFrequency: number;
  breakLength: number;
}

interface ExportData {
  shifts: Shift[];
  results: FatigueResult[];
  params: FatigueParams;
  maxFRI: number;
  avgFRI: number;
  overallRisk: string;
  patternName?: string;
  projectName?: string;
}

/**
 * Export fatigue analysis to CSV file
 */
export function exportFatigueToCSV(data: ExportData): void {
  const { shifts, results, params, maxFRI, avgFRI, patternName, projectName } = data;

  const rows = [
    ['Fatigue Risk Assessment Export'],
    [`Generated: ${new Date().toISOString()}`],
    patternName ? [`Pattern: ${patternName}`] : [],
    projectName ? [`Project: ${projectName}`] : [],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Maximum FRI', maxFRI.toFixed(3)],
    ['Average FRI', avgFRI.toFixed(3)],
    ['Overall Risk Level', getRiskLevel(maxFRI).level],
    ['Total Shifts', String(shifts.filter(s => !s.isRestDay).length)],
    [],
    ['Global Parameters'],
    ['Default Commute Time (mins)', String(params.commuteTime)],
    ['Default Workload (1-5)', String(params.workload)],
    ['Default Attention (1-5)', String(params.attention)],
    ['Default Break Frequency (mins)', String(params.breakFrequency)],
    ['Default Break Length (mins)', String(params.breakLength)],
    [],
    ['Shift Details'],
    ['Day', 'Start', 'End', 'Duration (hrs)', 'Commute In', 'Commute Out', 'Workload', 'Attention', 'Break Freq', 'Break Len', 'FRI', 'Risk Level'],
  ];

  shifts.forEach((shift, idx) => {
    if (shift.isRestDay) {
      rows.push([String(shift.day), 'REST DAY', '', '', '', '', '', '', '', '', '', '']);
    } else {
      const result = results.find(r => r.day === shift.day);
      const startHrs = parseTimeToHours(shift.startTime);
      const endHrs = parseTimeToHours(shift.endTime);
      const duration = calculateDutyLength(startHrs, endHrs);

      rows.push([
        String(shift.day),
        shift.startTime,
        shift.endTime,
        duration.toFixed(1),
        String(shift.commuteIn ?? Math.floor(params.commuteTime / 2)),
        String(shift.commuteOut ?? Math.ceil(params.commuteTime / 2)),
        String(shift.workload ?? params.workload),
        String(shift.attention ?? params.attention),
        String(shift.breakFreq ?? params.breakFrequency),
        String(shift.breakLen ?? params.breakLength),
        result ? result.riskIndex.toFixed(3) : 'N/A',
        result ? getRiskLevel(result.riskIndex).level : 'N/A',
      ]);
    }
  });

  const csv = rows.filter(r => r.length > 0).map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fatigue_analysis_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate print-friendly HTML for fatigue report
 */
export function generatePrintHTML(data: ExportData): string {
  const { shifts, results, params, maxFRI, avgFRI, overallRisk, patternName, projectName } = data;

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'low': return '#dcfce7';
      case 'moderate': return '#fef9c3';
      case 'elevated': return '#ffedd5';
      case 'critical': return '#fee2e2';
      default: return '#f3f4f6';
    }
  };

  const getRiskTextColor = (level: string) => {
    switch (level) {
      case 'low': return '#166534';
      case 'moderate': return '#854d0e';
      case 'elevated': return '#9a3412';
      case 'critical': return '#991b1b';
      default: return '#374151';
    }
  };

  const shiftRows = shifts.map((shift, idx) => {
    if (shift.isRestDay) {
      return `<tr><td>Day ${shift.day}</td><td colspan="4" style="text-align:center;color:#6b7280;">REST DAY</td></tr>`;
    }
    const result = results.find(r => r.day === shift.day);
    const riskLevel = result ? getRiskLevel(result.riskIndex).level : 'N/A';
    const startHrs = parseTimeToHours(shift.startTime);
    const endHrs = parseTimeToHours(shift.endTime);
    const duration = calculateDutyLength(startHrs, endHrs);

    return `
      <tr>
        <td>Day ${shift.day}</td>
        <td>${shift.startTime} - ${shift.endTime}</td>
        <td>${duration.toFixed(1)}h</td>
        <td style="font-weight:600;">${result ? result.riskIndex.toFixed(3) : 'N/A'}</td>
        <td style="background-color:${getRiskBgColor(riskLevel)};color:${getRiskTextColor(riskLevel)};font-weight:600;">${riskLevel.toUpperCase()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fatigue Risk Assessment Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 8px; color: #1e293b; }
        h2 { font-size: 18px; margin: 24px 0 12px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-card { padding: 16px; border-radius: 8px; text-align: center; }
        .summary-card .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .summary-card .value { font-size: 24px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; color: #475569; }
        .params-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; }
        .param-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .param-label { color: #64748b; }
        .param-value { font-weight: 600; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <h1>Fatigue Risk Assessment Report</h1>
      <div class="meta">
        Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        ${patternName ? `<br>Pattern: ${patternName}` : ''}
        ${projectName ? `<br>Project: ${projectName}` : ''}
      </div>

      <div class="summary-grid">
        <div class="summary-card" style="background-color:${getRiskBgColor(overallRisk)};color:${getRiskTextColor(overallRisk)};">
          <div class="label">Overall Risk</div>
          <div class="value">${overallRisk.toUpperCase()}</div>
        </div>
        <div class="summary-card" style="background:#f8fafc;">
          <div class="label">Maximum FRI</div>
          <div class="value" style="color:${getRiskTextColor(getRiskLevel(maxFRI).level)};">${maxFRI.toFixed(3)}</div>
        </div>
        <div class="summary-card" style="background:#f8fafc;">
          <div class="label">Average FRI</div>
          <div class="value">${avgFRI.toFixed(3)}</div>
        </div>
      </div>

      <h2>Shift Schedule</h2>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Duration</th>
            <th>FRI</th>
            <th>Risk Level</th>
          </tr>
        </thead>
        <tbody>
          ${shiftRows}
        </tbody>
      </table>

      <h2>Analysis Parameters</h2>
      <div class="params-grid">
        <div class="param-item"><span class="param-label">Default Commute Time</span><span class="param-value">${params.commuteTime} mins</span></div>
        <div class="param-item"><span class="param-label">Default Workload</span><span class="param-value">${params.workload}/5</span></div>
        <div class="param-item"><span class="param-label">Default Attention</span><span class="param-value">${params.attention}/5</span></div>
        <div class="param-item"><span class="param-label">Break Frequency</span><span class="param-value">${params.breakFrequency} mins</span></div>
        <div class="param-item"><span class="param-label">Break Length</span><span class="param-value">${params.breakLength} mins</span></div>
        <div class="param-item"><span class="param-label">Total Work Shifts</span><span class="param-value">${shifts.filter(s => !s.isRestDay).length}</span></div>
      </div>

      <div class="footer">
        <p>Generated by Fatigue Management System - Based on HSE RR446 Fatigue Risk Index methodology</p>
        <p>This report is for guidance only. Always follow your organisation's fatigue management policies.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Open print dialog with fatigue report
 */
export function printFatigueReport(data: ExportData): void {
  const printContent = generatePrintHTML(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
