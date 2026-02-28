import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffOutlinedIcon from '@mui/icons-material/NotificationsOffOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiUrl';
import { deleteGroup, restoreGroup } from '../lib/groupApi';
import { getUserPreferences, setUserPreferencesPatch } from '../lib/userPrefs';

type DashboardHomePageProps = {
  onCreateGroup: () => void;
  refreshToken?: number;
  onPrefsStateChange?: (state: {
    emailUpdatesEnabled: boolean | null;
    prefsLoading: boolean;
    prefsSaving: boolean;
    prefsError: string | null;
    onToggleEmailUpdates: (next: boolean) => void | Promise<void>;
  }) => void;
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

export function DashboardHomePage({ onCreateGroup, refreshToken = 0, onPrefsStateChange }: DashboardHomePageProps) {
  const [isBreakingOut, setIsBreakingOut] = useState(false);
  const [breakoutError, setBreakoutError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuGroup, setMenuGroup] = useState<DashboardGroup | null>(null);
  const [lastDeletedGroup, setLastDeletedGroup] = useState<{ groupId: string; name?: string } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoTimerRef = useRef<number | null>(null);
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState<boolean | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [mutedGroupIds, setMutedGroupIds] = useState<string[]>([]);

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
    void loadUserPreferences();
  }, [refreshToken]);

  useEffect(() => {
    if (!onPrefsStateChange) return;
    onPrefsStateChange({
      emailUpdatesEnabled,
      prefsLoading,
      prefsSaving,
      prefsError,
      onToggleEmailUpdates: (next) => handleToggleEmailUpdates(next)
    });
  }, [emailUpdatesEnabled, onPrefsStateChange, prefsError, prefsLoading, prefsSaving]);

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  const loadUserPreferences = async () => {
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const result = await getUserPreferences();
      if (!result.ok) {
        setPrefsError(result.message);
        return;
      }
      setEmailUpdatesEnabled(result.prefs.emailUpdatesEnabled);
      setMutedGroupIds(result.prefs.mutedGroupIds);
    } catch {
      setPrefsError('Unable to load notification preferences.');
    } finally {
      setPrefsLoading(false);
    }
  };

  const handleToggleEmailUpdates = async (nextChecked: boolean) => {
    if (prefsSaving || emailUpdatesEnabled === null) return;
    const previous = emailUpdatesEnabled;
    setEmailUpdatesEnabled(nextChecked);
    setPrefsSaving(true);
    setPrefsError(null);
    try {
      const result = await setUserPreferencesPatch({ emailUpdatesEnabled: nextChecked });
      if (!result.ok) {
        setEmailUpdatesEnabled(previous);
        setPrefsError(result.message);
        return;
      }
      setEmailUpdatesEnabled(result.prefs.emailUpdatesEnabled);
      setMutedGroupIds(result.prefs.mutedGroupIds);
    } catch {
      setEmailUpdatesEnabled(previous);
      setPrefsError('Unable to save notification preferences.');
    } finally {
      setPrefsSaving(false);
    }
  };


  const handleToggleMutedGroup = async (groupId: string, nextMuted: boolean) => {
    if (prefsSaving) return;
    const previous = mutedGroupIds;
    const next = nextMuted
      ? [...new Set([...mutedGroupIds, groupId])]
      : mutedGroupIds.filter((id) => id !== groupId);
    setMutedGroupIds(next);
    setPrefsSaving(true);
    setPrefsError(null);
    try {
      const result = await setUserPreferencesPatch({ mutedGroupIds: next });
      if (!result.ok) {
        setMutedGroupIds(previous);
        setPrefsError(result.message);
        return;
      }
      setMutedGroupIds(result.prefs.mutedGroupIds);
      setEmailUpdatesEnabled(result.prefs.emailUpdatesEnabled);
    } catch {
      setMutedGroupIds(previous);
      setPrefsError('Unable to save notification preferences.');
    } finally {
      setPrefsSaving(false);
    }
  };

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

  const handleDeleteClick = async () => {
    if (!menuGroup) return;
    const deletingGroup = menuGroup;
    handleMenuClose();
    setGroupsError(null);
    try {
      const response = await deleteGroup(deletingGroup.groupId);
      if (!response.ok) {
        setGroupsError(response.message ?? 'Unable to delete group right now.');
        return;
      }
      setLastDeletedGroup({ groupId: deletingGroup.groupId, name: deletingGroup.groupName });
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = window.setTimeout(() => {
        setLastDeletedGroup((prev) => (prev?.groupId === deletingGroup.groupId ? null : prev));
      }, 8000);
      await loadDashboard();
    } catch {
      setGroupsError('Unable to delete group right now.');
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeletedGroup || undoBusy) return;
    setUndoBusy(true);
    setGroupsError(null);
    try {
      const response = await restoreGroup(lastDeletedGroup.groupId);
      if (!response.ok) {
        setGroupsError(response.message ?? 'Unable to restore group right now.');
        return;
      }
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      setLastDeletedGroup(null);
      await loadDashboard();
    } catch {
      setGroupsError('Unable to restore group right now.');
    } finally {
      setUndoBusy(false);
    }
  };

  return (
    <Container maxWidth="lg" disableGutters>
      <Stack spacing={2}>
      {breakoutError ? <Alert severity="error" onClose={() => setBreakoutError(null)}>{breakoutError}</Alert> : null}

      <Stack spacing={1.25}>
        <Button variant="contained" fullWidth onClick={() => { void createBreakoutGroup(); }} disabled={isBreakingOut}>{isBreakingOut ? 'Breaking Out…' : '⚡ Break Out'}</Button>
        <Button variant="outlined" fullWidth onClick={onCreateGroup} disabled={isBreakingOut}>+ Create Group</Button>
      </Stack>

      <Card variant="outlined">
        <CardContent>
        <Typography variant="h6" sx={{ mb: 1.25, fontWeight: 700 }}>Your groups</Typography>
        {loadingGroups ? <Typography color="text.secondary">Loading…</Typography> : null}
        {groupsError ? <Typography color="error" variant="body2">{groupsError}</Typography> : null}
        {prefsError ? <Typography color="error" variant="body2" sx={{ mb: groupsError ? 0 : 1 }}>{prefsError}</Typography> : null}
        {lastDeletedGroup ? (
          <Alert
            severity="info"
            action={(
              <Tooltip title="Undo">
                <span>
                  <IconButton size="small" color="inherit" aria-label="Undo" disabled={undoBusy} onClick={() => { void handleUndoDelete(); }}>
                    <UndoOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            sx={{ mt: groupsError ? 1 : 0 }}
          >
            Group deleted
          </Alert>
        ) : null}
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
                          aria-label={mutedGroupIds.includes(group.groupId) ? `Unmute ${group.groupName}` : `Mute ${group.groupName}`}
                          disabled={prefsLoading || prefsSaving}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleToggleMutedGroup(group.groupId, !mutedGroupIds.includes(group.groupId));
                          }}
                        >
                          {mutedGroupIds.includes(group.groupId) ? <NotificationsOffOutlinedIcon fontSize="small" /> : <NotificationsActiveOutlinedIcon fontSize="small" />}
                        </IconButton>
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
        </CardContent>
      </Card>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>


      </Stack>
    </Container>
  );
}
