import React, { useEffect, useState } from 'react';
import { Alert, Box, IconButton, Menu, MenuItem, Paper, Stack, SvgIcon, Switch, Tooltip, Typography } from '@mui/material';
import { useColorMode } from '../../colorMode';

const ContentCopyIcon = () => (
  <SvgIcon fontSize="small">
    <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
  </SvgIcon>
);

const MoreVertIcon = () => (
  <SvgIcon>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </SvgIcon>
);

type Props = {
  title: string;
  description?: string;
  groupName?: string;
  groupId?: string;
  memberNames?: string[];
  groupAccessNote?: string;
  onMembersClick?: () => void;
  showGroupAccessNote?: boolean;
  breakoutAction?: React.ReactNode;
};

export function PageHeader({ title, description, groupName, groupId, memberNames, groupAccessNote, onMembersClick, showGroupAccessNote = true, breakoutAction }: Props) {
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

  const memberCount = memberNames?.length ?? 0;
  const membersSummary = memberCount > 0 ? `${memberCount} members • ${memberNames?.join(', ') ?? ''}` : '0 members';
  const displayGroupTitle = groupId ? `Group ${groupId}` : (groupName ?? title);
  const hasMembersAction = typeof onMembersClick === 'function';

  const handleMembersKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMembersAction) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onMembersClick();
  };

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Paper>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="h5">{displayGroupTitle}</Typography>
              {groupId ? (
                <Tooltip title="Copy group link">
                  <IconButton size="small" onClick={() => void copyGroupLink()} aria-label="Copy group link">
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
            <Box
              component="div"
              role={hasMembersAction ? 'button' : undefined}
              tabIndex={hasMembersAction ? 0 : undefined}
              aria-label={hasMembersAction ? `View members (${memberCount})` : undefined}
              onClick={hasMembersAction ? onMembersClick : undefined}
              onKeyDown={handleMembersKeyDown}
              sx={{
                mt: 0.25,
                borderRadius: 1,
                cursor: hasMembersAction ? 'pointer' : 'default',
                '&:hover': hasMembersAction ? { textDecoration: 'underline' } : undefined,
                '&:focus-visible': hasMembersAction ? { outline: '2px solid', outlineColor: 'primary.main' } : undefined
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {membersSummary}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="More">
              <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="More">
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
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
          {breakoutAction ? <MenuItem onClick={() => setAnchorEl(null)}>{breakoutAction}</MenuItem> : null}
        </Menu>
      </Paper>
      <Typography variant="h6">{title}</Typography>
      {description ? <Typography color="text.secondary">{description}</Typography> : null}
      {groupId && showGroupAccessNote ? <Typography variant="body2" color="text.secondary">{groupAccessNote ?? 'Only listed phone numbers can access this group.'}</Typography> : null}
      {copied ? <Alert severity="success">Copied</Alert> : null}
    </Stack>
  );
}
