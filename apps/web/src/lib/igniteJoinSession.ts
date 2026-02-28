const DURABLE_SESSION_ID_KEY = 'fs.sessionId';
const IGNITE_GRACE_SESSION_ID_KEY = 'fs.igniteGraceSessionId';
const IGNITE_GRACE_GROUP_ID_KEY = 'fs.igniteGraceGroupId';
const IGNITE_GRACE_EXPIRES_AT_KEY = 'fs.igniteGraceExpiresAtUtc';

type StorageLike = Pick<Storage, 'setItem' | 'removeItem'>;

export const clearIgniteGraceStorageKeys = (storage: StorageLike): void => {
  storage.removeItem(IGNITE_GRACE_SESSION_ID_KEY);
  storage.removeItem(IGNITE_GRACE_GROUP_ID_KEY);
  storage.removeItem(IGNITE_GRACE_EXPIRES_AT_KEY);
};

export const applyIgniteJoinSessionResult = ({
  storage,
  hasDsid,
  targetGroupId,
  responseSessionId,
  graceExpiresAtUtc
}: {
  storage: StorageLike;
  hasDsid: boolean;
  targetGroupId: string;
  responseSessionId?: string;
  graceExpiresAtUtc?: string;
}): void => {
  if (hasDsid) {
    clearIgniteGraceStorageKeys(storage);
    if (responseSessionId?.trim()) {
      storage.setItem(DURABLE_SESSION_ID_KEY, responseSessionId.trim());
    }
    return;
  }

  if (!responseSessionId?.trim()) return;
  storage.setItem(IGNITE_GRACE_SESSION_ID_KEY, responseSessionId.trim());
  storage.setItem(IGNITE_GRACE_GROUP_ID_KEY, targetGroupId);
  if (graceExpiresAtUtc?.trim()) {
    storage.setItem(IGNITE_GRACE_EXPIRES_AT_KEY, graceExpiresAtUtc);
  } else {
    storage.removeItem(IGNITE_GRACE_EXPIRES_AT_KEY);
  }
};
