"use client";

import { useEffect, useRef } from "react";

type Region = "ALL" | "DE" | "US";

const RELEASE_OPEN_SELECTOR = [
  ".dropHero",
  ".nextTape button",
  ".tapeRowMain",
  ".stashOpen",
].join(", ");

const RELEASE_BACK_SELECTOR = ".detailToolbar > button:first-child";
const REGION_SELECTOR = ".regionSwitch button";
const REGION_STORAGE_KEY = "release-friday:region";

function parseRegion(value: string | null): Region {
  return value === "DE" || value === "US" ? value : "ALL";
}

function readStoredRegion(): Region {
  try {
    return parseRegion(window.sessionStorage.getItem(REGION_STORAGE_KEY));
  } catch {
    return "ALL";
  }
}

function storeRegion(region: Region) {
  try {
    window.sessionStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    // The in-memory value still preserves the filter for the current render cycle.
  }
}

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
  const selectedRegion = useRef<Region>("ALL");
  const restoreFrame = useRef<number | null>(null);

  useEffect(() => {
    selectedRegion.current = readStoredRegion();

    const applySavedRegion = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(REGION_SELECTOR));
      const button = buttons.find((candidate) => parseRegion(candidate.textContent?.trim().toUpperCase() ?? null) === selectedRegion.current);

      if (!button || button.getAttribute("aria-pressed") === "true") return false;

      button.click();
      return true;
    };

    const initialFrame = window.requestAnimationFrame(applySavedRegion);
    const observer = new MutationObserver(applySavedRegion);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const regionButton = target.closest<HTMLButtonElement>(REGION_SELECTOR);
      if (regionButton) {
        const region = parseRegion(regionButton.textContent?.trim().toUpperCase() ?? null);
        selectedRegion.current = region;
        storeRegion(region);
        return;
      }

      if (target.closest(RELEASE_OPEN_SELECTOR)) {
        previousScrollY.current = window.scrollY;
        hasSavedPosition.current = true;
        return;
      }

      if (!target.closest(RELEASE_BACK_SELECTOR) || !hasSavedPosition.current) return;

      const finishRestore = () => {
        restoreScrollPosition(previousScrollY.current);
        hasSavedPosition.current = false;
        restoreFrame.current = null;
      };

      const restoreWhenTapeReturns = () => {
        if (document.querySelector(".detailScreen")) {
          restoreFrame.current = window.requestAnimationFrame(restoreWhenTapeReturns);
          return;
        }

        if (applySavedRegion()) {
          restoreFrame.current = window.requestAnimationFrame(finishRestore);
          return;
        }

        finishRestore();
      };

      restoreFrame.current = window.requestAnimationFrame(restoreWhenTapeReturns);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
      window.cancelAnimationFrame(initialFrame);
      if (restoreFrame.current !== null) window.cancelAnimationFrame(restoreFrame.current);
    };
  }, []);

  return null;
}
