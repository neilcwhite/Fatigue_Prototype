/**
 * CSV USER IMPORT UTILITIES
 *
 * Handles parsing and validation of CSV files for bulk user import.
 * De-duplicates based on Sentinel numbers.
 */

import type {
  CSVImportRow,
  CSVImportResult,
  CSVImportConflict,
  Employee,
} from './types';
import { isValidSentinelNumber } from './permissions';

/**
 * Parse CSV file content into structured rows
 * Expected columns: name, sentinel_number, role (optional), email (optional)
 */
export function parseCSV(csvContent: string): CSVImportRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header row
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const sentinelIndex = headers.findIndex(h =>
    h === 'sentinel_number' || h === 'sentinel' || h === 'sentinel number'
  );
  const roleIndex = headers.indexOf('role');
  const emailIndex = headers.indexOf('email');

  if (nameIndex === -1) {
    throw new Error('CSV must contain a "name" column');
  }
  if (sentinelIndex === -1) {
    throw new Error('CSV must contain a "sentinel_number" column');
  }

  // Parse data rows
  const rows: CSVImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());

    const name = values[nameIndex];
    const sentinel_number = values[sentinelIndex];

    if (!name || !sentinel_number) {
      console.warn(`Skipping row ${i + 1}: missing name or sentinel_number`);
      continue;
    }

    rows.push({
      name,
      sentinel_number,
      role: roleIndex >= 0 ? values[roleIndex] : undefined,
      email: emailIndex >= 0 ? values[emailIndex] : undefined,
    });
  }

  return rows;
}

/**
 * Validate CSV rows for import
 * Returns validation errors
 */
export function validateCSVRows(rows: CSVImportRow[]): string[] {
  const errors: string[] = [];

  // Check for duplicates within CSV
  const sentinelCounts = new Map<string, number>();
  for (const row of rows) {
    const count = sentinelCounts.get(row.sentinel_number) || 0;
    sentinelCounts.set(row.sentinel_number, count + 1);
  }

  for (const [sentinel, count] of sentinelCounts.entries()) {
    if (count > 1) {
      errors.push(`Duplicate Sentinel number in CSV: ${sentinel} (appears ${count} times)`);
    }
  }

  // Validate each row
  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 for header and 0-index

    // Validate name
    if (row.name.length < 2) {
      errors.push(`Row ${rowNum}: Name too short (minimum 2 characters)`);
    }

    // Validate Sentinel number
    if (!isValidSentinelNumber(row.sentinel_number)) {
      errors.push(
        `Row ${rowNum}: Invalid Sentinel number "${row.sentinel_number}" ` +
        `(must be 3-15 alphanumeric characters)`
      );
    }

    // Validate email if provided
    if (row.email && !isValidEmail(row.email)) {
      errors.push(`Row ${rowNum}: Invalid email address "${row.email}"`);
    }
  });

  return errors;
}

/**
 * Process CSV import against existing employees
 * Returns categorized results: imported, skipped, conflicts
 */
export function processCSVImport(
  csvRows: CSVImportRow[],
  existingEmployees: Employee[]
): CSVImportResult {
  const result: CSVImportResult = {
    imported: [],
    skipped: [],
    conflicts: [],
  };

  // Build lookup map of existing employees by Sentinel number
  const existingBySentinel = new Map<string, Employee>();
  for (const emp of existingEmployees) {
    if (emp.sentinel_number) {
      existingBySentinel.set(emp.sentinel_number, emp);
    }
  }

  // Process each CSV row
  for (const row of csvRows) {
    const existing = existingBySentinel.get(row.sentinel_number);

    if (!existing) {
      // Sentinel number is new -> import
      result.imported.push(row);
    } else if (existing.name === row.name) {
      // Sentinel exists + name matches -> skip
      result.skipped.push(row);
    } else {
      // Sentinel exists + name different -> flag conflict
      result.conflicts.push({
        sentinel_number: row.sentinel_number,
        csvName: row.name,
        existingName: existing.name,
        existingEmployeeId: existing.id,
      });
    }
  }

  return result;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Format import result summary for display
 */
export function formatImportSummary(result: CSVImportResult): string {
  const parts: string[] = [];

  if (result.imported.length > 0) {
    parts.push(`${result.imported.length} new employee${result.imported.length === 1 ? '' : 's'} to import`);
  }
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} existing employee${result.skipped.length === 1 ? '' : 's'} skipped`);
  }
  if (result.conflicts.length > 0) {
    parts.push(`${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'} requiring review`);
  }

  return parts.join(', ');
}

/**
 * Generate example CSV content for download
 */
export function generateExampleCSV(): string {
  return `name,sentinel_number,role,email
John Smith,ABC123,Engineer,john.smith@example.com
Jane Doe,XYZ789,Supervisor,jane.doe@example.com
Mike Johnson,M1234,Technician,mike.j@example.com`;
}
