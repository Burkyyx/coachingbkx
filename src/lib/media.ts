import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Choix et préparation des photos / vidéos envoyées (bilans, messagerie).
 *  - photos : redimensionnées (1600 px max) et compressées en JPEG avant l'envoi ;
 *  - vidéos : 60 secondes et 50 Mo maximum, qualité réduite à la capture (iPhone).
 */

export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export type PickedMedia = { uri: string; mime: string; durationSeconds: number | null };

export type PickError = 'too_long' | 'too_big';

async function compressImage(uri: string, width: number | undefined): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (width && width > 1600) context.resize({ width: 1600 });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return result.uri;
}

/** Photo depuis la galerie (ou l'appareil photo). Renvoie null si annulé. */
export async function pickPhoto(
  source: 'library' | 'camera' = 'library',
): Promise<PickedMedia | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const uri = await compressImage(asset.uri, asset.width).catch(() => asset.uri);
  return { uri, mime: 'image/jpeg', durationSeconds: null };
}

/** Vidéo courte (correction technique). */
export async function pickVideo(): Promise<PickedMedia | PickError | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: VIDEO_MAX_SECONDS,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    quality: 0.6,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  // La durée est en millisecondes.
  const seconds = asset.duration ? Math.round(asset.duration / 1000) : null;
  if (seconds !== null && seconds > VIDEO_MAX_SECONDS + 1) return 'too_long';
  if (asset.fileSize && asset.fileSize > VIDEO_MAX_BYTES) return 'too_big';
  return { uri: asset.uri, mime: asset.mimeType ?? 'video/mp4', durationSeconds: seconds };
}
