import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Raccourcis clavier (web / ordinateur uniquement). Ignorés pendant la saisie
 * dans un champ de texte.
 */
export function useKeyboardShortcuts(map: Record<string, () => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const action = ref.current[e.key.toLowerCase()] ?? ref.current[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
