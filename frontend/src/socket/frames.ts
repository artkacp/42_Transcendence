// src/socket/frames.ts
// Every frame on /ws/, exactly as backend/core/consumers.py sends and accepts them
// (contract: knowledge_base/430_websocket_contract.md). Keys are snake_case, ids are UUID strings,
// embedded objects are the same JSON as the matching REST endpoint.
import type { AppNotification, Inquiry, InquiryMessage, InquiryStage, Pet } from '../data/types';

// ── server → client ─────────────────────────────────────────────────────
export type ServerFrame =
  | { type: 'auth.ok' }
  | { type: 'auth.error' } // the server closes with 4401 right after
  | { type: 'presence.changed'; user_id: string; online: boolean }
  | { type: 'chat.message'; message: InquiryMessage } // also comes back to the sender
  | { type: 'inquiry.created'; inquiry: Inquiry }
  | { type: 'inquiry.stage_changed'; inquiry_id: string; stage: InquiryStage }
  | { type: 'pet.published'; pet: Pet }
  // pet.adopted / pet.removed can arrive twice (browse + pet.<id>): handle them idempotently
  | { type: 'pet.adopted'; pet_id: string; adopted_by_id: string }
  | { type: 'pet.removed'; pet_id: string }
  | { type: 'notification.created'; notification: AppNotification }
  | { type: 'error'; for: string; detail: string }; // `for` = the type of the rejected client frame

export type ServerFrameType = ServerFrame['type'];

// FrameOf<'pet.removed'> → { type: 'pet.removed'; pet_id: string }
export type FrameOf<T extends ServerFrameType> = Extract<ServerFrame, { type: T }>;

// ── client → server (only after auth.ok; the auth frame itself is sent by useSocket) ──
export type ClientFrame =
  | { type: 'chat.send'; inquiry_id: string; body?: string; attachment_ids?: string[] }
  | { type: 'pet.subscribe'; pet_id: string }
  | { type: 'pet.unsubscribe'; pet_id: string };
