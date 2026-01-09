'use client';

import { useState, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import { Upload, Download, X, CheckCircle, AlertTriangle } from '@/components/ui/Icons';
import type { CSVImportRow, CSVImportResult, Employee } from '@/lib/types';
import { parseCSV, validateCSVRows, processCSVImport, generateExampleCSV, formatImportSummary } from '@/lib/csvImport';

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  onImport: (rows: CSVImportRow[]) => Promise<void>;
  organisationId: string;
}

type ImportStep = 'upload' | 'preview' | 'conflicts' | 'importing' | 'complete';

export function CSVImportModal({
  open,
  onClose,
  existingEmployees,
  onImport,
  organisationId,
}: CSVImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CSVImportRow[]>([]);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setErrors([]);

    try {
      const content = await file.text();
      const rows = parseCSV(content);
      const validationErrors = validateCSVRows(rows);

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setStep('upload');
        return;
      }

      setCsvRows(rows);
      const result = processCSVImport(rows, existingEmployees);
      setImportResult(result);

      if (result.conflicts.length > 0) {
        setStep('conflicts');
      } else {
        setStep('preview');
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to parse CSV file']);
      setStep('upload');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateExampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importResult) return;

    setImporting(true);
    setStep('importing');

    try {
      await onImport(importResult.imported);
      setStep('complete');
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to import employees']);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setCsvFile(null);
    setCsvRows([]);
    setImportResult(null);
    setErrors([]);
    setStep('upload');
    onClose();
  };

  const handleSkipConflicts = () => {
    // Remove conflicts from import list
    if (importResult) {
      setImportResult({
        ...importResult,
        conflicts: [],
      });
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Import Employees from CSV</Typography>
          <IconButton onClick={handleClose} size="small">
            <X className="w-5 h-5" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Upload Step */}
        {step === 'upload' && (
          <Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Upload a CSV file containing employee data. Supports both custom format and Network Rail format.
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" mb={2}>
              <strong>Required:</strong> First Name (or first_name), Surname (or last_name), Sentinel Number
              <br />
              <strong>Optional:</strong> Role, Primary Sponsor, Sub Sponsors, Current Employer
              <br />
              <strong>Note:</strong> Date of Birth and NI Number are ignored for GDPR compliance
            </Typography>

            <Button
              variant="outlined"
              startIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadTemplate}
              size="small"
              sx={{ mb: 3 }}
            >
              Download Template
            </Button>

            <Paper
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-2 text-slate-400" />
              <Typography variant="body1" mb={1}>
                {csvFile ? csvFile.name : 'Click to upload or drag and drop'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                CSV files only
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Paper>

            {errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  Validation Errors:
                </Typography>
                {errors.map((error, index) => (
                  <Typography key={index} variant="body2">
                    • {error}
                  </Typography>
                ))}
              </Alert>
            )}
          </Box>
        )}

        {/* Preview Step */}
        {step === 'preview' && importResult && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              {formatImportSummary(importResult)}
            </Alert>

            {importResult.imported.length > 0 && (
              <>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  New Employees to Import ({importResult.imported.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>First Name</TableCell>
                        <TableCell>Last Name</TableCell>
                        <TableCell>Sentinel Number</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Primary Sponsor</TableCell>
                        <TableCell>Current Employer</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importResult.imported.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.first_name}</TableCell>
                          <TableCell>{row.last_name}</TableCell>
                          <TableCell>
                            <Chip label={row.sentinel_number} size="small" />
                          </TableCell>
                          <TableCell>{row.role || '-'}</TableCell>
                          <TableCell>{row.primary_sponsor || '-'}</TableCell>
                          <TableCell>{row.current_employer || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {importResult.skipped.length > 0 && (
              <>
                <Typography variant="subtitle1" fontWeight={600} mb={1} color="text.secondary">
                  Skipped (Already Exists) ({importResult.skipped.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>First Name</TableCell>
                        <TableCell>Last Name</TableCell>
                        <TableCell>Sentinel Number</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importResult.skipped.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.first_name}</TableCell>
                          <TableCell>{row.last_name}</TableCell>
                          <TableCell>
                            <Chip label={row.sentinel_number} size="small" color="default" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        )}

        {/* Conflicts Step */}
        {step === 'conflicts' && importResult && importResult.conflicts.length > 0 && (
          <Box>
            <Alert severity="warning" icon={<AlertTriangle className="w-5 h-5" />} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Sentinel Number Conflicts Detected
              </Typography>
              <Typography variant="body2">
                The following Sentinel numbers already exist but with different names. Review and decide how to proceed.
              </Typography>
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sentinel Number</TableCell>
                    <TableCell>CSV Name</TableCell>
                    <TableCell>Existing Name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importResult.conflicts.map((conflict, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip label={conflict.sentinel_number} size="small" color="warning" />
                      </TableCell>
                      <TableCell>
                        {conflict.csvFirstName} {conflict.csvLastName}
                      </TableCell>
                      <TableCell sx={{ color: 'error.main', fontWeight: 500 }}>
                        {conflict.existingName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="body2" color="text.secondary" mt={2}>
              You can skip these conflicts and import only the new employees, or cancel to fix the CSV file.
            </Typography>
          </Box>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" mb={2}>
              Importing employees...
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </Box>
          </Box>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <Box textAlign="center" py={4}>
            <CheckCircle className="w-16 h-16 mx-auto mb-3 text-green-500" />
            <Typography variant="h6" mb={2}>
              Import Successful!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {importResult.imported.length} employee{importResult.imported.length === 1 ? '' : 's'} imported successfully.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'upload' && (
          <Button onClick={handleClose}>Cancel</Button>
        )}

        {step === 'preview' && (
          <>
            <Button onClick={() => setStep('upload')}>Back</Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={!importResult || importResult.imported.length === 0}
            >
              Import {importResult?.imported.length || 0} Employee{importResult?.imported.length === 1 ? '' : 's'}
            </Button>
          </>
        )}

        {step === 'conflicts' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSkipConflicts} variant="outlined">
              Skip Conflicts & Continue
            </Button>
          </>
        )}

        {step === 'complete' && (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
