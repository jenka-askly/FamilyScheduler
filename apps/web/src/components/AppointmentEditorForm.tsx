import { KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from 'react';
import { Box, Button, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import CircularProgress from '@mui/material/CircularProgress';

type AppointmentEditorFormProps = {
  whenValue: string;
  descriptionValue: string;
  locationValue: string;
  notesValue: string;
  onWhenChange: (next: string) => void;
  onWhenKeyDown: (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onDescriptionChange: (next: string) => void;
  onLocationChange: (next: string) => void;
  onNotesChange: (next: string) => void;
  onResolveDate: () => void;
  onAcceptPreview: () => void;
  isResolving: boolean;
  canResolve: boolean;
  previewDisplayText: string | null;
  errorText: string | null;
  assumptions: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

export const AppointmentEditorForm = ({
  whenValue,
  descriptionValue,
  locationValue,
  notesValue,
  onWhenChange,
  onWhenKeyDown,
  onDescriptionChange,
  onLocationChange,
  onNotesChange,
  onResolveDate,
  onAcceptPreview,
  isResolving,
  canResolve,
  previewDisplayText,
  errorText,
  assumptions,
  onConfirm,
  onCancel
}: AppointmentEditorFormProps) => {
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => {
    setShowAssumptions(false);
  }, [previewDisplayText, assumptions.length]);

  return (
    <Stack spacing={2}>
    <TextField
      fullWidth
      label="When"
      value={whenValue}
      onChange={(event) => onWhenChange(event.target.value)}
      placeholder="e.g. next Tuesday 8–9pm"
      inputProps={{ onKeyDown: onWhenKeyDown }}
      error={Boolean(errorText)}
      helperText={errorText ?? undefined}
      InputProps={{
        endAdornment: canResolve ? (
          <InputAdornment position="end">
            <Tooltip title="Resolve">
              <span>
                <IconButton size="small" onClick={onResolveDate} disabled={isResolving} aria-label="Resolve">
                  {isResolving ? <CircularProgress size={18} /> : <AutoFixHighIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </InputAdornment>
        ) : undefined
      }}
    />

    {previewDisplayText ? (
      <Box sx={{ mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">Interpreted as: {previewDisplayText}</Typography>
        <Tooltip title="Accept">
          <IconButton size="small" onClick={onAcceptPreview} aria-label="Accept interpreted time">
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        </Box>
        {assumptions.length ? (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: 'pointer', mt: 0.5 }}
              onClick={() => setShowAssumptions((prev) => !prev)}
            >
              Assumptions ({assumptions.length}) {showAssumptions ? '▾' : '▸'}
            </Typography>
            {showAssumptions ? (
              <Box sx={{ mt: 0.5, pl: 2 }}>
                {assumptions.map((assumption, index) => (
                  <Typography key={`${assumption}-${index}`} variant="caption" component="div" color="text.secondary">• {assumption}</Typography>
                ))}
              </Box>
            ) : null}
          </>
        ) : null}
      </Box>
    ) : null}

    <TextField
      fullWidth
      label="Description"
      value={descriptionValue}
      onChange={(event) => onDescriptionChange(event.target.value)}
    />

    <TextField
      fullWidth
      label="Location"
      value={locationValue}
      onChange={(event) => onLocationChange(event.target.value)}
    />

    <TextField
      fullWidth
      label="Notes"
      value={notesValue}
      onChange={(event) => onNotesChange(event.target.value)}
      multiline
      minRows={3}
      maxRows={3}
    />
    <Stack direction="row" spacing={1} justifyContent="flex-end">
      <Button onClick={onConfirm}>Confirm</Button>
      <Button variant="outlined" onClick={onCancel}>
        Cancel
      </Button>
    </Stack>
  </Stack>
  );
};
