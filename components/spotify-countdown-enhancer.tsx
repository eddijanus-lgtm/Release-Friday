"use client";

import { useEffect } from "react";

const LABELS = ["DAYS", "HOURS", "MINUTES", "SECONDS"];

function parseCountdown(value: string) {
  if (value === "LIVE") return null;
  const parts = value.split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;

  const [totalHours, minutes, seconds] = parts;
  return [Math.floor(totalHours / 24), totalHours % 24, minutes, seconds];
}

function enhanceCountdown(root: HTMLElement) {
  const sourceNode = root.querySelector<HTMLElement>(":scope > strong");
  if (!sourceNode) return;

  const source = sourceNode.textContent?.trim() || "";
  if (source === "LIVE") {
    root.classList.add("spotifyCountdown", "isLive");
    root.innerHTML = '<span class="spotifyCountdownLive">AVAILABLE NOW</span>';
    return;
  }

  const values = parseCountdown(source);
  if (!values) return;

  root.classList.add("spotifyCountdown");
  root.classList.remove("isLive");
  root.innerHTML = values.map((value, index) => `
    <span class="spotifyCountdownUnit">
      <strong>${String(value).padStart(2, "0")}</strong>
      <small>${LABELS[index]}</small>
    </span>
  `).join("");
}

export function SpotifyCountdownEnhancer() {
  useEffect(() => {
    const update = () => {
      document.querySelectorAll<HTMLElement>(".countdownTape").forEach(enhanceCountdown);
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
