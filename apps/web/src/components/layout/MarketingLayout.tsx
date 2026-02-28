import { ReactNode, useState } from 'react';
import { Box, Button, Container, IconButton, Link, Menu, MenuItem, Stack, Switch, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useColorMode } from '../../colorMode';
import { buildInfo } from '../../lib/buildInfo';
import yapperIcon from '../../assets/yapper-icon.svg';

type MarketingLayoutProps = {
  children: ReactNode;
  hasApiSession?: boolean;
  sessionEmail?: string | null;
  sessionName?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  emailUpdatesEnabled?: boolean | null;
  prefsLoading?: boolean;
  prefsSaving?: boolean;
  prefsError?: string | null;
  onToggleEmailUpdates?: (next: boolean) => void | Promise<void>;
};

export function MarketingLayout({ children, hasApiSession = false, sessionEmail, sessionName, onSignIn, onSignOut, emailUpdatesEnabled = null, prefsLoading = false, prefsSaving = false, prefsError = null, onToggleEmailUpdates }: MarketingLayoutProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleMode } = useColorMode();
  const buildVersion = (typeof buildInfo.sha === 'string' ? buildInfo.sha.trim() : '').slice(0, 7) || 'dev';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: { xs: '#f8fafc', md: '#f7f9fd' }, display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 7, md: 10 }, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 4, md: 7 } }}>
          <Box>
            <Stack direction="row" spacing={0} alignItems="center">
              <Box
                component="img"
                src={yapperIcon}
                alt="Yapper"
                sx={{ width: 'auto', height: '1em', mr: '0.3em', verticalAlign: 'middle', transform: 'translateY(1px)' }}
              />
              <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main', lineHeight: 1 }}>
                Yapper
              </Typography>
            </Stack>
            {!hasApiSession ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                The friendlier way to move plans forward.
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {!hasApiSession && onSignIn ? (
              <Button variant="text" onClick={onSignIn} sx={{ fontWeight: 600 }}>
                Sign in
              </Button>
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
          <Stack direction="row" spacing={3} justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={3}>
              <Link href="#/privacy" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Privacy</Link>
              <Link href="#/terms" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Terms</Link>
              <Link href="#/contact" underline="hover" color="text.secondary" sx={{ fontSize: 14 }}>Contact</Link>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              Build {buildVersion}
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {!hasApiSession && onSignIn ? (
          <MenuItem onClick={() => { setAnchorEl(null); onSignIn(); }}>
            <Typography>Sign in</Typography>
          </MenuItem>
        ) : null}
        {hasApiSession ? (
          <MenuItem disabled>
            <Typography>{sessionName ? `Signed in as ${sessionName}${sessionEmail ? ` (${sessionEmail})` : ''}` : sessionEmail ? `Signed in as ${sessionEmail}` : 'Signed in'}</Typography>
          </MenuItem>
        ) : null}
        {hasApiSession && typeof onToggleEmailUpdates === 'function' ? (
          <MenuItem>
            <Stack direction="column" spacing={0.5} sx={{ width: '100%' }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <Typography>Receive appointment update emails</Typography>
                <Switch
                  checked={Boolean(emailUpdatesEnabled)}
                  disabled={prefsLoading || prefsSaving || emailUpdatesEnabled === null}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(_event, checked) => { void onToggleEmailUpdates(checked); }}
                  inputProps={{ 'aria-label': 'Receive appointment update emails' }}
                />
              </Stack>
              {prefsError ? <Typography variant="caption" color="error">{prefsError}</Typography> : null}
            </Stack>
          </MenuItem>
        ) : null}
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
        {hasApiSession && onSignOut ? (
          <MenuItem onClick={() => { setAnchorEl(null); onSignOut(); }}>
            <Typography>Sign out</Typography>
          </MenuItem>
        ) : null}
      </Menu>
    </Box>
  );
}
