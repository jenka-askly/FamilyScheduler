const normalizeUserId = (userId: string): string => encodeURIComponent(userId.trim().toLowerCase());

export const userProfilePhotoBlobKey = (userId: string): string => `users/profiles/${normalizeUserId(userId)}.jpg`;

export const userProfilePhotoMetaBlobKey = (userId: string): string => `users/profiles/${normalizeUserId(userId)}.json`;
