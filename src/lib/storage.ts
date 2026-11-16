import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

export type Bucket = 'avatars' | 'exercise-media' | 'checkin-photos' | 'message-media';

/** Durée de validité des liens signés (fichiers privés). */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Envoie un fichier local (photo / vidéo choisie sur l'appareil ou dans le navigateur)
 * dans un bucket privé.
 */
export async function uploadFile(bucket: Bucket, path: string, uri: string, contentType: string) {
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function removeFiles(bucket: Bucket, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

/** Lien temporaire vers un fichier privé (mis en cache 50 minutes). */
export function useSignedUrl(bucket: Bucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path as string, SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Extension de fichier à partir d'un type MIME. */
export function extensionFor(mime: string): string {
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}
