import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { spinoffBreakoutGroup } from '../lib/ignite/spinoffBreakout';
import { apiFetch } from '../lib/apiUrl';

type DashboardHomePageProps = {
  signedInLabel?: string;
  onCreateGroup: () => void;
  onOpenRecentGroup?: () => void;
  recentGroupId?: string;
};

type MeGroup = {
  groupId: string;
  groupName: string;
  myStatus: 'active' | 'invited';
};

export function DashboardHomePage({ signedInLabel = 'Signed in', onCreateGroup, onOpenRecentGroup, recentGroupId }: DashboardHomePageProps) {
  const [isSpinningOffGroupId, setIsSpinningOffGroupId] = useState<string | null>(null);
  const [breakoutNotice, setBreakoutNotice] = useState<string | null>(null);
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MeGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const hasRecentGroup = Boolean(recentGroupId);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingGroups(true);
      setGroupsError(null);
      try {
        const response = await apiFetch('/api/me/groups');
        if (!response.ok) {
          if (!cancelled) setGroupsError('Unable to load groups right now.');
          return;
        }
        const payload = await response.json() as { groups?: MeGroup[] };
        if (!cancelled) setGroups(Array.isArray(payload.groups) ? payload.groups : []);
      } catch {
        if (!cancelled) setGroupsError('Unable to load groups right now.');
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    void run();
    return () => { cancelled = true; };
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
        {hasRecentGroup ? (
          <Typography color="text.secondary">Continue where you left off.</Typography>
        ) : (
          <Typography color="text.secondary">No recent groups yet.</Typography>
        )}
      </Box>

      <Box sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Your groups</Typography>
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
                sx={{ py: 0.5, borderBottom: '1px solid', borderBottomColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{group.groupName}</Typography>
                  <Typography color="text.secondary" variant="body2">{group.groupId}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={group.myStatus === 'active' ? 'Active' : 'Invited'} color={group.myStatus === 'active' ? 'success' : 'warning'} />
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
    </Stack>
  );
}
