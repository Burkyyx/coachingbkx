import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { Stepper } from '../Stepper';

async function setup(value: number | null, onChange = jest.fn()) {
  await render(
    <ThemeProvider>
      <Stepper label="Charge" value={value} onChange={onChange} step={2.5} decimals={1} />
    </ThemeProvider>,
  );
  return onChange;
}

describe('Stepper', () => {
  it('augmente la valeur du pas configuré', async () => {
    const onChange = await setup(60);
    await fireEvent.press(screen.getByLabelText('Augmenter Charge'));
    expect(onChange).toHaveBeenCalledWith(62.5);
  });

  it('ne descend pas sous le minimum', async () => {
    const onChange = await setup(1);
    await fireEvent.press(screen.getByLabelText('Diminuer Charge'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('accepte la virgule comme séparateur décimal', async () => {
    const onChange = await setup(60);
    const input = screen.getByLabelText('Charge');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '62,5');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(62.5);
  });

  it('affiche la valeur avec une virgule', async () => {
    await setup(62.5);
    expect(screen.getByDisplayValue('62,5')).toBeTruthy();
  });
});
