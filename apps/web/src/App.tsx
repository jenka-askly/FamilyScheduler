import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';

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

const beep = (): void => {
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.12);
  window.setTimeout(() => { void ctx.close(); }, 180);
};

function IgniteOrganizerPage({ groupId, phone }: { groupId: string; phone: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'OPEN' | 'CLOSING' | 'CLOSED'>('OPEN');
  const [joinedCount, setJoinedCount] = useState(0);
  const [joinedPersonIds, setJoinedPersonIds] = useState<string[]>([]);
  const [photoUpdatedAtByPersonId, setPhotoUpdatedAtByPersonId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoSelected, setPhotoSelected] = useState(false);
  const [showJoinUrl, setShowJoinUrl] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'group' | 'join' | null>(null);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setJoinedPersonIds([]);
    setPhotoUpdatedAtByPersonId({});
  };

  useEffect(() => {
    if (!sessionId) {
      if (!phone.trim()) return;
      void startSession();
      return;
    }
    let canceled = false;
    let prevCount = joinedCount;
    const poll = async () => {
      const response = await fetch(apiUrl('/api/ignite/meta'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId, sessionId, phone, traceId: createTraceId() })
      });
      const data = await response.json() as IgniteMetaResponse;
      if (!response.ok || !data.ok || canceled) return;
      const nextCount = data.joinedCount ?? 0;
      if (nextCount > prevCount) beep();
      prevCount = nextCount;
      setStatus(data.status ?? 'OPEN');
      setJoinedCount(nextCount);
      setJoinedPersonIds(data.joinedPersonIds ?? []);
      setPhotoUpdatedAtByPersonId(data.photoUpdatedAtByPersonId ?? {});
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    return () => { canceled = true; window.clearInterval(interval); };
  }, [groupId, phone, sessionId]);

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

  const uploadPhoto = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file || !sessionId) {
      setPhotoSelected(false);
      return;
    }
    setPhotoSelected(true);
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
      const response = await fetch(apiUrl('/api/ignite/photo'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, sessionId, imageBase64: base64, imageMime: 'image/jpeg', traceId: createTraceId() }) });
      const data = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) setError(data.message ?? 'Unable to upload photo');
    } catch {
      setError('Unable to upload photo');
    } finally {
      setIsUploading(false);
      input.value = '';
    }
  };

  const base = `${window.location.origin}${window.location.pathname}${window.location.search}#`;
  const groupUrl = `${base}/g/${groupId}/app`;
  const joinUrl = sessionId ? `${base}/s/${groupId}/${sessionId}` : '';
  const qrImageUrl = joinUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}` : '';

  useEffect(() => {
    setQrLoadFailed(false);
    authLog({ component: 'IgniteOrganizerPage', stage: 'join_url', hasJoinUrl: Boolean(joinUrl), joinUrl, sessionId, groupId });
  }, [groupId, joinUrl, sessionId]);

  const copyLink = async (kind: 'group' | 'join', value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLink(kind);
      window.setTimeout(() => setCopiedLink((current) => (current === kind ? null : current)), 1800);
    } catch {
      setCopiedLink(null);
    }
  };

  return (
    <Page variant="form">
      <PageHeader
        title="Ignition Session"
        description="QR join for quick onboarding with live count and photos."
        groupId={groupId}
        groupAccessNote={status === 'OPEN' ? "Anyone with this QR can join while it's open." : 'Closed. Reopen to allow new joins.'}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack spacing={2}>
        <div className="ignite-top-row">
          <button
            
            type="button"
            title="Back to group"
            aria-label="Back to group"
            onClick={() => { nav(`/g/${groupId}/app`, { replace: true }); }}
          >
            ←
          </button>
        </div>
        <label>
          <Typography variant="subtitle2">Group home</Typography>
          <p className="ui-meta">Use this link to coordinate later.</p>
          <div className="ignite-link-row">
            <span className="ignite-link-text" title={groupUrl}>{groupUrl}</span>
            <Button variant="outlined" type="button" title="Copy" aria-label="Copy group home link" onClick={() => { void copyLink('group', groupUrl); }}>Copy</Button>
          </div>
          {copiedLink === 'group' ? <p className="ui-meta">✓ Copied</p> : null}
        </label>
        <div>
          <div className="ignite-link-row" style={{ justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">Join QR</Typography>
            <Button variant="outlined" type="button" title="Copy" aria-label="Copy join link" onClick={() => { void copyLink('join', joinUrl); }} disabled={!joinUrl}>Copy</Button>
          </div>
          {copiedLink === 'join' ? <p className="ui-meta">✓ Copied</p> : null}
          {joinUrl ? (
            qrLoadFailed ? (
              <p className="ui-meta">QR unavailable right now. Copy the join link and share it directly.</p>
            ) : (
              <img src={qrImageUrl} alt="Ignite join QR code" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid #e2e8f0' }} onError={() => setQrLoadFailed(true)} />
            )
          ) : null}
          {joinUrl ? (
            <Button variant="text" type="button" onClick={() => setShowJoinUrl((current) => !current)}>
              {showJoinUrl ? 'Hide join URL' : 'Trouble scanning?'}
            </Button>
          ) : null}
          {showJoinUrl && joinUrl ? <p className="ignite-link-text" title={joinUrl}>{joinUrl}</p> : null}
        </div>
        <p><strong>Status:</strong> {status} · <strong>Joined:</strong> {joinedCount}</p>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" type="button" onClick={() => { void closeSession(); }} disabled={!sessionId || status !== 'OPEN'}>Close</Button>
          <Button variant="contained" type="button" onClick={() => { void startSession(); }}>Reopen</Button>
        </Stack>
        <label>
          <Typography variant="subtitle2">Photo</Typography>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { void uploadPhoto(e.currentTarget); }} disabled={!sessionId || isUploading} />
          <Button variant="outlined" type="button" title="Photo" aria-label="Add or update your photo" onClick={() => fileInputRef.current?.click()} disabled={!sessionId || isUploading}>Add photo</Button>
          {photoSelected ? <p className="ui-meta">Photo selected.</p> : null}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {sessionId ? joinedPersonIds.map((personId) => (
            <img key={personId} src={apiUrl(`/api/ignite/photo?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&sessionId=${encodeURIComponent(sessionId)}&personId=${encodeURIComponent(personId)}&t=${encodeURIComponent(photoUpdatedAtByPersonId[personId] ?? '')}`)} alt={personId} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8, background: '#f1f5f9' }} />
          )) : null}
        </div>
      </Stack>
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
