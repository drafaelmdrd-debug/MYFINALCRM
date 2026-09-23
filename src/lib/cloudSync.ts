import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const TABLE = 'crm_state';

/** Fired whenever a load/save to Supabase fails, so the UI can tell the user. */
export const CLOUD_SYNC_ERROR_EVENT = 'cloudsync:error';
export const CLOUD_SYNC_OK_EVENT = 'cloudsync:ok';

export function reportError(key: string, action: 'load' | 'save', message: string) {
  console.error(`[cloudSync] Failed to ${action} "${key}": ${message}`);
  window.dispatchEvent(
    new CustomEvent(CLOUD_SYNC_ERROR_EVENT, { detail: { key, action, message } })
  );
}

export function reportOk(key: string) {
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_OK_EVENT, { detail: { key } }));
}

/** Keys that have local edits not yet confirmed saved in Supabase. */
const pendingKeys = new Set<string>();

/** True while any `useCloudState` value still has an unsaved edit (used to warn before a refresh/close). */
export function hasPendingCloudWrites(): boolean {
  return pendingKeys.size > 0;
}

const SAVE_RETRY_MS = 5000;

/**
 * Drop-in replacement for `useState` + localStorage, backed by the shared
 * Supabase `crm_state` table.
 *
 * Returns [value, setValue, loaded] — same shape as useState plus a loaded flag.
 */
export function useCloudState<T>(key: string, initialValue: T, enabled: boolean) {
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);

  // JSON of the last value we know is stored in Supabase (either loaded from it,
  // received from it via realtime, or successfully written to it). Comparing
  // against this — instead of a one-shot boolean flag — means a real edit can
  // never be swallowed, and our own realtime "echo" never overwrites newer edits.
  const lastSyncedJson = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestState = useRef<T>(initialValue);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestState.current = state;

  // Initial load from Supabase
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from(TABLE).select('value').eq('id', key).maybeSingle();
      if (cancelled) return;

      if (error) {
        // Do NOT mark as loaded: otherwise we'd later overwrite the real data
        // with placeholder data, or pretend edits are being saved.
        reportError(key, 'load', error.message);
        return;
      }

      if (data) {
        lastSyncedJson.current = JSON.stringify(data.value);
        setState(data.value as T);
      } else {
        // First time this key has ever been used: seed the row.
        const { error: insertError } = await supabase
          .from(TABLE)
          .upsert({ id: key, value: initialValue as unknown as object });
        if (insertError) {
          reportError(key, 'save', insertError.message);
        } else {
          lastSyncedJson.current = JSON.stringify(initialValue);
        }
      }

      loadedRef.current = true;
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // Live updates from other signed-in users / tabs
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`crm_state_${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${key}` },
        (payload) => {
          const incoming = (payload.new as { value?: T } | undefined)?.value;
          if (incoming === undefined) return;
          const incomingJson = JSON.stringify(incoming);
          // Echo of something we already have / just wrote -> ignore.
          if (incomingJson === lastSyncedJson.current) return;
          lastSyncedJson.current = incomingJson;
          setState(incoming);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, key]);

  // Push local changes up to Supabase.
  // Every queued save writes the LATEST value (so bursts of edits collapse into as few
  // writes as possible), saves land strictly in order, and a failed save is retried
  // automatically instead of waiting for the next edit — an edit is never silently dropped.
  const saveLatest = () => {
    saveQueue.current = saveQueue.current.then(async () => {
      const valueToSave = latestState.current;
      const json = JSON.stringify(valueToSave);
      if (json === lastSyncedJson.current) {
        pendingKeys.delete(key);
        return;
      }
      try {
        const { error } = await supabase
          .from(TABLE)
          .upsert({ id: key, value: valueToSave as unknown as object, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
        lastSyncedJson.current = json;
        if (JSON.stringify(latestState.current) === json) pendingKeys.delete(key);
        reportOk(key);
      } catch (e) {
        pendingKeys.add(key);
        reportError(key, 'save', e instanceof Error ? e.message : String(e));
        if (!retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            saveLatest();
          }, SAVE_RETRY_MS);
        }
      }
    });
  };

  useEffect(() => {
    if (!enabled || !loadedRef.current) return;
    if (JSON.stringify(state) === lastSyncedJson.current) return; // nothing new to save
    pendingKeys.add(key);
    saveLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, enabled, loaded]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      pendingKeys.delete(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return [state, setState, loaded] as const;
}
