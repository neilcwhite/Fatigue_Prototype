'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { Settings, ChevronDown, ChevronUp } from '@/components/ui/Icons';
import { ROLE_PRESETS, type RoleKey, type FatigueParams } from './hooks/useFatigueState';

interface FatigueParamsPanelProps {
  params: FatigueParams;
  onParamsChange: (params: FatigueParams) => void;
  selectedRole: RoleKey;
  onRoleChange: (role: RoleKey) => void;
  onApplyGlobalToAll: () => void;
  onResetParams: () => void;
  isReadOnly?: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export function FatigueParamsPanel({
  params,
  onParamsChange,
  selectedRole,
  onRoleChange,
  onApplyGlobalToAll,
  onResetParams,
  isReadOnly = false,
  showSettings,
  onToggleSettings,
}: FatigueParamsPanelProps) {
  const handleParamChange = (field: keyof FatigueParams, value: number) => {
    onParamsChange({ ...params, [field]: value });
  };

  const handleRoleSelect = (roleKey: RoleKey) => {
    onRoleChange(roleKey);
    if (roleKey !== 'custom') {
      const preset = ROLE_PRESETS[roleKey];
      onParamsChange({
        ...params,
        workload: preset.workload,
        attention: preset.attention,
      });
    }
  };

  return (
    <Paper sx={{ mb: 2 }}>
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={onToggleSettings}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings className="w-4 h-4" />
          <Typography variant="subtitle2" fontWeight={600}>
            Global Parameters
          </Typography>
          {!showSettings && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Commute: {params.commuteTime}min | Workload: {params.workload}/5 | Attention: {params.attention}/5
            </Typography>
          )}
        </Box>
        <IconButton size="small">
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </IconButton>
      </Box>

      <Collapse in={showSettings}>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          {/* Role Preset Selector */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom>
              Role Preset
            </Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <Select
                value={selectedRole}
                onChange={(e) => handleRoleSelect(e.target.value as RoleKey)}
                disabled={isReadOnly}
              >
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <MenuItem key={key} value={key}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{preset.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {preset.description} (W:{preset.workload}/A:{preset.attention})
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Parameter Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
            <Tooltip title="Total travel time to and from work (split equally by default)">
              <TextField
                label="Commute Time (mins)"
                type="number"
                size="small"
                value={params.commuteTime}
                onChange={(e) => handleParamChange('commuteTime', Number(e.target.value))}
                disabled={isReadOnly}
                inputProps={{ min: 0, max: 480 }}
              />
            </Tooltip>

            <Tooltip title="Physical/mental effort (1=Low, 5=High)">
              <TextField
                label="Workload (1-5)"
                type="number"
                size="small"
                value={params.workload}
                onChange={(e) => handleParamChange('workload', Number(e.target.value))}
                disabled={isReadOnly || selectedRole !== 'custom'}
                inputProps={{ min: 1, max: 5 }}
              />
            </Tooltip>

            <Tooltip title="Vigilance/concentration required (1=Low, 5=High)">
              <TextField
                label="Attention (1-5)"
                type="number"
                size="small"
                value={params.attention}
                onChange={(e) => handleParamChange('attention', Number(e.target.value))}
                disabled={isReadOnly || selectedRole !== 'custom'}
                inputProps={{ min: 1, max: 5 }}
              />
            </Tooltip>

            <Tooltip title="Time between breaks (minutes)">
              <TextField
                label="Break Frequency (mins)"
                type="number"
                size="small"
                value={params.breakFrequency}
                onChange={(e) => handleParamChange('breakFrequency', Number(e.target.value))}
                disabled={isReadOnly}
                inputProps={{ min: 0, max: 720 }}
              />
            </Tooltip>

            <Tooltip title="Duration of each break (minutes)">
              <TextField
                label="Break Length (mins)"
                type="number"
                size="small"
                value={params.breakLength}
                onChange={(e) => handleParamChange('breakLength', Number(e.target.value))}
                disabled={isReadOnly}
                inputProps={{ min: 0, max: 120 }}
              />
            </Tooltip>
          </Box>

          {/* Action Buttons */}
          {!isReadOnly && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" variant="outlined" onClick={onResetParams}>
                Reset to Defaults
              </Button>
              <Button size="small" variant="contained" onClick={onApplyGlobalToAll}>
                Apply to All Shifts
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
