import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  HStack,
  IconButton,
  Screen,
  Segmented,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatFrenchDate, formatKg, todayLocal, weekStart } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { ConsentGate } from '@/features/auth/ConsentGate';
import { saveCheckin, useMyCheckins, type Checkin } from '@/features/checkin/api';
import { toUserMessage } from '@/lib/errors';
import { pickPhoto } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';

const SCALE = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));

function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(n) ? null : n;
}

/** Bilan hebdomadaire de l'adhérent. */
export default function CheckinScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const checkins = useMyCheckins(userId);
  const thisWeek = weekStart(todayLocal());
  const current = (checkins.data ?? []).find((c) => c.week_start === thisWeek) ?? null;

  return (
    <Screen maxWidth={640}>
      <Button
        variant="ghost"
        icon="arrow-back"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        style={{ alignSelf: 'flex-start' }}
      />
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('checkin.title')}
        </Text>
        <Text color="textMuted">{t('checkin.subtitle')}</Text>
      </VStack>
      <ConsentGate
        type="health_data"
        title={t('checkin.consentTitle')}
        body={t('checkin.consentBody')}
      >
        {/* La clé force la réinitialisation du formulaire quand le bilan existant arrive du serveur. */}
        <CheckinForm
          key={current?.id ?? 'new'}
          current={current}
          onSaved={() => void checkins.refetch()}
        />
        <PastCheckins list={(checkins.data ?? []).filter((c) => c.week_start !== thisWeek)} />
      </ConsentGate>
      <Text variant="caption" color="textSubtle">
        {t('legal.disclaimer')}
      </Text>
    </Screen>
  );
}

function CheckinForm({ current, onSaved }: { current: Checkin | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const { userId } = useAuth();
  const [weight, setWeight] = useState(
    current?.weight_kg ? String(current.weight_kg).replace('.', ',') : '',
  );
  const [waist, setWaist] = useState(
    current?.waist_cm ? String(current.waist_cm).replace('.', ',') : '',
  );
  const [sleep, setSleep] = useState<number | null>(current?.sleep ?? null);
  const [energy, setEnergy] = useState<number | null>(current?.energy ?? null);
  const [stress, setStress] = useState<number | null>(current?.stress ?? null);
  const [soreness, setSoreness] = useState<number | null>(current?.soreness ?? null);
  const [comment, setComment] = useState(current?.comment ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { photosSkipped } = await saveCheckin(userId, {
        weightKg: parseNumber(weight),
        waistCm: parseNumber(waist),
        sleep,
        energy,
        stress,
        soreness,
        comment,
        photoUris: photos,
        existingPhotoPaths: current?.photo_paths ?? [],
      });
      setPhotos([]);
      toast(photosSkipped ? t('checkin.photosOffline') : t('checkin.sent'));
      onSaved();
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const scale = (label: string, value: number | null, set: (v: number) => void) => (
    <VStack gap="xs">
      <Text weight="600">{label}</Text>
      <Segmented options={SCALE} value={value} onChange={set} accessibilityLabel={label} />
    </VStack>
  );

  return (
    <Card>
      <VStack gap="lg">
        {current ? <Text color="success">{t('checkin.alreadyDone')}</Text> : null}
        <HStack gap="md" wrap>
          <View style={{ flex: 1, minWidth: 140 }}>
            <TextField
              label={t('checkin.weight')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <TextField
              label={t('checkin.waist')}
              value={waist}
              onChangeText={setWaist}
              keyboardType="decimal-pad"
            />
          </View>
        </HStack>
        <Text variant="caption" color="textSubtle">
          {t('checkin.scaleHint')}
        </Text>
        {scale(t('checkin.sleep'), sleep, setSleep)}
        {scale(t('checkin.energy'), energy, setEnergy)}
        {scale(t('checkin.stress'), stress, setStress)}
        {scale(t('checkin.soreness'), soreness, setSoreness)}
        <VStack gap="xs">
          <Text weight="600">{t('checkin.photos')}</Text>
          <HStack gap="sm" wrap>
            {photos.map((uri) => (
              <View
                key={uri}
                style={{
                  width: 80,
                  height: 106,
                  borderRadius: theme.radius.md,
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={{ uri }}
                  style={{ flex: 1 }}
                  contentFit="cover"
                  accessibilityLabel={t('checkin.photos')}
                />
                <View style={{ position: 'absolute', top: 0, right: 0 }}>
                  <IconButton
                    icon="close-circle"
                    label={t('common.delete')}
                    onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}
                  />
                </View>
              </View>
            ))}
            {photos.length + (current?.photo_paths.length ?? 0) < 3 ? (
              <Button
                variant="secondary"
                icon="camera-outline"
                label={t('checkin.addPhoto')}
                onPress={async () => {
                  const media = await pickPhoto();
                  if (media) setPhotos((p) => [...p, media.uri]);
                }}
              />
            ) : null}
          </HStack>
        </VStack>
        <TextField
          label={t('checkin.comment')}
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <Button
          size="lg"
          icon="send"
          label={t('checkin.send')}
          loading={busy}
          onPress={() => void submit()}
          fullWidth
        />
        {current?.coach_reply ? (
          <Card>
            <Text variant="caption" color="textSubtle">
              {t('checkin.coachReply')}
            </Text>
            <Text>{current.coach_reply}</Text>
          </Card>
        ) : null}
      </VStack>
    </Card>
  );
}

function PastCheckins({ list }: { list: Checkin[] }) {
  const { t } = useTranslation();
  if (list.length === 0) return null;
  return (
    <VStack gap="sm">
      <Text variant="subtitle">{t('checkin.history')}</Text>
      {list.map((c) => (
        <Card key={c.id}>
          <VStack gap="xs">
            <HStack justify="space-between">
              <Text weight="700">
                {t('adherent.checkinWeek', { date: formatFrenchDate(c.week_start) })}
              </Text>
              {c.weight_kg !== null ? <Text>{formatKg(Number(c.weight_kg))}</Text> : null}
            </HStack>
            {c.comment ? <Text color="textMuted">« {c.comment} »</Text> : null}
            {c.coach_reply ? (
              <Text>
                <Text weight="700">{t('checkin.coachReply')} : </Text>
                {c.coach_reply}
              </Text>
            ) : null}
          </VStack>
        </Card>
      ))}
    </VStack>
  );
}
