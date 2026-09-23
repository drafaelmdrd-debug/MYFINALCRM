import { useEffect, useRef, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { reportError, reportOk, hasPendingCloudWrites } from './cloudSync';
import { LeadSyncEngine } from './leadSync';

/**
 * Drop-in replacement for the old `useCloudState('leads', …)`, with the same
 * `[leads, setLeads, loaded]` shape — but every lead is saved as its own row in
 * `crm_leads`, so two people editing different leads never overwrite each other.
 * All the logic lives in `leadSync.ts`.
 */
export function useCloudLeads<T extends { id: string }>(initialValue: T[], enabled: boolean) {
  const ref = useRef<LeadSyncEngine<T> | null>(null);
  if (ref.current === null) {
    ref.current = new LeadSyncEngine<T>({
      client: supabase,
      initialValue,
      onError: (action, message) => reportError('leads', action, message),
      onOk: () => reportOk('leads'),
    });
  }
  const engine = ref.current;

  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    engine.start();
    return () => engine.stop();
  }, [enabled, engine]);

  // If someone refreshes/closes the tab while an edit is still on its way to the
  // database, make the browser ask first instead of silently losing it.
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (engine.hasUnsavedChanges() || hasPendingCloudWrites()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled, engine]);

  return [snap.items, engine.set, snap.loaded] as const;
}
