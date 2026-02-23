import { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';

type AppointmentEditorFormProps = {
  appointmentCode: string;
  whenValue: string;
  descriptionValue: string;
  locationValue: string;
  notesValue: string;
  onWhenChange: (next: string) => void;
  onWhenKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onDescriptionChange: (next: string) => void;
  onLocationChange: (next: string) => void;
  onNotesChange: (next: string) => void;
  onResolveDate: () => void;
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
  errorText,
  previewContent,
  onConfirm,
  onCancel
}: AppointmentEditorFormProps) => (
  <Stack spacing={2}>
    <Typography variant="subtitle1">Edit {appointmentCode}</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField fullWidth label="When" value={whenValue} onChange={(event) => onWhenChange(event.target.value)} onKeyDown={onWhenKeyDown} placeholder="e.g. next Tuesday 8–9pm" multiline minRows={1} maxRows={3} />
      <Button onClick={onResolveDate}>Resolve date</Button>
    </Stack>
    <TextField fullWidth label="Description" value={descriptionValue} onChange={(event) => onDescriptionChange(event.target.value)} multiline minRows={1} maxRows={3} />
    <TextField fullWidth label="Location" value={locationValue} onChange={(event) => onLocationChange(event.target.value)} multiline minRows={1} maxRows={3} />
    <TextField fullWidth label="Notes" value={notesValue} onChange={(event) => onNotesChange(event.target.value)} multiline minRows={2} maxRows={4} />
    <Paper variant="outlined">
      {errorText ? <Alert severity="error">{errorText}</Alert> : null}
      <Box sx={{ mt: 1 }}>{previewContent}</Box>
    </Paper>
    <Stack direction="row" spacing={1} justifyContent="flex-end">
      <Button onClick={onConfirm}>Confirm</Button>
      <Button variant="outlined" onClick={onCancel}>Cancel</Button>
    </Stack>
  </Stack>
);
