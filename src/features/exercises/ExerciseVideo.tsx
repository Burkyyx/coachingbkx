import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, LoadingState } from '@/components/ui';
import { parseYouTubeId, parseYouTubeStart, youTubeThumbnailUrl } from '@/core';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

import { YouTubeEmbed } from './YouTubeEmbed';

/** Lecteur pour un fichier vidéo (lien signé temporaire). */
function Player({ uri }: { uri: string }) {
  const theme = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        aspectRatio: 16 / 9,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
    </View>
  );
}

/**
 * Vidéo de démonstration d'un exercice :
 *  - fichier privé (bucket exercise-media) → lecteur intégré ;
 *  - lien YouTube → lecteur YouTube intégré directement dans l'app ;
 *  - autre lien → bouton qui ouvre la vidéo dans le navigateur.
 */
export function ExerciseVideo({ path, url }: { path: string | null; url: string | null }) {
  const { t } = useTranslation();
  const signed = useSignedUrl('exercise-media', path);
  if (path) {
    if (signed.data) return <Player uri={signed.data} />;
    return <LoadingState />;
  }
  const youTubeId = parseYouTubeId(url);
  if (url && youTubeId) return <YouTubeEmbed id={youTubeId} start={parseYouTubeStart(url)} />;
  if (url) {
    return (
      <Button
        variant="secondary"
        icon="play-circle-outline"
        label={t('exercises.videoOpenLink')}
        onPress={() => void WebBrowser.openBrowserAsync(url)}
      />
    );
  }
  return null;
}

/** Image de l'exercice (photo ou schéma), en grand. */
export function ExerciseImage({ path }: { path: string | null }) {
  const theme = useTheme();
  const signed = useSignedUrl('exercise-media', path);
  if (!path || !signed.data) return null;
  return (
    <Image
      source={{ uri: signed.data }}
      style={{
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
        aspectRatio: 4 / 3,
        borderRadius: theme.radius.md,
      }}
      contentFit="contain"
      accessibilityLabel="Image de l'exercice"
    />
  );
}

/**
 * Petite vignette pour les listes : image de l'exercice, sinon miniature YouTube,
 * sinon une icône.
 */
export function ExerciseThumb({
  imagePath,
  videoUrl,
  size = 48,
}: {
  imagePath: string | null;
  videoUrl: string | null;
  size?: number;
}) {
  const theme = useTheme();
  const signed = useSignedUrl('exercise-media', imagePath);
  const youTubeId = parseYouTubeId(videoUrl);
  const uri = imagePath ? signed.data : youTubeId ? youTubeThumbnailUrl(youTubeId) : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Icon name="barbell-outline" color="textSubtle" size={size / 2} />
      )}
    </View>
  );
}
