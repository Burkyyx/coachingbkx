import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, Screen, Text, VStack } from '@/components/ui';
import { isLegalDocId, LEGAL_DOCUMENTS } from '@/legal/documents';

/** Pages juridiques : mentions légales, CGU, politique de confidentialité. */
export default function LegalScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!doc || !isLegalDocId(doc)) {
    return (
      <Screen>
        <EmptyState title={t('common.notFound')} actionLabel={t('common.back')} onAction={back} />
      </Screen>
    );
  }
  const document = LEGAL_DOCUMENTS[doc];
  return (
    <Screen maxWidth={760}>
      <Button
        variant="ghost"
        icon="arrow-back"
        label={t('common.back')}
        onPress={back}
        style={{ alignSelf: 'flex-start' }}
      />
      <VStack gap="xs">
        <Text variant="headline" accessibilityRole="header">
          {document.title}
        </Text>
        <Text variant="small" color="textSubtle">
          Dernière mise à jour : {document.updatedAt}
        </Text>
      </VStack>
      {document.sections.map((section) => (
        <VStack key={section.title} gap="sm">
          <Text variant="subtitle" accessibilityRole="header">
            {section.title}
          </Text>
          {section.paragraphs.map((p) => (
            <Text key={p} color="textMuted">
              {p}
            </Text>
          ))}
        </VStack>
      ))}
      <Text variant="small" color="textSubtle">
        {t('legal.disclaimer')}
      </Text>
    </Screen>
  );
}
