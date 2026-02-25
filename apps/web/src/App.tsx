import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './AppShell';
import { DashboardHomePage } from './components/DashboardHomePage';
import { ProductHomePage } from './components/ProductHomePage';
import { FooterHelp } from './components/layout/FooterHelp';
import { MarketingLayout } from './components/layout/MarketingLayout';
import { Page } from './components/layout/Page';
import { PageHeader } from './components/layout/PageHeader';
import { apiFetch, apiUrl, getAuthSessionId, getSessionId } from './lib/apiUrl';
import { sessionLog } from './lib/sessionLog';
import { sanitizeSessionEmail } from './lib/validate';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';

type Session = { groupId: string; email: string; joinedAt: string };
type AuthStatus = 'checking' | 'allowed' | 'denied';
type AuthError = 'no_session' | 'group_mismatch' | 'not_allowed' | 'group_not_found' | 'join_failed';

const SESSION_KEY = 'familyscheduler.session';
const ROOT_SIGN_IN_MESSAGE = 'Please sign in to continue.';
const PENDING_AUTH_KEY = 'fs.pendingAuth';
const AUTH_CHANNEL_NAME = 'fs-auth';
const SESSION_EMAIL_KEY = 'fs.sessionEmail';
const SESSION_NAME_KEY = 'fs.sessionName';
const LAST_GROUP_ID_KEY = 'fs.lastGroupId';


const readSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  const sessionRaw = window.sessionStorage.getItem(SESSION_KEY);
  if (sessionRaw) {
    try {
      return JSON.parse(sessionRaw) as Session;
    } catch {
      return null;
    }
  }
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    window.sessionStorage.setItem(SESSION_KEY, raw);
    return parsed;
  } catch {
    return null;
  }
};

const writeSession = (session: Session): void => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = (): void => {
  window.sessionStorage.removeItem(SESSION_KEY);
};

const debugAuthLogsEnabled = import.meta.env.VITE_DEBUG_AUTH_LOGS === 'true';
const authLog = (payload: Record<string, unknown>): void => {
  if (!debugAuthLogsEnabled) return;
  console.log(payload);
};
function authDebug(event: string, data?: unknown) {
  try {
    console.debug('[AUTH_DEBUG]', {
      event,
      hash: window.location.hash,
      sessionId: window.localStorage.getItem('fs.sessionId'),
      igniteGraceSessionId: window.localStorage.getItem('fs.igniteGraceSessionId'),
      sessionEmail: window.localStorage.getItem('fs.sessionEmail'),
      localSession: sessionStorage.getItem('familyscheduler.session'),
      ...(typeof data === 'object' && data !== null ? data : { data })
    });
  } catch {
    // Ignore logging failures.
  }
}
const createTraceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createAttemptId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeReturnTo = (value?: string): string => {
  if (typeof value !== 'string') return '/';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return '/';
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) return '/';
  return trimmed;
};

const parseHashRoute = (hash: string): { type: 'home' } | { type: 'login'; notice?: string; next?: string } | { type: 'create' } | { type: 'join' | 'app'; groupId: string; error?: string; traceId?: string } | { type: 'ignite'; groupId: string } | { type: 'igniteJoin'; groupId: string; sessionId: string } | { type: 'handoff'; groupId: string; email?: string; next?: string } | { type: 'authConsume'; token?: string; attemptId?: string; returnTo?: string } | { type: 'authDone'; returnTo?: string } => {
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
  if (path === '/' || path === '/home') return { type: 'home' };
  if (path === '/login') {
    const requestedNext = query.get('next') ?? undefined;
    const normalizedNext = requestedNext === 'create' ? '/create' : sanitizeReturnTo(requestedNext);
    return { type: 'login', notice: query.get('m') ?? undefined, next: normalizedNext };
  }
  if (path === '/create') return { type: 'create' };

  if (path === '/auth/consume') {
    return {
      type: 'authConsume',
      token: query.get('token') ?? undefined,
      attemptId: query.get('attemptId') ?? undefined,
      returnTo: sanitizeReturnTo(query.get('returnTo') ?? undefined)
    };
  }
  if (path === '/auth/done') {
    return {
      type: 'authDone',
      returnTo: sanitizeReturnTo(query.get('returnTo') ?? undefined)
    };
  }
  if (path === '/handoff') {
    return {
      type: 'handoff',
      groupId: query.get('groupId') ?? '',
      email: query.get('email') ?? undefined,
      next: query.get('next') ?? undefined
    };
  }
  const joinMatch = path.match(/^\/g\/([^/]+)$/);
  if (joinMatch) return { type: 'join', groupId: joinMatch[1], error: query.get('err') ?? undefined, traceId: query.get('trace') ?? undefined };
  return { type: 'home' };
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
const toSignInRoute = (message: string = ROOT_SIGN_IN_MESSAGE): string => `/login?m=${encodeURIComponent(message)}`;


function SignInRequiredPage({ message }: { message: string }) {
  return (
    <Page variant="form">
      <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
        <Alert severity="warning">{message}</Alert>
        <Button variant="contained" onClick={() => nav('/', { replace: true })}>Go to sign-in</Button>
      </Stack>
      <FooterHelp />
    </Page>
  );
}

function RedirectToSignInPage({ message }: { message: string }) {
  useEffect(() => {
    nav(toSignInRoute(message), { replace: true });
  }, [message]);

  return <SignInRequiredPage message={message} />;
}


function RedirectToLoginPage({ next = '/create', notice }: { next?: string; notice?: string }) {
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('next', next === '/create' ? 'create' : next);
    if (notice) params.set('m', notice);
    nav(`/login?${params.toString()}`, { replace: true });
  }, [next, notice]);

  return <LandingSignInPage notice={notice} nextPath={next} />;
}

function LandingSignInPage({ notice, nextPath = '/' }: { notice?: string; nextPath?: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{ attemptId: string; returnTo: string } | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!successState) return;

    const onComplete = (attemptId: string) => {
      if (attemptId !== successState.attemptId) return;
      window.sessionStorage.removeItem(PENDING_AUTH_KEY);
      nav(successState.returnTo, { replace: true });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === `fs.authComplete.${successState.attemptId}`) onComplete(successState.attemptId);
    };

    window.addEventListener('storage', onStorage);

    const existing = window.localStorage.getItem(`fs.authComplete.${successState.attemptId}`);
    if (existing) onComplete(successState.attemptId);

    let channel: BroadcastChannel | null = null;
    if (typeof window.BroadcastChannel === 'function') {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ type?: string; attemptId?: string }>) => {
        if (event.data?.type === 'AUTH_COMPLETE' && event.data.attemptId) onComplete(event.data.attemptId);
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [successState]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessState(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }

    const attemptId = createAttemptId();
    const returnTo = sanitizeReturnTo(nextPath);
    window.sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify({ attemptId, returnTo, startedAt: Date.now() }));

    setRequesting(true);
    try {
      const response = await apiFetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, traceId: createTraceId(), attemptId, returnTo })
      });
      if (!response.ok) {
        setError('Unable to request sign-in link. Please try again.');
        window.sessionStorage.removeItem(PENDING_AUTH_KEY);
        return;
      }
      setSuccessState({ attemptId, returnTo });
    } catch {
      setError('Unable to request sign-in link. Please try again.');
      window.sessionStorage.removeItem(PENDING_AUTH_KEY);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Page variant="form">
      <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 1, sm: 2 }, borderRadius: 3, background: 'radial-gradient(circle at 20% -10%, rgba(255, 183, 77, 0.14), transparent 45%)' }}>
        <PageHeader
          title="Yapper"
          description="Smart coordination for modern groups"
          showGroupSummary={false}
        />
      </Box>
      <Stack component="form" spacing={2.5} onSubmit={submit} sx={{ maxWidth: 560, mx: 'auto', mt: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Sign in</Typography>
        <Typography variant="body2" color="text.secondary">Secure passwordless access via email link.</Typography>
        {notice ? <Alert severity="warning">{notice}</Alert> : null}
        <TextField label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required fullWidth />
        <Button variant="contained" type="submit" disabled={requesting} sx={{ transition: 'background-color 120ms ease, box-shadow 120ms ease' }}>{requesting ? 'Sending…' : 'Send sign-in link'}</Button>
        <Typography variant="body2" color="text.secondary">If you don’t see it, check your spam folder.</Typography>
        {successState ? <Alert severity="success">Email sent. Check your inbox (and Junk/Spam). After you click the link, come back here — we’ll continue automatically.</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Typography variant="body2" color="text.secondary">Need help? support@yapper-app.com</Typography>
      </Stack>
      <FooterHelp />
    </Page>
  );
}

function CreateGroupPage() {
  const [groupName, setGroupName] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session?.email) setCreatorEmail(session.email);
  }, []);

  const hasApiSession = Boolean(getAuthSessionId());
  const hasSessionEmail = Boolean(readSession()?.email);
  const hasSignedInSession = hasApiSession && hasSessionEmail;
  const trimmedGroupName = groupName.trim();
  const trimmedCreatorName = creatorName.trim();
  const trimmedCreatorEmail = creatorEmail.trim();
  const canSubmit = Boolean(trimmedGroupName && trimmedCreatorName && trimmedCreatorEmail) && !isCreating;

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
    if (!hasApiSession) {
      setError("You're not signed in. Please sign in again.");
      return;
    }
    if (!trimmedCreatorEmail) {
      setError('Your email is required.');
      return;
    }
    setIsCreating(true);
    try {
      const response = await apiFetch('/api/group/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupName: trimmedGroupName, creatorEmail: trimmedCreatorEmail, creatorName: trimmedCreatorName }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? 'Failed to create group');
        return;
      }

      const link = `${window.location.origin}/#/g/${data.groupId}`;
      writeSession({ groupId: data.groupId, email: creatorEmail.trim(), joinedAt: new Date().toISOString() });
      if (trimmedCreatorName) window.localStorage.setItem(SESSION_NAME_KEY, trimmedCreatorName);
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
        showGroupSummary={false}
      />

      <div className="ui-authContainer">
        <Stack className="ui-authForm" component="form" spacing={2} onSubmit={submit}>
          {showCreateForm ? (
            <>
              <TextField label="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required inputProps={{ maxLength: 60 }} placeholder="Mom Knee Surgery" fullWidth />
              <TextField label="Your name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} required inputProps={{ maxLength: 40 }} placeholder="Joe" fullWidth />
              <TextField
                label="Your email"
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                required
                placeholder="you@example.com"
                helperText={hasSignedInSession ? `Signed in as ${trimmedCreatorEmail || creatorEmail}` : 'Use an email you can sign in with.'}
                fullWidth
                InputProps={{ readOnly: hasSignedInSession }}
                disabled={hasSignedInSession}
              />
              <div className="ui-authActions">
                <Button variant="contained" type="submit" disabled={!canSubmit}>{isCreating ? 'CREATING…' : 'CREATE GROUP'}</Button>
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
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [groupName, setGroupName] = useState<string | undefined>(undefined);
  const routeNotice = useMemo(() => {
    if (routeError === 'no_session') return 'Please sign in again to continue.';
    if (routeError === 'group_mismatch') return 'Your active session is for a different group.';
    if (routeError === 'join_failed') return 'We could not process your join request. Please try again.';
    if (routeError === 'not_allowed') return 'This email is not allowed for this group.';
    return null;
  }, [routeError]);

  useEffect(() => {
    authLog({ stage: 'join_page_loaded', groupId, err: routeError ?? null, traceId: traceId ?? null });
  }, [groupId, routeError, traceId]);

  useEffect(() => {
    let canceled = false;

    const loadGroupMeta = async () => {
      try {
        const response = await apiFetch(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`);
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
        setFormError(null);
    if (!email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }
    const requestTraceId = createTraceId();
    const response = await apiFetch('/api/group/join-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, email: email.trim(), traceId: requestTraceId }) });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setFormError(data?.error === 'group_not_found' ? 'This group could not be found.' : 'This email is not authorized for this group.');
      return;
    }

    writeSession({ groupId, email, joinedAt: new Date().toISOString() });
    nav(`/g/${groupId}/app`);
  };

  const closeJoinDialog = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      window.history.back();
      return;
    }
    nav('/', { replace: true });
  };

  return (
    <Page variant="form">
      <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
        <Stack component="form" spacing={2} onSubmit={submit} sx={{ width: '100%', p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="h6">{groupName ? `Join “${groupName}”` : 'Join Group'}</Typography>
              <Typography variant="body2" color="text.secondary">You need access to this group to continue.</Typography>
            </Box>
            <IconButton size="small" aria-label="Close join dialog" onClick={closeJoinDialog}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          {routeNotice ? (
            <Alert severity="info" sx={{ py: 0.5, '& .MuiAlert-message': { py: 0 } }}>
              <Typography variant="body2" component="span">{routeNotice}</Typography>
              {traceId ? <Typography component="span" variant="caption" color="text.secondary"> {`Trace: ${traceId}`}</Typography> : null}
            </Alert>
          ) : null}

          <TextField
            label="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (hasSubmitted) setFormError(null);
            }}
            required
            error={Boolean(formError) && hasSubmitted}
            helperText={hasSubmitted ? formError || 'Only invited email addresses can join this group.' : 'Only invited email addresses can join this group.'}
            placeholder="you@example.com"
            fullWidth
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="text" type="button" onClick={closeJoinDialog}>Cancel</Button>
            <Button variant="contained" type="submit">Request access</Button>
          </Stack>
        </Stack>
      </Box>
      <FooterHelp />
    </Page>
  );
}


function AuthConsumePage({ token, attemptId, returnTo }: { token?: string; attemptId?: string; returnTo?: string }) {
  const [error, setError] = useState<string | null>(null);
  const nextPath = sanitizeReturnTo(returnTo);

  useEffect(() => {
    if (!token) return;
    let canceled = false;

    const consume = async () => {
      const traceId = createTraceId();
      try {
        const response = await apiFetch('/api/auth/consume-link', {
          method: 'POST',
          body: JSON.stringify({ token, traceId })
        });
        const data = await response.json() as { ok?: boolean; error?: string; message?: string; sessionId?: string; email?: string; name?: string; traceId?: string };
        if (!response.ok || !data.ok || !data.sessionId) {
          if (!canceled) setError(data?.message ?? data?.error ?? 'Unable to sign in with this link.');
          return;
        }
        if (!canceled) {
          window.localStorage.setItem('fs.sessionId', data.sessionId);
          window.localStorage.removeItem(SESSION_NAME_KEY);
          const sanitizedEmail = sanitizeSessionEmail(data.email);
          if (sanitizedEmail) {
            window.localStorage.setItem(SESSION_EMAIL_KEY, sanitizedEmail);
          } else {
            window.localStorage.removeItem(SESSION_EMAIL_KEY);
            if (typeof data.email === 'string' && data.email.trim()) {
              authLog({ event: 'session_email_rejected', value: data.email, traceId: data.traceId ?? traceId });
            }
          }
          if (typeof data.name === 'string' && data.name.trim()) window.localStorage.setItem(SESSION_NAME_KEY, data.name.trim());
          if (typeof window.BroadcastChannel === 'function') {
            const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
            channel.postMessage({ type: 'AUTH_SUCCESS', sessionId: data.sessionId, ts: Date.now() });
            channel.close();
          }
          if (attemptId) {
            const key = `fs.authComplete.${attemptId}`;
            const marker = String(Date.now());
            window.localStorage.setItem(key, marker);
            if (typeof window.BroadcastChannel === 'function') {
              const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
              channel.postMessage({ type: 'AUTH_COMPLETE', attemptId });
              channel.close();
            }
          }
          nav(`/auth/done?returnTo=${encodeURIComponent(nextPath)}`, { replace: true });
        }
      } catch {
        if (!canceled) setError('Unable to sign in with this link.');
      }
    };

    void consume();
    return () => {
      canceled = true;
    };
  }, [token, attemptId, nextPath]);

  if (!token) {
    return (
      <Page variant="form">
        <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
          <Alert severity="error">Missing sign-in token.</Alert>
          <Button variant="text" onClick={() => nav('/')}>Go home</Button>
        </Stack>
        <FooterHelp />
      </Page>
    );
  }

  if (error) {
    return (
      <Page variant="form">
        <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="text" onClick={() => nav(`/auth/consume?token=${encodeURIComponent(token)}`, { replace: true })}>Retry</Button>
        </Stack>
        <FooterHelp />
      </Page>
    );
  }

  return (
    <Page variant="form">
      <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
        <CircularProgress size={32} />
        <Typography>Signing you in...</Typography>
      </Stack>
      <FooterHelp />
    </Page>
  );
}

function AuthDonePage({ returnTo }: { returnTo?: string }) {
  const nextPath = sanitizeReturnTo(returnTo);
  const [showCloseHint, setShowCloseHint] = useState(false);

  const returnToApp = () => {
    try {
      if (typeof window.opener !== 'undefined' && window.opener) window.opener.focus();
    } catch {
      // noop
    }
    const destination = nextPath === '/' ? '/#/' : `/#${nextPath}`;
    window.location.replace(destination);
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // noop
      }
      if (!window.closed) setShowCloseHint(true);
    }, 150);
  };

  return (
    <Page variant="form">
      <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
        <Alert severity="success">Signed in to Yapper.</Alert>
        <Typography>This tab can close now. Return to Yapper to continue.</Typography>
        {showCloseHint ? <Typography variant="body2" color="text.secondary">You can close this tab.</Typography> : null}
        <Button variant="contained" onClick={returnToApp}>Return to Yapper</Button>
        <Button component="a" href={nextPath === '/' ? '/#/' : `/#${nextPath}`} variant="text">Go to Yapper</Button>
      </Stack>
      <FooterHelp />
    </Page>
  );
}

type IgniteMetaResponse = { ok?: boolean; status?: 'OPEN' | 'CLOSING' | 'CLOSED'; joinedCount?: number; joinedPersonIds?: string[]; photoUpdatedAtByPersonId?: Record<string, string>; createdByPersonId?: string; peopleByPersonId?: Record<string, { name?: string }> };
const IGNITE_SOUND_KEY = 'igniteSoundEnabled';

function IgniteOrganizerPage({ groupId, email }: { groupId: string; email: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'OPEN' | 'CLOSING' | 'CLOSED'>('OPEN');
  const [groupName, setGroupName] = useState<string>('');
  const [joinedCount, setJoinedCount] = useState(0);
  const [joinedBump, setJoinedBump] = useState(false);
  const [joinSoundEnabled, setJoinSoundEnabled] = useState(true);
  const [joinedPersonIds, setJoinedPersonIds] = useState<string[]>([]);
  const [newlyJoinedPersonIds, setNewlyJoinedPersonIds] = useState<string[]>([]);
  const [photoUpdatedAtByPersonId, setPhotoUpdatedAtByPersonId] = useState<Record<string, string>>({});
  const [createdByPersonId, setCreatedByPersonId] = useState<string>('');
  const [peopleByPersonId, setPeopleByPersonId] = useState<Record<string, { name?: string }>>({});
  const [groupMetaPeople, setGroupMetaPeople] = useState<Array<{ personId: string; name: string }>>([]);
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
        const response = await apiFetch(`/api/group/meta?groupId=${encodeURIComponent(groupId)}`);
        if (!response.ok) return;
        const data = await response.json() as { ok?: boolean; groupName?: string; people?: Array<{ personId: string; name: string }> };
        if (data.ok) {
          if (data.groupName) setGroupName(data.groupName);
          setGroupMetaPeople(data.people ?? []);
        }
      } catch {
        // Keep existing fallback title.
      }
    };
    void loadGroupMeta();
  }, [groupId]);

  useEffect(() => {
    const name = (groupName ?? '').trim();
    document.title = name ? `Ignition Session — ${name}` : 'Ignition Session';
  }, [groupName]);

  const renameGroupName = async (nextName: string) => {
    setError(null);
    const traceId = createTraceId();
    const response = await apiFetch('/api/group/rename', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, email, groupName: nextName, traceId })
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
    if (!email.trim()) {
      setError('Missing authorized email. Rejoin the group and try again.');
      return;
    }
    const traceId = createTraceId();
    const response = await apiFetch('/api/ignite/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, email, traceId }) });
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
    setCreatedByPersonId('');
    setPeopleByPersonId({});
  };

  useEffect(() => {
    const normalizedSessionId = sessionId?.trim();
    if (!normalizedSessionId) {
      if (sessionId === null && email.trim()) {
        void startSession();
      } else {
        console.debug('[AUTH_DEBUG]', { event: 'ignite_meta_skip', groupId, sessionId });
      }
      return;
    }
    let canceled = false;
    const poll = async () => {
      if (!groupId || !normalizedSessionId) {
        console.debug('[AUTH_DEBUG]', { event: 'ignite_meta_skip', groupId, sessionId: normalizedSessionId });
        return;
      }
      const response = await apiFetch('/api/ignite/meta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupId, sessionId: normalizedSessionId, email, traceId: createTraceId() })
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
      setCreatedByPersonId(data.createdByPersonId ?? '');
      setPeopleByPersonId(data.peopleByPersonId ?? {});
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    return () => { canceled = true; window.clearInterval(interval); };
  }, [groupId, email, sessionId, joinSoundEnabled]);

  const closeSession = async () => {
    if (!sessionId) return;
    const response = await apiFetch('/api/ignite/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, email, sessionId, traceId: createTraceId() }) });
    const data = await response.json() as { ok?: boolean; status?: 'OPEN' | 'CLOSING' | 'CLOSED'; message?: string };
    if (!response.ok || !data.ok) {
      setError(data.message ?? 'Unable to close session');
      return;
    }
    setStatus(data.status ?? 'CLOSING');
    setSessionId(null);
    writeSession({ groupId, email, joinedAt: new Date().toISOString() });
    nav(`/g/${groupId}/app`);
  };

  const uploadPhotoBase64 = async (base64: string) => {
    if (!sessionId || !base64) return;
    setError(null);
    setIsUploading(true);
    try {
      const response = await apiFetch('/api/ignite/photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, email, sessionId, imageBase64: base64, imageMime: 'image/jpeg', traceId: createTraceId() }) });
      const data = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? 'Unable to upload photo');
      } else {
        const organizerId = createdByPersonId || joinedPersonIds[0];
        if (organizerId) {
          setPhotoUpdatedAtByPersonId((existing) => ({ ...existing, [organizerId]: new Date().toISOString() }));
        }
      }
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
  const meetingUrl = `${window.location.origin}/#/g/${groupId}`;
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

  const cancelBreakout = () => {
    nav(`/g/${groupId}/app`);
  };

  const groupMemberPersonIds = groupMetaPeople.map((person) => person.personId).filter((id) => Boolean(id));
  const organizerPersonIds = createdByPersonId ? [createdByPersonId] : [];
  const displayedPersonIds = Array.from(new Set([...groupMemberPersonIds, ...organizerPersonIds, ...joinedPersonIds].filter((id): id is string => Boolean(id))));
  const combinedPeopleByPersonId: Record<string, { name?: string }> = {
    ...Object.fromEntries(groupMetaPeople.map((person) => [person.personId, { name: person.name }])),
    ...peopleByPersonId
  };

  return (
    <Page variant="form">
      <PageHeader
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
              <Typography className="ui-igniteOptionalLabel">Add photo (optional)</Typography>
            </div>
            <Typography variant="h6" className="ui-igniteCardTitle">Ignition Session</Typography>
            <div className="ui-igniteHeaderRight">
              <Button variant="text" type="button" onClick={cancelBreakout}>Cancel</Button>
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
              <div className="ui-igniteJoinLinkRow" role="group" aria-label="Ignite join link">
                <Typography component="div" className="ui-igniteJoinLinkText" title={joinUrl}>{joinUrl}</Typography>
                <IconButton type="button" title="Copy join link" aria-label="Copy join link" onClick={() => { void copyJoinLink(joinUrl); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </div>
              {copiedJoinLink ? <Typography className="ui-meta">✓ Copied</Typography> : null}
            </div>
          ) : null}

          {sessionId ? (
            <div className="ui-igniteSection">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Group link</Typography>
              <div className="ui-igniteJoinLinkRow" role="group" aria-label="Ignite group link">
                <Typography component="div" className="ui-igniteJoinLinkText" title={meetingUrl}>{meetingUrl}</Typography>
                <IconButton type="button" title="Copy group link" aria-label="Copy group link" onClick={() => { void copyJoinLink(meetingUrl); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          ) : null}

          <div className="ui-igniteSection">
            <div className="ui-igniteHeader">
              <Typography variant="subtitle2">Joined folks ({displayedPersonIds.length})</Typography>
            </div>
            {!sessionId || displayedPersonIds.length === 0 ? <Typography className="ui-meta">No one joined yet.</Typography> : null}
            <div className="ui-igniteFolksList">
              {sessionId ? displayedPersonIds.map((personId) => {
                const hasPhoto = Boolean(photoUpdatedAtByPersonId[personId]);
                const personName = combinedPeopleByPersonId[personId]?.name || personId;
                return (
                  <div key={personId} className={`ui-ignitePersonCard ${newlyJoinedPersonIds.includes(personId) ? 'ui-igniteJoinedBump' : ''}`}>
                    {hasPhoto
                      ? <>
                          <img className="ui-ignitePersonThumb" src={apiUrl(`/api/ignite/photo?groupId=${encodeURIComponent(groupId)}&email=${encodeURIComponent(email)}&sessionId=${encodeURIComponent(sessionId)}&personId=${encodeURIComponent(personId)}&t=${encodeURIComponent(photoUpdatedAtByPersonId[personId] ?? '')}`)} alt={personName} />
                          <Typography variant="caption" className="ui-ignitePersonName">{personName}</Typography>
                        </>
                      : <Typography variant="caption" className="ui-ignitePersonName">{personName}</Typography>}
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
  // Durable login session (fs.sessionId) means we can auto-join without prompting.
  // igniteGrace is joiner-only and may be stale; do NOT auto-join based on grace.
  const hasDurableSession = Boolean(getSessionId());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const joinPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const onPhotoSelected = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const [, base64 = ''] = dataUrl.split(',', 2);
      if (!base64) throw new Error('invalid_photo');
      setPhotoPreviewUrl(dataUrl);
      setPhotoBase64(base64);
    } catch {
      setError('Unable to read photo. You can skip this step and join without a photo.');
      setPhotoPreviewUrl('');
      setPhotoBase64('');
    } finally {
      input.value = '';
    }
  };

  const join = async (payload: { name?: string; email?: string; photoBase64?: string }) => {
    setError(null);
    setJoining(true);
    try {
      const response = await apiFetch('/api/ignite/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, sessionId, traceId: createTraceId(), ...payload }) });
      const data = await response.json() as { ok?: boolean; error?: string; code?: string; message?: string; sessionId?: string; breakoutGroupId?: string; graceExpiresAtUtc?: string };
      if (!response.ok || !data.ok || !data.breakoutGroupId) {
        if ((data.code ?? data.error) === 'IGNITE_CLOSED') {
          setError('This session is closed.');
          return;
        }
        setError(data.message ?? 'Unable to join session');
        return;
      }
      if (data.sessionId) {
        window.localStorage.setItem('fs.igniteGraceSessionId', data.sessionId);
        if (data.graceExpiresAtUtc) {
          window.localStorage.setItem('fs.igniteGraceExpiresAtUtc', data.graceExpiresAtUtc);
        }
        sessionLog('GRACE_START', {
          breakoutGroupId: data.breakoutGroupId,
          sessionIdPrefix: data.sessionId.slice(0, 8),
          graceExpiresAtUtc: data.graceExpiresAtUtc
        });
        authDebug('ignite_join_set_grace_session', {
          breakoutGroupId: data.breakoutGroupId,
          sessionIdPrefix: data.sessionId.slice(0, 8),
          graceExpiresAtUtc: data.graceExpiresAtUtc
        });
      }
      writeSession({ groupId: data.breakoutGroupId, email: payload.email ?? email, joinedAt: new Date().toISOString() });
      nav(`/g/${data.breakoutGroupId}/app`);
    } catch {
      setError('Unable to join session');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!hasDurableSession) return;
    if (joining) return;
    void join({});
  }, [hasDurableSession]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    await join({ name, email, photoBase64: photoBase64 || undefined });
  };

  if (hasDurableSession) {
    return (
      <Page variant="form">
        <PageHeader title="Join session" description="Joining…" groupId={groupId} />
        <Stack spacing={2}>
          <CircularProgress size={24} />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
        <FooterHelp />
      </Page>
    );
  }

  return (
    <Page variant="form">
      <PageHeader title="Join session" description="Enter your name and email to join this live session." groupId={groupId} />
      <Stack component="form" spacing={2} onSubmit={submit}>
        {!hasDurableSession ? (
          <Alert severity="info">
            We’ll email you a sign-in link. You’ll join now, and the link helps you keep participating if this temporary session expires.
          </Alert>
        ) : null}
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
        <input
          ref={joinPhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { void onPhotoSelected(e.currentTarget); }}
          disabled={joining}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" type="button" onClick={() => joinPhotoInputRef.current?.click()} disabled={joining}>Add photo (optional)</Button>
          {photoBase64 ? <Button variant="text" type="button" onClick={() => { setPhotoBase64(''); setPhotoPreviewUrl(''); }} disabled={joining}>Remove</Button> : null}
        </Stack>
        {photoPreviewUrl ? <img src={photoPreviewUrl} alt="Join photo preview" style={{ width: 88, height: 88, borderRadius: 10, objectFit: 'cover' }} /> : null}
        <Stack direction="row" spacing={1}><Button variant="contained" type="submit" disabled={joining}>{joining ? 'Joining…' : 'Join meeting'}</Button></Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
      </Stack>
      <FooterHelp />
    </Page>
  );
}

function GroupAuthGate({ groupId, children }: { groupId: string; children: (email: string) => ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [authError, setAuthError] = useState<AuthError | undefined>();
  const [traceId] = useState(() => createTraceId());
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const apiSessionId = getAuthSessionId();
    authDebug('gate_decision_snapshot', {
      groupId,
      apiSessionIdPrefix: apiSessionId?.slice(0, 8),
      // localSession is joiner-only state; do not gate logged-in access on it.
      session: readSession()
    });
    authLog({ stage: 'gate_enter', groupId, hasApiSession: !!apiSessionId });
    if (!apiSessionId) {
      authDebug('gate_redirect_missing_api_session', {
        groupId,
        apiSessionId
      });
      if (canceled) return;
      setAuthStatus('denied');
      setAuthError('no_session');
      authLog({ stage: 'gate_redirect', to: toSignInRoute(ROOT_SIGN_IN_MESSAGE), reason: 'missing_api_session' });
      nav(toSignInRoute(ROOT_SIGN_IN_MESSAGE), { replace: true });
      return;
    }

    // Logged-in access is determined by the server membership check.
    // Do NOT gate on local familyscheduler.session, which is joiner-only and may be stale/mismatched.
    const cachedEmail = window.localStorage.getItem('fs.sessionEmail');
    setEmail(cachedEmail ? sanitizeSessionEmail(cachedEmail) : null);
    authLog({ stage: 'gate_join_request', groupId });
    void apiFetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId, traceId }) })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; error?: AuthError };
        const responseError = !response.ok || !data.ok ? (data?.error === 'group_not_found' ? 'group_not_found' : data?.error === 'not_allowed' ? 'not_allowed' : 'join_failed') : undefined;
        authLog({ stage: 'gate_join_result', ok: response.ok && !!data.ok, error: responseError ?? null });
        if (!response.ok || !data.ok) {
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

  // email is best-effort (UI); authorization is from server join check.
  if (authStatus !== 'allowed') {
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
  return <>{children(email ?? "")}</>;
}

function HandoffPage({ groupId, email, next }: { groupId: string; email?: string; next?: string }) {
  useEffect(() => {
    const identity = email?.trim() || '';
    if (!groupId || !email) {
      nav('/');
      return;
    }
    const safeNext = typeof next === 'string' && next.startsWith('/g/') ? next : `/g/${groupId}/ignite`;
    writeSession({ groupId, email: identity, joinedAt: new Date().toISOString() });
    nav(safeNext, { replace: true });
  }, [groupId, email, next]);

  return (
    <Page variant="form">
      <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
        <CircularProgress size={32} />
        <Typography>Redirecting…</Typography>
      </Stack>
      <FooterHelp />
    </Page>
  );
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  const [hasApiSession, setHasApiSession] = useState<boolean>(() => Boolean(getAuthSessionId()));
  const sessionEmail = useMemo(() => {
    const rawSessionEmail = window.localStorage.getItem(SESSION_EMAIL_KEY);
    const sanitizedSessionEmail = sanitizeSessionEmail(rawSessionEmail);
    if (!sanitizedSessionEmail && rawSessionEmail !== null) {
      window.localStorage.removeItem(SESSION_EMAIL_KEY);
      authLog({ event: 'session_email_rejected', source: 'app_read', value: rawSessionEmail });
    }
    return sanitizedSessionEmail;
  }, [hash, hasApiSession]);
  const sessionName = useMemo(() => window.localStorage.getItem(SESSION_NAME_KEY), [hash, hasApiSession]);
  const recentGroupId = useMemo(() => window.localStorage.getItem(LAST_GROUP_ID_KEY), [hash, hasApiSession]);

  const signOut = () => {
    window.localStorage.removeItem('fs.sessionId');
    window.localStorage.removeItem('fs.igniteGraceSessionId');
    window.localStorage.removeItem('fs.igniteGraceExpiresAtUtc');
    window.localStorage.removeItem(SESSION_EMAIL_KEY);
    window.localStorage.removeItem(SESSION_NAME_KEY);
    sessionLog('DURABLE_CLEAR', { reason: 'sign_out' });
    sessionLog('GRACE_CLEARED', { reason: 'sign_out' });
    setHasApiSession(false);
    nav('/', { replace: true });
  };
  useEffect(() => {
    const refreshAuth = () => {
      setHasApiSession(Boolean(getAuthSessionId()));
      setHash(window.location.hash || '#/');
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'fs.sessionId' || event.key === SESSION_EMAIL_KEY || event.key === SESSION_NAME_KEY) refreshAuth();
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window.BroadcastChannel === 'function') {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === 'AUTH_SUCCESS') refreshAuth();
      };
    }

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, []);
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '/';
    }
    const onChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route = useMemo(() => parseHashRoute(hash), [hash]);
  useEffect(() => {
    setHasApiSession(Boolean(getAuthSessionId()));
  }, [hash]);

  useEffect(() => {
    if (route.type !== 'app') return;
    window.localStorage.setItem(LAST_GROUP_ID_KEY, route.groupId);
  }, [route]);

  useEffect(() => {
    authDebug('route_render', {
      routeType: route.type,
      hasApiSession
    });
  }, [route, hasApiSession]);

  if ((route.type === 'app' || route.type === 'ignite') && !hasApiSession) {
    authDebug('route_redirect_login', {
      routeType: route.type,
      hasApiSession
    });
    return <RedirectToSignInPage message={ROOT_SIGN_IN_MESSAGE} />;
  }
  if (route.type === 'home') {
    if (!hasApiSession) {
      return (
        <MarketingLayout hasApiSession={false} onSignIn={() => nav('/login')}>
          <ProductHomePage onCreateGroup={() => nav('/create')} />
        </MarketingLayout>
      );
    }
    return (
      <MarketingLayout hasApiSession sessionEmail={sessionEmail} sessionName={sessionName} onSignOut={signOut}>
        <DashboardHomePage
          signedInLabel={sessionName ? `Signed in as ${sessionName}${sessionEmail ? ` (${sessionEmail})` : ''}` : sessionEmail ? `Signed in as ${sessionEmail}` : 'Signed in'}
          onCreateGroup={() => nav('/create')}
          recentGroupId={recentGroupId ?? undefined}
          onOpenRecentGroup={recentGroupId ? () => nav(`/g/${recentGroupId}/app`) : undefined}
        />
      </MarketingLayout>
    );
  }
  if (route.type === 'login') return <LandingSignInPage notice={route.notice} nextPath={route.next} />;
  if (route.type === 'create' && !hasApiSession) return <RedirectToLoginPage next="/create" notice="Please sign in to create a group." />;
  if (route.type === 'create') return <CreateGroupPage />;
  if (route.type === 'handoff') return <HandoffPage groupId={route.groupId} email={route.email} next={route.next} />;
  if (route.type === 'join') return <JoinGroupPage groupId={route.groupId} routeError={route.error} traceId={route.traceId} />;
  if (route.type === 'authConsume') return <AuthConsumePage token={route.token} attemptId={route.attemptId} returnTo={route.returnTo} />;
  if (route.type === 'authDone') return <AuthDonePage returnTo={route.returnTo} />;
  if (route.type === 'igniteJoin') return <IgniteJoinPage groupId={route.groupId} sessionId={route.sessionId} />;
  if (route.type === 'ignite') {
    return (
      <GroupAuthGate groupId={route.groupId}>
        {(email) => <IgniteOrganizerPage groupId={route.groupId} email={email} />}
      </GroupAuthGate>
    );
  }
  return (
    <GroupAuthGate groupId={route.groupId}>
      {(email) => <AppShell groupId={route.groupId} sessionEmail={email} />}
    </GroupAuthGate>
  );
}
