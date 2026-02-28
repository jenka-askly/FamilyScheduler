export const requestEnvironmentCameraStream = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported on this device.');
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
};

export const captureVideoFrameAsJpeg = async (video: HTMLVideoElement, quality = 0.92): Promise<Blob> => {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to access canvas context.');
  context.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Unable to capture photo.');
  return blob;
};
