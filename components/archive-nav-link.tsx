"use client";

import { useEffect } from "react";

export function ArchiveNavLink() {
  useEffect(() => {
    const syncNavigation = () => {
      document.querySelectorAll<HTMLElement>(".tapeNav").forEach((nav) => {
        const buttons = [...nav.querySelectorAll<HTMLButtonElement>("button")];
        const stashButton = buttons.find((button) => button.textContent?.trim() === "STASH");
        if (!stashButton || stashButton.dataset.archiveReady === "true") return;

        stashButton.dataset.archiveReady = "true";
        stashButton.textContent = "ARCHIVE";
        stashButton.setAttribute("aria-label", "Archive");
        stashButton.onclick = (event) => {
          event.preventDefault();
          window.location.href = "./archive/";
        };
      });
    };

    syncNavigation();
    const observer = new MutationObserver(syncNavigation);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
