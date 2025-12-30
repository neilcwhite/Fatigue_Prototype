'use client';

import { useState, useRef } from 'react';
import { Upload, X, AlertTriangle, CheckCircle, FileSpreadsheet } from '@/components/ui/Icons';
import { parseImportFile, type ImportResult, type ParsedAssignment } from '@/lib/importExport';

interface ImportModalProps {
  onClose: () => void;
  onConfirm: (assignments: ParsedAssignment[]) => Promise<void>;
  projectName: string;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'complete';

export function ImportModal({ onClose, onConfirm, projectName }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState({ created: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Parse the file
    const result = await parseImportFile(selectedFile);
    setParseResult(result);
    setStep('preview');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    // Check file type
    if (!droppedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setImportErrors(['Please select an Excel file (.xlsx, .xls) or CSV file']);
      return;
    }

    setFile(droppedFile);
    const result = await parseImportFile(droppedFile);
    setParseResult(result);
    setStep('preview');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.assignments.length === 0) return;

    setStep('importing');
    setImportProgress({ created: 0, total: parseResult.assignments.length });

    try {
      await onConfirm(parseResult.assignments);
      setStep('complete');
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : 'Import failed']);
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Import Assignments - {projectName}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
          {/* Step 1: File Selection */}
          {step === 'select' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">
                  Drag and drop an Excel file here, or click to browse
                </p>
                <p className="text-sm text-slate-500">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Format Guide */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-slate-700 mb-2">Expected Format</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Your file should have columns for:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white px-3 py-2 rounded border text-slate-700">
                    <strong>Date</strong> (required)
                  </div>
                  <div className="bg-white px-3 py-2 rounded border text-slate-700">
                    <strong>Employee Name</strong> (required)
                  </div>
                  <div className="bg-white px-3 py-2 rounded border text-slate-700">
                    Shift Pattern (optional)
                  </div>
                  <div className="bg-white px-3 py-2 rounded border text-slate-700">
                    Start/End Time (optional)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && parseResult && (
            <div>
              {/* File info */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium text-slate-800">{file?.name}</p>
                  <p className="text-sm text-slate-500">
                    {parseResult.assignments.length} assignments found
                  </p>
                </div>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-800">
                      {parseResult.errors.length} errors found
                    </span>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium text-amber-800">
                      {parseResult.warnings.length} warnings
                    </span>
                  </div>
                  <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.warnings.slice(0, 10).map((warn, i) => (
                      <li key={i}>• {warn}</li>
                    ))}
                    {parseResult.warnings.length > 10 && (
                      <li>...and {parseResult.warnings.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {parseResult.assignments.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <span className="text-sm font-medium text-slate-700">
                      Preview (first 10 rows)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600">Date</th>
                          <th className="px-3 py-2 text-left text-slate-600">Employee</th>
                          <th className="px-3 py-2 text-left text-slate-600">Shift Pattern</th>
                          <th className="px-3 py-2 text-left text-slate-600">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.assignments.slice(0, 10).map((a, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-900">{a.date}</td>
                            <td className="px-3 py-2 text-slate-900">{a.employeeName}</td>
                            <td className="px-3 py-2 text-slate-900">{a.shiftPatternName}</td>
                            <td className="px-3 py-2 text-slate-900">
                              {a.startTime && a.endTime
                                ? `${a.startTime} - ${a.endTime}`
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parseResult.assignments.length > 10 && (
                    <div className="px-4 py-2 bg-slate-50 text-sm text-slate-500 border-t">
                      ...and {parseResult.assignments.length - 10} more assignments
                    </div>
                  )}
                </div>
              )}

              {/* Import errors from processing */}
              {importErrors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <ul className="text-sm text-red-700 space-y-1">
                    {importErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">Importing assignments...</p>
              <p className="text-sm text-slate-500 mt-2">
                {importProgress.created} of {importProgress.total} processed
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-medium text-slate-800">Import Complete!</p>
              <p className="text-slate-600 mt-2">
                Successfully imported {parseResult?.assignments.length || 0} assignments
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          {step === 'select' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => {
                  setStep('select');
                  setFile(null);
                  setParseResult(null);
                  setImportErrors([]);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!parseResult || parseResult.assignments.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import {parseResult?.assignments.length || 0} Assignments
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
