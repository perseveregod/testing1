import { config } from "../config";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

// One store per process. Kept on globalThis so dev hot-reloads don't create
// a second LocalStore that would overwrite the first one's file.
const g = globalThis as unknown as { __havenStore?: Store };

export function getStore(): Store {
  if (!g.__havenStore) {
    g.__havenStore =
      config.store.kind === "supabase"
        ? new SupabaseStore(config.store.supabaseUrl, config.store.supabaseServiceRoleKey)
        : new LocalStore(config.store.localFile);
  }
  return g.__havenStore;
}

/** Tests only. */
export function setStoreForTests(store: Store) {
  g.__havenStore = store;
}

export type { Store } from "./types";
