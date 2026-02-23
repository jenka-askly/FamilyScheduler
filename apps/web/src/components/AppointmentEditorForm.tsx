import { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

type AppointmentEditorFormProps = {
  appointmentCode: string;
  whenValue: string;
  descriptionValue: string;
  locationValue: string;
  notesValue: string;
  onWhenChange: (next: string) => void;
  onWhenKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
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
  <div className="rule-draft-output when-editor">
    <div className="when-editor-input-row">
      <label htmlFor={`when-editor-${appointmentCode}`}>When</label>
      <input
        id={`when-editor-${appointmentCode}`}
        value={whenValue}
        onChange={(event) => onWhenChange(event.target.value)}
        onKeyDown={onWhenKeyDown}
        placeholder="e.g. next Tuesday 8-9pm"
      />
      <button type="button" className="fs-btn fs-btn-secondary" onClick={onResolveDate}>Resolve date</button>
    </div>
    <div className="when-editor-input-row">
      <label htmlFor={`desc-editor-${appointmentCode}`}>Description</label>
      <input
        id={`desc-editor-${appointmentCode}`}
        value={descriptionValue}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="e.g. Follow-up visit"
      />
    </div>
    <div className="when-editor-input-row">
      <label htmlFor={`location-editor-${appointmentCode}`}>Location</label>
      <input
        id={`location-editor-${appointmentCode}`}
        value={locationValue}
        onChange={(event) => onLocationChange(event.target.value)}
        placeholder="e.g. Evergreen Health"
      />
    </div>
    <div className="when-editor-input-row">
      <label htmlFor={`notes-editor-${appointmentCode}`}>Notes</label>
      <input
        id={`notes-editor-${appointmentCode}`}
        value={notesValue}
        onChange={(event) => onNotesChange(event.target.value)}
        placeholder="Optional notes"
      />
    </div>
    <div className="when-editor-footer">
      <div className="when-editor-feedback">
        {errorText ? <p className="form-error">{errorText}</p> : null}
        {previewContent}
      </div>
      <div className="modal-actions when-editor-actions">
        <button type="button" className="fs-btn fs-btn-primary" onClick={onConfirm}>Confirm</button>
        <button type="button" className="fs-btn fs-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  </div>
);
