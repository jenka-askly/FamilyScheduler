import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiUrl';
import { deleteGroup } from '../lib/groupApi';

type DashboardHomePageProps = {
  onCreateGroup: () => void;
};

type DashboardGroup = {
  groupId: string;
  groupName: string;
  myStatus: 'active' | 'invited';
  invitedAt: string | null;
  joinedAt: string | null;
  removedAt: string | null;
  updatedAt: string;
  memberCountActive: number;
  memberCountInvited: number;
  appointmentCountUpcoming: number;
};

type DashboardPayload = {
  traceId: string;
  groups: DashboardGroup[];
};

const navToGroup = (groupId: string): void => {
  window.location.hash = `/g/${groupId}/app`;
};

export function DashboardHomePage({ onCreateGroup }: DashboardHomePageProps) {
  const [isBreakingOut, setIsBreakingOut] = useState(false);
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuGroup, setMenuGroup] = useState<DashboardGroup | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<DashboardGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const loadDashboard = async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const response = await apiFetch('/api/me/dashboard');
      if (!response.ok) {
        setGroupsError('Unable to load dashboard right now.');
        return;
      }
      const payload = await response.json() as DashboardPayload;
      setDashboard(payload);
    } catch {
      setGroupsError('Unable to load dashboard right now.');
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const createBreakoutGroup = async () => {
    if (isBreakingOut) return;
    setBreakoutError(null);
    setIsBreakingOut(true);
    try {
      const creatorName = window.localStorage.getItem('fs.sessionName')?.trim();
      const creatorEmail = window.localStorage.getItem('fs.sessionEmail')?.trim();
      if (!creatorEmail) {
        setBreakoutError('Missing signed-in email. Please sign in again and retry.');
        return;
      }
      const response = await apiFetch('/api/group/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupName: `Break Out ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
          creatorEmail,
          creatorName: creatorName || creatorEmail
        })
      });
      const data = await response.json() as { groupId?: string; message?: string; traceId?: string };
      if (!response.ok || !data.groupId) {
        setBreakoutError(`${data.message ?? 'Unable to break out right now.'}${data.traceId ? ` (trace: ${data.traceId})` : ''}`);
        return;
      }
      window.location.hash = `/g/${data.groupId}/ignite`;
    } catch {
      setBreakoutError('Unable to break out right now.');
    } finally {
      setIsBreakingOut(false);
    }
  };

  const groups = useMemo(() => dashboard?.groups ?? [], [dashboard?.groups]);

  const handleAccept = async (groupId: string) => {
    await apiFetch('/api/group/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId }) });
    await loadDashboard();
  };

  const handleDecline = async (groupId: string) => {
    await apiFetch('/api/group/decline', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId }) });
    await loadDashboard();
  };

  const handleMenuOpen = (event: MouseEvent<HTMLElement>, group: DashboardGroup) => {
    event.preventDefault();
    event.stopPropagation();
    setGroupsError(null);
    setMenuAnchorEl(event.currentTarget);
    setMenuGroup(group);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuGroup(null);
  };

  const handleDeleteClick = () => {
    setConfirmDeleteGroup(menuGroup);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteGroup || isDeletingGroup) return;
    setIsDeletingGroup(true);
    setGroupsError(null);
    try {
      const response = await deleteGroup(confirmDeleteGroup.groupId);
      if (!response.ok) {
        setGroupsError(response.message ?? 'Unable to delete group right now.');
        return;
      }
      setConfirmDeleteGroup(null);
      await loadDashboard();
    } catch {
      setGroupsError('Unable to delete group right now.');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      {breakoutError ? <Alert severity="error" onClose={() => setBreakoutError(null)}>{breakoutError}</Alert> : null}

      <Stack spacing={1.25}>
        <Button variant="contained" fullWidth onClick={() => { void createBreakoutGroup(); }} disabled={isBreakingOut}>{isBreakingOut ? 'Breaking Out…' : '⚡ Break Out'}</Button>
        <Button variant="outlined" fullWidth onClick={onCreateGroup} disabled={isBreakingOut}>+ Create Group</Button>
      </Stack>

      <Box>
        <Typography
          variant="caption"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.78, fontWeight: 700, display: 'block', mb: 1.25 }}
        >
          YOUR GROUPS
        </Typography>
        {loadingGroups ? <Typography color="text.secondary">Loading…</Typography> : null}
        {groupsError ? <Typography color="error" variant="body2">{groupsError}</Typography> : null}
        {!loadingGroups && !groupsError && groups.length > 0 ? (
          <List disablePadding>
            {groups.map((group, index) => {
              const invited = group.myStatus === 'invited';
              const content = (
                <>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 600 }}>{group.groupName}</Typography>}
                    secondary={(
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.35, lineHeight: 1.35 }}>
                        {group.memberCountActive} members · {group.appointmentCountUpcoming} upcoming · Updated {new Date(group.updatedAt).toLocaleDateString()}
                      </Typography>
                    )}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" onClick={(event) => event.stopPropagation()}>
                    {invited ? (
                      <>
                        <Button variant="contained" size="small" onClick={(event) => { event.stopPropagation(); void handleAccept(group.groupId); }}>Accept</Button>
                        <Button variant="outlined" color="warning" size="small" onClick={(event) => { event.stopPropagation(); void handleDecline(group.groupId); }}>Decline</Button>
                      </>
                    ) : (
                      <>
                        <IconButton
                          size="small"
                          aria-label={`Open actions for ${group.groupName}`}
                          onClick={(event) => handleMenuOpen(event, group)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                        <ChevronRightIcon color="action" fontSize="small" />
                      </>
                    )}
                  </Stack>
                </>
              );

              return (
                <Box key={group.groupId}>
                  <ListItem disablePadding sx={{ py: 0 }}>
                    {invited ? (
                      <Box
                        sx={{
                          width: '100%',
                          px: 0.5,
                          py: 1.1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1
                        }}
                      >
                        {content}
                      </Box>
                    ) : (
                      <ListItemButton
                        onClick={() => navToGroup(group.groupId)}
                        sx={{
                          px: 0.5,
                          py: 1.1,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        {content}
                      </ListItemButton>
                    )}
                  </ListItem>
                  {index < groups.length - 1 ? <Divider /> : null}
                </Box>
              );
            })}
          </List>
        ) : null}
        {!loadingGroups && !groupsError && groups.length === 0 ? <Typography color="text.secondary">No groups yet.</Typography> : null}
      </Box>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      <Dialog open={Boolean(confirmDeleteGroup)} onClose={() => { if (!isDeletingGroup) setConfirmDeleteGroup(null); }}>
        <DialogTitle>Delete “{confirmDeleteGroup?.groupName ?? ''}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteGroup(null)} disabled={isDeletingGroup}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { void handleDeleteConfirm(); }} disabled={isDeletingGroup}>
            {isDeletingGroup ? <CircularProgress size={16} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
