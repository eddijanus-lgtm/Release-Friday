"use client";

import { useEffect } from "react";

export function ArchiveNavLink() {
  useEffect(() => {
    const ensureLink = () => {
      document.querySelectorAll<HTMLElement>(".tapeNav").forEach((nav) => {
        if (nav.querySelector(".archiveNavLink")) return;
        const link = document.createElement("a");
        link.className = "archiveNavLink";
        link.href = "archive/";
        link.textContent = "ARCHIVE";
        link.setAttribute("aria-label", "Archive");
        nav.appendChild(link);
      });
    };

    ensureLink();
    const observer = new MutationObserver(ensureLink);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
