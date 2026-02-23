import { useEffect, useMemo, useState } from 'react';
import { FooterHelp } from './components/layout/FooterHelp';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiUrl } from './lib/apiUrl';

type IgniteStartResponse = { ok?: boolean; sessionId?: string; joinUrl?: string; error?: string; message?: string };
type IgniteMetaResponse = { ok?: boolean; sessionId?: string; joinUrl?: string; error?: string; message?: string };

const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function IgniteOrganizerPage({ groupId, phone }: { groupId: string; phone: string }) {
  const [traceId] = useState(() => createTraceId());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const metaUrl = useMemo(() => {
    if (!sessionId) return null;
    const params = new URLSearchParams({ groupId, sessionId, phone, traceId });
    return apiUrl(`/api/ignite/meta?${params.toString()}`);
  }, [groupId, phone, sessionId, traceId]);

  useEffect(() => {
    if (!metaUrl) return;
    let canceled = false;
    const interval = window.setInterval(() => {
      void fetch(metaUrl)
        .then(async (response) => {
          const data = (await response.json()) as IgniteMetaResponse;
          if (canceled || !response.ok || !data.ok) return;
          if (data.sessionId) setSessionId(data.sessionId);
          if (data.joinUrl) setJoinUrl(data.joinUrl);
        })
        .catch(() => undefined);
    }, 3000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [metaUrl]);

  const startSession = async () => {
    setError(null);
    setStatus('starting');
    const response = await fetch(apiUrl('/api/ignite/start'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, phone, traceId })
    });
    const data = (await response.json()) as IgniteStartResponse;

    if (!response.ok || !data.ok) {
      if (response.status === 403 && data.error === 'not_allowed') {
        setError('You must be a member of this group to start a session.');
      } else {
        setError(data.message ?? 'Unable to start session. Please try again.');
      }
      setStatus('error');
      return;
    }

    setSessionId(data.sessionId ?? null);
    setJoinUrl(data.joinUrl ?? null);
    setStatus('ready');
  };

  return (
    <Page>
      <PageHeader
        title="Ignite organizer"
        description="Start a join session and share the QR or link."
        groupId={groupId}
      />
      <div className="join-form-wrap">
        <div className="fs-meta">Phone: {phone}</div>
        <div className="join-actions">
          <button className="fs-btn fs-btn-primary" type="button" onClick={() => void startSession()} disabled={status === 'starting'}>
            {status === 'starting' ? 'Starting…' : 'Start session'}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {sessionId ? <p className="fs-meta">Session ID: {sessionId}</p> : null}
        {joinUrl ? (
          <div>
            <p className="fs-meta">Join URL</p>
            <a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a>
          </div>
        ) : null}
      </div>
      <FooterHelp />
    </Page>
  );
}
