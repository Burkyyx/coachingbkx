import { useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Remplissage automatique (trousseau iCloud / Safari, gestionnaires de mots de passe) :
 * le navigateur peut remplir un champ à l'écran SANS prévenir l'app (aucun événement),
 * surtout le 2ᵉ champ (mot de passe, confirmation). L'app croirait alors le champ vide.
 *
 * Avant l'envoi d'un formulaire, on relit donc la valeur réellement affichée par chaque
 * champ (web uniquement ; sur mobile natif, les événements arrivent toujours).
 */
export function useAutofillSync<F extends string>(apply: (name: F, value: string) => void) {
  const nodes = useRef(new Map<F, { value?: unknown }>());

  /** À passer en `ref` du champ. */
  const bind = (name: F) => (node: unknown) => {
    if (node && typeof node === 'object') nodes.current.set(name, node as { value?: unknown });
    else nodes.current.delete(name);
  };

  /** À appeler juste avant la validation du formulaire. */
  const sync = () => {
    if (Platform.OS !== 'web') return;
    nodes.current.forEach((node, name) => {
      if (typeof node.value === 'string') apply(name, node.value);
    });
  };

  return { bind, sync };
}
