import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { spinoffBreakoutGroup } from '../lib/ignite/spinoffBreakout';

type DashboardHomePageProps = {
  signedInLabel?: string;
  onCreateGroup: () => void;
  onOpenRecentGroup?: () => void;
  recentGroupId?: string;
  phone?: string;
};

export function DashboardHomePage({ signedInLabel = 'Signed in', onCreateGroup, onOpenRecentGroup, recentGroupId, phone }: DashboardHomePageProps) {
  const [isSpinningOffGroupId, setIsSpinningOffGroupId] = useState<string | null>(null);
  const [breakoutNotice, setBreakoutNotice] = useState<string | null>(null);
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const hasRecentGroup = Boolean(recentGroupId);
  const groups = recentGroupId ? [recentGroupId] : [];

  const createBreakoutGroup = async (groupId: string) => {
    if (!phone || isSpinningOffGroupId) return;
    setBreakoutError(null);
    setIsSpinningOffGroupId(groupId);
    try {
      const result = await spinoffBreakoutGroup({ sourceGroupId: groupId, phone });
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
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Welcome back</Typography>
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
        {groups.length > 0 ? (
          <Stack spacing={1.25}>
            {groups.map((groupId) => (
              <Stack
                key={groupId}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ py: 0.5, borderBottom: '1px solid', borderBottomColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}
              >
                <Typography color="text.secondary">{groupId}</Typography>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!phone || Boolean(isSpinningOffGroupId)}
                  onClick={() => { void createBreakoutGroup(groupId); }}
                >
                  {isSpinningOffGroupId === groupId ? 'Breaking Out…' : 'Break Out'}
                </Button>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No groups yet.</Typography>
        )}
      </Box>
    </Stack>
  );
}
