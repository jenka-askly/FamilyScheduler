import { ReactNode, useRef, useState } from 'react';
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
  onOpenDetails?: (appointment: Appointment) => void;
  activeAppointmentCode: string | null;
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
  onOpenDetails,
  activeAppointmentCode,
  scanViewIcon,
  editIcon,
  assignIcon,
  deleteIcon
}: AppointmentCardListProps) {
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

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
        const isActive = appointment.code === activeAppointmentCode;
        const isUnassigned = appointment.peopleDisplay.length === 0;

        const clearLongPressTimer = () => {
          if (longPressTimerRef.current != null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        };

        return (
          <ListItem
            key={appointment.id}
            disableGutters
            data-appt-code={appointment.code}
            className={isActive ? 'ui-appt-active' : ''}
            role="button"
            tabIndex={0}
            sx={{ display: 'block', borderBottom: (theme) => `1px solid ${theme.palette.divider}`, py: 0.75 }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails?.(appointment);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onOpenDetails?.(appointment);
            }}
            onPointerDown={(event) => {
              if (event.pointerType !== 'touch') return;
              clearLongPressTimer();
              didLongPressRef.current = false;
              longPressTimerRef.current = window.setTimeout(() => {
                didLongPressRef.current = true;
                onOpenDetails?.(appointment);
              }, 500);
            }}
            onPointerUp={() => {
              clearLongPressTimer();
            }}
            onPointerCancel={() => {
              clearLongPressTimer();
            }}
            onPointerLeave={() => {
              clearLongPressTimer();
            }}
            onClickCapture={(event) => {
              if (!didLongPressRef.current) return;
              didLongPressRef.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
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
                <div className="ui-appt-body">
                  <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 500 }}>{whenText}</Typography>
                </div>
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
            <Stack spacing={0.5} className="ui-appt-body" sx={{ px: 0.25, pr: 1.25, mt: 0.25 }}>
              {hasMetaRow ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {isUnassigned ? (
                    <Button
                      variant="text"
                      size="small"
                      color="inherit"
                      sx={{ minWidth: 0, px: 0, justifyContent: 'flex-start', textTransform: 'none' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectPeople(appointment);
                      }}
                    >
                      👤 {peopleText}
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">👤 {peopleText}</Typography>
                  )}
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
                    <Button size="small" variant="text" sx={{ mt: 0.25, minWidth: 0, px: 0 }} onClick={(event) => { event.stopPropagation(); toggleExpandedText(appointment.id); }}>
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
