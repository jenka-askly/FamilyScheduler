import { Box, Button, Stack, Typography } from '@mui/material';

type DashboardHomePageProps = {
  signedInLabel?: string;
  onCreateGroup: () => void;
  onOpenRecentGroup?: () => void;
  hasRecentGroup: boolean;
};

export function DashboardHomePage({ signedInLabel = 'Signed in', onCreateGroup, onOpenRecentGroup, hasRecentGroup }: DashboardHomePageProps) {
  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Welcome back</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{signedInLabel}</Typography>
      </Box>

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
        <Typography color="text.secondary">Coming soon: see and manage all groups you’re part of.</Typography>
      </Box>
    </Stack>
  );
}
