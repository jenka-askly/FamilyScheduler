import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton, Menu, MenuItem, Paper, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { useColorMode } from '../../colorMode';

type Props = {
  title: string;
  description?: string;
  groupName?: string;
  groupId?: string;
  memberNames?: string[];
  groupAccessNote?: string;
  breakoutAction?: React.ReactNode;
};

export function PageHeader({ title, description, groupName, groupId, memberNames, groupAccessNote, breakoutAction }: Props) {
  const [copied, setCopied] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleMode } = useColorMode();

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyGroupLink = async () => {
    if (!groupId || typeof window === 'undefined') return;
    const shareLink = window.location.href || `${window.location.origin}/#/g/${groupId}/app`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const visibleMembers = (memberNames ?? []).slice(0, 4);
  const remainingMemberCount = Math.max(0, (memberNames ?? []).length - visibleMembers.length);

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Paper>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Typography variant="overline">Group</Typography>
            <Typography variant="h5">{groupName ?? title}</Typography>
            {visibleMembers.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                {visibleMembers.join(', ')}{remainingMemberCount > 0 ? ` +${remainingMemberCount}` : ''}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
              <IconButton onClick={toggleMode} aria-label={mode === 'light' ? 'Dark mode' : 'Light mode'}>
                {mode === 'light' ? (
                  <SvgIcon>
                    <path d="M21 12.79A9 9 0 0 1 11.21 3a1 1 0 0 0-1.42 1.08A7 7 0 1 0 19.92 14.2a1 1 0 0 0 1.08-1.41z" />
                  </SvgIcon>
                ) : (
                  <SvgIcon>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2.5a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2A.75.75 0 0 1 12 2.5zm0 16.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75zM3.25 11.25h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5zm15.5 0h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5zM5.64 4.58a.75.75 0 0 1 1.06 0l1.42 1.41a.75.75 0 0 1-1.06 1.06L5.64 5.64a.75.75 0 0 1 0-1.06zm10.24 10.24a.75.75 0 0 1 1.06 0l1.41 1.42a.75.75 0 0 1-1.06 1.06l-1.41-1.42a.75.75 0 0 1 0-1.06zM5.64 19.42a.75.75 0 0 1 0-1.06l1.41-1.42a.75.75 0 1 1 1.06 1.06L6.7 19.42a.75.75 0 0 1-1.06 0zm10.24-10.24a.75.75 0 0 1 0-1.06l1.41-1.41a.75.75 0 1 1 1.06 1.06l-1.41 1.41a.75.75 0 0 1-1.06 0z" />
                  </SvgIcon>
                )}
              </IconButton>
            </Tooltip>
            {groupId ? <Button variant="outlined" onClick={() => void copyGroupLink()}>Copy group link</Button> : null}
            {breakoutAction ? <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>⋯</IconButton> : null}
          </Stack>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => setAnchorEl(null)}>{breakoutAction}</MenuItem>
        </Menu>
      </Paper>
      <Typography variant="h6">{title}</Typography>
      {description ? <Typography color="text.secondary">{description}</Typography> : null}
      {groupId ? <Typography variant="body2" color="text.secondary">{groupAccessNote ?? 'Only listed phone numbers can access this group.'}</Typography> : null}
      {copied ? <Alert severity="success">Copied</Alert> : null}
    </Stack>
  );
}
