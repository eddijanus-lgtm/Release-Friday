import type { ReleaseCountry, ReleaseKind } from "@/types/release";

export type ReleaseWriteStatus = "draft" | "published";

export type ReleaseFormValues = {
  artist: string;
  title: string;
  releaseDate: string;
  country: ReleaseCountry;
  kind: ReleaseKind;
  trackCount?: number;
  description?: string;
  genres: string[];
  spotifyUrl?: string;
  spotifyPreSaveUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  sourceUrl?: string;
};

export type EditableRelease = ReleaseFormValues & {
  id: string;
  status: ReleaseWriteStatus;
  coverUrl?: string;
  storagePath?: string;
  source: string;
};

export type ReleaseCreateResult = {
  id: string;
  status: ReleaseWriteStatus;
  releaseDate: string;
  action?: "created" | "updated" | "deleted";
};

export type ReleaseImportRunStatus =
  | "collecting"
  | "review"
  | "processing"
  | "completed"
  | "failed"
  | "rolled_back";

export type ReleaseImportRun = {
  id: string;
  targetDate: string;
  regionScope: "ALL" | ReleaseCountry;
  source: string;
  status: ReleaseImportRunStatus;
  stats: Record<string, number>;
  createdAt: string;
  completedAt?: string;
};

export type ReleaseCandidateStatus = "pending" | "accepted" | "rejected" | "duplicate";
export type ReleaseCandidateConfidence = "uncertain" | "likely" | "confirmed";
export type ReleaseCandidateCoverKind = "official" | "artist_fallback" | "missing";

export type ReleaseCandidateSource = {
  name?: string;
  url: string;
  type?: string;
};

export type ReleaseCandidate = ReleaseFormValues & {
  id: string;
  runId: string;
  coverUrl?: string;
  storagePath?: string;
  coverKind: ReleaseCandidateCoverKind;
  primarySource: string;
  sources: ReleaseCandidateSource[];
  confidence: ReleaseCandidateConfidence;
  warningCodes: string[];
  status: ReleaseCandidateStatus;
  matchedReleaseId?: string;
  createdAt: string;
};

export type ReleaseInboxBatchResult = {
  inserted?: number;
  updated?: number;
  skipped?: number;
  pending?: number;
  rejected?: number;
  restored?: number;
  failed?: number;
};
