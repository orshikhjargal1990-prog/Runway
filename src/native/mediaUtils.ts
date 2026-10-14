import { Platform } from 'react-native';
import type * as ImagePicker from 'expo-image-picker';

const galleryStorageBudget = 4_000_000;
const galleryPhotoLimit = 24;

export type PersistedGalleryPhoto = { id: string; uri: string };

export function isStableGalleryUri(uri: string) {
  const value = uri.trim();
  return Boolean(value) && !value.startsWith('blob:');
}

export function compactGalleryPhotos(photos: PersistedGalleryPhoto[]) {
  let used = 0;
  const compacted: PersistedGalleryPhoto[] = [];
  for (const photo of photos) {
    if (!photo?.uri || !isStableGalleryUri(photo.uri) || compacted.length >= galleryPhotoLimit) continue;
    const nextSize = photo.uri.length;
    if (used + nextSize > galleryStorageBudget) continue;
    compacted.push(photo);
    used += nextSize;
  }
  return compacted;
}

function dataUriFromBase64(asset: ImagePicker.ImagePickerAsset) {
  return asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function imagePickerAssetToPersistableUri(
  asset: ImagePicker.ImagePickerAsset,
  options: { maxSize?: number; quality?: number } = {}
) {
  if (asset.type === 'video') return asset.uri;
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !asset.file) {
    return dataUriFromBase64(asset);
  }

  const dataUrl = await readFileAsDataUrl(asset.file);
  const image = await loadHtmlImage(dataUrl);
  const maxSize = options.maxSize ?? 900;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', options.quality ?? 0.76);
}
