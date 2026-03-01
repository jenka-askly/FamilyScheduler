import { ReactNode, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Link, Menu, MenuItem, Snackbar, Stack, Switch, TextField, Typography } from '@mui/material';
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
  onSeedDemoData?: (config: { groupCount: number; apptsPerGroup: number; membersPerAppt: number }) => Promise<{ ok: boolean; message: string }>;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function MarketingLayout({ children, hasApiSession = false, sessionEmail, sessionName, onSignIn, onSignOut, emailUpdatesEnabled = null, prefsLoading = false, prefsSaving = false, prefsError = null, onToggleEmailUpdates, onSeedDemoData }: MarketingLayoutProps) {
  const enableDebugMenu = import.meta.env.DEV || import.meta.env.VITE_DOGFOOD === '1';
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [groupCount, setGroupCount] = useState(5);
  const [apptsPerGroup, setApptsPerGroup] = useState(6);
  const [membersPerAppt, setMembersPerAppt] = useState(4);
  const [seedingDemoData, setSeedingDemoData] = useState(false);
  const [seedNotice, setSeedNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const { mode, toggleMode } = useColorMode();
  const buildVersion = (typeof buildInfo.sha === 'string' ? buildInfo.sha.trim() : '').slice(0, 7) || 'dev';

  const submitSeedDemoData = async () => {
    if (!onSeedDemoData || seedingDemoData) return;
    setSeedingDemoData(true);
    try {
      const result = await onSeedDemoData({
        groupCount: clamp(groupCount, 1, 8),
        apptsPerGroup: clamp(apptsPerGroup, 1, 20),
        membersPerAppt: clamp(membersPerAppt, 0, 8)
      });
      if (!result.ok) {
        setSeedNotice({ severity: 'error', message: result.message });
        return;
      }
      setSeedDialogOpen(false);
      setSeedNotice({ severity: 'success', message: result.message });
    } catch {
      setSeedNotice({ severity: 'error', message: 'Unable to seed demo data right now.' });
    } finally {
      setSeedingDemoData(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: { xs: '#f8fafc', md: '#f7f9fd' }, display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 7, md: 10 }, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: { xs: 4, md: 7 } }}>
          <Box>
            <Stack direction="row" alignItems="center" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Box
                component="img"
                src={yapperIcon}
                alt="Yapper"
                sx={{ width: 28, height: 28, flex: '0 0 28px', display: 'block', transform: 'translateY(1px)' }}
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
              <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
                <Typography>Receive appointment update emails</Typography>
                <Switch
                  checked={Boolean(emailUpdatesEnabled)}
                  disabled={prefsLoading || prefsSaving || emailUpdatesEnabled === null}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(_event, checked) => { void onToggleEmailUpdates(checked); }}
                  inputProps={{ 'aria-label': 'Receive appointment update emails' }}
                  sx={{ ml: 'auto' }}
                />
              </Stack>
              {prefsError ? <Typography variant="caption" color="error">{prefsError}</Typography> : null}
            </Stack>
          </MenuItem>
        ) : null}
        <MenuItem>
          <Stack direction="row" alignItems="center" sx={{ width: '100%' }}>
            <Typography>Dark mode</Typography>
            <Switch
              checked={mode === 'dark'}
              onClick={(event) => event.stopPropagation()}
              onChange={() => toggleMode()}
              inputProps={{ 'aria-label': 'Toggle dark mode' }}
              sx={{ ml: 'auto' }}
            />
          </Stack>
        </MenuItem>
        {hasApiSession && onSignOut ? (
          <MenuItem onClick={() => { setAnchorEl(null); onSignOut(); }}>
            <Typography>Sign out</Typography>
          </MenuItem>
        ) : null}
        {enableDebugMenu && hasApiSession && onSeedDemoData ? <Divider sx={{ my: 0.5 }} /> : null}
        {enableDebugMenu && hasApiSession && onSeedDemoData ? (
          <MenuItem onClick={() => { setAnchorEl(null); setSeedDialogOpen(true); }}>
            <Typography>Seed demo data…</Typography>
          </MenuItem>
        ) : null}
      </Menu>

      <Dialog open={seedDialogOpen} onClose={() => { if (!seedingDemoData) setSeedDialogOpen(false); }} fullWidth maxWidth="xs">
        <DialogTitle>Seed demo data</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              type="number"
              label="Groups"
              value={groupCount}
              onChange={(event) => setGroupCount(clamp(Number(event.target.value), 1, 8))}
              inputProps={{ min: 1, max: 8 }}
              disabled={seedingDemoData}
            />
            <TextField
              type="number"
              label="Appts per group"
              value={apptsPerGroup}
              onChange={(event) => setApptsPerGroup(clamp(Number(event.target.value), 1, 20))}
              inputProps={{ min: 1, max: 20 }}
              disabled={seedingDemoData}
            />
            <TextField
              type="number"
              label="Members per appt"
              value={membersPerAppt}
              onChange={(event) => setMembersPerAppt(clamp(Number(event.target.value), 0, 8))}
              inputProps={{ min: 0, max: 8 }}
              disabled={seedingDemoData}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeedDialogOpen(false)} disabled={seedingDemoData}>Cancel</Button>
          <Button variant="contained" onClick={() => { void submitSeedDemoData(); }} disabled={seedingDemoData} startIcon={seedingDemoData ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {seedingDemoData ? 'Seeding…' : 'Create/Update demo data'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(seedNotice)} autoHideDuration={3500} onClose={() => setSeedNotice(null)}>
        <Alert severity={seedNotice?.severity ?? 'success'} onClose={() => setSeedNotice(null)} sx={{ width: '100%' }}>
          {seedNotice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
