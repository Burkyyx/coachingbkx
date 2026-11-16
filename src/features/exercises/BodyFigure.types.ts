import type { BodyGender } from './bodyShapes';
import type { BodyView } from './bodyZones';

export type BodyFigureProps = {
  gender: BodyGender;
  view: BodyView;
  width: number;
  /** Zones (slugs) surlignées. */
  highlighted: readonly string[];
  /** Zones surlignées en plus discret (muscles secondaires). */
  secondary?: readonly string[];
  isClickable: (slug: string) => boolean;
  onPress: (slug: string) => void;
  colors: { muscle: string; selected: string; inert: string; secondary?: string };
  /** Libellé accessible d'une zone (web). */
  labelFor?: (slug: string) => string;
};
