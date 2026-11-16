import { useState, type ReactNode } from 'react';
import { Animated, PanResponder, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './ui/Icon';

type Props<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Rendu d'un élément ; `handle` est la poignée à placer où l'on veut. */
  renderItem: (item: T, handle: ReactNode, index: number) => ReactNode;
  onReorder: (orderedKeys: string[]) => void;
  handleLabel: string;
  gap?: number;
};

/** Calcule le nouvel index après un déplacement vertical de `dy` pixels. */
export function targetIndex(
  heights: readonly number[],
  from: number,
  dy: number,
  gap: number,
): number {
  let index = from;
  let remaining = dy;
  if (dy > 0) {
    while (index < heights.length - 1) {
      const next = (heights[index + 1] ?? 0) + gap;
      if (remaining < next / 2) break;
      remaining -= next;
      index++;
    }
  } else {
    while (index > 0) {
      const prev = (heights[index - 1] ?? 0) + gap;
      if (-remaining < prev / 2) break;
      remaining += prev;
      index--;
    }
  }
  return index;
}

/**
 * Liste réordonnable par glisser-déposer (souris sur ordinateur, doigt sur mobile).
 * Les boutons « monter / descendre » restent proposés pour l'accessibilité.
 */
export function ReorderList<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  handleLabel,
  gap = 12,
}: Props<T>) {
  const theme = useTheme();
  // Hauteurs mesurées des éléments (simple tableau mutable, pas utilisé pour l'affichage).
  const [heights] = useState<number[]>(() => []);
  const [dragging, setDragging] = useState<number | null>(null);
  const [translate] = useState(() => new Animated.Value(0));

  const makeHandle = (index: number) => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translate.setValue(0);
        setDragging(index);
      },
      onPanResponderMove: (_, g) => translate.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        const to = targetIndex(heights, index, g.dy, gap);
        setDragging(null);
        translate.setValue(0);
        if (to !== index) {
          const keys = items.map(keyOf);
          const [moved] = keys.splice(index, 1);
          if (moved !== undefined) keys.splice(to, 0, moved);
          onReorder(keys);
        }
      },
      onPanResponderTerminate: () => {
        setDragging(null);
        translate.setValue(0);
      },
    });
    return (
      <View
        {...responder.panHandlers}
        accessibilityLabel={handleLabel}
        accessibilityHint="Glisser vers le haut ou le bas"
        style={{ padding: 6, cursor: 'grab' } as object}
      >
        <Icon name="reorder-three" color="textSubtle" size={22} />
      </View>
    );
  };

  return (
    <View style={{ gap }}>
      {items.map((item, index) => (
        <Animated.View
          key={keyOf(item)}
          onLayout={(e: LayoutChangeEvent) => {
            heights[index] = e.nativeEvent.layout.height;
          }}
          style={
            dragging === index
              ? {
                  transform: [{ translateY: translate }],
                  zIndex: 10,
                  opacity: 0.9,
                  shadowColor: '#000',
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  borderRadius: theme.radius.lg,
                }
              : undefined
          }
        >
          {renderItem(item, makeHandle(index), index)}
        </Animated.View>
      ))}
    </View>
  );
}
