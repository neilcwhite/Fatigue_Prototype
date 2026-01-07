'use client';

import { useState, useMemo, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { X, AlertTriangle, CheckCircle, FileText } from '@/components/ui/Icons';
import type {
  FatigueAssessment,
  FAMPAssessmentReason,
  FAMPQuestionAnswer,
  FAMPRiskLevel,
  FAMPExceedanceLevel,
  FAMPMitigation,
  FAMPQuestionId,
  ComplianceViolation,
  EmployeeCamel,
} from '@/lib/types';
import {
  ASSESSMENT_REASONS,
  ASSESSMENT_QUESTIONS,
  MITIGATION_OPTIONS,
  FAMP_RISK_COLORS,
  calculateRiskLevel,
  calculateTotalScore,
  getRequiredMitigations,
  getAdditionalControls,
  VIOLATION_TO_REASON_MAP,
} from '@/lib/fampConstants';

const STEPS = [
  'Details',
  'Reason',
  'Assessment',
  'Risk Result',
  'Mitigations',
  'Authorisation',
];

interface FatigueAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (assessment: Partial<FatigueAssessment>) => Promise<void>;
  employee?: EmployeeCamel;
  violation?: ComplianceViolation;
  assessorName?: string;
  existingAssessment?: FatigueAssessment;
}

export function FatigueAssessmentModal({
  open,
  onClose,
  onSave,
  employee,
  violation,
  assessorName = '',
  existingAssessment,
}: FatigueAssessmentModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Part 1: Details
  const [employeeName, setEmployeeName] = useState(existingAssessment?.employeeName || employee?.name || '');
  const [jobTitle, setJobTitle] = useState(existingAssessment?.jobTitle || employee?.role || '');
  const [contractNo, setContractNo] = useState(existingAssessment?.contractNo || '');
  const [location, setLocation] = useState(existingAssessment?.location || '');
  const [assessmentDate, setAssessmentDate] = useState(
    existingAssessment?.assessmentDate || new Date().toISOString().split('T')[0]
  );
  const [shiftStartTime, setShiftStartTime] = useState(existingAssessment?.shiftStartTime || '');
  const [shiftEndTime, setShiftEndTime] = useState(existingAssessment?.shiftEndTime || '');
  const [assessorNameState, setAssessorNameState] = useState(existingAssessment?.assessorName || assessorName);
  const [assessorRole, setAssessorRole] = useState(existingAssessment?.assessorRole || '');

  // Part 2: Reasons
  const [selectedReasons, setSelectedReasons] = useState<FAMPAssessmentReason[]>(() => {
    if (existingAssessment?.assessmentReasons) return existingAssessment.assessmentReasons;
    if (violation?.type && VIOLATION_TO_REASON_MAP[violation.type]) {
      return [VIOLATION_TO_REASON_MAP[violation.type]!];
    }
    return [];
  });

  // Part 3: Assessment answers
  const [answers, setAnswers] = useState<Record<FAMPQuestionId, FAMPQuestionAnswer | null>>(() => {
    if (existingAssessment?.assessmentAnswers) {
      const map: Record<FAMPQuestionId, FAMPQuestionAnswer | null> = {} as Record<FAMPQuestionId, FAMPQuestionAnswer | null>;
      existingAssessment.assessmentAnswers.forEach(a => {
        map[a.questionId] = a;
      });
      return map;
    }
    return {} as Record<FAMPQuestionId, FAMPQuestionAnswer | null>;
  });

  // Part 4: Risk adjustment
  const [riskAdjustmentNotes, setRiskAdjustmentNotes] = useState(existingAssessment?.riskAdjustmentNotes || '');
  const [finalRiskOverride, setFinalRiskOverride] = useState<FAMPRiskLevel | null>(null);

  // Part 5: Mitigations
  const [selectedMitigations, setSelectedMitigations] = useState<FAMPMitigation[]>(
    existingAssessment?.appliedMitigations || []
  );
  const [otherMitigationDetails, setOtherMitigationDetails] = useState(
    existingAssessment?.otherMitigationDetails || ''
  );

  // Part 6: Authorisation
  const [employeeAccepted, setEmployeeAccepted] = useState(existingAssessment?.employeeAccepted || false);
  const [employeeComments, setEmployeeComments] = useState(existingAssessment?.employeeComments || '');
  const [managerApproved, setManagerApproved] = useState(existingAssessment?.managerApproved || false);
  const [managerName, setManagerName] = useState(existingAssessment?.managerName || '');
  const [managerComments, setManagerComments] = useState(existingAssessment?.managerComments || '');

  // Calculate derived values
  const exceedanceLevel: FAMPExceedanceLevel = useMemo(() => {
    if (selectedReasons.includes('more_than_72_hours_weekly')) return 'level2';
    if (selectedReasons.includes('more_than_60_hours_weekly')) return 'level1';
    if (violation?.type === 'LEVEL_2_EXCEEDANCE') return 'level2';
    if (violation?.type === 'LEVEL_1_EXCEEDANCE') return 'level1';
    return 'none';
  }, [selectedReasons, violation]);

  const assessmentAnswersList = useMemo(() => {
    return Object.values(answers).filter((a): a is FAMPQuestionAnswer => a !== null);
  }, [answers]);

  const totalScore = useMemo(() => calculateTotalScore(assessmentAnswersList), [assessmentAnswersList]);

  const riskResult = useMemo(() => {
    return calculateRiskLevel(totalScore, exceedanceLevel, selectedReasons);
  }, [totalScore, exceedanceLevel, selectedReasons]);

  const finalRiskLevel = finalRiskOverride || riskResult.riskLevel;

  const requiredMitigations = useMemo(() => getRequiredMitigations(finalRiskLevel), [finalRiskLevel]);
  const additionalControls = useMemo(() => getAdditionalControls(), []);

  // Validation
  const isStep1Valid = employeeName.trim() !== '' && assessorNameState.trim() !== '' && assessmentDate !== '';
  const isStep2Valid = selectedReasons.length > 0;
  const isStep3Valid = assessmentAnswersList.length === ASSESSMENT_QUESTIONS.length;
  const isStep5Valid = requiredMitigations.every(m => selectedMitigations.includes(m.id));

  const canProceed = useCallback((step: number) => {
    switch (step) {
      case 0: return isStep1Valid;
      case 1: return isStep2Valid;
      case 2: return isStep3Valid;
      case 3: return true; // Risk result is display only
      case 4: return isStep5Valid;
      case 5: return true; // Authorisation is optional for draft
      default: return false;
    }
  }, [isStep1Valid, isStep2Valid, isStep3Valid, isStep5Valid]);

  const handleNext = () => {
    if (canProceed(activeStep)) {
      setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const handleReasonToggle = (reason: FAMPAssessmentReason) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleAnswerChange = (questionId: FAMPQuestionId, value: string, label: string, score: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, answerValue: value, answerLabel: label, score },
    }));
  };

  const handleMitigationToggle = (mitigation: FAMPMitigation) => {
    setSelectedMitigations(prev =>
      prev.includes(mitigation)
        ? prev.filter(m => m !== mitigation)
        : [...prev, mitigation]
    );
  };

  const handleSave = async (status: 'draft' | 'pending_employee' | 'completed') => {
    setSaving(true);
    setError(null);

    try {
      const assessment: Partial<FatigueAssessment> = {
        id: existingAssessment?.id,
        employeeId: employee?.id || existingAssessment?.employeeId || 0,
        employeeName,
        jobTitle,
        contractNo,
        location,
        assessmentDate,
        shiftStartTime,
        shiftEndTime,
        assessorName: assessorNameState,
        assessorRole,
        violationType: violation?.type || existingAssessment?.violationType,
        violationDate: violation?.date || existingAssessment?.violationDate,
        assessmentReasons: selectedReasons,
        assessmentAnswers: assessmentAnswersList,
        totalScore,
        exceedanceLevel,
        calculatedRiskLevel: riskResult.riskLevel,
        finalRiskLevel,
        riskAdjustmentNotes: finalRiskOverride ? riskAdjustmentNotes : undefined,
        appliedMitigations: selectedMitigations,
        otherMitigationDetails: selectedMitigations.includes('other') ? otherMitigationDetails : undefined,
        employeeAccepted,
        employeeAcceptanceDate: employeeAccepted ? new Date().toISOString() : undefined,
        employeeComments,
        managerApproved,
        managerApprovalDate: managerApproved ? new Date().toISOString() : undefined,
        managerName: managerApproved ? managerName : undefined,
        managerComments,
        status,
      };

      await onSave(assessment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderDetailsStep();
      case 1:
        return renderReasonsStep();
      case 2:
        return renderQuestionsStep();
      case 3:
        return renderRiskResultStep();
      case 4:
        return renderMitigationsStep();
      case 5:
        return renderAuthorisationStep();
      default:
        return null;
    }
  };

  const renderDetailsStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Part 1: Details of the person being assessed and the assessor
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Name of Person Being Assessed"
            value={employeeName}
            onChange={e => setEmployeeName(e.target.value)}
            fullWidth
            required
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Job Title / Role"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Contract No."
            value={contractNo}
            onChange={e => setContractNo(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Assessment Date"
            type="date"
            value={assessmentDate}
            onChange={e => setAssessmentDate(e.target.value)}
            fullWidth
            required
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label="Shift Start Time"
            type="time"
            value={shiftStartTime}
            onChange={e => setShiftStartTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField
            label="Shift End Time"
            type="time"
            value={shiftEndTime}
            onChange={e => setShiftEndTime(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">Assessor Details</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Assessment By (Name)"
            value={assessorNameState}
            onChange={e => setAssessorNameState(e.target.value)}
            fullWidth
            required
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Assessor Job Title / Role"
            value={assessorRole}
            onChange={e => setAssessorRole(e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderReasonsStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Part 2: Reason for Assessment (tick all that apply)
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {ASSESSMENT_REASONS.map(reason => (
          <Paper
            key={reason.id}
            variant="outlined"
            sx={{
              p: 1.5,
              cursor: 'pointer',
              bgcolor: selectedReasons.includes(reason.id) ? 'primary.50' : 'background.paper',
              borderColor: selectedReasons.includes(reason.id) ? 'primary.main' : 'divider',
              '&:hover': { borderColor: 'primary.light' },
            }}
            onClick={() => handleReasonToggle(reason.id)}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedReasons.includes(reason.id)}
                  onChange={() => handleReasonToggle(reason.id)}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {reason.label}
                    {reason.autoRisk && (
                      <Chip
                        label={`Auto ${reason.autoRisk}`}
                        size="small"
                        sx={{
                          ml: 1,
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: FAMP_RISK_COLORS[reason.autoRisk].bg,
                          color: FAMP_RISK_COLORS[reason.autoRisk].text,
                        }}
                      />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {reason.description}
                  </Typography>
                </Box>
              }
              sx={{ m: 0, width: '100%' }}
            />
          </Paper>
        ))}
      </Box>
    </Box>
  );

  const renderQuestionsStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" color="text.secondary">
          Part 3: Assessment Questions
        </Typography>
        <Chip
          label={`Total Score: ${totalScore}`}
          color={totalScore >= 40 ? 'error' : totalScore >= 20 ? 'warning' : 'success'}
          size="small"
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto', pr: 1 }}>
        {ASSESSMENT_QUESTIONS.map(question => {
          const currentAnswer = answers[question.id];
          return (
            <Paper key={question.id} variant="outlined" sx={{ p: 2 }}>
              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {question.number}. {question.question}
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={currentAnswer?.answerValue || ''}
                  onChange={e => {
                    const option = question.options.find(o => o.value === e.target.value);
                    if (option) {
                      handleAnswerChange(question.id, option.value, option.label, option.score);
                    }
                  }}
                >
                  {question.options.map(option => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio size="small" />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{option.label}</Typography>
                          <Chip
                            label={option.score}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', minWidth: 24 }}
                          />
                        </Box>
                      }
                      sx={{ mb: 0.5 }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );

  const renderRiskResultStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Part 4: Fatigue Risk Assessment Result
      </Typography>

      {/* Score Summary */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Total Assessment Score
        </Typography>
        <Typography variant="h3" fontWeight={700}>
          {totalScore}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Score range: 9-19 (LOW), 20-39 (MEDIUM), 40-65 (HIGH)
        </Typography>
      </Paper>

      {/* Risk Level */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          bgcolor: FAMP_RISK_COLORS[riskResult.riskLevel].bg,
          borderColor: FAMP_RISK_COLORS[riskResult.riskLevel].border,
          borderWidth: 2,
        }}
      >
        <Typography variant="h4" fontWeight={700} sx={{ color: FAMP_RISK_COLORS[riskResult.riskLevel].text }}>
          {riskResult.riskLevel} RISK
        </Typography>
        <Typography variant="body2" sx={{ color: FAMP_RISK_COLORS[riskResult.riskLevel].text, mt: 1 }}>
          {riskResult.description}
        </Typography>
      </Paper>

      {/* Risk Override Option */}
      <Alert severity="info" icon={<AlertTriangle className="w-5 h-5" />}>
        <Typography variant="body2" fontWeight={500} gutterBottom>
          Assessor Judgement
        </Typography>
        <Typography variant="caption">
          Fatigue is not an exact science. If you feel the risk is higher than scored, you may adjust it.
          Be aware of signs and symptoms of fatigue - the person may score low but still be suffering fatigue.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2">Override risk level:</Typography>
        {(['LOW', 'MEDIUM', 'HIGH'] as FAMPRiskLevel[]).map(level => (
          <Chip
            key={level}
            label={level}
            onClick={() => setFinalRiskOverride(level === riskResult.riskLevel ? null : level)}
            sx={{
              bgcolor: finalRiskOverride === level || (!finalRiskOverride && level === riskResult.riskLevel)
                ? FAMP_RISK_COLORS[level].bg
                : 'grey.100',
              color: finalRiskOverride === level || (!finalRiskOverride && level === riskResult.riskLevel)
                ? FAMP_RISK_COLORS[level].text
                : 'text.secondary',
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: finalRiskOverride === level ? FAMP_RISK_COLORS[level].border : 'transparent',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>

      {finalRiskOverride && (
        <TextField
          label="Reason for risk adjustment"
          value={riskAdjustmentNotes}
          onChange={e => setRiskAdjustmentNotes(e.target.value)}
          multiline
          rows={2}
          fullWidth
          size="small"
          placeholder="Explain why you are adjusting the calculated risk level..."
        />
      )}
    </Box>
  );

  const renderMitigationsStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Part 5: Minimum Mitigation / Additional Controls Required
      </Typography>

      <Alert
        severity={finalRiskLevel === 'HIGH' ? 'error' : finalRiskLevel === 'MEDIUM' ? 'warning' : 'success'}
      >
        Based on <strong>{finalRiskLevel}</strong> risk level, the following mitigations are required:
      </Alert>

      {/* Required Mitigations */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Required Mitigations for {finalRiskLevel} Risk
        </Typography>
        {requiredMitigations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No mandatory mitigations required for LOW risk.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {requiredMitigations.map(mitigation => (
              <FormControlLabel
                key={mitigation.id}
                control={
                  <Checkbox
                    checked={selectedMitigations.includes(mitigation.id)}
                    onChange={() => handleMitigationToggle(mitigation.id)}
                    size="small"
                    color="error"
                  />
                }
                label={
                  <Typography variant="body2">
                    {mitigation.label}
                    {mitigation.description && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({mitigation.description})
                      </Typography>
                    )}
                  </Typography>
                }
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Additional Controls */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Additional Controls (tick all to be applied)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {additionalControls.map(control => (
            <FormControlLabel
              key={control.id}
              control={
                <Checkbox
                  checked={selectedMitigations.includes(control.id)}
                  onChange={() => handleMitigationToggle(control.id)}
                  size="small"
                />
              }
              label={<Typography variant="body2">{control.label}</Typography>}
            />
          ))}
        </Box>

        {selectedMitigations.includes('other') && (
          <TextField
            label="Other mitigation details"
            value={otherMitigationDetails}
            onChange={e => setOtherMitigationDetails(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            sx={{ mt: 2 }}
          />
        )}
      </Paper>
    </Box>
  );

  const renderAuthorisationStep = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Part 6: Acceptance and Authorisation
      </Typography>

      {/* Employee Acceptance */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Employee Acceptance
        </Typography>
        <Typography variant="caption" color="text.secondary" paragraph>
          I consider that I am able to continue working safely for the duration of the exceedance.
          I understand the mitigation/additional controls necessary to continue working and will
          inform the supervisor if the situation changes.
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={employeeAccepted}
              onChange={e => setEmployeeAccepted(e.target.checked)}
            />
          }
          label={<Typography variant="body2" fontWeight={500}>I accept the above statement</Typography>}
        />
        <TextField
          label="Employee Comments (optional)"
          value={employeeComments}
          onChange={e => setEmployeeComments(e.target.value)}
          multiline
          rows={2}
          fullWidth
          size="small"
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* Manager Approval */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Project Manager Approval
        </Typography>
        <Typography variant="caption" color="text.secondary" paragraph>
          I have confirmed that the employee appears fit to continue working, and I have briefed
          them on the mitigation/additional controls to be applied. I have also informed others
          within the work group/site to ensure they understand the actions to be taken.
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={managerApproved}
              onChange={e => setManagerApproved(e.target.checked)}
            />
          }
          label={<Typography variant="body2" fontWeight={500}>I approve this assessment</Typography>}
        />
        {managerApproved && (
          <TextField
            label="Manager Name"
            value={managerName}
            onChange={e => setManagerName(e.target.value)}
            fullWidth
            size="small"
            required
            sx={{ mt: 1 }}
          />
        )}
        <TextField
          label="Manager Comments (optional)"
          value={managerComments}
          onChange={e => setManagerComments(e.target.value)}
          multiline
          rows={2}
          fullWidth
          size="small"
          sx={{ mt: 1 }}
        />
      </Paper>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileText className="w-5 h-5" />
          <Typography variant="h6">Fatigue Assessment and Mitigation Plan</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <X className="w-5 h-5" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label, index) => (
            <Step key={label} completed={index < activeStep}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={saving}>
            Back
          </Button>
        )}
        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed(activeStep) || saving}
          >
            Next
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => handleSave('draft')}
              disabled={saving}
            >
              {saving ? <CircularProgress size={20} /> : 'Save as Draft'}
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSave(employeeAccepted && managerApproved ? 'completed' : 'pending_employee')}
              disabled={saving || !isStep5Valid}
              startIcon={saving ? <CircularProgress size={16} /> : <CheckCircle className="w-4 h-4" />}
            >
              {employeeAccepted && managerApproved ? 'Complete Assessment' : 'Submit for Approval'}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
}
