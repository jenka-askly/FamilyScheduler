import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';

type Session = { groupId: string; phone: string; joinedAt: string };

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

const parseHashRoute = (hash: string): { type: 'create' } | { type: 'join' | 'app'; groupId: string; error?: string } => {
  const cleaned = (hash || '#/').replace(/^#/, '');
  const [rawPath, queryString = ''] = cleaned.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query = new URLSearchParams(queryString);
  const appMatch = path.match(/^\/g\/([^/]+)\/app$/);
  if (appMatch) return { type: 'app', groupId: appMatch[1] };
  const joinMatch = path.match(/^\/g\/([^/]+)$/);
  if (joinMatch) return { type: 'join', groupId: joinMatch[1], error: query.get('err') ?? undefined };
  return { type: 'create' };
};

const nav = (path: string) => { window.location.hash = path; };

function CreateGroupPage() {
  const [groupName, setGroupName] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [creatorPhone, setCreatorPhone] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="create-page">
      <h1>Family Scheduler</h1>
      <form onSubmit={submit} className="panel create-card">
        <h2>Create Group</h2>
        <div className="create-fields">
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
        </div>
        <button type="submit" className="create-submit" disabled={isCreating}>{isCreating ? 'Creating…' : 'Create group'}</button>
        {error ? <p className="form-error">{error}</p> : null}

        {shareLink && createdGroupId ? (
          <section className="share-link">
            <p className="field-label">Share link</p>
            <div className="share-row">
              <input readOnly value={shareLink} className="field-input" />
              <button type="button" onClick={() => void navigator.clipboard.writeText(shareLink)}>Copy</button>
            </div>
            <p className="field-help">Anyone opening this link must enter a phone number already in People.</p>
            <button type="button" onClick={() => nav(`/g/${createdGroupId}/app`)}>Continue to app</button>
          </section>
        ) : null}
      </form>
    </main>
  );
}

function JoinGroupPage({ groupId, routeError }: { groupId: string; routeError?: string }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(routeError === 'not_allowed' ? 'Not authorized. Ask someone to add your phone.' : null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone }) });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setError('Not authorized. Ask someone in the group to add your phone in People.');
      return;
    }

    writeSession({ groupId, phone, joinedAt: new Date().toISOString() });
    nav(`/g/${groupId}/app`);
  };

  return <main className="app-shell"><form onSubmit={submit} className="panel"><h2>Join Group</h2><p>Group: {groupId}</p><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label><button type="submit">Join</button>{error ? <p>{error}</p> : null}</form></main>;
}

function GuardedApp({ groupId }: { groupId: string }) {
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const session = readSession();
    if (!session || !session.phone) {
      nav(`/g/${groupId}`);
      return;
    }

    if (session.groupId !== groupId) {
      clearSession();
      nav(`/g/${groupId}`);
      return;
    }

    setPhone(session.phone);
    fetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, phone: session.phone }) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) {
          clearSession();
          const err = data?.error === 'not_allowed' ? 'not_allowed' : 'not_allowed';
          nav(`/g/${groupId}?err=${err}`);
          return;
        }
        setReady(true);
      });
  }, [groupId]);

  if (!ready) return <main className="app-shell"><p>Checking access...</p></main>;
  return <AppShell groupId={groupId} phone={phone} />;
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
  if (route.type === 'join') return <JoinGroupPage groupId={route.groupId} routeError={route.error} />;
  return <GuardedApp groupId={route.groupId} />;
}
