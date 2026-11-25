/**
 * Web : si le navigateur n'a pas de lecteur de codes-barres intégré (Safari, Firefox),
 * expo-camera utilise le module « barcode-detector » (zxing en WebAssembly).
 * On lui indique notre propre copie du moteur (public/zxing) au lieu d'un CDN externe.
 */
let prepared: Promise<void> | null = null;

export function prepareBarcodeEngine(): Promise<void> {
  prepared ??= (async () => {
    if ('BarcodeDetector' in globalThis) return;
    const { setZXingModuleOverrides } = await import('barcode-detector');
    setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + path,
    });
  })();
  return prepared;
}
