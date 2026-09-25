import { Lead, PhoneNumberRecord } from '../types';
import { isLeadInDealPipeline } from './moveEngine';

/**
 * Duplicate detection for imports.
 *
 *  - Two leads are "the same property" when their street addresses match after tidying
 *    (case, punctuation, St/Street, Dr/Drive, N/North, Apt/Unit/#…) and their zip code /
 *    city don't contradict each other.
 *  - Two phone numbers are the same when their digits match (country code 1, spaces,
 *    dashes and brackets are ignored).
 *  - A row that matches a lead already in the CRM is NOT imported as a new lead.
 *      - If that existing lead is already in the Deal Pipeline (Project Mgmt, Follow-Up,
 *        DNC, Language Barrier, Needs Skiptracing/Deepdive, Needs Deepdive), the row is
 *        skipped entirely — nothing is added or changed on it. It's already being worked.
 *      - Otherwise (it's still a cold Power Dialer lead) only the phone numbers that lead
 *        doesn't have yet are added to it. No second lead / address record is created.
 *  - A row that matches an earlier row in the same file is merged into it the same way.
 */

const SUFFIX: Record<string, string> = {
  street: 'st', str: 'st',
  drive: 'dr',
  avenue: 'ave', av: 'ave',
  boulevard: 'blvd',
  road: 'rd',
  lane: 'ln',
  court: 'ct',
  circle: 'cir',
  place: 'pl',
  terrace: 'ter',
  highway: 'hwy',
  parkway: 'pkwy',
  trail: 'trl',
  freeway: 'fwy',
  expressway: 'expy',
  apartment: 'unit', apt: 'unit', suite: 'unit', ste: 'unit',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
};

export function phoneKey(number: string): string {
  let d = (number || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
}

const isComparablePhone = (key: string) => key.length >= 7;

/** Street part of an address, tidied so "123 N. Main Street, Apt 4" == "123 north main st unit 4". */
export function streetKey(address: string | undefined): string {
  const first = (address || '').split(',')[0];
  return first
    .toLowerCase()
    .replace(/#/g, ' unit ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIX[w] ?? w)
    .join(' ');
}

const isUsableStreetKey = (k: string) => k.length >= 4;

function zip5(lead: Lead): string {
  const direct = (lead.zipCode || '').replace(/\D/g, '').slice(0, 5);
  if (direct.length === 5) return direct;
  const m = (lead.propertyAddress || '').match(/\b(\d{5})(?:-\d{4})?\s*$/);
  return m ? m[1] : '';
}

const cityKey = (lead: Lead): string =>
  (lead.city || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Same street key already; make sure zip / city don't say "different place". */
function sameArea(a: Lead, b: Lead): boolean {
  const za = zip5(a);
  const zb = zip5(b);
  if (za && zb && za !== zb) return false;
  const ca = cityKey(a);
  const cb = cityKey(b);
  if (ca && cb && ca !== cb) return false;
  return true;
}

function phonesOf(lead: Lead): Set<string> {
  const set = new Set<string>();
  const add = (n: string) => {
    const k = phoneKey(n);
    if (isComparablePhone(k)) set.add(k);
  };
  (lead.phoneNumbers || []).forEach((p) => add(p.number));
  (lead.contacts || []).forEach((c) => (c.phoneNumbers || []).forEach((p) => add(p.number)));
  return set;
}

export interface PhoneAdd {
  leadId: string;
  phones: PhoneNumberRecord[];
}

export interface ImportMatch {
  leadId: string;
  ownerName: string;
  address: string;
  stage: string;
  added: string[];
  skipped: string[];
}

/** An address that matched a lead already sitting in the Deal Pipeline — the whole row was skipped. */
export interface PipelineSkip {
  leadId: string;
  ownerName: string;
  address: string;
  stage: string;
  reason: string;
}

export interface ImportPlan {
  /** Rows that are genuinely new leads. */
  newLeads: Lead[];
  /** Numbers to add to leads already in the CRM (Power Dialer / cold leads only). */
  phoneAdds: PhoneAdd[];
  /** One entry per existing (non-pipeline) lead that the file touched (for the on-screen summary). */
  matches: ImportMatch[];
  /** Addresses that were skipped outright because that lead is already in Deal Pipeline / DNC / Language Barrier / Needs Skiptracing. */
  pipelineSkips: PipelineSkip[];
  stats: {
    rows: number;
    newLeads: number;
    /** rows that matched a lead already in the CRM (Power Dialer, numbers merged) */
    matchedExisting: number;
    /** rows merged into an earlier row of the same file */
    mergedInFile: number;
    numbersAdded: number;
    /** numbers ignored because that lead / row already had them */
    numbersSkipped: number;
    /** rows skipped entirely because the address already matched a Deal Pipeline / DNC / Language Barrier / Needs Skiptracing lead */
    pipelineSkipped: number;
  };
}

export function planImport(parsed: Lead[], existing: Lead[]): ImportPlan {
  const byStreet = new Map<string, Lead[]>();
  for (const l of existing) {
    const k = streetKey(l.propertyAddress);
    if (!isUsableStreetKey(k)) continue;
    const list = byStreet.get(k);
    if (list) list.push(l);
    else byStreet.set(k, [l]);
  }

  const knownPhones = new Map<string, Set<string>>(); // existing lead id -> digits already on it
  const addsByLead = new Map<string, PhoneNumberRecord[]>();
  const matchByLead = new Map<string, ImportMatch>();
  const pipelineSkipByLead = new Map<string, PipelineSkip>();

  const out: Lead[] = [];
  const outByStreet = new Map<string, number[]>(); // street key -> positions in `out`

  const stats = {
    rows: parsed.length,
    newLeads: 0,
    matchedExisting: 0,
    mergedInFile: 0,
    numbersAdded: 0,
    numbersSkipped: 0,
    pipelineSkipped: 0,
  };

  for (const row of parsed) {
    // 1. Same number listed twice on one row → keep it once.
    const seenOnRow = new Set<string>();
    const rowPhones: PhoneNumberRecord[] = [];
    for (const p of row.phoneNumbers || []) {
      const k = phoneKey(p.number);
      if (isComparablePhone(k)) {
        if (seenOnRow.has(k)) {
          stats.numbersSkipped++;
          continue;
        }
        seenOnRow.add(k);
      }
      rowPhones.push(p);
    }
    const lead: Lead = rowPhones.length === (row.phoneNumbers || []).length ? row : { ...row, phoneNumbers: rowPhones };

    const key = streetKey(lead.propertyAddress);
    if (!isUsableStreetKey(key)) {
      out.push(lead); // no usable address: can't tell if it's a duplicate
      continue;
    }

    // 2. Already in the CRM?
    const hit = (byStreet.get(key) || []).find((e) => sameArea(e, lead));
    if (hit) {
      // 2a. That address is already being worked in the Deal Pipeline (Project Mgmt,
      //     Follow-Up, DNC, Language Barrier, Needs Skiptracing/Deepdive). Skip the row
      //     entirely — don't touch that lead and don't create a new one for it.
      if (isLeadInDealPipeline(hit)) {
        if (!pipelineSkipByLead.has(hit.id)) {
          pipelineSkipByLead.set(hit.id, {
            leadId: hit.id,
            ownerName: hit.ownerName,
            address: hit.propertyAddress,
            stage: hit.stageId,
            reason: `Already in Deal Pipeline (${hit.stageId}) — import skipped for this address`,
          });
        }
        stats.pipelineSkipped++;
        continue;
      }

      // 2b. Still a Power Dialer / cold lead: same address, no new lead — just add any
      //     numbers it doesn't already have.
      let have = knownPhones.get(hit.id);
      if (!have) {
        have = phonesOf(hit);
        knownPhones.set(hit.id, have);
      }
      const match =
        matchByLead.get(hit.id) ||
        ({
          leadId: hit.id,
          ownerName: hit.ownerName,
          address: hit.propertyAddress,
          stage: hit.stageId,
          added: [],
          skipped: [],
        } as ImportMatch);
      matchByLead.set(hit.id, match);

      for (const p of lead.phoneNumbers) {
        const k = phoneKey(p.number);
        if (isComparablePhone(k) && have.has(k)) {
          match.skipped.push(p.number);
          stats.numbersSkipped++;
        } else {
          if (isComparablePhone(k)) have.add(k);
          const list = addsByLead.get(hit.id) || [];
          list.push(p);
          addsByLead.set(hit.id, list);
          match.added.push(p.number);
          stats.numbersAdded++;
        }
      }
      stats.matchedExisting++;
      continue;
    }

    // 3. Same property appeared earlier in this file?
    const earlier = (outByStreet.get(key) || []).find((i) => sameArea(out[i], lead));
    if (earlier !== undefined) {
      const target = out[earlier];
      const have = phonesOf(target);
      const extra: PhoneNumberRecord[] = [];
      for (const p of lead.phoneNumbers) {
        const k = phoneKey(p.number);
        if (isComparablePhone(k) && have.has(k)) {
          stats.numbersSkipped++;
        } else {
          if (isComparablePhone(k)) have.add(k);
          extra.push(p);
        }
      }
      out[earlier] = { ...target, phoneNumbers: [...target.phoneNumbers, ...extra] };
      stats.mergedInFile++;
      stats.numbersAdded += extra.length;
      continue;
    }

    outByStreet.set(key, [...(outByStreet.get(key) || []), out.length]);
    out.push(lead);
  }

  stats.newLeads = out.length;
  const phoneAdds: PhoneAdd[] = Array.from(addsByLead.entries()).map(([leadId, phones]) => ({ leadId, phones }));
  return {
    newLeads: out,
    phoneAdds,
    matches: Array.from(matchByLead.values()),
    pipelineSkips: Array.from(pipelineSkipByLead.values()),
    stats,
  };
}

/** Add `phones` to a lead, skipping any number it already has. Returns the same object if nothing is new. */
export function addNewPhones(lead: Lead, phones: PhoneNumberRecord[]): Lead {
  const have = phonesOf(lead);
  const fresh: PhoneNumberRecord[] = [];
  for (const p of phones) {
    const k = phoneKey(p.number);
    if (isComparablePhone(k)) {
      if (have.has(k)) continue;
      have.add(k);
    }
    fresh.push(p);
  }
  return fresh.length ? { ...lead, phoneNumbers: [...(lead.phoneNumbers || []), ...fresh] } : lead;
}
