import { ReactNode, useState } from 'react';
import { Box, Button, Chip, IconButton, List, ListItem, Stack, Tooltip, Typography } from '@mui/material';
import type { TimeSpec } from '../../../../packages/shared/src/types.js';

type Appointment = {
  id: string;
  code: string;
  desc: string;
  date: string;
  startTime?: string;
  durationMins?: number;
  isAllDay: boolean;
  people: string[];
  peopleDisplay: string[];
  location: string;
  locationRaw: string;
  locationDisplay: string;
  locationMapQuery: string;
  locationName: string;
  locationAddress: string;
  locationDirections: string;
  notes: string;
  scanStatus: 'pending' | 'parsed' | 'failed' | 'deleted' | null;
  scanImageKey: string | null;
  scanImageMime: string | null;
  scanCapturedAt: string | null;
  updatedAt?: string;
  time: TimeSpec;
};

type AppointmentCardListProps = {
  appointments: Appointment[];
  getStatus: (appointment: Appointment) => 'unreconcilable' | 'conflict' | 'no_conflict';
  formatWhen: (appointment: Appointment) => string;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  onSelectPeople: (appointment: Appointment) => void;
  onOpenScanViewer: (appointment: Appointment) => void;
  scanViewIcon: ReactNode;
  editIcon: ReactNode;
  assignIcon: ReactNode;
  deleteIcon: ReactNode;
};

export function AppointmentCardList({
  appointments,
  getStatus,
  formatWhen,
  onEdit,
  onDelete,
  onSelectPeople,
  onOpenScanViewer,
  scanViewIcon,
  editIcon,
  assignIcon,
  deleteIcon
}: AppointmentCardListProps) {
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());

  const toggleExpandedText = (id: string) => {
    setExpandedTextIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <List disablePadding>
      {appointments.map((appointment) => {
        const apptStatus = getStatus(appointment);
        const whenText = appointment.time?.intent?.status !== 'resolved' ? 'Unresolved' : formatWhen(appointment);
        const statusLabel = apptStatus === 'unreconcilable' ? 'Unreconcilable' : apptStatus === 'conflict' ? 'Conflict' : 'No conflict';
        const isProblemStatus = statusLabel && statusLabel.toLowerCase() !== 'no conflict';
        const statusColor = apptStatus === 'unreconcilable' ? 'warning' : 'error';
        const peopleText = appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned';
        const titleText = appointment.desc || 'Appointment';
        const locationText = appointment.locationDisplay || appointment.location;
        const notesText = appointment.notes?.trim();
        const hasLongText = Boolean(notesText && notesText.length > 120);
        const isTextExpanded = expandedTextIds.has(appointment.id);
        const hasMetaRow = Boolean(peopleText || locationText || notesText);

        return (
          <ListItem key={appointment.id} disableGutters sx={{ display: 'block', borderBottom: (theme) => `1px solid ${theme.palette.divider}`, py: 0.75 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                width: '100%',
                py: 0.25,
                px: 0.25
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, minWidth: 0 }} noWrap title={titleText}>{titleText}</Typography>
                  {isProblemStatus ? <Chip size="small" label={statusLabel} color={statusColor} variant="outlined" /> : null}
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 500 }}>{whenText}</Typography>
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {appointment.scanImageKey ? (
                    <Tooltip title="View scanned document">
                      <IconButton
                        size="small"
                        color="inherit"
                        aria-label="View scanned document"
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                        onClick={() => onOpenScanViewer(appointment)}
                      >
                        {scanViewIcon}
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Tooltip title="Edit appointment">
                    <IconButton size="small" color="inherit" aria-label="Edit appointment" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={() => onEdit(appointment)}>
                      {editIcon}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Assign people">
                    <IconButton size="small" color="inherit" aria-label="Assign people" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={() => onSelectPeople(appointment)}>
                      {assignIcon}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete appointment">
                    <IconButton size="small" color="inherit" aria-label="Delete appointment" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={() => onDelete(appointment)}>
                      {deleteIcon}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
            <Stack spacing={0.5} sx={{ px: 0.25, pr: 1.25, mt: 0.25 }}>
              {hasMetaRow ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" color="text.secondary">👤 {peopleText}</Typography>
                  {locationText ? <Typography variant="body2" color="text.secondary">📍 {locationText}</Typography> : null}
                  {notesText ? (
                    <Tooltip title="Notes available">
                      <Typography variant="body2" color="text.secondary" aria-label="Notes available">📝</Typography>
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : null}
              {notesText ? (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: isTextExpanded ? 'unset' : 2,
                      overflow: 'hidden'
                    }}
                  >
                    {notesText}
                  </Typography>
                  {hasLongText ? (
                    <Button size="small" variant="text" sx={{ mt: 0.25, minWidth: 0, px: 0 }} onClick={() => toggleExpandedText(appointment.id)}>
                      {isTextExpanded ? 'Show less' : 'Show more'}
                    </Button>
                  ) : null}
                </Box>
              ) : null}
            </Stack>
          </ListItem>
        );
      })}
    </List>
  );
}
