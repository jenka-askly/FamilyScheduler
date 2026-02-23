import { ReactNode, useState } from 'react';
import { Box, Chip, Collapse, IconButton, List, ListItem, Stack, Tooltip, Typography } from '@mui/material';
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

type MetadataToken = { kind: 'people' | 'location' | 'notes'; label: string; tooltip?: string };

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <List disablePadding>
      {appointments.map((appointment) => {
        const apptStatus = getStatus(appointment);
        const whenText = appointment.time?.intent?.status !== 'resolved' ? 'Unresolved' : formatWhen(appointment);
        const statusLabel = apptStatus === 'unreconcilable' ? 'Unreconcilable' : apptStatus === 'conflict' ? 'Conflict' : 'No conflict';
        const isProblemStatus = statusLabel && statusLabel.toLowerCase() !== 'no conflict';
        const statusColor = apptStatus === 'unreconcilable' ? 'warning' : 'error';
        const peopleText = appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned';
        const titleText = appointment.desc || appointment.code;
        const metadataTokens: MetadataToken[] = [];
        if (appointment.peopleDisplay.length) metadataTokens.push({ kind: 'people', label: `👤 ${appointment.peopleDisplay.join(', ')}` });
        if (appointment.locationDisplay || appointment.location) metadataTokens.push({ kind: 'location', label: `📍 ${appointment.locationDisplay || appointment.location}` });
        if (appointment.notes) metadataTokens.push({ kind: 'notes', label: '📝 Notes', tooltip: appointment.notes });
        const metadataPreview = metadataTokens.slice(0, 2);

        return (
          <ListItem key={appointment.id} disableGutters sx={{ display: 'block', borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Box
              onClick={() => setExpandedId((previous) => previous === appointment.id ? null : appointment.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                py: 1,
                px: 0.25,
                cursor: 'pointer'
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={titleText}>{titleText}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                  {isProblemStatus ? <Chip size="small" label={statusLabel} color={statusColor} variant="outlined" /> : null}
                  {metadataPreview.length > 0 ? (
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      {metadataPreview.map((token, index) => (
                        token.kind === 'notes' ? (
                          <Tooltip key={`${appointment.id}-${token.kind}-${index}`} title={token.tooltip ?? 'Notes'}>
                            <Typography variant="caption" color="text.secondary" noWrap>{token.label}</Typography>
                          </Tooltip>
                        ) : (
                          <Typography key={`${appointment.id}-${token.kind}-${index}`} variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
                            {token.label}
                          </Typography>
                        )
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap>{whenText}</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {appointment.scanImageKey ? (
                    <Tooltip title="View scanned document">
                      <IconButton
                        size="small"
                        color="inherit"
                        aria-label="View scanned document"
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenScanViewer(appointment);
                        }}
                      >
                        {scanViewIcon}
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Tooltip title="Edit appointment">
                    <IconButton size="small" color="inherit" aria-label="Edit appointment" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={(event) => { event.stopPropagation(); onEdit(appointment); }}>
                      {editIcon}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Assign people">
                    <IconButton size="small" color="inherit" aria-label="Assign people" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={(event) => { event.stopPropagation(); onSelectPeople(appointment); }}>
                      {assignIcon}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete appointment">
                    <IconButton size="small" color="inherit" aria-label="Delete appointment" sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }} onClick={(event) => { event.stopPropagation(); onDelete(appointment); }}>
                      {deleteIcon}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
            <Collapse in={expandedId === appointment.id} timeout="auto" unmountOnExit>
              <Stack spacing={0.75} sx={{ py: 0.75, px: 0.25, pr: 1.25 }}>
                <Typography variant="body2" color="text.secondary">📅 {whenText}</Typography>
                <Typography variant="body2" color="text.secondary">👤 {peopleText}</Typography>
                {appointment.locationDisplay || appointment.location ? (
                  <Typography variant="body2" color="text.secondary">📍 {appointment.locationDisplay || appointment.location}</Typography>
                ) : null}
                {appointment.notes ? (
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    📝 {appointment.notes}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.disabled">Code: {appointment.code}</Typography>
              </Stack>
            </Collapse>
          </ListItem>
        );
      })}
    </List>
  );
}
