import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';

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
      setCopied(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Page variant="form">
      <PageHeader
        title="Create a Family Schedule"
        description="Create a private shared schedule for coordinating appointments. You’ll get a link to share. Only phone numbers you add can access this group."
      />

      <form onSubmit={submit}>
        <div className="join-form-wrap">
          <label>
            <span className="field-label">Group name</span>
            <input className="field-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} required maxLength={60} placeholder="Mom Knee Surgery" />
          </label>
          <label>
            <span className="field-label">Group key (6 digits)</span>
            <input className="field-input" value={groupKey} onChange={(e) => setGroupKey(e.target.value)} inputMode="numeric" maxLength={6} pattern="\d{6}" required />
          </label>
          <label>
            <span className="field-label">Your name</span>
            <input className="field-input" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} required maxLength={40} placeholder="Joe" />
          </label>
          <label>
            <span className="field-label">Your phone</span>
            <input className="field-input" value={creatorPhone} onChange={(e) => setCreatorPhone(e.target.value)} required placeholder="(425) 555-1234" />
            <span className="field-help">Use a number you will use to sign into this group.</span>
          </label>
          <div className="join-actions">
            <button className="fs-btn fs-btn-primary" type="submit" disabled={isCreating}>{isCreating ? 'Creating…' : 'Create Group'}</button>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}

        {createdGroupId ? (
          <section className="share-link">
            <h2 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Your schedule is ready</h2>
            <div style={{ marginBottom: 16 }}>
              <div className="fs-groupName">{createdGroupName}</div>
              <div className="fs-meta">Group ID: {createdGroupId}</div>
            </div>

            <label>
              <span className="field-label">Share link</span>
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: 640 }}>
              <input type="text" value={shareUrl} readOnly className="field-input" />
              <button className="fs-btn fs-btn-secondary" type="button" onClick={() => void copyShareLink()}>Copy</button>
            </div>
            {copied ? <p className="fs-meta">Copied to clipboard.</p> : null}

            <p className="fs-desc" style={{ marginTop: 12 }}>
              Share this link with family members. They must enter a phone number that you add to the group.
            </p>

            <div className="fs-alert" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Next steps</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#64748b' }}>
                <li>Add people who can access this schedule</li>
                <li>Share the link</li>
                <li>Add appointments</li>
              </ul>
            </div>
            <div className="join-actions">
              <button className="fs-btn fs-btn-primary" type="button" onClick={() => nav(`/g/${createdGroupId}/app`)}>Continue to app</button>
            </div>
          </section>
        ) : null}
      </form>
      <FooterHelp />
    </Page>
  );
}

function JoinGroupPage({ groupId, routeError, traceId }: { groupId: string; routeError?: string; traceId?: string }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(
    routeError === 'not_allowed'
      ? 'This phone number is not authorized for this group.'
      : routeError === 'group_not_found'
        ? 'This group could not be found.'
        : routeError === 'join_failed'
          ? 'Unable to verify access. Please try again.'
          : routeError === 'group_mismatch' || routeError === 'no_session'
            ? 'Please enter your phone number to continue.'
            : null
  );
  const [groupName, setGroupName] = useState<string | undefined>(undefined);

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
    setError(null);
    if (!phone.trim()) {
      setError('Enter a valid phone number.');
      return;
    }
    const requestTraceId = createTraceId();
    const response = await fetch(apiUrl('/api/group/join'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, traceId: requestTraceId }) });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setError(data?.error === 'group_not_found' ? 'This group could not be found.' : 'This phone number is not authorized for this group.');
      return;
    }

    writeSession({ groupId, phone, joinedAt: new Date().toISOString() });
    nav(`/g/${groupId}/app`);
  };

  return (
    <Page variant="form">
      <PageHeader
        title={groupName ? `Join “${groupName}”` : 'Join Group'}
        description="Enter your phone number to access this schedule. Your number must already be added to this group."
        groupName={groupName}
        groupId={groupId}
      />

      <form onSubmit={submit}>
        <div className="join-form-wrap">
          <label>
            <span className="field-label">Phone number</span>
            <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(425) 555-1234" />
          </label>
          <div className="join-actions">
            <button className="fs-btn fs-btn-primary" type="submit">Join Group</button>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
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

  const startSession = async () => {
    setError(null);
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
      void startSession();
      return;
    }
    let canceled = false;
    let prevCount = joinedCount;
    const poll = async () => {
      const response = await fetch(apiUrl(`/api/ignite/meta?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&sessionId=${encodeURIComponent(sessionId)}&traceId=${encodeURIComponent(createTraceId())}`));
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
    if (!file || !sessionId) return;
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

  const joinUrl = sessionId ? `${window.location.origin}${window.location.pathname}#/s/${groupId}/${sessionId}` : '';
  const qrImageUrl = joinUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}` : '';

  return (
    <Page variant="form">
      <PageHeader title="Ignition Session" description="QR join for quick onboarding with live count and photos." groupId={groupId} />
      {error ? <p className="form-error">{error}</p> : null}
      <div className="join-form-wrap">
        {sessionId ? <img src={qrImageUrl} alt="Ignite join QR code" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid #e2e8f0' }} /> : <p>Starting session…</p>}
        {joinUrl ? <p className="fs-meta">{joinUrl}</p> : null}
        <p><strong>Status:</strong> {status} · <strong>Joined:</strong> {joinedCount}</p>
        <div className="join-actions">
          <button className="fs-btn fs-btn-secondary" type="button" onClick={() => { nav(`/g/${groupId}/app`); }}>Back to group</button>
          <button className="fs-btn fs-btn-secondary" type="button" onClick={() => { void closeSession(); }} disabled={!sessionId || status !== 'OPEN'}>Close</button>
          <button className="fs-btn fs-btn-primary" type="button" onClick={() => { void startSession(); }}>Reopen</button>
        </div>
        <label>
          <span className="field-label">Add/Update your photo</span>
          <input className="field-input" type="file" accept="image/*" onChange={(e) => { void uploadPhoto(e.currentTarget); }} disabled={!sessionId || isUploading} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {sessionId ? joinedPersonIds.map((personId) => (
            <img key={personId} src={apiUrl(`/api/ignite/photo?groupId=${encodeURIComponent(groupId)}&phone=${encodeURIComponent(phone)}&sessionId=${encodeURIComponent(sessionId)}&personId=${encodeURIComponent(personId)}&t=${encodeURIComponent(photoUpdatedAtByPersonId[personId] ?? '')}`)} alt={personId} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8, background: '#f1f5f9' }} />
          )) : null}
        </div>
      </div>
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
      <form onSubmit={submit}>
        <div className="join-form-wrap">
          <label><span className="field-label">Name</span><input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label><span className="field-label">Phone</span><input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
          <label>
            <span className="field-label">Add a photo (optional)</span>
            <input className="field-input" type="file" accept="image/*" capture="environment" onChange={(e) => { void onImagePicked(e.currentTarget); }} />
          </label>
          <div className="join-actions"><button className="fs-btn fs-btn-primary" type="submit">Join Session</button></div>
          {joined ? (
            <div className="join-actions" style={{ marginTop: 12 }}>
              <p>Joined. Opening group…</p>
              <button className="fs-btn fs-btn-secondary" type="button" onClick={() => { nav(`/g/${groupId}/app`); }}>Open group</button>
            </div>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
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

  if (authStatus !== 'allowed' || !phone) return <main className="app-shell"><p>{authStatus === 'checking' ? 'Checking access...' : `Redirecting to join (${authError ?? 'denied'})...`}</p></main>;
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
