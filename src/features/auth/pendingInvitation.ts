import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/kvStorage';

/**
 * Code d'invitation validé AVANT la création du compte. Il est conservé sur
 * l'appareil (même si l'adhérent doit d'abord confirmer son e-mail), puis utilisé
 * automatiquement dès que le compte est connecté.
 */
type PendingInvitationState = {
  code: string | null;
  setCode: (code: string | null) => void;
};

export const usePendingInvitation = create<PendingInvitationState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
    }),
    { name: 'pending-invitation', storage: createJSONStorage(() => kvStorage) },
  ),
);
