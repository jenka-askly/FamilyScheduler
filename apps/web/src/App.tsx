import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';

type Session = { groupId: string; phone: string; joinedAt: string };
type AuthStatus = 'checking' | 'allowed' | 'denied';
type AuthError = 'no_session' | 'group_mismatch' | 'not_allowed' | 'group_not_found' | 'join_failed';

const SESSION_KEY = 'familyscheduler.session';

const readSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

const writeSession = (session: Session): void => {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = (): void => {
  window.localStorage.removeItem(SESSION_KEY);
};

const debugAuthLogsEnabled = import.meta.env.VITE_DEBUG_AUTH_LOGS === 'true';
const authLog = (payload: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  console.log(payload);
};
const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const parseHashRoute = (hash: string): { type: 'create' } | { type: 'join' | 'app'; groupId: string; error?: string; traceId?: string } | { type: 'ignite'; groupId: string } | { type: 'igniteJoin'; groupId: string; sessionId: string } => {
  const cleaned = (hash || '#/').replace(/^#/, '');
  const [rawPath, queryString = ''] = cleaned.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query = new URLSearchParams(queryString);
  const appMatch = path.match(/^\/g\/([^/]+)\/app$/);
  if (appMatch) return { type: 'app', groupId: appMatch[1] };
  const igniteMatch = path.match(/^\/g\/([^/]+)\/ignite$/);
  if (igniteMatch) return { type: 'ignite', groupId: igniteMatch[1] };
  const sessionMatch = path.match(/^\/s\/([^/]+)\/([^/]+)$/);
  if (sessionMatch) return { type: 'igniteJoin', groupId: sessionMatch[1], sessionId: sessionMatch[2] };
  const joinMatch = path.match(/^\/g\/([^/]+)$/);
  if (joinMatch) return { type: 'join', groupId: joinMatch[1], error: query.get('err') ?? undefined, traceId: query.get('trace') ?? undefined };
  return { type: 'create' };
};

const nav = (path: string, options?: { replace?: boolean }) => {
  if (options?.replace) {
    const next = `${window.location.pathname}${window.location.search}#${path.startsWith('/') ? path : `/${path}`}`;
    window.location.replace(next);
    return;
  }
  window.location.hash = path;
};

const toJoinRoute = (groupId: string, error: AuthError, traceId: string): string => `/g/${groupId}?err=${error}&trace=${traceId}`;

function CreateGroupPage() {
  const [groupName, setGroupName] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [creatorPhone, setCreatorPhone] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (shareLink) return shareLink;
    if (!createdGroupId) return '';
    return `${window.location.origin}/#/g/${createdGroupId}`;
  }, [createdGroupId, shareLink]);

  const createdGroupName = groupName.trim() || 'Family Schedule';

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch(apiUrl('/api/group/create'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupName, groupKey, creatorPhone, creatorName }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? 'Failed to create group');
        return;
      }

      const link = `${window.location.origin}/#/g/${data.groupId}`;
      writeSession({ groupId: data.groupId, phone: creatorPhone, joinedAt: new Date().toISOString() });
      setCreatedGroupId(data.groupId);
      setShareLink(link);
      setShowCreateForm(false);
      setCopied(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Page variant="form">
      <PageHeader
        title="Create a Family Schedule"
        description="Create a private shared schedule. Only people you add can access it."
      />

      <div className="ui-authContainer">
        <Stack className="ui-authForm" component="form" spacing={2} onSubmit={submit}>
          {showCreateForm ? (
            <>
              <TextField label="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required inputProps={{ maxLength: 60 }} placeholder="Mom Knee Surgery" fullWidth />
              <TextField label="Group key" value={groupKey} onChange={(e) => setGroupKey(e.target.value)} required inputProps={{ inputMode: 'numeric', maxLength: 6, pattern: '\\d{6}' }} placeholder="Group key" helperText="6 digits" fullWidth />
              <TextField label="Your name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} required inputProps={{ maxLength: 40 }} placeholder="Joe" fullWidth />
              <TextField label="Your phone" value={creatorPhone} onChange={(e) => setCreatorPhone(e.target.value)} required placeholder="(425) 555-1234" helperText="Use a phone number you can sign in with." fullWidth />
              <div className="ui-authActions">
                <Button variant="contained" type="submit" disabled={isCreating}>{isCreating ? 'CREATING…' : 'CREATE GROUP'}</Button>
              </div>
            </>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          {createdGroupId ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <div className="ui-successHeader">
                <Box>
                  <Typography variant="h6">Schedule created</Typography>
                  <Typography fontWeight={600}>{createdGroupName}</Typography>
                  <Typography variant="body2" color="text.secondary">Group ID: {createdGroupId}</Typography>
                  {!showCreateForm ? (
                    <Button variant="text" size="small" type="button" onClick={() => setShowCreateForm(true)}>Edit details</Button>
                  ) : null}
                </Box>
                <Button variant="contained" type="button" onClick={() => nav(`/g/${createdGroupId}/app`)}>Continue to app</Button>
              </div>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField label="Share link" value={shareUrl} InputProps={{ readOnly: true }} fullWidth />
                <Button variant="outlined" type="button" onClick={() => void copyShareLink()}>Copy</Button>
              </Stack>
              {copied ? <Alert severity="success">Copied to clipboard.</Alert> : null}
              <Typography className="ui-successHelp">Share this link. Only people you add can join.</Typography>
            </Stack>
          ) : null}
        </Stack>
      </div>
      <FooterHelp />
    </Page>
  );
}

function JoinGroupPage({ groupId, routeError, traceId }: { groupId: string; routeError?: string; traceId?: string }) {
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [groupName, setGroupName] = useState<string | undefined>(undefined);
  const routeNotice = routeError === 'group_mismatch' || routeError === 'no_session'
    ? 'Enter your phone number to join this group.'
    : null;

  useEffect(() => {
    authLog({ stage: 'join_page_loaded', groupId, err: routeError ?? null, traceId: traceId ?? null });
  }, [groupId, routeError, traceId]);

  useEffect(() => {
    let canceled = false;

    const loadGroupMeta = async () => {
      try {
        const response = await fetch(apiUrl(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`));
        if (!response.ok) return;
        const data = await response.json() as { ok?: boolean; groupName?: string };
        if (!canceled && data.ok) setGroupName(data.groupName || 'Family Schedule');
      } catch {
        if (!canceled) setGroupName(undefined);
      }
    };

    void loadGroupMeta();
    return () => {
      canceled = true;
    };
  }, [groupId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const normalized = phone.replace(/[^\d+]/g, '');
    const isValidPhone = normalized.length >= 10;
    if (!isValidPhone) {
      setFormError('Please enter a valid phone number.');
      return;
    }
    setFormError(null);
    const requestTraceId = createTraceId();
    const response = await fetch(apiUrl('/api/group/join'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, traceId: requestTraceId }) });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setFormError(data?.error === 'group_not_found' ? 'This group could not be found.' : 'This phone number is not authorized for this group.');
      return;
    }

    writeSession({ groupId, phone, joinedAt: new Date().toISOString() });
    nav(`/g/${groupId}/app`);
  };

  return (
    <Page variant="form">
      <PageHeader
        title={groupName ? `Join “${groupName}”` : 'Join Group'}
        description="Enter your phone number to access this schedule."
        groupName={groupName}
        groupId={groupId}
      />

      <div className="ui-joinContainer">
        <Stack className="ui-joinForm" component="form" spacing={2} onSubmit={submit}>
          {routeNotice ? <Typography className="ui-joinNotice">{routeNotice}</Typography> : null}
          <TextField
            label="Phone number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (hasSubmitted) setFormError(null);
            }}
            required
            error={Boolean(formError) && hasSubmitted}
            helperText={hasSubmitted ? formError || 'Only listed phone numbers can join.' : 'Only listed phone numbers can join.'}
            placeholder="(425) 555-1234"
            fullWidth
          />
          <div className="ui-joinActions">
            <Button variant="contained" type="submit">Join Group</Button>
          </div>
        </Stack>
      </div>
      <FooterHelp />
    </Page>
  );
}


type IgniteMetaResponse = { ok?: boolean; status?: 'OPEN' | 'CLOSING' | 'CLOSED'; joinedCount?: number; joinedPersonIds?: string[]; photoUpdatedAtByPersonId?: Record<string, string> };
const IGNITE_SOUND_KEY = 'igniteSoundEnabled';

function IgniteOrganizerPage({ groupId, phone }: { groupId: string; phone: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'OPEN' | 'CLOSING' | 'CLOSED'>('OPEN');
  const [groupName, setGroupName] = useState<string>('Family Schedule');
  const [joinedCount, setJoinedCount] = useState(0);
  const [joinedBump, setJoinedBump] = useState(false);
  const [joinSoundEnabled, setJoinSoundEnabled] = useState(true);
  const [joinedPersonIds, setJoinedPersonIds] = useState<string[]>([]);
  const [newlyJoinedPersonIds, setNewlyJoinedPersonIds] = useState<string[]>([]);
  const [photoUpdatedAtByPersonId, setPhotoUpdatedAtByPersonId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedJoinLink, setCopiedJoinLink] = useState(false);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [scanCaptureOpen, setScanCaptureOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanCaptureVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanCaptureStreamRef = useRef<MediaStream | null>(null);
  const prevJoinedRef = useRef(0);
  const prevJoinedPersonIdsRef = useRef<string[]>([]);
  const joinBumpTimeoutRef = useRef<number | null>(null);
  const joinedPersonBumpTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastChimeAtRef = useRef(0);

  const stopScanCaptureStream = () => {
    if (!scanCaptureStreamRef.current) return;
    scanCaptureStreamRef.current.getTracks().forEach((track) => track.stop());
    scanCaptureStreamRef.current = null;
  };

  const closeScanCaptureModal = () => {
    stopScanCaptureStream();
    setScanCaptureOpen(false);
  };

  useEffect(() => () => {
    stopScanCaptureStream();
    if (joinBumpTimeoutRef.current != null) window.clearTimeout(joinBumpTimeoutRef.current);
    if (joinedPersonBumpTimeoutRef.current != null) window.clearTimeout(joinedPersonBumpTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = window.localStorage.getItem(IGNITE_SOUND_KEY);
    if (persisted == null) {
      setJoinSoundEnabled(true);
      return;
    }
    setJoinSoundEnabled(persisted !== 'false');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(IGNITE_SOUND_KEY, joinSoundEnabled ? 'true' : 'false');
  }, [joinSoundEnabled]);

  useEffect(() => {
    const loadGroupMeta = async () => {
      try {
        const response = await fetch(apiUrl(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`));
        if (!response.ok) return;
        const data = await response.json() as { ok?: boolean; groupName?: string };
        if (data.ok && data.groupName) setGroupName(data.groupName);
      } catch {
        // Keep existing fallback title.
      }
    };
    void loadGroupMeta();
  }, [groupId]);

  const renameGroupName = async (nextName: string) => {
    setError(null);
    const traceId = createTraceId();
    const response = await fetch(apiUrl('/api/group/rename'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, phone, groupName: nextName, traceId })
    });
    const payload = await response.json() as { groupName?: string; traceId?: string; message?: string };
    if (!response.ok) throw new Error(`${payload.message ?? 'Unable to rename group.'}${payload.traceId ? ` (trace: ${payload.traceId})` : ''}`);
    setGroupName(payload.groupName || nextName);
  };

  const playJoinChime = () => {
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const now = Date.now();
      if (now - lastChimeAtRef.current < 500) return;
      const ctx = audioContextRef.current ?? new AudioCtor();
      audioContextRef.current = ctx;
      const t0 = ctx.currentTime + 0.01;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, t0);
      gain1.gain.setValueAtTime(0.0001, t0);
      gain1.gain.exponentialRampToValueAtTime(0.09, t0 + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t0);
      osc1.stop(t0 + 0.08);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const t1 = t0 + 0.1;
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, t1);
      gain2.gain.setValueAtTime(0.0001, t1);
      gain2.gain.exponentialRampToValueAtTime(0.08, t1 + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t1);
      osc2.stop(t1 + 0.08);
      lastChimeAtRef.current = now;
    } catch {
      // Best-effort only; browsers may block until user gesture.
    }
  };

  const startSession = async () => {
    setError(null);
    if (!phone.trim()) {
      setError('Missing authorized phone number. Rejoin the group and try again.');
      return;
    }
    const traceId = createTraceId();
    const response = await fetch(apiUrl('/api/ignite/start'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, traceId }) });
    const data = await response.json() as { ok?: boolean; sessionId?: string; message?: string };
    if (!response.ok || !data.ok || !data.sessionId) {
      setError(data.message ?? 'Unable to start session');
      return;
    }
    setSessionId(data.sessionId);
    setStatus('OPEN');
    setJoinedCount(0);
    prevJoinedRef.current = 0;
    prevJoinedPersonIdsRef.current = [];
    setJoinedPersonIds([]);
    setNewlyJoinedPersonIds([]);
    setPhotoUpdatedAtByPersonId({});
  };

  useEffect(() => {
    if (!sessionId) {
      if (!phone.trim()) return;
      void startSession();
      return;
    }
    let canceled = false;
    const poll = async () => {
      const response = await fetch(apiUrl('/api/ignite/meta'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId, sessionId, phone, traceId: createTraceId() })
      });
      const data = await response.json() as IgniteMetaResponse;
      if (!response.ok || !data.ok || canceled) return;
      const nextCount = data.joinedCount ?? 0;
      if (nextCount > prevJoinedRef.current) {
        setJoinedBump(true);
        if (joinBumpTimeoutRef.current != null) window.clearTimeout(joinBumpTimeoutRef.current);
        joinBumpTimeoutRef.current = window.setTimeout(() => setJoinedBump(false), 600);
        if (joinSoundEnabled && document.visibilityState === 'visible') playJoinChime();
      }
      const incomingIds = data.joinedPersonIds ?? [];
      const nextSet = new Set(incomingIds);
      const addedIds = incomingIds.filter((personId) => !prevJoinedPersonIdsRef.current.includes(personId));
      if (addedIds.length > 0) {
        setNewlyJoinedPersonIds((existing) => [...new Set([...existing.filter((personId) => nextSet.has(personId)), ...addedIds])]);
        if (joinedPersonBumpTimeoutRef.current != null) window.clearTimeout(joinedPersonBumpTimeoutRef.current);
        joinedPersonBumpTimeoutRef.current = window.setTimeout(() => setNewlyJoinedPersonIds([]), 900);
      }
      prevJoinedPersonIdsRef.current = incomingIds;
      prevJoinedRef.current = nextCount;
      setStatus(data.status ?? 'OPEN');
      setJoinedCount(nextCount);
      setJoinedPersonIds(incomingIds);
      setPhotoUpdatedAtByPersonId(data.photoUpdatedAtByPersonId ?? {});
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    return () => { canceled = true; window.clearInterval(interval); };
  }, [groupId, phone, sessionId, joinSoundEnabled]);

  const closeSession = async () => {
    if (!sessionId) return;
    const response = await fetch(apiUrl('/api/ignite/close'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, sessionId, traceId: createTraceId() }) });
    const data = await response.json() as { ok?: boolean; status?: 'OPEN' | 'CLOSING' | 'CLOSED'; message?: string };
    if (!response.ok || !data.ok) {
      setError(data.message ?? 'Unable to close session');
      return;
    }
    setStatus(data.status ?? 'CLOSING');
  };

  const uploadPhotoBase64 = async (base64: string) => {
    if (!sessionId || !base64) return;
    setError(null);
    setIsUploading(true);
    try {
      const response = await fetch(apiUrl('/api/ignite/photo'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, sessionId, imageBase64: base64, imageMime: 'image/jpeg', traceId: createTraceId() }) });
      const data = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) setError(data.message ?? 'Unable to upload photo');
    } catch {
      setError('Unable to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadPhoto = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file || !sessionId) {
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const [, base64 = ''] = dataUrl.split(',', 2);
      await uploadPhotoBase64(base64);
    } catch {
      setError('Unable to upload photo');
    } finally {
      input.value = '';
    }
  };

  const openCapture = async () => {
    if (!sessionId || isUploading) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scanCaptureStreamRef.current = stream;
      setScanCaptureOpen(true);
    } catch {
      fileInputRef.current?.click();
    }
  };

  const capturePhoto = async () => {
    const video = scanCaptureVideoRef.current;
    const canvas = scanCaptureCanvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(blob);
    });
    const [, base64 = ''] = dataUrl.split(',', 2);
    closeScanCaptureModal();
    await uploadPhotoBase64(base64);
  };

  useEffect(() => {
    if (!scanCaptureOpen) return;
    let frameId: number | null = null;
    let attempts = 0;

    const attachPreview = () => {
      const video = scanCaptureVideoRef.current;
      const stream = scanCaptureStreamRef.current;
      if (!stream) return;
      if (!video && attempts < 6) {
        attempts += 1;
        frameId = window.requestAnimationFrame(attachPreview);
        return;
      }
      if (!video) return;
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    };

    attachPreview();
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
    };
  }, [scanCaptureOpen]);

  const base = `${window.location.origin}${window.location.pathname}${window.location.search}#`;
  const joinUrl = sessionId ? `${base}/s/${groupId}/${sessionId}` : '';
  const qrImageUrl = joinUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinUrl)}` : '';

  useEffect(() => {
    setQrLoadFailed(false);
    authLog({ component: 'IgniteOrganizerPage', stage: 'join_url', hasJoinUrl: Boolean(joinUrl), joinUrl, sessionId, groupId });
  }, [groupId, joinUrl, sessionId]);

  const copyJoinLink = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedJoinLink(true);
      window.setTimeout(() => setCopiedJoinLink(false), 1800);
    } catch {
      setCopiedJoinLink(false);
    }
  };

  return (
    <Page variant="form">
      <PageHeader
        title="Ignition Session"
        description="QR join for quick onboarding with live count and photos."
        titleOverride={groupName}
        subtitleOverride={`Joined: ${joinedCount}`}
        subtitlePulse={joinedBump}
        onRenameGroupName={renameGroupName}
        groupId={groupId}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <div className="ui-igniteOrg">
        <div className="ui-igniteOrgInner">
          <div className="ui-igniteSection ui-igniteCardHeader">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { void uploadPhoto(e.currentTarget); }} disabled={!sessionId || isUploading} />
            <div className="ui-igniteHeaderLeft">
              <IconButton type="button" title="Add optional photo" aria-label="Add optional photo" onClick={() => { void openCapture(); }} disabled={!sessionId || isUploading}>
                <CameraAltIcon />
              </IconButton>
              <Typography className="ui-igniteOptionalLabel">Optional</Typography>
            </div>
            <Typography variant="h6" className="ui-igniteCardTitle">Ignition Session</Typography>
            <div className="ui-igniteHeaderRight">
              <IconButton
                size="small"
                aria-label="Join sound"
                title={`Join sound ${joinSoundEnabled ? 'on' : 'off'}`}
                onClick={() => setJoinSoundEnabled((current) => !current)}
              >
                {joinSoundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
              {status === 'OPEN' && sessionId ? (
                <Button variant="contained" type="button" onClick={() => { void closeSession(); }}>Close</Button>
              ) : (
                <Button variant="contained" type="button" onClick={() => { void startSession(); }}>Reopen</Button>
              )}
            </div>
          </div>

          {!sessionId ? (
            <div className="ui-igniteSection">
              <Typography className="ui-meta">No active session right now.</Typography>
            </div>
          ) : (
            <div className="ui-igniteSection ui-igniteQrWrap">
              <Typography variant="subtitle2">Scan to join</Typography>
              {qrLoadFailed ? (
                <Typography className="ui-meta">QR unavailable — use the join link.</Typography>
              ) : (
                <img className="ui-igniteQrImg" src={qrImageUrl} alt="Ignite join QR code" onError={() => setQrLoadFailed(true)} />
              )}
            </div>
          )}

          {sessionId ? (
            <div className="ui-igniteSection">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Join link</Typography>
              <div className="ui-igniteJoinLinkRow">
                <code className="ui-igniteJoinLinkText" title={joinUrl}>{joinUrl}</code>
                <IconButton type="button" title="Copy join link" aria-label="Copy join link" onClick={() => { void copyJoinLink(joinUrl); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </div>
              {copiedJoinLink ? <Typography className="ui-meta">✓ Copied</Typography> : null}
            </div>
          ) : null}

          <div className="ui-igniteSection">
            <div className="ui-igniteHeader">
              <Typography variant="subtitle2">Joined folks</Typography>
            </div>
            {!sessionId || joinedPersonIds.length === 0 ? <Typography className="ui-meta">No one joined yet.</Typography> : null}
            <div className="ui-igniteFolksList">
              {sessionId ? joinedPersonIds.map((personId) => {
                const hasPhoto = Boolean(photoUpdatedAtByPersonId[personId]);
                return (
                  <div key={personId} className={`ui-ignitePersonCard ${newlyJoinedPersonIds.includes(personId) ? 'ui-igniteJoinedBump' : ''}`}>
                    {hasPhoto ? <img className="ui-ignitePersonThumb" src={apiUrl(`/api/ignite/photo?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&sessionId=${encodeURIComponent(sessionId)}&personId=${encodeURIComponent(personId)}&t=${encodeURIComponent(photoUpdatedAtByPersonId[personId] ?? '')}`)} alt={personId} /> : null}
                    <Typography variant="caption" className="ui-ignitePersonName">{personId}</Typography>
                  </div>
                );
              }) : null}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={scanCaptureOpen} onClose={closeScanCaptureModal} maxWidth="sm" fullWidth>
        <DialogTitle>Capture photo</DialogTitle>
        <DialogContent>
          <Box component="video" ref={scanCaptureVideoRef} autoPlay playsInline muted sx={{ width: '100%', minHeight: 280, borderRadius: 1, objectFit: 'cover', backgroundColor: 'black' }} />
          <canvas ref={scanCaptureCanvasRef} style={{ display: 'none' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeScanCaptureModal}>Cancel</Button>
          <Button variant="contained" onClick={() => { void capturePhoto(); }}>Capture</Button>
        </DialogActions>
      </Dialog>
      <FooterHelp />
    </Page>
  );
}

function IgniteJoinPage({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMime, setImageMime] = useState<string>('');
  const [joined, setJoined] = useState(false);

  const onImagePicked = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) {
      setImageBase64('');
      setImageMime('');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(file);
    });
    const [, base64 = ''] = dataUrl.split(',', 2);
    setImageBase64(base64);
    setImageMime(file.type || 'image/jpeg');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch(apiUrl('/api/ignite/join'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, sessionId, name, phone, traceId: createTraceId() }) });
    const data = await response.json() as { ok?: boolean; error?: string; phoneE164?: string; message?: string };
    if (!response.ok || !data.ok) {
      setError(data.error === 'ignite_closed' ? 'Session closed. Ask the organizer to reopen the QR.' : (data.message ?? 'Unable to join session'));
      return;
    }
    writeSession({ groupId, phone, joinedAt: new Date().toISOString() });
    if (imageBase64) {
      try {
        await fetch(apiUrl('/api/ignite/photo'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId, sessionId, phone, imageBase64, imageMime: imageMime || 'image/jpeg', traceId: createTraceId() })
        });
      } catch {
        // Non-fatal: continue into the group even if photo upload fails.
      }
    }
    setJoined(true);
    window.setTimeout(() => { nav(`/g/${groupId}/app`); }, 500);
  };

  return (
    <Page variant="form">
      <PageHeader title="Join session" description="Enter your name and phone to join this live session." groupId={groupId} />
      <Stack component="form" spacing={2} onSubmit={submit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required fullWidth />
        <Button variant="outlined" component="label">
          Add a photo (optional)
          <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void onImagePicked(e.currentTarget); }} />
        </Button>
        <Stack direction="row" spacing={1}><Button variant="contained" type="submit">Join Session</Button></Stack>
        {joined ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>Joined. Opening group…</Typography>
            <Button variant="outlined" type="button" onClick={() => { nav(`/g/${groupId}/app`); }}>Open group</Button>
          </Stack>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
      </Stack>
      <FooterHelp />
    </Page>
  );
}

function GroupAuthGate({ groupId, children }: { groupId: string; children: (phone: string) => ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authError, setAuthError] = useState<AuthError | undefined>();
  const [traceId] = useState(() => createTraceId());
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const session = readSession();
    authLog({ stage: 'gate_enter', groupId, hasSession: !!session, hasPhone: !!session?.phone });
    if (!session || !session.phone) {
      if (canceled) return;
      setAuthStatus('denied');
      setAuthError('no_session');
      authLog({ stage: 'gate_redirect', to: `/g/${groupId}`, reason: 'no_session' });
      nav(toJoinRoute(groupId, 'no_session', traceId), { replace: true });
      return;
    }

    if (session.groupId !== groupId) {
      clearSession();
      if (canceled) return;
      setAuthStatus('denied');
      setAuthError('group_mismatch');
      authLog({ stage: 'gate_redirect', to: `/g/${groupId}`, reason: 'mismatch' });
      nav(toJoinRoute(groupId, 'group_mismatch', traceId), { replace: true });
      return;
    }

    setPhone(session.phone);
    authLog({ stage: 'gate_join_request', groupId });
    void fetch(apiUrl('/api/group/join'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone: session.phone, traceId }) })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; error?: AuthError };
        const responseError = !response.ok || !data.ok ? (data?.error === 'group_not_found' ? 'group_not_found' : data?.error === 'not_allowed' ? 'not_allowed' : 'join_failed') : undefined;
        authLog({ stage: 'gate_join_result', ok: response.ok && !!data.ok, error: responseError ?? null });
        if (!response.ok || !data.ok) {
          clearSession();
          if (canceled) return;
          const deniedError = responseError ?? 'join_failed';
          setAuthStatus('denied');
          setAuthError(deniedError);
          authLog({ stage: 'gate_redirect', to: `/g/${groupId}`, reason: 'not_allowed' });
          nav(toJoinRoute(groupId, deniedError, traceId), { replace: true });
          return;
        }
        if (canceled) return;
        setAuthStatus('allowed');
      })
      .catch(() => {
        clearSession();
        if (canceled) return;
        setAuthStatus('denied');
        setAuthError('join_failed');
        authLog({ stage: 'gate_join_result', ok: false, error: 'join_failed' });
        authLog({ stage: 'gate_redirect', to: `/g/${groupId}`, reason: 'not_allowed' });
        nav(toJoinRoute(groupId, 'join_failed', traceId), { replace: true });
      });

    return () => {
      canceled = true;
    };
  }, [groupId, traceId]);

  if (authStatus !== 'allowed' || !phone) {
    return (
      <Page variant="form">
        <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
          {authStatus === 'checking' ? <CircularProgress size={32} /> : <Alert severity="warning">Redirecting to join ({authError ?? 'denied'})...</Alert>}
          <Typography>{authStatus === 'checking' ? 'Checking access...' : 'Please wait while we route you to the join flow.'}</Typography>
        </Stack>
        <FooterHelp />
      </Page>
    );
  }
  return <>{children(phone)}</>;
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route = useMemo(() => parseHashRoute(hash), [hash]);
  if (route.type === 'create') return <CreateGroupPage />;
  if (route.type === 'join') return <JoinGroupPage groupId={route.groupId} routeError={route.error} traceId={route.traceId} />;
  if (route.type === 'igniteJoin') return <IgniteJoinPage groupId={route.groupId} sessionId={route.sessionId} />;
  if (route.type === 'ignite') {
    return (
      <GroupAuthGate groupId={route.groupId}>
        {(phone) => <IgniteOrganizerPage groupId={route.groupId} phone={phone} />}
      </GroupAuthGate>
    );
  }
  return (
    <GroupAuthGate groupId={route.groupId}>
      {(phone) => <AppShell groupId={route.groupId} phone={phone} />}
    </GroupAuthGate>
  );
}
