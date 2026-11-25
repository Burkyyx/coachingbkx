import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  Button,
  Checkbox,
  HStack,
  Icon,
  IconButton,
  Segmented,
  Sheet,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  formatInt,
  formatNumber,
  macrosForGrams,
  mealTypeForHour,
  sumMacros,
  todayLocal,
  type AiConfidence,
  type FoodProduct,
  type Macros,
} from '@/core';
import { ConsentGate } from '@/features/auth/ConsentGate';
import { toUserMessage } from '@/lib/errors';
import { pickPhoto } from '@/lib/media';
import { removeFiles, uploadFile } from '@/lib/storage';
import { uuid } from '@/lib/uuid';
import { useTheme } from '@/theme/ThemeProvider';

import { BarcodePanel } from './BarcodePanel';
import { analyzeMealPhoto, mealPhotoPath, useAnalysesLeft, type AnalysisErrorCode } from './photo';
import {
  MEAL_TYPES,
  mealTotals,
  useMealActions,
  useRecentMeals,
  type ItemInput,
  type Meal,
  type MealType,
} from './journal';

type Mode = 'photo' | 'quick' | 'detailed' | 'barcode' | 'recent';

type ItemDraft = {
  key: string;
  name: string;
  quantity: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Estimation de l'IA (photo) : « low » est mis en évidence. */
  confidence?: AiConfidence | null;
  /**
   * Estimation de l'IA : valeurs de référence pour une quantité. Changer la quantité
   * recalcule alors les valeurs en proportion (une valeur corrigée devient la référence).
   */
  basis?: { quantityG: number; values: Macros } | null;
};

const fmt1 = (n: number) => formatNumber(n, 1);

/** Applique une modification à un aliment, avec recalcul proportionnel si possible. */
function patchItem(item: ItemDraft, patch: Partial<ItemDraft>): ItemDraft {
  const next = { ...item, ...patch };
  if (!item.basis) return next;
  const q = num(next.quantity);
  if ('quantity' in patch) {
    if (q === null) return next;
    const b = item.basis;
    const per100 = {
      kcal: (b.values.kcal * 100) / b.quantityG,
      proteinG: (b.values.proteinG * 100) / b.quantityG,
      carbsG: (b.values.carbsG * 100) / b.quantityG,
      fatG: (b.values.fatG * 100) / b.quantityG,
    };
    const v = macrosForGrams(per100, q);
    return {
      ...next,
      kcal: fmt1(v.kcal),
      protein: fmt1(v.proteinG),
      carbs: fmt1(v.carbsG),
      fat: fmt1(v.fatG),
    };
  }
  // Valeur corrigée à la main : elle devient la nouvelle référence.
  if (q === null) return { ...next, basis: null };
  return {
    ...next,
    basis: {
      quantityG: q,
      values: {
        kcal: num(next.kcal) ?? 0,
        proteinG: num(next.protein) ?? 0,
        carbsG: num(next.carbs) ?? 0,
        fatG: num(next.fat) ?? 0,
      },
    },
  };
}

const emptyItem = (): ItemDraft => ({
  key: uuid(),
  name: '',
  quantity: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
});

function num(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n;
}

/** Heure du repas : maintenant si c'est aujourd'hui, sinon une heure type du moment choisi. */
const DEFAULT_HOUR: Record<MealType, number> = { breakfast: 8, lunch: 12, snack: 16, dinner: 20 };
export function eatenAtFor(day: string, mealType: MealType): string {
  if (day === todayLocal()) return new Date().toISOString();
  const hh = String(DEFAULT_HOUR[mealType]).padStart(2, '0');
  return new Date(`${day}T${hh}:00:00`).toISOString();
}

export function defaultMealType(day: string): MealType {
  return day === todayLocal() ? mealTypeForHour(new Date().getHours()) : 'lunch';
}

/** Convertit un aliment saisi (valeurs pour la quantité, ou pour 100 g). */
function toItem(d: ItemDraft, per100g: boolean): ItemInput {
  const quantity = num(d.quantity);
  const values = {
    kcal: num(d.kcal) ?? 0,
    proteinG: num(d.protein) ?? 0,
    carbsG: num(d.carbs) ?? 0,
    fatG: num(d.fat) ?? 0,
  };
  const macros = per100g && quantity !== null ? macrosForGrams(values, quantity) : values;
  return { name: d.name, quantityG: quantity, ...macros, confidence: d.confidence ?? null };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  adherentId: string;
  day: string;
  /** Moment pré-sélectionné (bouton « Ajouter » d'un groupe de repas). */
  initialType: MealType;
  /** false : suivi sans chiffres (description seulement). */
  numbers: boolean;
};

export function AddMealSheet(props: Props) {
  // Clé : le formulaire repart de zéro à chaque ouverture.
  if (!props.visible) return null;
  return <AddMealForm {...props} />;
}

function AddMealForm({ visible, onClose, adherentId, day, initialType, numbers }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const { add, copy } = useMealActions(adherentId);
  const recent = useRecentMeals(adherentId);

  const [mealType, setMealType] = useState<MealType>(initialType);
  const [mode, setMode] = useState<Mode>('photo');
  const [description, setDescription] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [per100g, setPer100g] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  // --- Photo (+ analyse IA) ---
  const [mealId] = useState(uuid);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  /** Non nul : la liste d'aliments est affichée (résultat de l'IA ou saisie manuelle). */
  const [analysis, setAnalysis] = useState<{ analyzed: boolean; note: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const analysesLeft = useAnalysesLeft(numbers);
  // Photo envoyée mais repas non enregistré à la fermeture : on supprime le fichier.
  const uploaded = useRef<string | null>(null);
  const saved = useRef(false);
  useEffect(
    () => () => {
      if (!saved.current && uploaded.current)
        void removeFiles('meal-photos', [uploaded.current]).catch(() => undefined);
    },
    [],
  );

  const per100 = mode === 'detailed' && per100g;
  const parsedItems = items.filter((i) => i.name.trim() !== '').map((i) => toItem(i, per100));
  const total = sumMacros(parsedItems);

  const choosePhoto = async (source: 'camera' | 'library') => {
    const picked = await pickPhoto(source).catch(() => null);
    if (!picked) return;
    setPhoto(picked.uri);
    setPhotoPath(null); // même chemin : la nouvelle photo remplacera l'ancienne à l'envoi
    setAnalysis(null);
    setPhotoMessage(null);
    setError(null);
  };

  const ensureUploaded = async (): Promise<string> => {
    if (photoPath) return photoPath;
    const path = mealPhotoPath(adherentId, mealId);
    await uploadFile('meal-photos', path, photo as string, 'image/jpeg');
    uploaded.current = path;
    setPhotoPath(path);
    return path;
  };

  const analysisMessage: Record<AnalysisErrorCode, string> = {
    ai_not_configured: t('nutrition.journal.aiNotConfigured'),
    limit_reached: t('nutrition.journal.aiLimit'),
    ai_busy: t('nutrition.journal.aiBusy'),
    consent_required: t('nutrition.journal.aiFailed'),
    calories_disabled: t('nutrition.journal.aiFailed'),
    ai_failed: t('nutrition.journal.aiFailed'),
  };

  const analyze = async () => {
    setAnalyzing(true);
    setPhotoMessage(null);
    try {
      const path = await ensureUploaded();
      const r = await analyzeMealPhoto(path, description);
      void analysesLeft.refetch();
      if (!r.ok) {
        setPhotoMessage(analysisMessage[r.code]);
        if (r.code !== 'ai_busy') setAnalysis((a) => a ?? { analyzed: false, note: '' });
        return;
      }
      if (!r.analysis.isFood) {
        setPhotoMessage(t('nutrition.journal.notFood'));
        return;
      }
      const f = fmt1;
      setItems(
        r.analysis.items.map((i) => ({
          key: uuid(),
          name: i.name,
          quantity: f(i.quantityG),
          kcal: f(i.kcal),
          protein: f(i.proteinG),
          carbs: f(i.carbsG),
          fat: f(i.fatG),
          confidence: i.confidence,
          basis:
            i.quantityG > 0
              ? {
                  quantityG: i.quantityG,
                  values: { kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG },
                }
              : null,
        })),
      );
      setAnalysis({ analyzed: true, note: r.analysis.note });
    } catch {
      setPhotoMessage(t('nutrition.journal.photoUploadFailed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const filledItems = () =>
    items.filter((i) => i.name.trim() || i.kcal.trim() || i.quantity.trim() || i.protein.trim());

  const savePhoto = async () => {
    if (!photo) return setError(t('nutrition.journal.photoMissing'));
    const filled = numbers ? filledItems() : [];
    if (numbers) {
      if (filled.length === 0) return setError(t('nutrition.journal.errorEmpty'));
      if (filled.some((i) => !i.name.trim())) return setError(t('nutrition.journal.errorItem'));
    }
    let path: string;
    try {
      path = await ensureUploaded();
    } catch {
      return setError(t('nutrition.journal.photoUploadFailed'));
    }
    await add.mutateAsync({
      id: mealId,
      mealType,
      eatenAt: eatenAtFor(day, mealType),
      description,
      source: analysis?.analyzed ? 'photo_ai' : 'manual',
      photoPath: path,
      analysisStatus: analysis?.analyzed ? 'done' : 'none',
      analysisNote: analysis?.note || null,
      items: filled.map((i) => toItem(i, false)),
      totals: numbers ? undefined : { kcal: 0, proteinG: 0 },
    });
    saved.current = true;
    toast(t('nutrition.journal.saved'));
    onClose();
  };

  const save = async () => {
    setError(null);
    try {
      if (mode === 'photo') {
        await savePhoto();
        return;
      }
      if (mode === 'quick') {
        const k = num(kcal);
        if (!numbers) {
          if (!description.trim()) return setError(t('nutrition.journal.errorEmpty'));
        } else if (k === null) {
          return setError(t('nutrition.journal.errorKcal'));
        }
        await add.mutateAsync({
          mealType,
          eatenAt: eatenAtFor(day, mealType),
          description,
          source: 'quick',
          items: [],
          totals: { kcal: k ?? 0, proteinG: num(protein) ?? 0 },
        });
      } else {
        const filled = filledItems();
        if (filled.length === 0) return setError(t('nutrition.journal.errorEmpty'));
        if (filled.some((i) => !i.name.trim())) return setError(t('nutrition.journal.errorItem'));
        await add.mutateAsync({
          mealType,
          eatenAt: eatenAtFor(day, mealType),
          description,
          source: 'manual',
          items: filled.map((i) => toItem(i, per100)),
        });
      }
      toast(t('nutrition.journal.saved'));
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const addProduct = async (product: FoodProduct, grams: number) => {
    setError(null);
    try {
      await add.mutateAsync({
        mealType,
        eatenAt: eatenAtFor(day, mealType),
        source: 'barcode',
        items: [
          {
            name: product.brand ? `${product.name} (${product.brand})` : product.name,
            quantityG: grams,
            ...macrosForGrams(product.per100g, grams),
            barcode: product.barcode,
          },
        ],
      });
      toast(t('nutrition.journal.saved'));
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const addAgain = async (meal: Meal) => {
    try {
      await copy(meal, mealType, eatenAtFor(day, mealType));
      toast(t('nutrition.journal.saved'));
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const modes = [
    { value: 'photo' as const, label: t('nutrition.journal.modePhoto') },
    { value: 'quick' as const, label: t('nutrition.journal.modeQuick') },
    ...(numbers
      ? [
          { value: 'barcode' as const, label: t('nutrition.journal.modeBarcode') },
          { value: 'detailed' as const, label: t('nutrition.journal.modeDetailed') },
        ]
      : []),
    { value: 'recent' as const, label: t('nutrition.journal.modeRecent') },
  ];
  const recentList = recent.data ?? [];
  const favorites = recentList.filter((m) => m.is_favorite);
  const others = recentList.filter((m) => !m.is_favorite);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('nutrition.journal.sheetTitle')}
      footer={
        mode === 'recent' || mode === 'barcode' ? undefined : (
          <VStack gap="sm">
            {error ? (
              <Text variant="small" color="danger">
                {error}
              </Text>
            ) : null}
            <Button
              icon="checkmark"
              label={t('nutrition.journal.save')}
              loading={add.isPending}
              onPress={() => void save()}
            />
          </VStack>
        )
      }
    >
      <VStack gap="xs">
        <Text variant="small" weight="600" color="textMuted">
          {t('nutrition.journal.moment')}
        </Text>
        <Segmented
          scrollable
          options={MEAL_TYPES.map((m) => ({
            value: m,
            label: t(`nutrition.journal.mealTypes.${m}`),
          }))}
          value={mealType}
          onChange={setMealType}
          accessibilityLabel={t('nutrition.journal.moment')}
        />
      </VStack>
      <Segmented scrollable options={modes} value={mode} onChange={setMode} />

      {mode === 'photo' ? (
        <VStack gap="md">
          {photo ? (
            <View style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}>
              <Image
                source={{ uri: photo }}
                style={{ width: '100%', height: 220 }}
                contentFit="cover"
                accessibilityLabel={t('nutrition.journal.modePhoto')}
              />
            </View>
          ) : (
            <Text variant="small" color="textMuted">
              {t('nutrition.journal.photoHelp')}
            </Text>
          )}
          <HStack gap="xs" wrap>
            <Button
              variant={photo ? 'secondary' : 'primary'}
              icon="camera-outline"
              label={photo ? t('nutrition.journal.changePhoto') : t('nutrition.journal.takePhoto')}
              onPress={() => void choosePhoto('camera')}
            />
            <Button
              variant="secondary"
              icon="images-outline"
              label={t('nutrition.journal.choosePhoto')}
              onPress={() => void choosePhoto('library')}
            />
          </HStack>
          <TextField
            label={numbers ? t('nutrition.journal.hintLabel') : t('nutrition.journal.description')}
            placeholder={t('nutrition.journal.hintPlaceholder')}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
          />
          {!numbers ? (
            <Text variant="small" color="textMuted">
              {t('nutrition.journal.photoNoNumbers')}
            </Text>
          ) : null}
          {numbers && photo && !analysis?.analyzed ? (
            <ConsentGate
              type="ai_photo"
              title={t('nutrition.journal.aiConsentTitle')}
              body={t('nutrition.journal.aiConsentBody')}
            >
              <VStack gap="xs">
                <Button
                  icon="sparkles-outline"
                  label={
                    analyzing ? t('nutrition.journal.analyzing') : t('nutrition.journal.analyze')
                  }
                  loading={analyzing}
                  disabled={analysesLeft.data === 0}
                  onPress={() => void analyze()}
                />
                {analysesLeft.data != null ? (
                  <Text variant="caption" color="textSubtle">
                    {t('nutrition.journal.analysesLeft', { count: analysesLeft.data })}
                  </Text>
                ) : null}
              </VStack>
            </ConsentGate>
          ) : null}
          {photoMessage ? (
            <Text variant="small" color="textMuted">
              {photoMessage}
            </Text>
          ) : null}
          {numbers && photo && !analysis ? (
            <Button
              variant="ghost"
              icon="create-outline"
              label={t('nutrition.journal.manualEntry')}
              onPress={() => setAnalysis({ analyzed: false, note: '' })}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
          {numbers && analysis ? (
            <VStack gap="sm">
              {analysis.analyzed ? (
                <HStack gap="xs" align="flex-start">
                  <Icon name="sparkles-outline" size={16} color="textMuted" />
                  <Text variant="small" color="textMuted" style={{ flex: 1 }}>
                    {t('nutrition.journal.aiResult')}
                    {analysis.note
                      ? ` ${t('nutrition.journal.aiNote', { note: analysis.note })}`
                      : ''}
                  </Text>
                </HStack>
              ) : null}
              <ItemsEditor items={items} onChange={setItems} total={total} />
            </VStack>
          ) : null}
        </VStack>
      ) : null}

      {mode === 'quick' ? (
        <VStack gap="md">
          {numbers ? (
            <Text variant="small" color="textMuted">
              {t('nutrition.journal.quickHelp')}
            </Text>
          ) : (
            <Text variant="small" color="textMuted">
              {t('nutrition.journal.noNumbersHint')}
            </Text>
          )}
          <TextField
            label={t('nutrition.journal.description')}
            placeholder={t('nutrition.journal.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
          />
          {numbers ? (
            <HStack gap="sm" align="flex-start">
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('nutrition.journal.quickKcal')}
                  value={kcal}
                  onChangeText={setKcal}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('nutrition.journal.quickProtein')}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                />
              </View>
            </HStack>
          ) : null}
        </VStack>
      ) : null}

      {mode === 'detailed' ? (
        <VStack gap="md">
          <TextField
            label={t('nutrition.journal.description')}
            placeholder={t('nutrition.journal.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
          />
          <Checkbox
            checked={per100g}
            onChange={setPer100g}
            label={t('nutrition.journal.per100g')}
            description={t('nutrition.journal.per100gHint')}
          />
          <ItemsEditor items={items} onChange={setItems} total={total} />
        </VStack>
      ) : null}

      {mode === 'barcode' ? (
        <VStack gap="sm">
          <BarcodePanel saving={add.isPending} onAdd={(p, g) => void addProduct(p, g)} />
          {error ? (
            <Text variant="small" color="danger">
              {error}
            </Text>
          ) : null}
        </VStack>
      ) : null}

      {mode === 'recent' ? (
        <VStack gap="sm">
          {recentList.length === 0 ? (
            <Text color="textMuted">{t('nutrition.journal.recentEmpty')}</Text>
          ) : (
            <Text variant="small" color="textMuted">
              {t('nutrition.journal.recentHelp')}
            </Text>
          )}
          {error ? (
            <Text variant="small" color="danger">
              {error}
            </Text>
          ) : null}
          {[
            { title: t('nutrition.journal.favorites'), list: favorites },
            { title: t('nutrition.journal.recent'), list: others },
          ]
            .filter((g) => g.list.length > 0)
            .map((group) => (
              <VStack key={group.title} gap="xs">
                <Text variant="small" weight="700">
                  {group.title}
                </Text>
                {group.list.map((meal) => (
                  <RecentRow
                    key={meal.id}
                    meal={meal}
                    numbers={numbers}
                    disabled={add.isPending}
                    onPress={() => void addAgain(meal)}
                  />
                ))}
              </VStack>
            ))}
        </VStack>
      ) : null}
    </Sheet>
  );
}

/** Libellé d'un repas : sa description, sinon la liste de ses aliments. */
export function mealLabel(meal: Meal): string {
  if (meal.description) return meal.description;
  return meal.items.map((i) => i.name).join(', ') || '—';
}

function RecentRow({
  meal,
  numbers,
  disabled,
  onPress,
}: {
  meal: Meal;
  numbers: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const totals = mealTotals(meal);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('nutrition.journal.addTo')} : ${mealLabel(meal)}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      {meal.is_favorite ? <Icon name="star" size={16} rawColor={theme.nutrition.carbs} /> : null}
      <VStack gap="xxs" flex={1}>
        <Text numberOfLines={2}>{mealLabel(meal)}</Text>
        {numbers ? (
          <Text variant="caption" color="textSubtle" tabular>
            {formatInt(totals.kcal)} kcal · P {formatInt(totals.proteinG)} g
          </Text>
        ) : null}
      </VStack>
      <Icon name="add-circle-outline" color="textMuted" />
    </Pressable>
  );
}

/** Liste d'aliments modifiable (mode détaillé et résultat de l'analyse photo). */
function ItemsEditor({
  items,
  onChange,
  total,
}: {
  items: ItemDraft[];
  onChange: (update: (list: ItemDraft[]) => ItemDraft[]) => void;
  total: Macros;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = (key: string, patch: Partial<ItemDraft>) =>
    onChange((list) => list.map((i) => (i.key === key ? patchItem(i, patch) : i)));
  const setItems = onChange;
  return (
    <VStack gap="md">
      {items.map((item, index) => (
        <View
          key={item.key}
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            gap: theme.spacing.sm,
            borderWidth: item.confidence === 'low' ? 1 : 0,
            borderColor: theme.colors.warning,
          }}
        >
          {item.confidence === 'low' ? (
            <HStack gap="xs">
              <Icon name="help-circle-outline" size={16} color="warning" />
              <Text variant="caption" color="warning">
                {t('nutrition.journal.lowConfidence')}
              </Text>
            </HStack>
          ) : null}
          <HStack gap="sm" align="flex-end">
            <View style={{ flex: 2 }}>
              <TextField
                label={`${t('nutrition.journal.itemName')} ${index + 1}`}
                placeholder={t('nutrition.journal.itemNamePlaceholder')}
                value={item.name}
                onChangeText={(v) => update(item.key, { name: v })}
                maxLength={120}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('nutrition.journal.quantity')}
                value={item.quantity}
                onChangeText={(v) => update(item.key, { quantity: v })}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
            </View>
            {items.length > 1 ? (
              <IconButton
                icon="close"
                label={t('nutrition.journal.removeItem')}
                onPress={() => setItems((list) => list.filter((i) => i.key !== item.key))}
              />
            ) : null}
          </HStack>
          <HStack gap="sm" wrap>
            {(
              [
                ['kcal', 'kcal', theme.colors.text],
                ['protein', 'proteinShort', theme.nutrition.protein],
                ['carbs', 'carbsShort', theme.nutrition.carbs],
                ['fat', 'fatShort', theme.nutrition.fat],
              ] as const
            ).map(([field, labelKey, color]) => {
              const fieldLabel = labelKey === 'kcal' ? 'kcal' : `${t(`nutrition.${labelKey}`)} (g)`;
              return (
                <View key={field} style={{ flex: 1, minWidth: 70 }}>
                  <HStack gap="xxs">
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
                    />
                    <Text variant="caption" color="textMuted">
                      {fieldLabel}
                    </Text>
                  </HStack>
                  <TextField
                    accessibilityLabel={`${fieldLabel} — ${t('nutrition.journal.itemName')} ${index + 1}`}
                    value={item[field]}
                    onChangeText={(v) => update(item.key, { [field]: v })}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                  />
                </View>
              );
            })}
          </HStack>
        </View>
      ))}
      <Button
        variant="ghost"
        icon="add"
        label={t('nutrition.journal.addItem')}
        onPress={() => setItems((list) => [...list, emptyItem()])}
        style={{ alignSelf: 'flex-start' }}
      />
      <Text variant="small" weight="600" tabular>
        {t('nutrition.journal.total', {
          kcal: formatInt(total.kcal),
          protein: formatInt(total.proteinG),
          carbs: formatInt(total.carbsG),
          fat: formatInt(total.fatG),
        })}
      </Text>
    </VStack>
  );
}
