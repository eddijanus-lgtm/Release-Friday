"use client";

import { useEffect } from "react";

const supportedTabs = new Set(["drop", "find", "me"]);

export function TabDeepLink() {
  useEffect(() => {
    const openRequestedTab = () => {
      const tab = window.location.hash.replace(/^#/, "").toLowerCase();
      if (!supportedTabs.has(tab)) return;

      const label = tab.toUpperCase();
      const button = [...document.querySelectorAll<HTMLButtonElement>(".tapeNav button")]
        .find((item) => item.textContent?.trim() === label);
      if (!button) return;

      button.click();
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };

    openRequestedTab();
    const observer = new MutationObserver(openRequestedTab);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", openRequestedTab);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", openRequestedTab);
    };
  }, []);

  return null;
}
