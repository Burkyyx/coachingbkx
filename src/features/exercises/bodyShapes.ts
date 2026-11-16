/**
 * Tracés du corps (face / dos, homme / femme) repris de react-native-body-highlighter
 * (licence MIT). On n'utilise que les données : le dessin est fait par BodyFigure.
 */
import { bodyBack } from 'react-native-body-highlighter/dist/assets/bodyBack';
import { bodyFemaleBack } from 'react-native-body-highlighter/dist/assets/bodyFemaleBack';
import { bodyFemaleFront } from 'react-native-body-highlighter/dist/assets/bodyFemaleFront';
import { bodyFront } from 'react-native-body-highlighter/dist/assets/bodyFront';

import type { BodyView } from './bodyZones';

export type BodyGender = 'male' | 'female';
export type BodyShape = { slug: string; paths: string[] };

const VIEWBOX: Record<BodyGender, Record<BodyView, string>> = {
  male: { front: '0 0 724 1448', back: '724 0 724 1448' },
  female: { front: '-50 -40 734 1538', back: '756 0 774 1448' },
};

const SOURCES = {
  male: { front: bodyFront, back: bodyBack },
  female: { front: bodyFemaleFront, back: bodyFemaleBack },
} as const;

export function bodyShapes(gender: BodyGender, view: BodyView) {
  const parts: BodyShape[] = SOURCES[gender][view]
    .filter((p) => p.slug)
    .map((p) => ({
      slug: p.slug as string,
      paths: [...(p.path?.common ?? []), ...(p.path?.left ?? []), ...(p.path?.right ?? [])],
    }));
  return { viewBox: VIEWBOX[gender][view], parts };
}
