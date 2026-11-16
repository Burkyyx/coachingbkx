import { View } from 'react-native';

import { youTubeEmbedUrl } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

/** Lecteur YouTube intégré (version web : cadre YouTube standard). */
export function YouTubeEmbed({ id, start }: { id: string; start: number | null }) {
  const theme = useTheme();
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
      <iframe
        title="Vidéo de démonstration"
        src={youTubeEmbedUrl(id, start)}
        style={{ width: '100%', height: '100%', border: 0 }}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </View>
  );
}
