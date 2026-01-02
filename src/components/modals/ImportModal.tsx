'use client';

import { useState, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
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
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Import Assignments - {projectName}
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 400 }}>
        {/* Step 1: File Selection */}
        {step === 'select' && (
          <Box>
            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ color: 'text.secondary', mb: 2 }}>
                <Upload className="w-12 h-12" />
              </Box>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Drag and drop an Excel file here, or click to browse
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports .xlsx, .xls, and .csv files
              </Typography>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Format Guide */}
            <Paper variant="outlined" sx={{ mt: 3, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Expected Format
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your file should have columns for:
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2"><strong>Date</strong> (required)</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2"><strong>Employee Name</strong> (required)</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2">Shift Pattern (optional)</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2">Start/End Time (optional)</Typography>
                </Paper>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <Box>
            {/* File info */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ color: 'success.main' }}>
                <FileSpreadsheet className="w-8 h-8" />
              </Box>
              <Box>
                <Typography variant="subtitle2">{file?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {parseResult.assignments.length} assignments found
                </Typography>
              </Box>
            </Paper>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <Alert
                severity="error"
                icon={<AlertTriangle className="w-5 h-5" />}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  {parseResult.errors.length} errors found
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0, maxHeight: 100, overflow: 'auto' }}>
                  {parseResult.errors.map((err, i) => (
                    <li key={i}><Typography variant="body2">{err}</Typography></li>
                  ))}
                </Box>
              </Alert>
            )}

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <Alert
                severity="warning"
                icon={<AlertTriangle className="w-5 h-5" />}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  {parseResult.warnings.length} warnings
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0, maxHeight: 100, overflow: 'auto' }}>
                  {parseResult.warnings.slice(0, 10).map((warn, i) => (
                    <li key={i}><Typography variant="body2">{warn}</Typography></li>
                  ))}
                  {parseResult.warnings.length > 10 && (
                    <li><Typography variant="body2">...and {parseResult.warnings.length - 10} more</Typography></li>
                  )}
                </Box>
              </Alert>
            )}

            {/* Preview table */}
            {parseResult.assignments.length > 0 && (
              <Paper variant="outlined">
                <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2">Preview (first 10 rows)</Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Employee</TableCell>
                      <TableCell>Shift Pattern</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parseResult.assignments.slice(0, 10).map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>{a.date}</TableCell>
                        <TableCell>{a.employeeName}</TableCell>
                        <TableCell>{a.shiftPatternName}</TableCell>
                        <TableCell>
                          {a.startTime && a.endTime
                            ? `${a.startTime} - ${a.endTime}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parseResult.assignments.length > 10 && (
                  <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">
                      ...and {parseResult.assignments.length - 10} more assignments
                    </Typography>
                  </Box>
                )}
              </Paper>
            )}

            {/* Import errors from processing */}
            {importErrors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {importErrors.map((err, i) => (
                  <Typography key={i} variant="body2">{err}</Typography>
                ))}
              </Alert>
            )}
          </Box>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Importing assignments...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {importProgress.created} of {importProgress.total} processed
            </Typography>
          </Box>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ color: 'success.main', mb: 2 }}>
              <CheckCircle className="w-16 h-16" />
            </Box>
            <Typography variant="h5" gutterBottom>
              Import Complete!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Successfully imported {parseResult?.assignments.length || 0} assignments
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {step === 'select' && (
          <Button onClick={onClose}>Cancel</Button>
        )}

        {step === 'preview' && (
          <>
            <Button
              onClick={() => {
                setStep('select');
                setFile(null);
                setParseResult(null);
                setImportErrors([]);
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              color="secondary"
              disabled={!parseResult || parseResult.assignments.length === 0}
              startIcon={<Upload className="w-4 h-4" />}
            >
              Import {parseResult?.assignments.length || 0} Assignments
            </Button>
          </>
        )}

        {step === 'complete' && (
          <Button onClick={onClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
