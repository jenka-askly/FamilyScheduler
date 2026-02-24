import { Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import { Page } from './layout/Page';

type ProductHomePageProps = {
  onCreateGroup: () => void;
  onSignIn: () => void;
};

const features = [
  {
    title: 'Breakout Sessions',
    description: 'Create temporary breakout spaces inside a group. Share a link and track who joins.'
  },
  {
    title: 'AI Scan',
    description: 'Capture schedules or notes and turn them into structured group events.'
  },
  {
    title: 'Smart Group Coordination',
    description: 'Keep people aligned with clear group context and lightweight planning tools.'
  }
];

const steps = ['Create a group', 'Share the link', 'Coordinate in one place'];

export function ProductHomePage({ onCreateGroup, onSignIn }: ProductHomePageProps) {
  return (
    <Page variant="form">
      <Stack spacing={5} sx={{ px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 7 } }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="overline" color="text.secondary">Yapper</Typography>
          <Typography variant="h3">Coordinate groups without the chaos.</Typography>
          <Typography color="text.secondary" maxWidth={700}>
            Create shared spaces for planning, breakout sessions, and fast scheduling — all from a single link.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" onClick={onCreateGroup}>Create a group</Button>
            <Button variant="outlined" onClick={onSignIn}>Sign in</Button>
          </Stack>
        </Stack>

        <Divider />

        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Features</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {features.map((feature) => (
              <Box key={feature.title} sx={{ flex: 1, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{feature.title}</Typography>
                <Typography variant="body2" color="text.secondary">{feature.description}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>How it works</Typography>
          <Stack spacing={1.5}>
            {steps.map((step, index) => (
              <Typography key={step} color="text.secondary">{index + 1}) {step}</Typography>
            ))}
          </Stack>
        </Box>

        <Divider />

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Link component="button" type="button" underline="hover">Privacy</Link>
          <Link component="button" type="button" underline="hover">Terms</Link>
          <Link component="button" type="button" underline="hover">Contact</Link>
        </Stack>
      </Stack>
    </Page>
  );
}
