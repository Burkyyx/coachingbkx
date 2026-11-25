import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, Sheet, Text, TextField, VStack, useFeedback } from '@/components/ui';
import {
  addDays,
  formatFrenchDate,
  isoWeekday,
  maskFrenchDate,
  parseFrenchDate,
  todayLocal,
} from '@/core';
import { toUserMessage } from '@/lib/errors';

import { useActiveAdherents, useAssignProgram } from './api';

/** Lundi prochain (ou aujourd'hui si on est lundi). */
function nextMonday(): string {
  const today = todayLocal();
  const wd = isoWeekday(today);
  return wd === 1 ? today : addDays(today, 8 - wd);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  onAssigned?: (ids: string[]) => void;
};

/** Assigner un modèle à un ou plusieurs adhérents (une copie personnalisable chacun). */
export function AssignSheet({ visible, onClose, programId, programName, onAssigned }: Props) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const { data: adherents = [] } = useActiveAdherents();
  const assign = useAssignProgram();
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(formatFrenchDate(nextMonday()));
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const iso = parseFrenchDate(date);
    if (!iso) {
      setError(t('onboarding.invalidDate'));
      return;
    }
    setError(null);
    try {
      const ids = await assign.mutateAsync({
        sourceId: programId,
        adherentIds: selected,
        startDate: iso,
        activate,
      });
      toast(t('programs.assignDone', { count: selected.length }));
      setSelected([]);
      onClose();
      onAssigned?.(ids ?? []);
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('programs.assignTitle', { name: programName })}
      footer={
        <Button
          label={t('programs.assign')}
          icon="send"
          disabled={selected.length === 0}
          loading={assign.isPending}
          onPress={() => void submit()}
          fullWidth
        />
      }
    >
      <Text weight="600">{t('programs.assignTo')}</Text>
      {adherents.length === 0 ? <Text color="textMuted">{t('programs.noAdherents')}</Text> : null}
      <VStack gap="xs">
        {adherents.map((a) => (
          <Checkbox
            key={a.id}
            label={[a.first_name, a.last_name].filter(Boolean).join(' ') || a.nickname || '—'}
            checked={selected.includes(a.id)}
            onChange={(v) => setSelected((s) => (v ? [...s, a.id] : s.filter((x) => x !== a.id)))}
          />
        ))}
      </VStack>
      <TextField
        label={t('programs.startDate')}
        value={date}
        onChangeText={(v) => setDate((prev) => maskFrenchDate(v, prev))}
        placeholder="JJ/MM/AAAA"
        keyboardType="number-pad"
        inputMode="numeric"
      />
      <Checkbox label={t('programs.assignActivate')} checked={activate} onChange={setActivate} />
      {error ? <Text color="danger">{error}</Text> : null}
    </Sheet>
  );
}
