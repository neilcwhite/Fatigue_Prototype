// ============================================
// IMPORT/EXPORT FUNCTIONALITY - SheetJS
// ============================================

import * as XLSX from 'xlsx';
import type {
  AssignmentCamel,
  EmployeeCamel,
  ShiftPatternCamel,
  ProjectCamel
} from './types';

// ==================== EXPORT ====================

export interface ExportData {
  project: ProjectCamel;
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  assignments: AssignmentCamel[];
  periodName?: string;
}

interface ExportRow {
  Date: string;
  Day: string;
  'Shift Pattern': string;
  'Start Time': string;
  'End Time': string;
  'Employee Name': string;
  'Employee Role': string;
  'Duty Type': string;
  'Night Shift': string;
  Notes: string;
}

export function exportToExcel(data: ExportData): void {
  const { project, employees, shiftPatterns, assignments, periodName } = data;

  // Build employee lookup
  const employeeMap = new Map(employees.map(e => [e.id, e]));
  const patternMap = new Map(shiftPatterns.map(p => [p.id, p]));

  // Sort assignments by date, then by shift pattern
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.shiftPatternId.localeCompare(b.shiftPatternId);
  });

  // Build export rows
  const rows: ExportRow[] = sortedAssignments.map(assignment => {
    const employee = employeeMap.get(assignment.employeeId);
    const pattern = patternMap.get(assignment.shiftPatternId);
    const date = new Date(assignment.date);
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });

    // Determine start/end times
    const startTime = assignment.customStartTime || pattern?.startTime || '';
    const endTime = assignment.customEndTime || pattern?.endTime || '';

    return {
      Date: assignment.date,
      Day: dayName,
      'Shift Pattern': pattern?.name || 'Unknown',
      'Start Time': startTime,
      'End Time': endTime,
      'Employee Name': employee?.name || 'Unknown',
      'Employee Role': employee?.role || '',
      'Duty Type': pattern?.dutyType || '',
      'Night Shift': pattern?.isNight ? 'Yes' : 'No',
      Notes: assignment.notes || '',
    };
  });

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new();

  // Sheet 1: Assignments
  const assignmentsSheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  assignmentsSheet['!cols'] = [
    { wch: 12 },  // Date
    { wch: 6 },   // Day
    { wch: 25 },  // Shift Pattern
    { wch: 10 },  // Start Time
    { wch: 10 },  // End Time
    { wch: 20 },  // Employee Name
    { wch: 15 },  // Employee Role
    { wch: 15 },  // Duty Type
    { wch: 10 },  // Night Shift
    { wch: 30 },  // Notes
  ];

  XLSX.utils.book_append_sheet(wb, assignmentsSheet, 'Assignments');

  // Sheet 2: Summary
  const summaryData = [
    { Field: 'Project', Value: project.name },
    { Field: 'Location', Value: project.location || '' },
    { Field: 'Period', Value: periodName || '' },
    { Field: 'Total Assignments', Value: assignments.length },
    { Field: 'Unique Employees', Value: new Set(assignments.map(a => a.employeeId)).size },
    { Field: 'Shift Patterns', Value: shiftPatterns.length },
    { Field: 'Export Date', Value: new Date().toISOString().split('T')[0] },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Sheet 3: Employees
  const employeeRows = employees.map(e => ({
    ID: e.id,
    Name: e.name,
    Role: e.role || '',
    Email: e.email || '',
  }));
  const employeesSheet = XLSX.utils.json_to_sheet(employeeRows);
  employeesSheet['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, employeesSheet, 'Employees');

  // Sheet 4: Shift Patterns
  const patternRows = shiftPatterns.map(p => ({
    ID: p.id,
    Name: p.name,
    'Start Time': p.startTime || '',
    'End Time': p.endTime || '',
    'Duty Type': p.dutyType,
    'Night Shift': p.isNight ? 'Yes' : 'No',
    'Has Weekly Schedule': p.weeklySchedule ? 'Yes' : 'No',
  }));
  const patternsSheet = XLSX.utils.json_to_sheet(patternRows);
  patternsSheet['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
    { wch: 15 }, { wch: 12 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, patternsSheet, 'Shift Patterns');

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeName}_${periodName || 'export'}_${dateStr}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
}

// ==================== IMPORT ====================

export interface ImportResult {
  success: boolean;
  assignments: ParsedAssignment[];
  errors: string[];
  warnings: string[];
}

export interface ParsedAssignment {
  date: string;
  shiftPatternName: string;
  employeeName: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export function parseImportFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find the Assignments sheet (or use first sheet)
        const sheetName = workbook.SheetNames.includes('Assignments')
          ? 'Assignments'
          : workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        const assignments: ParsedAssignment[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        rows.forEach((row, index) => {
          const rowNum = index + 2; // Excel rows start at 1, plus header

          // Try to parse date - handle various formats
          let date = '';
          if (row['Date']) {
            const rawDate = row['Date'];
            if (typeof rawDate === 'number') {
              // Excel serial date
              const excelDate = XLSX.SSF.parse_date_code(rawDate);
              date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            } else if (typeof rawDate === 'string') {
              // Try to parse string date
              const parsed = new Date(rawDate);
              if (!isNaN(parsed.getTime())) {
                date = parsed.toISOString().split('T')[0];
              } else {
                // Try DD/MM/YYYY format
                const parts = rawDate.split(/[\/\-]/);
                if (parts.length === 3) {
                  const [d, m, y] = parts;
                  date = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
            }
          }

          if (!date) {
            errors.push(`Row ${rowNum}: Invalid or missing date`);
            return;
          }

          const employeeName = row['Employee Name'] || row['Employee'] || row['Name'] || '';
          if (!employeeName) {
            errors.push(`Row ${rowNum}: Missing employee name`);
            return;
          }

          const shiftPatternName = row['Shift Pattern'] || row['Pattern'] || row['Shift'] || '';
          if (!shiftPatternName) {
            warnings.push(`Row ${rowNum}: No shift pattern specified, will use default`);
          }

          assignments.push({
            date,
            shiftPatternName: shiftPatternName || 'Custom (Ad-hoc)',
            employeeName: String(employeeName).trim(),
            startTime: row['Start Time'] || row['Start'] || undefined,
            endTime: row['End Time'] || row['End'] || undefined,
            notes: row['Notes'] || row['Note'] || undefined,
          });
        });

        resolve({
          success: errors.length === 0,
          assignments,
          errors,
          warnings,
        });
      } catch (err) {
        resolve({
          success: false,
          assignments: [],
          errors: [`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`],
          warnings: [],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        assignments: [],
        errors: ['Failed to read file'],
        warnings: [],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

// ==================== IMPORT PROCESSOR ====================

export interface ProcessImportOptions {
  parsedAssignments: ParsedAssignment[];
  employees: EmployeeCamel[];
  shiftPatterns: ShiftPatternCamel[];
  projectId: number;
  organisationId: string;
  onCreateAssignment: (data: {
    employeeId: number;
    projectId: number;
    shiftPatternId: string;
    date: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => Promise<void>;
  existingAssignments: AssignmentCamel[];
}

export interface ProcessImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function processImport(options: ProcessImportOptions): Promise<ProcessImportResult> {
  const {
    parsedAssignments,
    employees,
    shiftPatterns,
    projectId,
    onCreateAssignment,
    existingAssignments
  } = options;

  // Build lookup maps (case-insensitive)
  const employeeByName = new Map<string, EmployeeCamel>();
  employees.forEach(e => {
    employeeByName.set(e.name.toLowerCase().trim(), e);
  });

  const patternByName = new Map<string, ShiftPatternCamel>();
  shiftPatterns.forEach(p => {
    patternByName.set(p.name.toLowerCase().trim(), p);
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const parsed of parsedAssignments) {
    // Find employee
    const employee = employeeByName.get(parsed.employeeName.toLowerCase().trim());
    if (!employee) {
      errors.push(`Employee not found: "${parsed.employeeName}"`);
      failed++;
      continue;
    }

    // Find shift pattern
    let pattern = patternByName.get(parsed.shiftPatternName.toLowerCase().trim());

    // If no pattern found, use Custom pattern or first available
    if (!pattern) {
      pattern = shiftPatterns.find(p => p.name.includes('Custom')) || shiftPatterns[0];
    }

    if (!pattern) {
      errors.push(`No shift pattern available for: "${parsed.shiftPatternName}"`);
      failed++;
      continue;
    }

    // Check for existing assignment
    const exists = existingAssignments.some(
      a => a.employeeId === employee.id &&
           a.date === parsed.date &&
           a.shiftPatternId === pattern!.id
    );

    if (exists) {
      skipped++;
      continue;
    }

    // Create assignment
    try {
      await onCreateAssignment({
        employeeId: employee.id,
        projectId,
        shiftPatternId: pattern.id,
        date: parsed.date,
        customStartTime: parsed.startTime,
        customEndTime: parsed.endTime,
      });
      created++;
    } catch (err) {
      errors.push(`Failed to create assignment for ${parsed.employeeName} on ${parsed.date}`);
      failed++;
    }
  }

  return { created, skipped, failed, errors };
}
