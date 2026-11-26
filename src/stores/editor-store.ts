"use client";

import { current } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  applyTemplateToDocument,
  FLAGSHIP_TEMPLATES,
} from "@/modules/invitation-engine/templates";
import {
  hydrateDocumentWithProfile,
  invitationDocumentV2Schema,
  type InvitationDocumentV2,
  type WeddingProfileData,
} from "@/modules/invitation-engine/schema";

const MAX_HISTORY_STEPS = 50;
const MAX_LOCAL_BACKUPS = 3;

export type InvitationStatus = "draft" | "published" | "paused";

export interface EditorConflict {
  serverVersion: number;
  serverDoc: InvitationDocumentV2;
}

export interface LocalBackupEntry {
  savedAt: string;
  doc: InvitationDocumentV2;
}

export interface EditorInitPayload {
  invitationId: string;
  slug: string;
  status: InvitationStatus;
  title: string;
  version: number;
  doc: InvitationDocumentV2;
  lastSavedAt?: string | null;
}

interface EditorState {
  invitationId: string;
  slug: string;
  status: InvitationStatus;
  title: string;
  version: number;
  doc: InvitationDocumentV2;
  past: InvitationDocumentV2[];
  future: InvitationDocumentV2[];
  isDirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  conflict: EditorConflict | null;
  tabConflictWarning: boolean;

  init: (payload: EditorInitPayload) => void;
  updateDoc: (updater: (draft: InvitationDocumentV2) => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  switchTemplate: (templateDoc: InvitationDocumentV2) => void;
  applyProfile: (profile: WeddingProfileData) => void;
  updateTitle: (title: string) => void;
  setSaving: (saving: boolean) => void;
  markSaved: (newVersion: number, updatedAt: string) => void;
  applyServerSnapshot: (payload: {
    version: number;
    doc: InvitationDocumentV2;
    title?: string;
    slug?: string;
    status?: InvitationStatus;
    updatedAt?: string | null;
  }) => void;
  setMeta: (payload: { slug?: string; status?: InvitationStatus }) => void;
  setConflict: (conflict: EditorConflict | null) => void;
  setTabConflict: (flag: boolean) => void;
}

function cloneDoc(doc: InvitationDocumentV2): InvitationDocumentV2 {
  if (typeof structuredClone === "function") {
    return structuredClone(doc);
  }
  return JSON.parse(JSON.stringify(doc)) as InvitationDocumentV2;
}

function getBackupStorageKey(id: string): string {
  return `matrimony_backup_${id}`;
}

/**
 * Saves a document snapshot to a 3-slot ring buffer in localStorage.
 */
export function saveLocalBackup(id: string, doc: InvitationDocumentV2): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const existing = loadLocalBackups(id);
    const next: LocalBackupEntry[] = [
      ...existing,
      { savedAt: new Date().toISOString(), doc: cloneDoc(doc) },
    ].slice(-MAX_LOCAL_BACKUPS);
    window.localStorage.setItem(getBackupStorageKey(id), JSON.stringify(next));
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}

/**
 * Loads up to 3 recent local backup snapshots for an invitation.
 */
export function loadLocalBackups(id: string): LocalBackupEntry[] {
  if (typeof window === "undefined" || !id) return [];
  try {
    const raw = window.localStorage.getItem(getBackupStorageKey(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid: LocalBackupEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      if (typeof obj.savedAt !== "string") continue;
      const docCheck = invitationDocumentV2Schema.safeParse(obj.doc);
      if (docCheck.success) {
        valid.push({ savedAt: obj.savedAt, doc: docCheck.data });
      }
    }
    return valid.slice(-MAX_LOCAL_BACKUPS);
  } catch {
    return [];
  }
}

const FALLBACK_DOC: InvitationDocumentV2 = FLAGSHIP_TEMPLATES[0].defaultDoc;

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    invitationId: "",
    slug: "",
    status: "draft",
    title: "",
    version: 1,
    doc: cloneDoc(FALLBACK_DOC),
    past: [],
    future: [],
    isDirty: false,
    saving: false,
    lastSavedAt: null,
    conflict: null,
    tabConflictWarning: false,

    init: (payload) =>
      set((state) => {
        state.invitationId = payload.invitationId;
        state.slug = payload.slug;
        state.status = payload.status;
        state.title = payload.title;
        state.version = payload.version;
        state.doc = cloneDoc(payload.doc);
        state.past = [];
        state.future = [];
        state.isDirty = false;
        state.saving = false;
        state.lastSavedAt = payload.lastSavedAt ?? null;
        state.conflict = null;
      }),

    updateDoc: (updater) =>
      set((state) => {
        const snapshot = cloneDoc(current(state.doc));
        state.past.push(snapshot);
        if (state.past.length > MAX_HISTORY_STEPS) {
          state.past.shift();
        }
        state.future = [];
        updater(state.doc);
        state.isDirty = true;
      }),

    undo: () =>
      set((state) => {
        if (state.past.length === 0) return;
        const previous = state.past.pop();
        if (!previous) return;
        state.future.push(cloneDoc(current(state.doc)));
        if (state.future.length > MAX_HISTORY_STEPS) {
          state.future.shift();
        }
        state.doc = previous;
        state.isDirty = true;
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return;
        const next = state.future.pop();
        if (!next) return;
        state.past.push(cloneDoc(current(state.doc)));
        if (state.past.length > MAX_HISTORY_STEPS) {
          state.past.shift();
        }
        state.doc = next;
        state.isDirty = true;
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    switchTemplate: (templateDoc) =>
      set((state) => {
        const currentPlain = cloneDoc(current(state.doc));
        state.past.push(currentPlain);
        if (state.past.length > MAX_HISTORY_STEPS) {
          state.past.shift();
        }
        state.future = [];
        state.doc = applyTemplateToDocument(currentPlain, templateDoc);
        state.isDirty = true;
      }),

    applyProfile: (profile) =>
      set((state) => {
        const currentPlain = cloneDoc(current(state.doc));
        state.past.push(currentPlain);
        if (state.past.length > MAX_HISTORY_STEPS) {
          state.past.shift();
        }
        state.future = [];
        state.doc = hydrateDocumentWithProfile(currentPlain, profile);
        state.isDirty = true;
      }),

    updateTitle: (title) =>
      set((state) => {
        state.title = title;
        state.isDirty = true;
      }),

    setSaving: (saving) =>
      set((state) => {
        state.saving = saving;
      }),

    markSaved: (newVersion, updatedAt) =>
      set((state) => {
        state.version = newVersion;
        state.lastSavedAt = updatedAt;
        state.isDirty = false;
        state.saving = false;
        state.conflict = null;
      }),

    applyServerSnapshot: (payload) =>
      set((state) => {
        state.version = payload.version;
        state.doc = cloneDoc(payload.doc);
        if (payload.title !== undefined) state.title = payload.title;
        if (payload.slug !== undefined) state.slug = payload.slug;
        if (payload.status !== undefined) state.status = payload.status;
        if (payload.updatedAt !== undefined) state.lastSavedAt = payload.updatedAt;
        state.past = [];
        state.future = [];
        state.isDirty = false;
        state.saving = false;
        state.conflict = null;
      }),

    setMeta: (payload) =>
      set((state) => {
        if (payload.slug !== undefined) state.slug = payload.slug;
        if (payload.status !== undefined) state.status = payload.status;
      }),

    setConflict: (conflict) =>
      set((state) => {
        state.conflict = conflict;
        state.saving = false;
      }),

    setTabConflict: (flag) =>
      set((state) => {
        state.tabConflictWarning = flag;
      }),
  })),
);
