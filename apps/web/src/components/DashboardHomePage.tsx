import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { spinoffBreakoutGroup } from '../lib/ignite/spinoffBreakout';
import { apiFetch } from '../lib/apiUrl';

type DashboardHomePageProps = {
  signedInLabel?: string;
  onCreateGroup: () => void;
  onOpenRecentGroup?: () => void;
  recentGroupId?: string;
};

type DashboardGroup = {
  groupId: string;
  groupName: string;
  myStatus: 'active' | 'invited';
  invitedAt: string | null;
  joinedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  memberCountActive: number;
  memberCountInvited: number;
  appointmentCountUpcoming: number;
};

type DashboardRecent = {
  type: 'invite' | 'group';
  label: string;
  groupId?: string;
  status?: 'active' | 'invited';
  timestamp: string;
  actions: string[];
};

type DashboardPayload = {
  traceId: string;
  groups: DashboardGroup[];
  recent: DashboardRecent[];
  usageToday: { openaiCalls: number; tokensIn: number; tokensOut: number; errors: number } | null;
  monthSummary: { newGroups: number; newAppointments: number; invitesSent: number; invitesAccepted: number } | null;
  health: { ok: boolean; time: string };
};

const navToGroup = (groupId: string): void => {
  window.location.hash = `/g/${groupId}/app`;
};

export function DashboardHomePage({ signedInLabel = 'Signed in', onCreateGroup, onOpenRecentGroup, recentGroupId }: DashboardHomePageProps) {
  const [isSpinningOffGroupId, setIsSpinningOffGroupId] = useState<string | null>(null);
  const [breakoutNotice, setBreakoutNotice] = useState<string | null>(null);
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'invited'>('all');
  const hasRecentGroup = Boolean(recentGroupId);

  const loadDashboard = async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const response = await apiFetch('/api/me/dashboard');
      if (!response.ok) {
        setGroupsError('Unable to load dashboard right now.');
        return;
      }
      const payload = await response.json() as DashboardPayload;
      setDashboard(payload);
    } catch {
      setGroupsError('Unable to load dashboard right now.');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const createBreakoutGroup = async (groupId: string) => {
    if (isSpinningOffGroupId) return;
    setBreakoutError(null);
    setIsSpinningOffGroupId(groupId);
    try {
      const result = await spinoffBreakoutGroup({ sourceGroupId: groupId });
      if (!result.ok) {
        setBreakoutError(`${result.message}${result.traceId ? ` (trace: ${result.traceId})` : ''}`);
        return;
      }

      const popup = window.open(result.urlToOpen, '_blank', 'noopener,noreferrer');
      if (!popup) {
        setBreakoutNotice(result.urlToOpen);
        return;
      }
      popup.focus?.();
      setBreakoutNotice(null);
      setBreakoutError(null);
    } finally {
      setIsSpinningOffGroupId(null);
    }
  };

  const groups = useMemo(() => {
    const all = dashboard?.groups ?? [];
    if (filter === 'all') return all;
    return all.filter((group) => group.myStatus === filter);
  }, [dashboard?.groups, filter]);

  const handleAccept = async (groupId: string) => {
    await apiFetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId }) });
    await loadDashboard();
  };

  const handleDecline = async (groupId: string) => {
    await apiFetch('/api/group/decline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId }) });
    await loadDashboard();
  };

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <Box>
        <Typography variant="overline" sx={{ color: '#d97706', fontWeight: 700, letterSpacing: '0.08em' }}>Dashboard</Typography>
        <Typography
          variant="h4"
          sx={{
            mt: 0.6,
            fontWeight: 750,
            letterSpacing: '-0.015em',
            fontSize: { xs: '1.8rem', md: '2.1rem' },
            lineHeight: 1.15
          }}
        >
          Welcome back
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{signedInLabel}</Typography>
      </Box>

      {breakoutNotice ? (
        <Alert severity="info" onClose={() => setBreakoutNotice(null)}>
          Opening Breakout in a new tab. If nothing happened, <a href={breakoutNotice} target="_blank" rel="noopener noreferrer">open it manually</a>.
        </Alert>
      ) : null}
      {breakoutError ? <Alert severity="error" onClose={() => setBreakoutError(null)}>{breakoutError}</Alert> : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button variant="contained" onClick={onCreateGroup}>Create a group</Button>
        {hasRecentGroup && onOpenRecentGroup ? <Button variant="outlined" onClick={onOpenRecentGroup}>Open recent group</Button> : null}
      </Stack>

      <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Recent</Typography>
        {loadingGroups ? <Typography color="text.secondary">Loading…</Typography> : null}
        {!loadingGroups && (dashboard?.recent?.length ?? 0) === 0 ? <Typography color="text.secondary">No recent activity yet.</Typography> : null}
        <Stack spacing={1}>
          {(dashboard?.recent ?? []).map((item, idx) => (
            <Stack key={`${item.type}-${item.groupId ?? idx}`} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid', borderBottomColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">{new Date(item.timestamp).toLocaleString()}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                {item.actions.includes('accept') && item.groupId ? <Button size="small" variant="contained" onClick={() => { void handleAccept(item.groupId!); }}>Accept</Button> : null}
                {item.actions.includes('decline') && item.groupId ? <Button size="small" variant="outlined" color="warning" onClick={() => { void handleDecline(item.groupId!); }}>Decline</Button> : null}
                {item.actions.includes('resume') && item.groupId ? <Button size="small" variant="outlined" onClick={() => navToGroup(item.groupId!)}>Resume</Button> : null}
                {item.actions.includes('open') && item.groupId ? <Button size="small" variant="text" onClick={() => navToGroup(item.groupId!)}>Open</Button> : null}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Your groups</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Chip size="small" clickable label="All" color={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')} />
          <Chip size="small" clickable label="Active" color={filter === 'active' ? 'success' : 'default'} onClick={() => setFilter('active')} />
          <Chip size="small" clickable label="Invited" color={filter === 'invited' ? 'warning' : 'default'} onClick={() => setFilter('invited')} />
        </Stack>
        {loadingGroups ? <Typography color="text.secondary">Loading…</Typography> : null}
        {groupsError ? <Typography color="error" variant="body2">{groupsError}</Typography> : null}
        {!loadingGroups && !groupsError && groups.length > 0 ? (
          <Stack spacing={1.25}>
            {groups.map((group) => (
              <Stack
                key={group.groupId}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => navToGroup(group.groupId)}
                sx={{ py: 0.75, borderBottom: '1px solid', borderBottomColor: 'divider', '&:last-of-type': { borderBottom: 'none' }, cursor: 'pointer' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{group.groupName}</Typography>
                  <Typography color="text.secondary" variant="body2">{group.memberCountActive} members · {group.appointmentCountUpcoming} upcoming</Typography>
                  <Typography color="text.secondary" variant="caption">Updated {new Date(group.updatedAt).toLocaleString()}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" onClick={(event) => event.stopPropagation()}>
                  <Chip size="small" label={group.myStatus === 'active' ? 'Active' : 'Invited'} color={group.myStatus === 'active' ? 'success' : 'warning'} />
                  {group.myStatus === 'invited' ? (
                    <>
                      <Button variant="contained" size="small" onClick={() => { void handleAccept(group.groupId); }}>Accept</Button>
                      <Button variant="outlined" color="warning" size="small" onClick={() => { void handleDecline(group.groupId); }}>Decline</Button>
                    </>
                  ) : null}
                  <Button
                    variant="contained"
                    size="small"
                    disabled={Boolean(isSpinningOffGroupId)}
                    onClick={() => { void createBreakoutGroup(group.groupId); }}
                  >
                    {isSpinningOffGroupId === group.groupId ? 'Breaking Out…' : 'Break Out'}
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : null}
        {!loadingGroups && !groupsError && groups.length === 0 ? <Typography color="text.secondary">No groups yet.</Typography> : null}
      </Box>

      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Typography variant="body2" color="text.secondary">
          AI today: {dashboard?.usageToday ? `${dashboard.usageToday.openaiCalls} calls (${dashboard.usageToday.tokensIn}/${dashboard.usageToday.tokensOut})` : 'No usage'}
        </Typography>
        <Typography variant="body2" sx={{ color: dashboard?.health.ok ? 'success.main' : 'error.main' }}>
          Health: {dashboard?.health.ok ? `ok (${new Date(dashboard.health.time).toLocaleTimeString()})` : 'down'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Month: {dashboard?.monthSummary ? `${dashboard.monthSummary.newGroups} groups · ${dashboard.monthSummary.newAppointments} appointments · ${dashboard.monthSummary.invitesSent} invites sent · ${dashboard.monthSummary.invitesAccepted} invites accepted` : 'No metrics yet'}
        </Typography>
      </Box>
    </Stack>
  );
}
