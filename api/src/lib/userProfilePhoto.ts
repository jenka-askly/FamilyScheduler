export const userProfilePhotoBlobKey = (groupId: string, personId: string): string => {
  // personId is group-scoped today (created in groupCreate), so profile-photo persistence is currently per-group.
  // If/when personId becomes a global identity, migrate this key to familyscheduler/users/<personId>/profile.jpg.
  return `familyscheduler/groups/${groupId}/users/${personId}/profile.jpg`;
};

export const userProfilePhotoMetaBlobKey = (groupId: string, personId: string): string => {
  return `familyscheduler/groups/${groupId}/users/${personId}/profile.json`;
};
