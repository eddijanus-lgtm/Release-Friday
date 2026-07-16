"use client";

import { useEffect, useRef } from "react";

const RELEASE_OPEN_SELECTOR = [
  ".dropHero",
  ".nextTape button",
  ".tapeRowMain",
  ".stashOpen",
].join(", ");

const RELEASE_BACK_SELECTOR = ".detailToolbar > button:first-child";

function restoreScrollPosition(top: number) {
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;

  root.style.scrollBehavior = "auto";
  window.scrollTo({ top, left: 0, behavior: "auto" });

  window.requestAnimationFrame(() => {
    root.style.scrollBehavior = previousScrollBehavior;
  });
}

export function TapeScrollRestoration() {
  const previousScrollY = useRef(0);
  const hasSavedPosition = useRef(false);
  const restoreFrame = useRef<number | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest(RELEASE_OPEN_SELECTOR)) {
        previousScrollY.current = window.scrollY;
        hasSavedPosition.current = true;
        return;
      }

      if (!target.closest(RELEASE_BACK_SELECTOR) || !hasSavedPosition.current) return;

      const restoreWhenTapeReturns = () => {
        if (document.querySelector(".detailScreen")) {
          restoreFrame.current = window.requestAnimationFrame(restoreWhenTapeReturns);
          return;
        }

        restoreScrollPosition(previousScrollY.current);
        hasSavedPosition.current = false;
        restoreFrame.current = null;
      };

      restoreFrame.current = window.requestAnimationFrame(restoreWhenTapeReturns);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      if (restoreFrame.current !== null) window.cancelAnimationFrame(restoreFrame.current);
    };
  }, []);

  return null;
}
