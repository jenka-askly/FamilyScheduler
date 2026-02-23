import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material';
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
            <Button variant="outlined" onClick={toggleMode}>{mode === 'light' ? 'Dark' : 'Light'} mode</Button>
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
