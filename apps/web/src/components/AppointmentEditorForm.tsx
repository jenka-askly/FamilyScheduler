import { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Box, Button, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import CircularProgress from '@mui/material/CircularProgress';

type AppointmentEditorFormProps = {
  appointmentCode: string;
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
  previewContent: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export const AppointmentEditorForm = ({
  appointmentCode,
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
  previewContent,
  onConfirm,
  onCancel
}: AppointmentEditorFormProps) => (
  <Stack spacing={2}>
    <Typography variant="subtitle2" color="text.secondary">{appointmentCode}</Typography>

    <TextField
      fullWidth
      label="When"
      value={whenValue}
      onChange={(event) => onWhenChange(event.target.value)}
      placeholder="e.g. next Tuesday 8–9pm"
      multiline
      minRows={1}
      maxRows={3}
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: -1 }}>
        <Typography variant="body2" color="text.secondary">Interpreted as: {previewDisplayText}</Typography>
        <Tooltip title="Accept">
          <IconButton size="small" onClick={onAcceptPreview} aria-label="Accept interpreted time">
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ) : null}

    <TextField
      fullWidth
      label="Description"
      value={descriptionValue}
      onChange={(event) => onDescriptionChange(event.target.value)}
      multiline
      minRows={1}
      maxRows={3}
    />

    <TextField
      fullWidth
      label="Location"
      value={locationValue}
      onChange={(event) => onLocationChange(event.target.value)}
      multiline
      minRows={1}
      maxRows={3}
    />

    <TextField
      fullWidth
      label="Notes"
      value={notesValue}
      onChange={(event) => onNotesChange(event.target.value)}
      multiline
      minRows={2}
      maxRows={4}
    />

    {previewContent ? <Box sx={{ mt: -1 }}>{previewContent}</Box> : null}

    <Stack direction="row" spacing={1} justifyContent="flex-end">
      <Button onClick={onConfirm}>Confirm</Button>
      <Button variant="outlined" onClick={onCancel}>
        Cancel
      </Button>
    </Stack>
  </Stack>
);
