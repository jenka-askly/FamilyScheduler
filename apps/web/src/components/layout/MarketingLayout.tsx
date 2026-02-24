import { ReactNode, useState } from 'react';
import { Box, Container, IconButton, Link, Menu, MenuItem, Stack, Switch, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useColorMode } from '../../colorMode';

type MarketingLayoutProps = {
  children: ReactNode;
  onSignIn?: () => void;
};

export function MarketingLayout({ children, onSignIn }: MarketingLayoutProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleMode } = useColorMode();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: { xs: '#f8fafc', md: '#f7f9fd' }, display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 7, md: 10 }, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 4, md: 7 } }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main', lineHeight: 1 }}>
              Yapper
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              The friendlier way to move plans forward.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {onSignIn ? (
              <Link component="button" type="button" underline="hover" color="text.secondary" onClick={onSignIn} sx={{ fontWeight: 500 }}>
                Sign in
              </Link>
            ) : null}
            <IconButton aria-label="Utilities" onClick={(event) => setAnchorEl(event.currentTarget)}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Box>{children}</Box>
      </Container>

      <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Stack direction="row" spacing={3}>
            <Link href="#/privacy" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Privacy</Link>
            <Link href="#/terms" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Terms</Link>
            <Link href="#/contact" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Contact</Link>
          </Stack>
        </Container>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
            <Typography>Dark mode</Typography>
            <Switch
              checked={mode === 'dark'}
              onClick={(event) => event.stopPropagation()}
              onChange={() => toggleMode()}
              inputProps={{ 'aria-label': 'Toggle dark mode' }}
            />
          </Stack>
        </MenuItem>
      </Menu>
    </Box>
  );
}
