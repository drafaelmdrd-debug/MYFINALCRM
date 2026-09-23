/**
 * Per-lead sync engine.
 *
 * Every lead is its own row in `crm_leads`, so two people editing DIFFERENT
 * leads never overwrite each other (the old design stored all leads in one
 * JSON blob, so the last save won for everybody).
 *
 * This file is plain TypeScript (no React, no Supabase import) so it can be
 * tested on its own. `cloudLeads.ts` wraps it in a React hook.
 *
 * How it works
 *  - The engine owns the array of leads. `set()` works like React's setState
 *    (a value or an updater function).
 *  - After every change it diffs the array against what it knows is in the
 *    database and sends ONLY the leads that changed (upsert) or vanished (delete).
 *  - Changes made by other people arrive over Realtime and are merged in one lead
 *    at a time. If you have an unsaved edit to the same lead, yours wins.
 *  - Array order (the dialer queue, "new leads first") is preserved with a
 *    `sort_key` number stored on each row.
 *
 * Edits to an EXISTING lead are sent as a small field-level patch (`crm_patch_leads`
 * in supabase/schema.sql), and applied by the database on top of whatever the row
 * holds right now. So two people changing different fields of the same lead — or both
 * adding a phone number, or both adding a note — never overwrite each other. Only two
 * people changing the very same field at the same instant is still "last one wins".
 * (If that function isn't installed yet, the engine falls back to whole-lead saves.)
 */

const TABLE = 'crm_leads';
const STATE_TABLE = 'crm_state';
const LEGACY_KEY = 'leads'; // the old single-blob row, migrated on first run
const MIGRATED_MARKER = 'leads_migrated';

const PAGE = 1000;
const WRITE_BATCH = 200;
const PATCH_BATCH = 50;
const DELETE_BATCH = 200;
const RETRY_MS = 5000;
const REMOTE_APPLY_MS = 120;

/** The small slice of the Supabase client this engine needs. */
export interface SyncClient {
  from: (table: string) => any;
  rpc?: (fn: string, args: object) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => any;
}

export interface LeadRow<T> {
  id: string;
  value: T;
  sort_key: number;
  writer: string | null;
  /** Bumped by a database trigger on every write; lets us ignore stale events. */
  version: number;
}

type RemoteEvent<T> = { kind: 'upsert'; row: LeadRow<T> } | { kind: 'delete'; id: string };
type Synced = { json: string; key: number; version: number };
type Action<T> = T[] | ((prev: T[]) => T[]);

export interface EngineOptions<T> {
  client: SyncClient;
  initialValue: T[];
  onError: (action: 'load' | 'save', message: string) => void;
  onOk: () => void;
  clientId?: string;
}

/** JSON with sorted keys, so Postgres' jsonb key reordering never looks like a change. */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = sortDeep(x);
    }
    return out;
  }
  return v;
}

/**
 * Give every lead that has no sort_key yet one that puts it in its current place
 * in the array: new leads at the front get keys below the first existing lead, new
 * leads at the end get keys above the last, and ones in the middle are spaced between
 * their neighbours. Existing leads keep their keys.
 */
export function assignKeys<T extends { id: string }>(arr: T[], keys: Map<string, number>): void {
  let i = 0;
  while (i < arr.length) {
    if (keys.has(arr[i].id)) {
      i++;
      continue;
    }
    let j = i;
    while (j < arr.length && !keys.has(arr[j].id)) j++;
    const n = j - i;
    const prevKey = i > 0 ? keys.get(arr[i - 1].id) : undefined;
    const nextKey = j < arr.length ? keys.get(arr[j].id) : undefined;
    for (let k = 0; k < n; k++) {
      let key: number;
      if (prevKey === undefined && nextKey === undefined) key = k;
      else if (prevKey === undefined) key = (nextKey as number) - (n - k);
      else if (nextKey === undefined) key = prevKey + (k + 1);
      else key = prevKey + ((nextKey - prevKey) * (k + 1)) / (n + 1);
      keys.set(arr[i + k].id, key);
    }
    i = j;
  }
}

// ---------------------------------------------------------------------------
// Field-level patches (used for saving edits and for merging other people's edits)
// ---------------------------------------------------------------------------

export interface ArrayOps {
  added: unknown[];
  removed: string[];
  changed: unknown[];
}

export interface LeadPatch {
  /** top-level fields to overwrite */
  set: Record<string, unknown>;
  /** top-level fields to delete */
  remove: string[];
  /** text appended to a text field (call notes) instead of replacing it */
  append: Record<string, string>;
  /** lists of records with an `id` (phone numbers, contacts): add / remove / change by id */
  arrays: Record<string, ArrayOps>;
}

/** Text fields that only ever grow (timestamped notes) — merged by appending. */
const APPEND_FIELDS = new Set(['callNotes', 'vaNotes', 'notes']);
/** Lists of `{ id, … }` records — merged item by item. */
const ID_ARRAY_FIELDS = new Set(['phoneNumbers', 'contacts']);

type Rec = Record<string, unknown>;
const cj = (v: unknown): string => (v === undefined ? '\u0000undefined' : JSON.stringify(sortDeep(v)));
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const idOf = (x: unknown): string | null => (isRec(x) && typeof x.id === 'string' ? x.id : null);
const allHaveUniqueIds = (a: unknown[]): boolean =>
  a.every((x) => idOf(x) !== null) && new Set(a.map(idOf)).size === a.length;

/** What did `local` change compared with `base`? */
export function diffLead(base: object, local: object): LeadPatch {
  const b0 = base as Rec;
  const l0 = local as Rec;
  const patch: LeadPatch = { set: {}, remove: [], append: {}, arrays: {} };
  const keys = new Set([...Object.keys(b0), ...Object.keys(l0)]);
  for (const k of keys) {
    const b = b0[k];
    const l = l0[k];
    if (cj(b) === cj(l)) continue;
    if (l === undefined) {
      patch.remove.push(k);
      continue;
    }
    if (
      APPEND_FIELDS.has(k) &&
      typeof l === 'string' &&
      (b === undefined || typeof b === 'string') &&
      l.length > ((b as string | undefined) ?? '').length &&
      l.startsWith((b as string | undefined) ?? '')
    ) {
      patch.append[k] = l.slice(((b as string | undefined) ?? '').length);
      continue;
    }
    if (ID_ARRAY_FIELDS.has(k) && Array.isArray(l) && (b === undefined || Array.isArray(b))) {
      const ba = ((b as unknown[] | undefined) ?? []) as unknown[];
      if (allHaveUniqueIds(ba) && allHaveUniqueIds(l)) {
        const baseById = new Map(ba.map((x) => [idOf(x) as string, x]));
        const localIds = new Set(l.map((x) => idOf(x) as string));
        const added = l.filter((x) => !baseById.has(idOf(x) as string));
        const removed = ba.map((x) => idOf(x) as string).filter((id) => !localIds.has(id));
        const changed = l.filter(
          (x) => baseById.has(idOf(x) as string) && cj(baseById.get(idOf(x) as string)) !== cj(x)
        );
        if (added.length || removed.length || changed.length) {
          patch.arrays[k] = { added, removed, changed };
          continue;
        }
        // only the order changed: fall through and send the whole list
      }
    }
    patch.set[k] = l;
  }
  return patch;
}

/** Apply a patch on top of `target` (the same steps `crm_patch_leads` runs in the database). */
export function applyPatch<T extends object>(target: T, patch: LeadPatch): T {
  const out: Rec = { ...(target as Rec) };
  for (const k of patch.remove) delete out[k];
  Object.assign(out, patch.set);
  for (const [k, suffix] of Object.entries(patch.append)) {
    const cur = typeof out[k] === 'string' ? (out[k] as string) : '';
    if (!cur.endsWith(suffix)) out[k] = cur + suffix; // already there = a retry of the same write
  }
  for (const [k, op] of Object.entries(patch.arrays)) {
    let arr: unknown[] = Array.isArray(out[k]) ? [...(out[k] as unknown[])] : [];
    const removed = new Set(op.removed);
    arr = arr.filter((x) => {
      const id = idOf(x);
      return id === null || !removed.has(id);
    });
    const changed = new Map(op.changed.map((x) => [idOf(x) as string, x]));
    arr = arr.map((x) => {
      const id = idOf(x);
      return id !== null && changed.has(id) ? changed.get(id) : x;
    });
    const have = new Set(arr.map(idOf).filter((id): id is string => id !== null));
    for (const a of op.added) {
      const id = idOf(a);
      if (id === null || !have.has(id)) arr.push(a);
    }
    out[k] = arr;
  }
  return out as T;
}

/** Combine my edits (base → local) with what the database now holds (remote). */
export function mergeLead<T extends object>(base: T, local: T, remote: T): T {
  return applyPatch(remote, diffLead(base, local));
}

const isMissingFunction = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message ?? ''));

export class LeadSyncEngine<T extends { id: string }> {
  private readonly client: SyncClient;
  private readonly initialValue: T[];
  private readonly onError: EngineOptions<T>['onError'];
  private readonly onOk: EngineOptions<T>['onOk'];
  readonly clientId: string;

  private items: T[];
  private loaded = false;
  private snapshot: { items: T[]; loaded: boolean };
  private listeners = new Set<() => void>();

  /** What we know is in the database, per lead. */
  private synced = new Map<string, Synced>();
  private keys = new Map<string, number>();
  private canonCache = new WeakMap<object, string>();

  private remoteBuf: RemoteEvent<T>[] = [];
  private remoteTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private running = false;
  private again = false;
  private epoch = 0;
  private active = false;
  private flushCounter = 0;
  private channel: unknown = null;
  private subscribedBefore = false;
  private patchSupported = true;

  constructor(opts: EngineOptions<T>) {
    this.client = opts.client;
    this.initialValue = opts.initialValue;
    this.onError = opts.onError;
    this.onOk = opts.onOk;
    this.clientId =
      opts.clientId ??
      `c${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    this.items = [];
    this.snapshot = { items: this.items, loaded: false };
  }

  // ---- external-store API (used by React's useSyncExternalStore) ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  /** Same contract as React's setState: pass a new array or an updater function. */
  set = (action: Action<T>) => {
    const next = typeof action === 'function' ? (action as (p: T[]) => T[])(this.items) : action;
    if (next === this.items) return;
    this.items = next;
    this.publish();
    this.requestFlush();
  };

  /**
   * True while any lead edit has not yet been confirmed saved in the database.
   * Used to warn before the page is refreshed or closed.
   */
  hasUnsavedChanges = (): boolean => {
    if (!this.active || !this.loaded) return false;
    if (this.running || this.again || this.retryTimer) return true;
    const seen = new Set<string>();
    for (const lead of this.items) {
      if (seen.has(lead.id)) continue;
      seen.add(lead.id);
      const s = this.synced.get(lead.id);
      if (!s || s.json !== this.canon(lead)) return true;
    }
    for (const id of this.synced.keys()) if (!seen.has(id)) return true;
    return false;
  };

  private publish() {
    this.snapshot = { items: this.items, loaded: this.loaded };
    this.listeners.forEach((l) => l());
  }

  private canon(v: object): string {
    let c = this.canonCache.get(v);
    if (c === undefined) {
      c = JSON.stringify(sortDeep(v));
      this.canonCache.set(v, c);
    }
    return c;
  }

  // ---- lifecycle -----------------------------------------------------------

  start() {
    const epoch = ++this.epoch;
    this.active = true;
    this.loaded = false;
    this.synced.clear();
    this.keys.clear();
    this.remoteBuf = [];
    this.subscribedBefore = false;
    this.running = false;
    this.publish();
    this.openChannel(epoch);
    void this.load(epoch);
  }

  stop() {
    this.epoch++;
    this.active = false;
    if (this.remoteTimer) clearTimeout(this.remoteTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.remoteTimer = this.retryTimer = null;
    if (this.channel) {
      try {
        this.client.removeChannel(this.channel);
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
  }

  // ---- loading -------------------------------------------------------------

  private async fetchAll(): Promise<{ rows: LeadRow<T>[]; error: string | null }> {
    const byId = new Map<string, LeadRow<T>>();
    let from = 0;
    for (;;) {
      const { data, error } = await this.client
        .from(TABLE)
        .select('id, value, sort_key, writer, version')
        .order('sort_key', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { rows: [], error: error.message as string };
      if (!data || data.length === 0) break;
      for (const r of data as LeadRow<T>[]) byId.set(r.id, r);
      from += data.length;
    }
    const rows = Array.from(byId.values()).sort(
      (a, b) => a.sort_key - b.sort_key || (a.id < b.id ? -1 : 1)
    );
    return { rows, error: null };
  }

  private async writeRows(rows: { id: string; value: T; sort_key: number; writer: string }[]) {
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      const { error } = await this.client.from(TABLE).upsert(rows.slice(i, i + WRITE_BATCH));
      if (error) return error.message as string;
    }
    return null;
  }

  private async load(epoch: number) {
    const { rows, error } = await this.fetchAll();
    if (epoch !== this.epoch) return;
    if (error) {
      // Not marked loaded on purpose: we must never save placeholder data over the real thing.
      this.onError('load', error);
      return;
    }

    let items: T[];

    if (rows.length > 0) {
      items = [];
      for (const r of rows) {
        items.push(r.value);
        this.synced.set(r.id, { json: this.canon(r.value), key: r.sort_key, version: r.version ?? 0 });
        this.keys.set(r.id, r.sort_key);
      }
      void this.markMigrated(); // best effort; stops old data being resurrected later
    } else {
      // Empty table: either a brand new project, an existing project that still has the
      // old single-blob "leads" row, or someone deliberately deleted every lead.
      const marker = await this.client.from(STATE_TABLE).select('value').eq('id', MIGRATED_MARKER).maybeSingle();
      if (epoch !== this.epoch) return;
      if (marker.error) {
        this.onError('load', marker.error.message);
        return;
      }
      if (marker.data) {
        items = []; // already migrated/seeded once; empty means empty
      } else {
        const legacy = await this.client.from(STATE_TABLE).select('value').eq('id', LEGACY_KEY).maybeSingle();
        if (epoch !== this.epoch) return;
        if (legacy.error) {
          this.onError('load', legacy.error.message);
          return;
        }
        const legacyValue = legacy.data?.value;
        const source: T[] =
          Array.isArray(legacyValue) && legacyValue.length > 0 ? (legacyValue as T[]) : this.initialValue;

        const seenIds = new Set<string>();
        items = [];
        for (const l of source) {
          if (l && typeof l.id === 'string' && !seenIds.has(l.id)) {
            seenIds.add(l.id);
            items.push(l);
          }
        }
        assignKeys(items, this.keys); // 0..n-1, i.e. the existing order
        const writer = `${this.clientId}:init`;
        const werr = await this.writeRows(
          items.map((l) => ({ id: l.id, value: l, sort_key: this.keys.get(l.id) as number, writer }))
        );
        if (epoch !== this.epoch) return;
        if (werr) {
          this.keys.clear();
          this.onError('save', werr);
          return;
        }
        const merr = await this.markMigrated();
        if (epoch !== this.epoch) return;
        if (merr) {
          this.onError('save', merr);
          return;
        }
        for (const l of items) {
          this.synced.set(l.id, { json: this.canon(l), key: this.keys.get(l.id) as number, version: 1 });
        }
      }
    }

    this.items = items;
    this.loaded = true;
    this.publish();
    this.onOk();
    if (this.remoteBuf.length) this.scheduleRemoteApply();
    this.requestFlush();
  }

  private async markMigrated(): Promise<string | null> {
    try {
      const { error } = await this.client
        .from(STATE_TABLE)
        .upsert({ id: MIGRATED_MARKER, value: true }, { onConflict: 'id', ignoreDuplicates: true });
      return error ? (error.message as string) : null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  // ---- realtime ------------------------------------------------------------

  private openChannel(epoch: number) {
    this.channel = this.client
      .channel(`crm_leads_${this.clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload: any) => {
        if (epoch !== this.epoch) return;
        this.onRemote(payload);
      })
      .subscribe((status: string) => {
        if (epoch !== this.epoch) return;
        if (status === 'SUBSCRIBED') {
          // A re-subscribe means the connection dropped: catch up on anything we missed.
          if (this.subscribedBefore && this.loaded) void this.reconcile(epoch);
          this.subscribedBefore = true;
        }
      });
  }

  private onRemote(payload: any) {
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (typeof id === 'string') this.enqueueRemote({ kind: 'delete', id });
      return;
    }
    const row = payload.new as LeadRow<T> | undefined;
    if (!row || typeof row.id !== 'string') return;
    if (!row.value || typeof row.value !== 'object') {
      if (this.loaded) void this.reconcile(this.epoch); // partial payload: re-read instead of guessing
      return;
    }
    // Our own writes come back here too. That's fine: applyRemote() ignores anything that
    // isn't newer than what we already have, and merges it in if the database combined our
    // edit with someone else's.
    this.enqueueRemote({ kind: 'upsert', row });
  }

  private enqueueRemote(ev: RemoteEvent<T>) {
    this.remoteBuf.push(ev);
    if (this.loaded) this.scheduleRemoteApply();
  }

  private scheduleRemoteApply() {
    if (this.remoteTimer) return;
    this.remoteTimer = setTimeout(() => {
      this.remoteTimer = null;
      this.applyRemote();
    }, REMOTE_APPLY_MS);
  }

  private applyRemote() {
    if (!this.loaded || this.remoteBuf.length === 0) return;
    const events = this.remoteBuf;
    this.remoteBuf = [];

    assignKeys(this.items, this.keys); // key any brand-new local leads before merging
    const byId = new Map<string, T>();
    for (const l of this.items) if (!byId.has(l.id)) byId.set(l.id, l);
    let changed = false;
    let needSort = false;

    for (const ev of events) {
      if (ev.kind === 'delete') {
        const s = this.synced.get(ev.id);
        const local = byId.get(ev.id);
        this.synced.delete(ev.id);
        if (local) {
          const dirty = s ? this.canon(local) !== s.json : true;
          if (!dirty) {
            byId.delete(ev.id);
            this.keys.delete(ev.id);
            changed = true;
          } // else: we have unsaved edits to it — keep it, the next save re-creates it
        }
        continue;
      }

      const { id, value, sort_key } = ev.row;
      const version = ev.row.version ?? 0;
      const json = this.canon(value);
      const s = this.synced.get(id);
      // Events can arrive late or out of order. Anything not newer than what we already
      // know about this lead is stale (or our own write coming back) — ignore it.
      if (s && version <= s.version) continue;
      const local = byId.get(id);
      const dirty = local ? !s || this.canon(local) !== s.json : false;
      this.synced.set(id, { json, key: sort_key, version });
      if (dirty) {
        // We have unsent edits to this lead: keep them AND take in what the other person
        // changed. What's left different from the database goes out on the next save.
        if (s && local) {
          const merged = mergeLead(JSON.parse(s.json) as T, local, value);
          byId.set(id, merged);
          if (this.keys.get(id) === s.key && s.key !== sort_key) {
            this.keys.set(id, sort_key);
            needSort = true;
          }
          changed = true;
        }
        continue;
      }
      if (!byId.has(id) || this.keys.get(id) !== sort_key) needSort = true;
      this.keys.set(id, sort_key);
      byId.set(id, value);
      changed = true;
    }

    if (changed) {
      let next = Array.from(byId.values());
      if (needSort) {
        next = next.sort(
          (a, b) => (this.keys.get(a.id) ?? 0) - (this.keys.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1)
        );
      }
      this.items = next;
      this.publish();
    }
    this.requestFlush();
  }

  /** After a reconnect: compare the database to what we have and merge the differences. */
  private async reconcile(epoch: number) {
    const { rows, error } = await this.fetchAll();
    if (epoch !== this.epoch || error) return;
    const inDb = new Set<string>();
    for (const r of rows) {
      inDb.add(r.id);
      this.remoteBuf.push({ kind: 'upsert', row: r });
    }
    for (const id of Array.from(this.synced.keys())) {
      if (!inDb.has(id)) this.remoteBuf.push({ kind: 'delete', id });
    }
    this.scheduleRemoteApply();
  }

  // ---- saving --------------------------------------------------------------

  private requestFlush() {
    if (!this.active || !this.loaded) return;
    if (this.running) {
      this.again = true;
      return;
    }
    void this.run(this.epoch);
  }

  private async run(epoch: number) {
    this.running = true;
    try {
      do {
        this.again = false;
        const ok = await this.flushOnce(epoch);
        if (epoch !== this.epoch) return;
        if (!ok) {
          this.scheduleRetry();
          return;
        }
      } while (this.again);
    } finally {
      if (epoch === this.epoch) this.running = false;
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.requestFlush();
    }, RETRY_MS);
  }

  /**
   * The database applied our patches on top of the latest row, which may include other
   * people's changes. Take that result in, keeping any edits we made after sending.
   */
  private adoptServerRows(
    rows: { lead_id: string; lead_value: T; lead_sort_key: number; lead_version: number }[],
    sentJson: Map<string, string>
  ) {
    const localById = new Map<string, T>();
    for (const l of this.items) if (!localById.has(l.id)) localById.set(l.id, l);
    const updates = new Map<string, T>();

    for (const r of rows) {
      const s = this.synced.get(r.lead_id);
      if (s && s.version >= r.lead_version) continue; // a newer copy is already merged in
      this.synced.set(r.lead_id, {
        json: this.canon(r.lead_value),
        key: r.lead_sort_key,
        version: r.lead_version,
      });
      const local = localById.get(r.lead_id);
      if (!local) continue; // deleted here in the meantime — the delete goes out on the next save
      this.keys.set(r.lead_id, r.lead_sort_key);
      const sent = sentJson.get(r.lead_id);
      const localJson = this.canon(local);
      let next: T;
      if (sent === undefined) next = local;
      else if (localJson === sent) next = r.lead_value; // no edits since sending: just take the merged row
      else next = mergeLead(JSON.parse(sent) as T, local, r.lead_value); // edited again meanwhile
      if (this.canon(next) !== localJson) updates.set(r.lead_id, next);
    }

    if (updates.size > 0) {
      this.items = this.items.map((l) => updates.get(l.id) ?? l);
      this.publish();
    }
    this.again = true; // anything still different from the database goes out again (usually nothing)
  }

  private async flushOnce(epoch: number): Promise<boolean> {
    const current = this.items;
    assignKeys(current, this.keys);
    const writer = `${this.clientId}:${++this.flushCounter}`;

    const seen = new Set<string>();
    // New leads (or everything, if the patch function isn't installed): whole-row upsert.
    const upserts: { row: { id: string; value: T; sort_key: number; writer: string }; json: string; key: number }[] = [];
    // Existing leads that changed: field-level patch.
    const patches: { lead: T; json: string; key: number; keyChanged: boolean; patch: LeadPatch }[] = [];
    for (const lead of current) {
      if (seen.has(lead.id)) continue;
      seen.add(lead.id);
      const json = this.canon(lead);
      const key = this.keys.get(lead.id) as number;
      const s = this.synced.get(lead.id);
      if (s && s.json === json && s.key === key) continue;
      if (s && this.patchSupported && this.client.rpc) {
        patches.push({
          lead,
          json,
          key,
          keyChanged: s.key !== key,
          patch: diffLead(JSON.parse(s.json), lead),
        });
      } else {
        upserts.push({ row: { id: lead.id, value: lead, sort_key: key, writer }, json, key });
      }
    }
    const deletes: string[] = [];
    for (const id of this.synced.keys()) if (!seen.has(id)) deletes.push(id);

    if (upserts.length === 0 && patches.length === 0 && deletes.length === 0) return true;

    for (let i = 0; i < upserts.length; i += WRITE_BATCH) {
      const batch = upserts.slice(i, i + WRITE_BATCH);
      const { data, error } = await this.client
        .from(TABLE)
        .upsert(batch.map((b) => b.row))
        .select('id, version');
      if (epoch !== this.epoch) return true;
      if (error) {
        this.onError('save', error.message);
        return false;
      }
      const versions = new Map<string, number>();
      for (const r of (data ?? []) as { id: string; version: number }[]) versions.set(r.id, r.version);
      for (const b of batch) {
        const cur = this.synced.get(b.row.id);
        const version = versions.get(b.row.id) ?? (cur?.version ?? 0) + 1;
        // If someone else's newer write reached us while ours was in flight, `cur` already
        // has a higher version: leave it, so our edit is sent again and wins (everyone converges).
        if (!cur || version > cur.version) {
          this.synced.set(b.row.id, { json: b.json, key: b.key, version });
        }
      }
    }

    // Sorted by id so two people saving many leads at once always lock rows in the same order.
    patches.sort((a, b) => (a.lead.id < b.lead.id ? -1 : a.lead.id > b.lead.id ? 1 : 0));
    for (let i = 0; i < patches.length; i += PATCH_BATCH) {
      const batch = patches.slice(i, i + PATCH_BATCH);
      const { data, error } = await (this.client.rpc as NonNullable<SyncClient['rpc']>)('crm_patch_leads', {
        items: batch.map((b) => ({
          id: b.lead.id,
          patch: b.patch,
          full: b.lead, // only used if the lead was deleted by someone else meanwhile
          sort_key: b.keyChanged ? b.key : null,
          writer,
        })),
      });
      if (epoch !== this.epoch) return true;
      if (error) {
        if (isMissingFunction(error)) {
          // The database hasn't been given the latest supabase/schema.sql yet.
          console.warn(
            '[leadSync] crm_patch_leads is not installed — saving whole leads instead. ' +
              'Run the latest supabase/schema.sql to stop simultaneous edits overwriting each other.'
          );
          this.patchSupported = false;
          this.again = true;
          return true;
        }
        this.onError('save', (error.message as string) ?? 'Save failed');
        return false;
      }
      this.adoptServerRows(
        (data ?? []) as { lead_id: string; lead_value: T; lead_sort_key: number; lead_version: number }[],
        new Map(batch.map((b) => [b.lead.id, b.json]))
      );
    }

    for (let i = 0; i < deletes.length; i += DELETE_BATCH) {
      const chunk = deletes.slice(i, i + DELETE_BATCH);
      const { error } = await this.client.from(TABLE).delete().in('id', chunk);
      if (epoch !== this.epoch) return true;
      if (error) {
        this.onError('save', error.message);
        return false;
      }
      for (const id of chunk) {
        this.synced.delete(id);
        this.keys.delete(id);
      }
    }

    this.onOk();
    return true;
  }
}
