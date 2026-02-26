import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { Box, Link, Stack, Typography } from '@mui/material';

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
    title: 'Start with everyone in one place',
    body: 'Invite your group and get aligned fast.'
  },
  {
    title: 'Make real decisions',
    body: 'Stop the endless back-and-forth.'
  },
  {
    title: 'Keep everything in one place',
    body: 'Group calendar, shared to-dos, updates — all together.'
  }
];

export function ProductHomePage({ onSignIn }: ProductHomePageProps) {
  return (
    <Stack spacing={{ xs: 7, md: 9 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 4, md: 6 }} alignItems="stretch">
        <Stack spacing={2.2} sx={{ flex: 1.15, pt: { md: 2 } }}>
          <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', maxWidth: 650, fontSize: { xs: '2.2rem', md: '3rem' } }}>
            Plan together without the scheduling spiral.
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 620, fontSize: { xs: '1rem', md: '1.08rem' } }}>
            Yapper gives your people one clear place to create plans, run quick breakout moments, and keep progress visible.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in with your email. We&apos;ll send a secure link — no password required.{' '}
            <Link component="button" type="button" underline="hover" color="inherit" onClick={onSignIn} sx={{ fontWeight: 600 }}>
              Try it now
            </Link>
          </Typography>
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
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, #eef3ff 0%, #f8fbff 58%, #fff9ef 100%)' }} />
          <Box sx={{ position: 'absolute', top: '12%', left: '8%', width: '36%', height: '76%', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(79,111,191,0.18)', boxShadow: '0 10px 22px rgba(15,23,42,0.08)' }}>
            <Box sx={{ p: 1.25, borderBottom: '1px solid rgba(79,111,191,0.10)' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12, color: 'rgba(15,23,42,0.88)' }}>Who&apos;s in</Typography>
            </Box>
            <Stack spacing={1.1} sx={{ p: 1.25 }}>
              {[0, 1, 2].map((item) => (
                <Stack key={item} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: item === 1 ? '#d97706' : '#4f6fbf', opacity: 0.8 }} />
                  <Box sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: 'rgba(15,23,42,0.14)' }} />
                </Stack>
              ))}
            </Stack>
          </Box>
          <Box sx={{ position: 'absolute', bottom: '11%', right: '8%', width: '47%', height: '58%', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.97)', border: '1px solid rgba(79,111,191,0.20)', boxShadow: '0 12px 22px rgba(15,23,42,0.10)', p: 1.4 }}>
            <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 1.1, borderRadius: 2, border: '2px solid rgba(15,23,42,0.18)', background: 'linear-gradient(135deg, #1f2937 25%, #fff 25%, #fff 50%, #1f2937 50%, #1f2937 75%, #fff 75%)', backgroundSize: '12px 12px' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 12, textAlign: 'center', mb: 0.6 }}>Break Out</Typography>
            <Box sx={{ width: '74%', height: 8, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(79,111,191,0.22)', mb: 0.8 }} />
            <Box sx={{ width: '58%', height: 8, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(217,119,6,0.24)' }} />
          </Box>
        </Box>
      </Stack>

      <Box>
        <Typography variant="overline" sx={{ mb: 0.8, display: 'block', color: 'text.secondary', letterSpacing: '0.1em', fontWeight: 700 }}>How it works</Typography>
        <Typography variant="h5" sx={{ mb: 2.6, fontWeight: 700 }}>Bring your group together in three steps</Typography>
        <Stack spacing={1.8}>
          {steps.map((step, index) => (
            <Box key={step.title} sx={{ p: 2.2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.35, fontSize: { xs: '1rem', md: '1.05rem' } }}>
                {index + 1}. {step.title}
              </Typography>
              <Typography color="text.secondary" variant="body2">{step.body}</Typography>
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
