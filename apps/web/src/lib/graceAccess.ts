export const computeIsIgniteGraceActiveForGroup = ({
  groupId,
  durableSessionId,
  igniteGraceSessionId,
  igniteGraceGroupId
}: {
  groupId?: string;
  durableSessionId?: string | null;
  igniteGraceSessionId?: string | null;
  igniteGraceGroupId?: string | null;
}): boolean => {
  if (!groupId) return false;
  if (durableSessionId && durableSessionId.trim()) return false;
  if (!igniteGraceSessionId || !igniteGraceSessionId.trim()) return false;
  return igniteGraceGroupId === groupId;
};
