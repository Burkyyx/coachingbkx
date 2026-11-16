import type { BodyFigureProps } from './BodyFigure.types';
import { bodyShapes } from './bodyShapes';

/**
 * Silhouette cliquable (web) en SVG natif du navigateur : clics fiables et
 * curseur « main » sur les zones actives.
 */
export function BodyFigure({
  gender,
  view,
  width,
  highlighted,
  secondary = [],
  isClickable,
  onPress,
  colors,
  labelFor,
}: BodyFigureProps) {
  const { viewBox, parts } = bodyShapes(gender, view);
  return (
    <svg viewBox={viewBox} width={width} height={width * 2} style={{ display: 'block' }}>
      {parts.map((part) => {
        const clickable = isClickable(part.slug);
        const selected = highlighted.includes(part.slug);
        const fill = selected
          ? colors.selected
          : secondary.includes(part.slug) && colors.secondary
            ? colors.secondary
            : clickable
              ? colors.muscle
              : colors.inert;
        return (
          <g
            key={part.slug}
            role={clickable ? 'button' : undefined}
            aria-label={clickable ? labelFor?.(part.slug) : undefined}
            aria-pressed={clickable ? selected : undefined}
            onClick={clickable ? () => onPress(part.slug) : undefined}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
          >
            {clickable && labelFor ? <title>{labelFor(part.slug)}</title> : null}
            {part.paths.map((d, i) => (
              <path key={i} d={d} fill={fill} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
