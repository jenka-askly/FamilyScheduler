import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { Box, Button, Stack, Typography } from '@mui/material';

type ProductHomePageProps = {
  onSignIn: () => void;
};

const features = [
  {
    title: 'Breakout Sessions',
    description: 'Spin up focused moments for smaller conversations without leaving your main planning flow.',
    icon: Groups2OutlinedIcon
  },
  {
    title: 'AI Scan',
    description: 'Snap notes or schedules and instantly turn them into clean, shareable plans your group can act on.',
    icon: AutoAwesomeOutlinedIcon
  },
  {
    title: 'Smart Group Coordination',
    description: 'Keep people aligned with one living space that tracks decisions and keeps momentum going.',
    icon: HubOutlinedIcon
  }
];

const steps = [
  {
    title: 'Create a shared space',
    body: 'Turn an idea into something real your group can see and join.'
  },
  {
    title: 'Bring everyone together',
    body: 'One link connects everyone in the same place, instantly.'
  },
  {
    title: 'Keep things moving',
    body: 'Plan, break out, and capture what matters without losing the thread.'
  }
];

export function ProductHomePage({ onSignIn }: ProductHomePageProps) {
  return (
    <Stack spacing={{ xs: 7, md: 9 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 4, md: 6 }} alignItems="stretch">
        <Stack spacing={2.2} sx={{ flex: 1.15, pt: { md: 2 } }}>
          <Typography variant="overline" sx={{ color: '#d97706', fontWeight: 700, letterSpacing: '0.08em' }}>Gather. Decide. Move.</Typography>
          <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', maxWidth: 650, fontSize: { xs: '2.2rem', md: '3rem' } }}>
            Plan together without the scheduling spiral.
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 620, fontSize: { xs: '1rem', md: '1.08rem' } }}>
            Yapper gives your people one clear place to create plans, run quick breakout moments, and keep progress visible. No password—get a sign-in link by email.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" onClick={onSignIn} sx={{ px: 2.5, py: 1.1, transition: 'transform 140ms ease, box-shadow 140ms ease', '&:hover': { transform: 'translateY(-1px)' } }}>
              Sign in with email
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            flex: 0.85,
            minHeight: { xs: 220, md: 300 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 14px 30px rgba(15,23,42,0.07)',
            transform: { md: 'translateY(10px)' }
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(79,111,191,0.20), transparent 55%), radial-gradient(circle at 80% 70%, rgba(217,119,6,0.12), transparent 46%)' }} />
          <Box sx={{ position: 'absolute', top: '16%', left: '13%', width: '56%', height: '30%', bgcolor: 'rgba(255,255,255,0.78)', border: '1px solid rgba(79,111,191,0.16)', borderRadius: 3, boxShadow: '0 8px 18px rgba(15,23,42,0.07)' }} />
          <Box sx={{ position: 'absolute', bottom: '14%', right: '12%', width: '44%', height: '26%', bgcolor: 'rgba(255,255,255,0.88)', border: '1px solid rgba(79,111,191,0.22)', borderRadius: 3, boxShadow: '0 8px 18px rgba(15,23,42,0.08)' }} />
          <Box sx={{ position: 'absolute', top: '58%', left: '22%', width: 10, height: 10, borderRadius: '50%', bgcolor: 'rgba(217,119,6,0.65)' }} />
        </Box>
      </Stack>


      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Stack spacing={1.25} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Passwordless sign-in</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            Enter your email and we’ll send a secure sign-in link (a ‘magic link’). No password to remember.
          </Typography>
          <Typography variant="caption" color="text.secondary">Links expire quickly for safety.</Typography>
          <Button size="small" variant="outlined" onClick={onSignIn}>Send me a sign-in link</Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="h5" sx={{ mb: 2.6, fontWeight: 700 }}>Bring your group together in three steps</Typography>
        <Stack spacing={1.8}>
          {steps.map((step, index) => (
            <Box key={step.title} sx={{ p: 2.2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
                {index + 1}. {step.title}
              </Typography>
              <Typography color="text.secondary">{step.body}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 700 }}>Features</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Box
                key={feature.title}
                sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  p: 2.2,
                  bgcolor: 'background.paper',
                  transition: 'transform 160ms ease, box-shadow 160ms ease',
                  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(15,23,42,0.08)' }
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Icon sx={{ color: '#d97706', fontSize: 19 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{feature.title}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">{feature.description}</Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}
