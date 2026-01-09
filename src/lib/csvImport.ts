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
 * Supports both custom format and Network Rail format
 *
 * Custom format: first_name, last_name, sentinel_number, role (optional)
 * Network Rail format: First Name, Surname, Sentinel Number, Date Of Birth (ignored),
 *                      NI Number (ignored), Primary Sponsor, Sub Sponsors, Current Employer
 *
 * Note: Date Of Birth and NI Number are intentionally ignored for GDPR compliance
 */
export function parseCSV(csvContent: string): CSVImportRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header row - normalize to lowercase with underscores
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  // Find required columns (support multiple naming conventions)
  const firstNameIndex = headers.findIndex(h => h === 'first_name' || h === 'firstname');
  const lastNameIndex = headers.findIndex(h => h === 'last_name' || h === 'lastname' || h === 'surname');
  const sentinelIndex = headers.findIndex(h =>
    h === 'sentinel_number' || h === 'sentinel' || h === 'sentinelnumber'
  );

  // Find optional columns
  const roleIndex = headers.findIndex(h => h === 'role');
  const primarySponsorIndex = headers.findIndex(h => h === 'primary_sponsor' || h === 'primarysponsor');
  const subSponsorsIndex = headers.findIndex(h => h === 'sub_sponsors' || h === 'subsponsors');
  const currentEmployerIndex = headers.findIndex(h => h === 'current_employer' || h === 'currentemployer');

  // Validate required columns
  if (firstNameIndex === -1) {
    throw new Error('CSV must contain a "First Name" or "first_name" column');
  }
  if (lastNameIndex === -1) {
    throw new Error('CSV must contain a "Surname", "Last Name", or "last_name" column');
  }
  if (sentinelIndex === -1) {
    throw new Error('CSV must contain a "Sentinel Number" or "sentinel_number" column');
  }

  // Parse data rows
  const rows: CSVImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());

    const first_name = values[firstNameIndex];
    const last_name = values[lastNameIndex];
    const sentinel_number = values[sentinelIndex];

    if (!first_name || !last_name || !sentinel_number) {
      console.warn(`Skipping row ${i + 1}: missing required fields`);
      continue;
    }

    const row: CSVImportRow = {
      first_name,
      last_name,
      sentinel_number,
    };

    // Add optional fields if present and not empty
    if (roleIndex >= 0 && values[roleIndex]) {
      row.role = values[roleIndex];
    }
    if (primarySponsorIndex >= 0 && values[primarySponsorIndex]) {
      row.primary_sponsor = values[primarySponsorIndex];
    }
    if (subSponsorsIndex >= 0 && values[subSponsorsIndex]) {
      row.sub_sponsors = values[subSponsorsIndex];
    }
    if (currentEmployerIndex >= 0 && values[currentEmployerIndex]) {
      row.current_employer = values[currentEmployerIndex];
    }

    rows.push(row);
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

    // Validate first name
    if (row.first_name.length < 2) {
      errors.push(`Row ${rowNum}: First name too short (minimum 2 characters)`);
    }

    // Validate last name
    if (row.last_name.length < 2) {
      errors.push(`Row ${rowNum}: Last name too short (minimum 2 characters)`);
    }

    // Validate Sentinel number
    if (!isValidSentinelNumber(row.sentinel_number)) {
      errors.push(
        `Row ${rowNum}: Invalid Sentinel number "${row.sentinel_number}" ` +
        `(must be 3-15 alphanumeric characters)`
      );
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
    const fullName = `${row.first_name} ${row.last_name}`;

    if (!existing) {
      // Sentinel number is new -> import
      result.imported.push(row);
    } else if (existing.name === fullName) {
      // Sentinel exists + name matches -> skip
      result.skipped.push(row);
    } else {
      // Sentinel exists + name different -> flag conflict
      result.conflicts.push({
        sentinel_number: row.sentinel_number,
        csvFirstName: row.first_name,
        csvLastName: row.last_name,
        existingName: existing.name,
        existingEmployeeId: existing.id,
      });
    }
  }

  return result;
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
  return `first_name,last_name,sentinel_number,role,primary_sponsor,sub_sponsors,current_employer
John,Smith,ABC123,Engineer,C Spencer Ltd,,C Spencer Ltd
Jane,Doe,XYZ789,Supervisor,Network Rail,,Network Rail
Mike,Johnson,M1234,Technician,C Spencer Ltd,,`;
}
