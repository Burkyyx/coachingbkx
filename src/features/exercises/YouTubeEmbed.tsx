import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { youTubeEmbedUrl } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

/** Lecteur YouTube intégré (iPhone / Android). La version web est YouTubeEmbed.web.tsx. */
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
      <WebView
        source={{ uri: youTubeEmbedUrl(id, start) }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        style={{ flex: 1, backgroundColor: '#000' }}
      />
    </View>
  );
}
