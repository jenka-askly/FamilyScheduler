import { ReactNode } from 'react';
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
  deleteIcon
}: AppointmentCardListProps) {
  return (
    <div className="ui-cardList">
      {appointments.map((appointment) => {
        const apptStatus = getStatus(appointment);
        const whenText = appointment.time?.intent?.status !== 'resolved'
          ? 'Unresolved'
          : formatWhen(appointment);
        const location = appointment.locationDisplay || appointment.location || '—';
        const notes = appointment.notes || '—';
        const truncatedNotes = notes.length > 140 ? `${notes.slice(0, 140)}…` : notes;
        const mapQuery = appointment.locationMapQuery || appointment.locationAddress || appointment.locationDisplay || appointment.locationRaw;

        return (
          <article key={appointment.code} className="ui-card">
            <div className="ui-cardHeader">
              <code>{appointment.code}</code>
              <div className="action-icons">
                {appointment.scanImageKey ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="View appointment scan"
                    data-tooltip="View scan"
                    onClick={() => onOpenScanViewer(appointment)}
                  >
                    {scanViewIcon}
                  </button>
                ) : null}
                <button type="button" className="icon-button" aria-label="Edit appointment" data-tooltip="Edit appointment" onClick={() => onEdit(appointment)}>{editIcon}</button>
                <button type="button" className="icon-button" aria-label="Delete appointment" data-tooltip="Delete appointment" onClick={() => onDelete(appointment)}>{deleteIcon}</button>
              </div>
            </div>

            <div className="ui-cardRow">
              <span className="ui-cardLabel">When</span>
              <button type="button" className="linkish ui-cardValueButton" onClick={() => onEdit(appointment)}>
                {appointment.time?.intent?.status !== 'resolved' ? <span className="status-tag unknown">{whenText}</span> : whenText}
              </button>
            </div>

            <div className="ui-cardRow">
              <span className="ui-cardLabel">Status</span>
              {apptStatus === 'unreconcilable' ? (
                <button type="button" className="linkish ui-cardValueButton" onClick={() => onEdit(appointment)}>
                  <span className="status-tag unknown">Unreconcilable</span>
                </button>
              ) : (
                <span className={`status-tag ${apptStatus === 'conflict' ? 'unavailable' : 'available'}`}>
                  {apptStatus === 'conflict' ? 'Conflict' : 'No Conflict'}
                </span>
              )}
            </div>

            <div className="ui-cardRow"><span className="ui-cardLabel">Description</span><span className="ui-cardValue">{appointment.desc || (appointment.scanStatus === 'pending' ? 'Scanning…' : appointment.scanStatus === 'parsed' ? 'Scanned appointment' : '—')}</span></div>
            <div className="ui-cardRow"><span className="ui-cardLabel">People</span><button type="button" className="linkish ui-cardValueButton" onClick={() => onSelectPeople(appointment)}>{appointment.peopleDisplay.length ? appointment.peopleDisplay.join(', ') : 'Unassigned'}</button></div>
            <div className="ui-cardRow">
              <span className="ui-cardLabel">Location</span>
              <span className="ui-cardValue">{location}{mapQuery ? <><br /><a className="location-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer">Map</a></> : null}</span>
            </div>
            <div className="ui-cardRow"><span className="ui-cardLabel">Notes</span><span className="ui-cardValue" title={notes}>{truncatedNotes}</span></div>
          </article>
        );
      })}
    </div>
  );
}
