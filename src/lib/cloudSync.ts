import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const TABLE = 'crm_state';

/**
 * Drop-in replacement for the old `useState(() => localStorage...)` +
 * `useEffect(() => localStorage.setItem(...))` pattern, backed by a shared
 * Supabase table instead of the browser's local storage.
 *
 * - `key` identifies the row in `crm_state` (e.g. 'leads', 'campaigns').
 * - `initialValue` is used until the first load resolves, and is what gets
 *   written if no row exists yet for this key (first run ever).
 * - `enabled` should be false until there's an authenticated session, so we
 *   don't try to read/write before the user is signed in.
 * - Other signed-in users' changes arrive automatically via Supabase Realtime.
 *
 * Returns [value, setValue, loaded, error] — same shape as useState plus a
 * loaded flag and the last load/save error (null when everything's fine).
 * `error` is cleared automatically the next time a save succeeds, so
 * consumers can surface it (e.g. a toast) without tracking it themselves.
 */
export function useCloudState<T>(key: string, initialValue: T, enabled: boolean) {
  const [state, setState] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipNextSave = useRef(false);
  const loadedRef = useRef(false);

  // Initial load from Supabase
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data, error: loadError } = await supabase.from(TABLE).select('value').eq('id', key).maybeSingle();

      if (cancelled) return;

      if (loadError) {
        console.error(`[cloudSync] Failed to load "${key}"`, loadError);
        setError(`Couldn't load "${key}" from the shared workspace (${loadError.message}). Showing local data — it may be out of date.`);
      } else if (data) {
        skipNextSave.current = true;
        setState(data.value as T);
      } else {
        // First time this key has ever been used: seed the row.
        const { error: insertError } = await supabase
          .from(TABLE)
          .upsert({ id: key, value: initialValue as unknown as object });
        if (insertError) {
          console.error(`[cloudSync] Failed to seed "${key}"`, insertError);
          setError(`Couldn't initialize "${key}" in the shared workspace (${insertError.message}).`);
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

  // Live updates from other signed-in users
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`crm_state_${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${key}` },
        (payload) => {
          const incoming = (payload.new as { value?: T } | undefined)?.value;
          if (incoming !== undefined) {
            skipNextSave.current = true;
            setState(incoming);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, key]);

  // Push local changes up to Supabase (skip echoes from our own load/realtime)
  useEffect(() => {
    if (!enabled || !loadedRef.current) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    supabase
      .from(TABLE)
      .upsert({ id: key, value: state as unknown as object, updated_at: new Date().toISOString() })
      .then(({ error: saveError }) => {
        if (saveError) {
          console.error(`[cloudSync] Failed to save "${key}"`, saveError);
          setError(`Couldn't save "${key}" to the shared workspace (${saveError.message}). Your latest change is NOT saved — reloading the page will lose it.`);
        } else {
          setError(null);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, enabled]);

  return [state, setState, loaded, error] as const;
}
