import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';

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

const parseHashRoute = (hash: string): { type: 'create' } | { type: 'join' | 'app'; groupId: string; error?: string; traceId?: string } => {
  const cleaned = (hash || '#/').replace(/^#/, '');
  const [rawPath, queryString = ''] = cleaned.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query = new URLSearchParams(queryString);
  const appMatch = path.match(/^\/g\/([^/]+)\/app$/);
  if (appMatch) return { type: 'app', groupId: appMatch[1] };
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
      const response = await fetch('/api/group/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupName, groupKey, creatorPhone, creatorName }) });
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
            <button className="fs-btnPrimary" type="submit" disabled={isCreating}>{isCreating ? 'Creating…' : 'Create Group'}</button>
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
              <button className="fs-btnSecondary" type="button" onClick={() => void copyShareLink()}>Copy</button>
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
              <button className="fs-btnPrimary" type="button" onClick={() => nav(`/g/${createdGroupId}/app`)}>Continue to app</button>
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
        const response = await fetch(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`);
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
    const response = await fetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone, traceId: requestTraceId }) });
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
            <button className="fs-btnPrimary" type="submit">Join Group</button>
          </div>
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
    void fetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone: session.phone, traceId }) })
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
  return (
    <GroupAuthGate groupId={route.groupId}>
      {(phone) => <AppShell groupId={route.groupId} phone={phone} />}
    </GroupAuthGate>
  );
}
