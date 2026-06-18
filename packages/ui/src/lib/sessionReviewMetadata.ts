import type { Session } from '@opencode-ai/sdk/v2';

export type SessionMetadataRecord = Record<string, unknown>;

type AiYoMetadata = {
  kind?: 'review';
  originalSessionID?: string;
  reviewSessionID?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const getSessionMetadata = (session: Session | null | undefined): SessionMetadataRecord => {
  const metadata = (session as (Session & { metadata?: unknown }) | null | undefined)?.metadata;
  return isRecord(metadata) ? metadata : {};
};

const getAiYoMetadata = (metadata: SessionMetadataRecord): AiYoMetadata => {
  const value = metadata.aiyo;
  return isRecord(value) ? value as AiYoMetadata : {};
};

export const getReviewSessionID = (session: Session | null | undefined): string | null => {
  const value = getAiYoMetadata(getSessionMetadata(session)).reviewSessionID;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const getOriginalSessionID = (session: Session | null | undefined): string | null => {
  const value = getAiYoMetadata(getSessionMetadata(session)).originalSessionID;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const isReviewSession = (session: Session | null | undefined): boolean =>
  getAiYoMetadata(getSessionMetadata(session)).kind === 'review' && Boolean(getOriginalSessionID(session));

export const withReviewSessionLink = (
  metadata: SessionMetadataRecord,
  reviewSessionID: string,
): SessionMetadataRecord => {
  const current = getAiYoMetadata(metadata);
  return {
    ...metadata,
    aiyo: {
      ...current,
      reviewSessionID,
    },
  };
};

export const withReviewSessionMarker = (
  metadata: SessionMetadataRecord,
  originalSessionID: string,
): SessionMetadataRecord => {
  const current = getAiYoMetadata(metadata);
  return {
    ...metadata,
    aiyo: {
      ...current,
      kind: 'review' as const,
      originalSessionID,
    },
  };
};

export const withoutReviewSessionLink = (
  metadata: SessionMetadataRecord,
  reviewSessionID: string,
): SessionMetadataRecord => {
  const current = getAiYoMetadata(metadata);
  if (current.reviewSessionID !== reviewSessionID) return metadata;

  const restAiYo = { ...current };
  delete restAiYo.reviewSessionID;
  const next: SessionMetadataRecord = { ...metadata };
  if (Object.keys(restAiYo).length > 0) {
    next.aiyo = restAiYo;
  } else {
    delete next.aiyo;
  }
  return next;
};
