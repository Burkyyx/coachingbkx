import { csvCell, setsToCsv } from '../export';

describe('export CSV', () => {
  it('formate les cellules à la française et échappe les caractères spéciaux', () => {
    expect(csvCell(62.5)).toBe('62,5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "dur"')).toBe('"dit ""dur"""');
    expect(csvCell(true)).toBe('true');
  });
  it('produit un en-tête et une ligne par série', () => {
    const csv = setsToCsv([
      {
        performed_at: '2026-11-16T18:00:00Z',
        exercise_name: 'Squat barre',
        set_type: 'working',
        load_kg: 80,
        reps: 8,
        rir: 2,
        completed: true,
      },
    ]);
    const [header, line] = csv.split('\n');
    expect(header).toBe(
      'date;exercice;type;charge_kg;reps;rir;rpe;repos_reel_s;repos_prevu_s;validee;note',
    );
    expect(line).toBe('2026-11-16T18:00:00Z;Squat barre;working;80;8;2;;;;true;');
  });
});
