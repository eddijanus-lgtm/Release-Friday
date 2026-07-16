"use client";

import { useCallback, useRef, type TouchEventHandler } from "react";

type TouchPoint = {
  x: number;
  y: number;
};

type SwipeBackHandlers = {
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchCancel: TouchEventHandler<HTMLElement>;
};

const MIN_SWIPE_DISTANCE = 64;
const MAX_SWIPE_DISTANCE = 110;
const HORIZONTAL_INTENT_RATIO = 1.35;

export function isSwipeBackGesture(start: TouchPoint, end: TouchPoint, viewportWidth: number) {
  const horizontalDistance = end.x - start.x;
  const verticalDistance = Math.abs(end.y - start.y);
  const requiredDistance = Math.min(
    MAX_SWIPE_DISTANCE,
    Math.max(MIN_SWIPE_DISTANCE, viewportWidth * 0.18),
  );

  return horizontalDistance >= requiredDistance
    && horizontalDistance >= verticalDistance * HORIZONTAL_INTENT_RATIO;
}

export function useSwipeBack(onSwipeBack: () => void): SwipeBackHandlers {
  const startPoint = useRef<TouchPoint | null>(null);

  const reset = useCallback(() => {
    startPoint.current = null;
  }, []);

  const onTouchStart = useCallback<TouchEventHandler<HTMLElement>>((event) => {
    if (event.touches.length !== 1) {
      reset();
      return;
    }

    const touch = event.touches[0];
    startPoint.current = { x: touch.clientX, y: touch.clientY };
  }, [reset]);

  const onTouchEnd = useCallback<TouchEventHandler<HTMLElement>>((event) => {
    const start = startPoint.current;
    reset();
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    if (isSwipeBackGesture(
      start,
      { x: touch.clientX, y: touch.clientY },
      window.innerWidth,
    )) {
      onSwipeBack();
    }
  }, [onSwipeBack, reset]);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel: reset,
  };
}
