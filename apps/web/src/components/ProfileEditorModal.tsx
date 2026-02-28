import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { captureVideoFrameAsJpeg, requestEnvironmentCameraStream } from '../lib/cameraCapture';
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(() => Date.now());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

  const stopCaptureStream = () => {
    if (!captureStreamRef.current) return;
    captureStreamRef.current.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;
  };

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
        if (profile.photoUpdatedAt) {
          setPhotoVersion(new Date(profile.photoUpdatedAt).getTime());
        }
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
      stopCaptureStream();
      setCaptureOpen(false);
      setCapturedBlob(null);
      setCameraError(null);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!captureOpen) return;
    const video = captureVideoRef.current;
    const stream = captureStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [captureOpen]);

  const trimmed = displayName.trim().replace(/\s+/g, ' ');
  const isValid = trimmed.length > 0 && trimmed.length <= 40;
  const isDirty = trimmed !== savedDisplayName.trim();
  const initials = useMemo(() => (trimmed || savedDisplayName || '?').slice(0, 1).toUpperCase(), [trimmed, savedDisplayName]);
  const capturedPreviewUrl = useMemo(() => (capturedBlob ? URL.createObjectURL(capturedBlob) : null), [capturedBlob]);

  useEffect(() => () => {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
  }, [capturedPreviewUrl]);

  const uploadPhotoBlob = async (blob: Blob): Promise<boolean> => {
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(blob.type.toLowerCase())) {
      setError('Only JPEG/PNG files are allowed.');
      return false;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadUserProfilePhoto(blob, 'profile.jpg');
      setPhotoVersion(Date.now());
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photo');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadPhotoBlob(file);
  };

  const openCameraCapture = async () => {
    if (uploading) return;
    setCameraError(null);
    setCapturedBlob(null);
    try {
      const stream = await requestEnvironmentCameraStream();
      captureStreamRef.current = stream;
      setCaptureOpen(true);
    } catch {
      setCameraError('Camera is unavailable. You can still use Choose file.');
    }
  };

  const capturePhoto = async () => {
    const video = captureVideoRef.current;
    if (!video) return;
    try {
      const blob = await captureVideoFrameAsJpeg(video);
      stopCaptureStream();
      setCapturedBlob(blob);
    } catch {
      setCameraError('Unable to capture photo. Try again or use Choose file.');
    }
  };

  const cancelCaptureDialog = () => {
    stopCaptureStream();
    setCaptureOpen(false);
    setCapturedBlob(null);
  };

  const retakeCapture = async () => {
    setCapturedBlob(null);
    setCameraError(null);
    if (!captureStreamRef.current) {
      try {
        captureStreamRef.current = await requestEnvironmentCameraStream();
      } catch {
        setCameraError('Camera is unavailable. You can still use Choose file.');
      }
    }
  };

  const confirmCapturedPhoto = async () => {
    if (!capturedBlob) return;
    const uploaded = await uploadPhotoBlob(capturedBlob);
    if (uploaded) cancelCaptureDialog();
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
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => { void openCameraCapture(); }} disabled={uploading}>Take photo</Button>
                <Button variant="outlined" component="label" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Choose file'}
                  <input ref={fileInputRef} hidden type="file" accept="image/jpeg,image/jpg,image/png" onChange={onUpload} />
                </Button>
              </Stack>
            </Stack>
            {cameraError ? <Alert severity="info">{cameraError}</Alert> : null}
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
          {isBlocking ? <Button color="inherit" onClick={onSignOut}>Sign out</Button> : null}
          <Button variant="contained" onClick={() => { void save(); }} disabled={!isValid || !isDirty || saving || loading}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={captureOpen} onClose={cancelCaptureDialog} fullWidth maxWidth="sm">
        <DialogTitle>Take photo</DialogTitle>
        <DialogContent>
          {capturedBlob ? (
            <Box component="img" src={capturedPreviewUrl ?? ''} alt="Captured profile" sx={{ width: '100%', borderRadius: 1, maxHeight: 360, objectFit: 'cover' }} />
          ) : (
            <Box component="video" ref={captureVideoRef} autoPlay playsInline muted sx={{ width: '100%', minHeight: 280, borderRadius: 1, objectFit: 'cover', backgroundColor: 'black' }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelCaptureDialog}>Cancel</Button>
          {capturedBlob ? (
            <>
              <Button variant="outlined" onClick={() => { void retakeCapture(); }}>Retake</Button>
              <Button variant="contained" onClick={() => { void confirmCapturedPhoto(); }} disabled={uploading}>{uploading ? 'Uploading…' : 'Use photo'}</Button>
            </>
          ) : (
            <Button variant="contained" onClick={() => { void capturePhoto(); }}>Capture</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
