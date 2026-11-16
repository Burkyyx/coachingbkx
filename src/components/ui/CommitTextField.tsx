import { useState } from 'react';

import { TextField } from './TextField';

type Props = {
  label: string;
  value: string;
  /** Appelé à la sortie du champ si la valeur a changé. */
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
};

/** Champ texte enregistré automatiquement quand on le quitte (iOS, Android, web). */
export function CommitTextField({ label, value, onCommit, multiline, placeholder, hint }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <TextField
      label={label}
      hint={hint}
      placeholder={placeholder}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={multiline ? undefined : commit}
      multiline={multiline}
    />
  );
}
