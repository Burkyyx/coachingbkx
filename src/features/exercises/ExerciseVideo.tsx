import * as WebBrowser from 'expo-web-browser';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, LoadingState } from '@/components/ui';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

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
 * Vidéo de démonstration d'un exercice : fichier privé (bucket exercise-media)
 * ou lien externe (ouvert dans le navigateur).
 */
export function ExerciseVideo({ path, url }: { path: string | null; url: string | null }) {
  const { t } = useTranslation();
  const signed = useSignedUrl('exercise-media', path);
  if (path) {
    if (signed.data) return <Player uri={signed.data} />;
    return <LoadingState />;
  }
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
