import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { getUserProfile, putUserProfile, uploadUserProfilePhoto } from '../lib/userProfileApi';

type Props = {
  isOpen: boolean;
  isBlocking: boolean;
  onClose: () => void;
  onSaved?: (displayName: string) => void;
  onSignOut: () => void;
};

export function ProfileEditorModal({ isOpen, isBlocking, onClose, onSaved, onSignOut }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getUserProfile()
      .then((profile) => {
        if (cancelled) return;
        setDisplayName(profile.displayName ?? '');
        setSavedDisplayName(profile.displayName ?? '');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const trimmed = displayName.trim().replace(/\s+/g, ' ');
  const isValid = trimmed.length > 0 && trimmed.length <= 40;
  const isDirty = trimmed !== savedDisplayName.trim();
  const initials = useMemo(() => (trimmed || savedDisplayName || '?').slice(0, 1).toUpperCase(), [trimmed, savedDisplayName]);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type.toLowerCase())) {
      setError('Only JPEG/PNG files are allowed.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadUserProfilePhoto(file);
      setPhotoVersion(Date.now());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await putUserProfile(trimmed);
      setSavedDisplayName(updated.displayName);
      setDisplayName(updated.displayName);
      onSaved?.(updated.displayName);
      if (!isBlocking) onClose();
      if (isBlocking) onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={(_event, reason) => {
        if (isBlocking && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
        onClose();
      }}
      disableEscapeKeyDown={isBlocking}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Edit profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {isBlocking ? <Alert severity="warning">Set a display name to continue.</Alert> : null}
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={`/api/user/profile-photo?v=${photoVersion}`} sx={{ width: 56, height: 56 }}>{initials}</Avatar>
            <Button variant="outlined" component="label" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload photo'}
              <input hidden type="file" accept="image/jpeg,image/jpg,image/png" onChange={onUpload} />
            </Button>
          </Stack>
          <TextField
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            inputProps={{ maxLength: 40 }}
            helperText={trimmed.length > 40 ? 'Display name must be 40 characters or less.' : 'Required'}
            error={trimmed.length > 40 || (!trimmed && displayName.length > 0)}
            disabled={loading || saving}
            autoFocus
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? <Typography color="text.secondary">Loading profile…</Typography> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isBlocking ? <Button onClick={onClose}>Cancel</Button> : null}
        <Button color="inherit" onClick={onSignOut}>Sign out</Button>
        <Button variant="contained" onClick={() => void save()} disabled={!isValid || !isDirty || saving || loading}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
