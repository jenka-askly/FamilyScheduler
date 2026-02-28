import { apiFetch } from './apiUrl';

export type UserProfile = {
  email: string;
  displayName: string;
  hasPhoto?: boolean;
  photoUpdatedAt?: string;
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await apiFetch('/api/user/profile');
  if (!response.ok) throw new Error('Failed to load profile');
  const payload = await response.json() as { email?: string; displayName?: string; hasPhoto?: boolean; photoUpdatedAt?: string };
  return {
    email: payload.email ?? '',
    displayName: (payload.displayName ?? '').trim(),
    hasPhoto: payload.hasPhoto,
    photoUpdatedAt: payload.photoUpdatedAt
  };
};

export const putUserProfile = async (displayName: string): Promise<UserProfile> => {
  const response = await apiFetch('/api/user/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName })
  });
  const payload = await response.json() as { error?: string; field?: string; message?: string; email?: string; displayName?: string; hasPhoto?: boolean; photoUpdatedAt?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? 'Failed to update profile');
  }
  return {
    email: payload.email ?? '',
    displayName: (payload.displayName ?? '').trim(),
    hasPhoto: payload.hasPhoto,
    photoUpdatedAt: payload.photoUpdatedAt
  };
};

export const uploadUserProfilePhoto = async (file: File): Promise<void> => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiFetch('/api/user/profile-photo', { method: 'PUT', body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(payload?.message ?? payload?.error ?? 'Failed to upload photo');
  }
};
