"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const STORAGE_KEY = "release-friday:saved";
const BACKUP_KEY = "release-friday:cloud-stash";

function readIds(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeIds(key: string, ids: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

function mergeIntoLocal(cloudIds: Set<string>) {
  const local = readIds(STORAGE_KEY);
  const merged = new Set([...local, ...cloudIds]);
  writeIds(STORAGE_KEY, merged);
  return merged;
}

export function CloudStashRehydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let stopped = false;
    let watchdog: number | undefined;

    const restore = async () => {
      const cached = readIds(BACKUP_KEY);
      if (cached.size) mergeIntoLocal(cached);

      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || stopped) return;

      const { data, error } = await supabase
        .from("user_stash")
        .select("release_id")
        .eq("user_id", user.id);

      if (error || stopped) return;

      const cloudIds = new Set(
        (data ?? []).map((row) => `manual-${String(row.release_id)}`),
      );

      writeIds(BACKUP_KEY, cloudIds);
      mergeIntoLocal(cloudIds);

      const startedAt = Date.now();
      watchdog = window.setInterval(() => {
        if (Date.now() - startedAt > 5000) {
          if (watchdog) window.clearInterval(watchdog);
          return;
        }
        mergeIntoLocal(cloudIds);
      }, 100);
    };

    void restore();

    return () => {
      stopped = true;
      if (watchdog) window.clearInterval(watchdog);
    };
  }, []);

  return null;
}
