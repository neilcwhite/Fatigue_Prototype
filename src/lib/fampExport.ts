/**
 * FAMP (Fatigue Assessment and Mitigation Plan) Export
 * Generates Word documents matching the Network Rail template format
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  convertInchesToTwip,
  type ITableCellOptions,
} from 'docx';
import type { FatigueAssessment, FAMPRiskLevel, FAMPMitigation } from './types';
import {
  ASSESSMENT_REASONS,
  ASSESSMENT_QUESTIONS,
  MITIGATION_OPTIONS,
  FAMP_STATUS_LABELS,
} from './fampConstants';

// Constants for styling
const COLORS = {
  headerBg: '1F4E79',       // Dark blue for headers
  headerText: 'FFFFFF',     // White text
  greenBg: 'C6EFCE',        // Light green for LOW risk
  yellowBg: 'FFEB9C',       // Light yellow for MEDIUM risk
  redBg: 'FFC7CE',          // Light red for HIGH risk
  lightGray: 'F2F2F2',      // Alternating row background
  borderColor: '000000',    // Black borders
};

// Helper to create a table cell with standard formatting
function createCell(
  text: string,
  options: {
    bold?: boolean;
    shading?: string;
    width?: number;
    widthType?: (typeof WidthType)[keyof typeof WidthType];
    columnSpan?: number;
    rowSpan?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    fontSize?: number;
  } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options.bold,
            size: options.fontSize ?? 20, // 10pt default
          }),
        ],
        alignment: options.alignment ?? AlignmentType.LEFT,
      }),
    ],
    width: options.width ? { size: options.width, type: options.widthType ?? WidthType.PERCENTAGE } : undefined,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    shading: options.shading ? { fill: options.shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
  });
}

// Helper to create a header cell
function createHeaderCell(text: string, width?: number, columnSpan?: number): TableCell {
  return createCell(text, {
    bold: true,
    shading: COLORS.headerBg,
    width,
    columnSpan,
    alignment: AlignmentType.CENTER,
  });
}

// Get risk level background color
function getRiskColor(riskLevel: FAMPRiskLevel): string {
  switch (riskLevel) {
    case 'LOW': return COLORS.greenBg;
    case 'MEDIUM': return COLORS.yellowBg;
    case 'HIGH': return COLORS.redBg;
    default: return COLORS.lightGray;
  }
}

// Format date for display
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Get reason label from ID
function getReasonLabel(reasonId: string): string {
  const reason = ASSESSMENT_REASONS.find(r => r.id === reasonId);
  return reason?.label ?? reasonId;
}

// Get mitigation label from ID
function getMitigationLabel(mitigationId: FAMPMitigation): string {
  const mitigation = MITIGATION_OPTIONS.find(m => m.id === mitigationId);
  return mitigation?.label ?? mitigationId;
}

// Get question text from ID
function getQuestionText(questionId: string): string {
  const question = ASSESSMENT_QUESTIONS.find(q => q.id === questionId);
  return question?.question ?? questionId;
}

/**
 * Create Part 1: Details table
 */
function createPart1Details(assessment: FatigueAssessment): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Section header
      new TableRow({
        children: [
          createCell('1', { bold: true, shading: COLORS.headerBg, width: 5 }),
          createCell('DETAILS', { bold: true, shading: COLORS.headerBg, columnSpan: 3 }),
        ],
      }),
      // Name and Job Title
      new TableRow({
        children: [
          createCell('Name of Person Being Assessed', { bold: true, width: 30 }),
          createCell(assessment.employeeName, { width: 20 }),
          createCell('Job Title / Role', { bold: true, width: 25 }),
          createCell(assessment.jobTitle ?? '', { width: 25 }),
        ],
      }),
      // Contract and Location
      new TableRow({
        children: [
          createCell('Contract No.', { bold: true }),
          createCell(assessment.contractNo ?? ''),
          createCell('Location', { bold: true }),
          createCell(assessment.location ?? ''),
        ],
      }),
      // Date and Shift Times
      new TableRow({
        children: [
          createCell('Date', { bold: true }),
          createCell(formatDate(assessment.assessmentDate)),
          createCell('Shift Start / Finish Times', { bold: true }),
          createCell(`${assessment.shiftStartTime ?? ''} - ${assessment.shiftEndTime ?? ''}`),
        ],
      }),
      // Assessor details
      new TableRow({
        children: [
          createCell('Assessment By (Name)', { bold: true }),
          createCell(assessment.assessorName),
          createCell('Job Title / Role', { bold: true }),
          createCell(assessment.assessorRole ?? ''),
        ],
      }),
    ],
  });
}

/**
 * Create Part 2: Reasons for Assessment table
 */
function createPart2Reasons(assessment: FatigueAssessment): Table {
  const selectedReasons = new Set(assessment.assessmentReasons);

  const reasonRows = ASSESSMENT_REASONS.map(reason => {
    const isSelected = selectedReasons.has(reason.id);
    return new TableRow({
      children: [
        createCell(reason.label, { width: 80 }),
        createCell(isSelected ? '✓' : '', {
          width: 10,
          alignment: AlignmentType.CENTER,
          shading: isSelected ? COLORS.yellowBg : undefined,
        }),
        createCell(reason.autoRisk ? `If Yes, ${reason.autoRisk === 'HIGH' ? 'automatically a High' : 'at least a Medium'} Fatigue Risk` : '', {
          width: 10,
          fontSize: 16,
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('2', { bold: true, shading: COLORS.headerBg, width: 5 }),
          createCell('REASON FOR ASSESSMENT', { bold: true, shading: COLORS.headerBg, columnSpan: 2 }),
        ],
      }),
      ...reasonRows,
    ],
  });
}

/**
 * Create Part 3: Assessment Questions table
 */
function createPart3Assessment(assessment: FatigueAssessment): Table {
  const answerMap = new Map(
    assessment.assessmentAnswers.map(a => [a.questionId, a])
  );

  const questionRows: TableRow[] = [];

  ASSESSMENT_QUESTIONS.forEach(question => {
    const answer = answerMap.get(question.id);

    // Question header row
    questionRows.push(new TableRow({
      children: [
        createCell(`${question.number}. ${question.question}`, {
          bold: true,
          columnSpan: 3,
          shading: COLORS.lightGray,
        }),
      ],
    }));

    // Options rows
    question.options.forEach(option => {
      const isSelected = answer?.answerValue === option.value;
      questionRows.push(new TableRow({
        children: [
          createCell(option.label, { width: 70 }),
          createCell(String(option.score), { width: 15, alignment: AlignmentType.CENTER }),
          createCell(isSelected ? String(option.score) : '', {
            width: 15,
            alignment: AlignmentType.CENTER,
            bold: true,
            shading: isSelected ? COLORS.yellowBg : undefined,
          }),
        ],
      }));
    });

    // Score label row
    questionRows.push(new TableRow({
      children: [
        createCell('', { width: 70 }),
        createCell('', { width: 15 }),
        createCell('SCORE', { width: 15, bold: true, alignment: AlignmentType.CENTER }),
      ],
    }));
  });

  // Total score row
  questionRows.push(new TableRow({
    children: [
      createCell('TOTAL SCORE (13 answers added together)', {
        bold: true,
        columnSpan: 2,
        shading: COLORS.headerBg,
      }),
      createCell(String(assessment.totalScore), {
        bold: true,
        alignment: AlignmentType.CENTER,
        shading: getRiskColor(assessment.finalRiskLevel),
        fontSize: 24,
      }),
    ],
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('3', { bold: true, shading: COLORS.headerBg, width: 5 }),
          createCell('ASSESSMENT', { bold: true, shading: COLORS.headerBg, columnSpan: 2 }),
        ],
      }),
      ...questionRows,
    ],
  });
}

/**
 * Create Part 4: Risk Assessment Result table
 */
function createPart4RiskAssessment(assessment: FatigueAssessment): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('4', { bold: true, shading: COLORS.headerBg, width: 5 }),
          createCell('FATIGUE RISK ASSESSMENT', { bold: true, shading: COLORS.headerBg, columnSpan: 3 }),
        ],
      }),
      // Header row
      new TableRow({
        children: [
          createCell('FACTOR', { bold: true, shading: COLORS.lightGray, width: 40 }),
          createCell('Yes/No', { bold: true, shading: COLORS.lightGray, width: 15, alignment: AlignmentType.CENTER }),
          createCell('RISK', { bold: true, shading: COLORS.lightGray, width: 15, alignment: AlignmentType.CENTER }),
          createCell('MINIMUM MITIGATION REQUIRED', { bold: true, shading: COLORS.lightGray, width: 30 }),
        ],
      }),
      // Score 9-19
      new TableRow({
        children: [
          createCell('Fatigue Risk Score is 9-19'),
          createCell(assessment.totalScore >= 9 && assessment.totalScore <= 19 ? '✓' : '', { alignment: AlignmentType.CENTER }),
          createCell('LOW', { shading: COLORS.greenBg, alignment: AlignmentType.CENTER }),
          createCell('None'),
        ],
      }),
      // Score 20-39
      new TableRow({
        children: [
          createCell('Fatigue Risk Score is 20-39'),
          createCell(assessment.totalScore >= 20 && assessment.totalScore <= 39 ? '✓' : '', { alignment: AlignmentType.CENTER }),
          createCell('MEDIUM', { shading: COLORS.yellowBg, alignment: AlignmentType.CENTER }),
          createCell('Apply controls/mitigation specified in Part 5'),
        ],
      }),
      // Level 1 Exceedance
      new TableRow({
        children: [
          createCell('Level 1 Exceedance'),
          createCell(assessment.exceedanceLevel === 'level1' ? '✓' : '', { alignment: AlignmentType.CENTER }),
          createCell('MEDIUM', { shading: COLORS.yellowBg, alignment: AlignmentType.CENTER }),
          createCell('Apply controls/mitigation specified in Part 5'),
        ],
      }),
      // Score 40-65
      new TableRow({
        children: [
          createCell('Fatigue Risk Score is 40-65'),
          createCell(assessment.totalScore >= 40 ? '✓' : '', { alignment: AlignmentType.CENTER }),
          createCell('HIGH', { shading: COLORS.redBg, alignment: AlignmentType.CENTER }),
          createCell('Apply controls/mitigation specified in Part 5'),
        ],
      }),
      // Level 2 Exceedance
      new TableRow({
        children: [
          createCell('Level 2 Exceedance'),
          createCell(assessment.exceedanceLevel === 'level2' ? '✓' : '', { alignment: AlignmentType.CENTER }),
          createCell('HIGH', { shading: COLORS.redBg, alignment: AlignmentType.CENTER }),
          createCell('Apply controls/mitigation specified in Part 5'),
        ],
      }),
      // Final risk level result
      new TableRow({
        children: [
          createCell('FINAL RISK LEVEL:', { bold: true }),
          createCell('', { columnSpan: 2 }),
          createCell(assessment.finalRiskLevel, {
            bold: true,
            shading: getRiskColor(assessment.finalRiskLevel),
            alignment: AlignmentType.CENTER,
            fontSize: 24,
          }),
        ],
      }),
    ],
  });
}

/**
 * Create Part 5: Mitigations table
 */
function createPart5Mitigations(assessment: FatigueAssessment): Table {
  const selectedMitigations = new Set(assessment.appliedMitigations);

  // HIGH risk mitigations
  const highMitigations = MITIGATION_OPTIONS.filter(m => m.requiredFor.includes('HIGH') && !m.isAdditionalControl);
  // MEDIUM risk mitigations (that aren't also HIGH)
  const mediumMitigations = MITIGATION_OPTIONS.filter(m => m.requiredFor.includes('MEDIUM') && !m.requiredFor.includes('HIGH') && !m.isAdditionalControl);
  // Additional controls
  const additionalControls = MITIGATION_OPTIONS.filter(m => m.isAdditionalControl);

  const rows: TableRow[] = [
    // Section header
    new TableRow({
      children: [
        createCell('5', { bold: true, shading: COLORS.headerBg, width: 5 }),
        createCell('MINIMUM MITIGATION / ADDITIONAL CONTROLS REQUIRED', { bold: true, shading: COLORS.headerBg, columnSpan: 2 }),
      ],
    }),
    // HIGH risk header
    new TableRow({
      children: [
        createCell('HIGH RISK - MINIMUM MITIGATION', { bold: true, shading: COLORS.redBg, columnSpan: 2, width: 80 }),
        createCell('Applied', { bold: true, shading: COLORS.redBg, width: 20, alignment: AlignmentType.CENTER }),
      ],
    }),
  ];

  // HIGH risk mitigations
  highMitigations.forEach(m => {
    const isApplied = selectedMitigations.has(m.id);
    rows.push(new TableRow({
      children: [
        createCell(m.label, { columnSpan: 2 }),
        createCell(isApplied ? '✓' : '', { alignment: AlignmentType.CENTER, shading: isApplied ? COLORS.greenBg : undefined }),
      ],
    }));
  });

  // MEDIUM risk header
  rows.push(new TableRow({
    children: [
      createCell('MEDIUM RISK - MINIMUM MITIGATION', { bold: true, shading: COLORS.yellowBg, columnSpan: 2 }),
      createCell('Applied', { bold: true, shading: COLORS.yellowBg, alignment: AlignmentType.CENTER }),
    ],
  }));

  // MEDIUM risk mitigations
  mediumMitigations.forEach(m => {
    const isApplied = selectedMitigations.has(m.id);
    rows.push(new TableRow({
      children: [
        createCell(m.label, { columnSpan: 2 }),
        createCell(isApplied ? '✓' : '', { alignment: AlignmentType.CENTER, shading: isApplied ? COLORS.greenBg : undefined }),
      ],
    }));
  });

  // Additional controls header
  rows.push(new TableRow({
    children: [
      createCell('ADDITIONAL CONTROLS', { bold: true, shading: COLORS.lightGray, columnSpan: 2 }),
      createCell('Applied', { bold: true, shading: COLORS.lightGray, alignment: AlignmentType.CENTER }),
    ],
  }));

  // Additional controls
  additionalControls.forEach(m => {
    const isApplied = selectedMitigations.has(m.id);
    rows.push(new TableRow({
      children: [
        createCell(m.label, { columnSpan: 2 }),
        createCell(isApplied ? '✓' : '', { alignment: AlignmentType.CENTER, shading: isApplied ? COLORS.greenBg : undefined }),
      ],
    }));
  });

  // Other mitigation details
  if (assessment.otherMitigationDetails) {
    rows.push(new TableRow({
      children: [
        createCell('Other details:', { bold: true }),
        createCell(assessment.otherMitigationDetails, { columnSpan: 2 }),
      ],
    }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

/**
 * Create Part 6: Acceptance and Authorisation table
 */
function createPart6Authorisation(assessment: FatigueAssessment): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Section header
      new TableRow({
        children: [
          createCell('6', { bold: true, shading: COLORS.headerBg, width: 5 }),
          createCell('ACCEPTANCE AND AUTHORISATION', { bold: true, shading: COLORS.headerBg, columnSpan: 3 }),
        ],
      }),
      // Employee section header
      new TableRow({
        children: [
          createCell('EMPLOYEE ACCEPTANCE', { bold: true, shading: COLORS.lightGray, columnSpan: 4 }),
        ],
      }),
      // Employee acceptance
      new TableRow({
        children: [
          createCell('I have read and understood this Fatigue Assessment. I understand the mitigation that needs to be applied and will inform the Project Manager if my circumstances change.', { columnSpan: 4 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Accepted:', { bold: true }),
          createCell(assessment.employeeAccepted ? 'Yes' : 'No'),
          createCell('Date:', { bold: true }),
          createCell(formatDate(assessment.employeeAcceptanceDate)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Employee Comments:', { bold: true }),
          createCell(assessment.employeeComments ?? '', { columnSpan: 3 }),
        ],
      }),
      // Manager section header
      new TableRow({
        children: [
          createCell('PROJECT MANAGER APPROVAL', { bold: true, shading: COLORS.lightGray, columnSpan: 4 }),
        ],
      }),
      // Manager approval
      new TableRow({
        children: [
          createCell('I have reviewed this Fatigue Assessment and confirm the controls/mitigation to be applied.', { columnSpan: 4 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Approved:', { bold: true }),
          createCell(assessment.managerApproved ? 'Yes' : 'No'),
          createCell('Date:', { bold: true }),
          createCell(formatDate(assessment.managerApprovalDate)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Manager Name:', { bold: true }),
          createCell(assessment.managerName ?? ''),
          createCell('Comments:', { bold: true }),
          createCell(assessment.managerComments ?? ''),
        ],
      }),
    ],
  });
}

/**
 * Generate a complete FAMP Word document
 */
export async function generateFAMPDocument(assessment: FatigueAssessment): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'FATIGUE ASSESSMENT AND MITIGATION PLAN (FAMP)',
                bold: true,
                size: 32,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          // Subtitle with status
          new Paragraph({
            children: [
              new TextRun({
                text: `Status: ${FAMP_STATUS_LABELS[assessment.status] ?? assessment.status}`,
                size: 20,
                italics: true,
              }),
              new TextRun({
                text: `    |    Generated: ${new Date().toLocaleDateString('en-GB')}`,
                size: 20,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          // Part 1: Details
          createPart1Details(assessment),
          new Paragraph({ spacing: { after: 200 } }),
          // Part 2: Reasons
          createPart2Reasons(assessment),
          new Paragraph({ spacing: { after: 200 } }),
          // Part 3: Assessment
          createPart3Assessment(assessment),
          new Paragraph({ spacing: { after: 200 } }),
          // Part 4: Risk Assessment
          createPart4RiskAssessment(assessment),
          new Paragraph({ spacing: { after: 200 } }),
          // Part 5: Mitigations
          createPart5Mitigations(assessment),
          new Paragraph({ spacing: { after: 200 } }),
          // Part 6: Authorisation
          createPart6Authorisation(assessment),
          // Footer note
          new Paragraph({
            children: [
              new TextRun({
                text: 'This document was generated by the Fatigue Management System based on Network Rail NR/L2/OHS/003 standard.',
                size: 16,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Download a FAMP as a Word document
 */
export async function downloadFAMPAsWord(assessment: FatigueAssessment): Promise<void> {
  const blob = await generateFAMPDocument(assessment);

  // Create filename from employee name and date
  const safeName = assessment.employeeName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = assessment.assessmentDate.replace(/-/g, '');
  const filename = `FAMP_${safeName}_${dateStr}.docx`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
