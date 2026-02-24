import React, { useEffect, useState } from 'react';
import { Alert, Box, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, SvgIcon, Switch, Tooltip, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useColorMode } from '../../colorMode';
import { PRODUCT } from '../../product';

const ContentCopyIcon = () => (
  <SvgIcon fontSize="small">
    <path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
  </SvgIcon>
);

type Props = {
  title?: string;
  description?: string;
  groupName?: string;
  groupId?: string;
  memberNames?: string[];
  groupAccessNote?: string;
  onMembersClick?: () => void;
  showGroupAccessNote?: boolean;
  onBreakoutClick?: () => void;
  breakoutDisabled?: boolean;
};

export function PageHeader({ title, description, groupName, groupId, memberNames, groupAccessNote, onMembersClick, showGroupAccessNote = true, onBreakoutClick, breakoutDisabled = false }: Props) {
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
  const normalizedGroupName = groupName?.trim();
  const shortGroupId = groupId ? groupId.slice(0, 8) : undefined;
  const displayGroupTitle = normalizedGroupName
    ? normalizedGroupName
    : shortGroupId
      ? `Group ${shortGroupId}`
      : title;
  const hasMembersAction = typeof onMembersClick === 'function';

  const handleMembersKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMembersAction) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onMembersClick();
  };

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>{PRODUCT.name}</Typography>
      <Paper>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" sx={{ opacity: 0.8, display: 'block', lineHeight: 1.2 }}>
              Group
            </Typography>
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
            <Tooltip title="Menu">
              <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Menu">
                <MenuIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {onBreakoutClick ? (
            <MenuItem
              sx={{ fontWeight: 600 }}
              disabled={breakoutDisabled}
              onClick={() => {
                setAnchorEl(null);
                onBreakoutClick();
              }}
            >
              <ListItemIcon>
                <RocketLaunchIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Breakout Session"
                secondary={<Typography variant="body2" color="text.secondary">Create a live coordination session</Typography>}
              />
            </MenuItem>
          ) : null}
          {onBreakoutClick ? <Divider /> : null}
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
      </Paper>
      {title ? <Typography variant="h6">{title}</Typography> : null}
      {description ? <Typography color="text.secondary">{description}</Typography> : null}
      {groupId && showGroupAccessNote ? <Typography variant="body2" color="text.secondary">{groupAccessNote ?? 'Only listed phone numbers can access this group.'}</Typography> : null}
      {copied ? <Alert severity="success">Copied</Alert> : null}
    </Stack>
  );
}
