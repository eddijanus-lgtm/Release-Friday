"use client";

import { useCallback, useEffect, useRef } from "react";

type ReleaseDetailHistoryOwner = "current" | "overlay";

type UseReleaseDetailHistoryOptions = {
  isOpen: boolean;
  owner: ReleaseDetailHistoryOwner;
  onClose: () => void;
};

const DETAIL_STATE_KEY = "releaseFridayDetail";
const SCROLL_STATE_KEY = "releaseFridayScrollY";

function historyState(value: unknown = window.history.state): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function currentScrollPosition() {
  // Safari can report a zero scrollingElement offset while window.scrollY
  // still contains the real page position. Keep the largest browser signal
  // so a swipe-back from the inline archive does not restore to the top.
  return Math.max(
    window.scrollY,
    window.pageYOffset,
    document.scrollingElement?.scrollTop ?? 0,
    document.documentElement.scrollTop,
    document.body?.scrollTop ?? 0,
  );
}

function restoreScrollPosition(top: number) {
  window.scrollTo({ top, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = top;
  if (document.body) document.body.scrollTop = top;
}

export function useReleaseDetailHistory({ isOpen, owner, onClose }: UseReleaseDetailHistoryOptions) {
  const previousScrollPosition = useRef(0);
  const shouldRestoreScroll = useRef(false);
  const suppressNextPopRestore = useRef(false);

  const beginDetailNavigation = useCallback(() => {
    const top = currentScrollPosition();
    const listState: Record<string, unknown> = {
      ...historyState(),
      [SCROLL_STATE_KEY]: top,
    };
    delete listState[DETAIL_STATE_KEY];

    previousScrollPosition.current = top;
    shouldRestoreScroll.current = false;
    suppressNextPopRestore.current = false;

    try {
      window.history.replaceState(listState, "");
      window.history.pushState({
        ...listState,
        [DETAIL_STATE_KEY]: owner,
      }, "");
    } catch {
      // The detail view still works if a browser blocks same-document history updates.
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [owner]);

  const finishDetailNavigation = useCallback((restoreScroll: boolean) => {
    shouldRestoreScroll.current = restoreScroll;
    suppressNextPopRestore.current = !restoreScroll;
    onClose();

    if (historyState()[DETAIL_STATE_KEY] === owner) {
      window.history.back();
    }
  }, [onClose, owner]);

  const closeDetailNavigation = useCallback(() => {
    finishDetailNavigation(true);
  }, [finishDetailNavigation]);

  const dismissDetailNavigation = useCallback(() => {
    finishDetailNavigation(false);
  }, [finishDetailNavigation]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (event: PopStateEvent) => {
      const state = historyState(event.state);
      const storedPosition = state[SCROLL_STATE_KEY];
      if (typeof storedPosition === "number") {
        previousScrollPosition.current = storedPosition;
      }

      if (suppressNextPopRestore.current) {
        suppressNextPopRestore.current = false;
        shouldRestoreScroll.current = false;
      } else {
        shouldRestoreScroll.current = true;
      }
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen || !shouldRestoreScroll.current) return;

    shouldRestoreScroll.current = false;
    const top = previousScrollPosition.current;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      restoreScrollPosition(top);
      secondFrame = window.requestAnimationFrame(() => restoreScrollPosition(top));
    });
    const firstCheck = window.setTimeout(() => restoreScrollPosition(top), 120);
    const finalCheck = window.setTimeout(() => restoreScrollPosition(top), 320);

    restoreScrollPosition(top);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(firstCheck);
      window.clearTimeout(finalCheck);
    };
  }, [isOpen]);

  return {
    beginDetailNavigation,
    closeDetailNavigation,
    dismissDetailNavigation,
  };
}
