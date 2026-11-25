import { useTranslation } from 'react-i18next';

import { useFeedback } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';

import { useDeleteAdherent } from './adherent';

/** Suppression définitive d'un adhérent, avec double confirmation. */
export function useConfirmDeleteAdherent() {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const remove = useDeleteAdherent();

  const run = async (adherentId: string, name: string, onDone?: () => void) => {
    const first = await confirm({
      title: t('adherent.deleteAdherent'),
      message: t('adherent.deleteAdherentConfirm', { name }),
      destructive: true,
      confirmLabel: t('adherent.deleteAdherent'),
    });
    if (!first) return;
    const second = await confirm({
      title: t('adherent.deleteAdherent'),
      message: t('adherent.deleteAdherentConfirm2', { name }),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!second) return;
    remove.mutate(adherentId, {
      onSuccess: () => {
        toast(t('adherent.deleteAdherentDone'));
        onDone?.();
      },
      onError: (e) => toast(toUserMessage(e)),
    });
  };

  return { run, pending: remove.isPending };
}
