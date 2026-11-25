import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, HStack, Icon, LoadingState, Text, TextField, VStack } from '@/components/ui';
import {
  cleanBarcode,
  formatInt,
  formatNumber,
  isValidBarcode,
  macrosForGrams,
  type FoodProduct,
} from '@/core';
import { useTheme } from '@/theme/ThemeProvider';
import { cameraColors } from '@/theme/tokens';

import { prepareBarcodeEngine } from './barcodeEngine';
import { lookupBarcode } from './foodLookup';

function num(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n;
}

type Props = {
  saving: boolean;
  onAdd: (product: FoodProduct, grams: number) => void;
};

/** Ajout d'un produit par code-barres : caméra ou saisie du code, puis quantité. */
export function BarcodePanel({ saving, onAdd }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [grams, setGrams] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const search = async (raw: string, fromCamera: boolean) => {
    const value = cleanBarcode(raw);
    setMessage(null);
    if (!fromCamera && !isValidBarcode(value)) {
      setMessage(t('nutrition.journal.invalidCode'));
      return;
    }
    setScanning(false);
    setCode(value);
    setLoading(true);
    try {
      const found = await lookupBarcode(value);
      setProduct(found);
      if (found) setGrams(String(found.servingG ?? 100));
      else setMessage(t('nutrition.journal.notFound'));
    } catch {
      setMessage(t('nutrition.journal.lookupError'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setProduct(null);
    setCode('');
    setMessage(null);
  };

  if (product) {
    const g = num(grams);
    const values = macrosForGrams(product.per100g, g ?? 0);
    return (
      <VStack gap="md">
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            gap: theme.spacing.xs,
          }}
        >
          <Text weight="700">{product.name}</Text>
          {product.brand ? (
            <Text variant="small" color="textMuted">
              {product.brand}
            </Text>
          ) : null}
          <Text variant="caption" color="textSubtle" tabular>
            {t('nutrition.journal.per100', {
              kcal: formatInt(product.per100g.kcal),
              protein: formatNumber(product.per100g.proteinG, 1),
              carbs: formatNumber(product.per100g.carbsG, 1),
              fat: formatNumber(product.per100g.fatG, 1),
            })}
          </Text>
          {product.incomplete ? (
            <HStack gap="xs">
              <Icon name="alert-circle-outline" size={16} color="warning" />
              <Text variant="caption" color="warning">
                {t('nutrition.journal.incomplete')}
              </Text>
            </HStack>
          ) : null}
        </View>
        <TextField
          label={t('nutrition.journal.quantity')}
          value={grams}
          onChangeText={setGrams}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <HStack gap="xs" wrap>
          {product.servingG ? (
            <Button
              variant="secondary"
              label={t('nutrition.journal.portion', { grams: formatNumber(product.servingG, 1) })}
              onPress={() => setGrams(String(product.servingG))}
            />
          ) : null}
          <Button variant="secondary" label="100 g" onPress={() => setGrams('100')} />
        </HStack>
        <Text variant="small" weight="600" tabular>
          {t('nutrition.journal.total', {
            kcal: formatInt(values.kcal),
            protein: formatInt(values.proteinG),
            carbs: formatInt(values.carbsG),
            fat: formatInt(values.fatG),
          })}
        </Text>
        <Button
          icon="checkmark"
          label={t('nutrition.journal.addProduct')}
          disabled={g === null}
          loading={saving}
          onPress={() => g !== null && onAdd(product, g)}
        />
        <Button
          variant="ghost"
          icon="barcode-outline"
          label={t('nutrition.journal.otherProduct')}
          onPress={reset}
          style={{ alignSelf: 'flex-start' }}
        />
        <Text variant="caption" color="textSubtle">
          {t('nutrition.journal.offSource')}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="md">
      {scanning ? (
        <Scanner
          onScanned={(value) => void search(value, true)}
          onClose={() => setScanning(false)}
        />
      ) : (
        <Button
          icon="scan-outline"
          label={t('nutrition.journal.scan')}
          onPress={() => {
            setMessage(null);
            setScanning(true);
          }}
        />
      )}
      <HStack gap="sm" align="flex-end">
        <View style={{ flex: 1 }}>
          <TextField
            label={t('nutrition.journal.manualCode')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={20}
            onSubmitEditing={() => void search(code, false)}
          />
        </View>
        <Button
          variant="secondary"
          icon="search"
          label={t('nutrition.journal.search')}
          loading={loading}
          onPress={() => void search(code, false)}
        />
      </HStack>
      {loading ? <LoadingState /> : null}
      {message ? (
        <Text variant="small" color="textMuted">
          {message}
        </Text>
      ) : null}
    </VStack>
  );
}

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

function Scanner({
  onScanned,
  onClose,
}: {
  onScanned: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [engineReady, setEngineReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let alive = true;
    prepareBarcodeEngine()
      .catch(() => undefined)
      .then(() => alive && setEngineReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const handle = (result: BarcodeScanningResult) => {
    if (done.current || !result.data) return;
    done.current = true;
    onScanned(result.data);
  };

  let body: ReactNode;
  if (failed) {
    body = <Text color="textMuted">{t('nutrition.journal.cameraUnavailable')}</Text>;
  } else if (!permission || !engineReady) {
    body = <LoadingState />;
  } else if (!permission.granted) {
    body = (
      <VStack gap="sm">
        <Text color="textMuted">
          {permission.canAskAgain
            ? t('nutrition.journal.cameraPermission')
            : t('nutrition.journal.cameraDenied')}
        </Text>
        {permission.canAskAgain ? (
          <Button
            icon="camera-outline"
            label={t('nutrition.journal.allowCamera')}
            onPress={() => void requestPermission().catch(() => setFailed(true))}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
      </VStack>
    );
  } else {
    body = (
      <VStack gap="xs">
        <View
          style={{
            height: 260,
            borderRadius: theme.radius.md,
            overflow: 'hidden',
            backgroundColor: cameraColors.background,
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handle}
            onMountError={() => setFailed(true)}
          />
          {/* Cadre de visée */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '12%',
              right: '12%',
              top: '35%',
              bottom: '35%',
              borderWidth: 2,
              borderColor: cameraColors.frame,
              borderRadius: theme.radius.md,
            }}
          />
        </View>
        <Text variant="caption" color="textSubtle">
          {t('nutrition.journal.scanHelp')}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap="sm">
      {body}
      <Button
        variant="ghost"
        icon="close"
        label={t('nutrition.journal.stopScan')}
        onPress={onClose}
        style={{ alignSelf: 'flex-start' }}
      />
    </VStack>
  );
}
