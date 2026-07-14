"use client";

import { useEffect } from "react";

const supportedTabs = new Set(["drop", "find", "stash", "me"]);

export function HashTabBridge() {
  useEffect(() => {
    const activateHashTab = () => {
      const tab = window.location.hash.slice(1).toLowerCase();
      if (!supportedTabs.has(tab)) return;

      const button = document.querySelector<HTMLButtonElement>(
        `.tapeNav button[aria-label="${tab === "me" ? "Me" : tab.charAt(0).toUpperCase() + tab.slice(1)}"]`,
      );

      button?.click();
    };

    const frame = window.requestAnimationFrame(activateHashTab);
    window.addEventListener("hashchange", activateHashTab);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", activateHashTab);
    };
  }, []);

  return null;
}
