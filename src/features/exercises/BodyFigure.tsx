import Svg, { Path } from 'react-native-svg';

import type { BodyFigureProps } from './BodyFigure.types';
import { bodyShapes } from './bodyShapes';

/** Silhouette cliquable (iOS / Android) avec react-native-svg. */
export function BodyFigure({
  gender,
  view,
  width,
  highlighted,
  secondary = [],
  isClickable,
  onPress,
  colors,
}: BodyFigureProps) {
  const { viewBox, parts } = bodyShapes(gender, view);
  return (
    <Svg viewBox={viewBox} width={width} height={width * 2}>
      {parts.map((part) => {
        const clickable = isClickable(part.slug);
        const fill = highlighted.includes(part.slug)
          ? colors.selected
          : secondary.includes(part.slug) && colors.secondary
            ? colors.secondary
            : clickable
              ? colors.muscle
              : colors.inert;
        return part.paths.map((d, i) => (
          <Path
            key={`${part.slug}-${i}`}
            d={d}
            fill={fill}
            onPress={clickable ? () => onPress(part.slug) : undefined}
          />
        ));
      })}
    </Svg>
  );
}
