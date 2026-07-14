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

function renderPresentation(presentation: HTMLElement, source: string) {
  const nextMarkup = source === "LIVE"
    ? '<span class="spotifyCountdownLive">AVAILABLE NOW</span>'
    : (parseCountdown(source) ?? []).map((value, index) => `
      <span class="spotifyCountdownUnit">
        <strong>${String(value).padStart(2, "0")}</strong>
        <small>${LABELS[index]}</small>
      </span>
    `).join("");

  if (nextMarkup && presentation.innerHTML !== nextMarkup) {
    presentation.innerHTML = nextMarkup;
  }
}

function enhanceCountdown(root: HTMLElement) {
  const sourceNode = root.querySelector<HTMLElement>(":scope > strong");
  if (!sourceNode) return;

  const source = sourceNode.textContent?.trim() || "";
  if (source !== "LIVE" && !parseCountdown(source)) return;

  root.classList.add("spotifyCountdown");
  root.classList.toggle("isLive", source === "LIVE");

  sourceNode.classList.add("spotifyCountdownSource");
  const sourceLabel = sourceNode.previousElementSibling;
  if (sourceLabel instanceof HTMLElement) sourceLabel.classList.add("spotifyCountdownSource");

  let presentation = root.querySelector<HTMLElement>(":scope > .spotifyCountdownPresentation");
  if (!presentation) {
    presentation = document.createElement("div");
    presentation.className = "spotifyCountdownPresentation";
    presentation.setAttribute("aria-live", "polite");
    root.appendChild(presentation);
  }

  renderPresentation(presentation, source);
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
