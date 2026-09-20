import { Lead } from '../types';
import { isLeadInDealPipeline } from './moveEngine';

/**
 * Export groups
 * -------------
 * A "group" is any list of leads the user can see in the CRM:
 *  - the workspace lists in the sidebar (Power Dialer, Deal Pipeline, DNC, ...)
 *  - each Campaign
 *
 * A lead can match several selected groups (e.g. a lead in "Follow-Up" that also
 * belongs to the "Dallas Tax Delinquent" campaign). Selected groups are combined
 * as a union, every lead is exported once, and the "Group" column lists every
 * selected group the lead matched.
 */

export interface ExportGroup {
  id: string;
  label: string;
  description?: string;
  match: (lead: Lead) => boolean;
}

const CAMPAIGN_PREFIX = 'campaign:';

export const campaignGroupId = (name: string) => `${CAMPAIGN_PREFIX}${name}`;

// Mirrors DealPipelineView.getLeadStatus for follow-up leads
const followUpStatusText = (lead: Lead): string =>
  (lead.vaFollowUpStatus || lead.vaStatus || lead.originalStatus || 'Not Interested')
    .trim()
    .toLowerCase();

export const LIST_EXPORT_GROUPS: ExportGroup[] = [
  {
    id: 'power-dialer',
    label: 'Power Dialer (Calling List)',
    description: 'Cold leads still in the dialer workspace',
    match: (l) => !isLeadInDealPipeline(l),
  },
  {
    id: 'project-mgmt',
    label: 'Deal Pipeline: Project Mgmt',
    description: 'Interested, offers, contracts, callbacks',
    match: (l) => l.stageId === 'Project Mgmt',
  },
  {
    id: 'follow-up',
    label: 'Deal Pipeline: Follow-Up (all)',
    description: 'All nurture timers',
    match: (l) => l.stageId === 'Follow-Up',
  },
  {
    id: 'follow-up-not-interested',
    label: 'Follow-Up: Not Interested only',
    description: '30 / 60 / 90 day timers',
    match: (l) => l.stageId === 'Follow-Up' && followUpStatusText(l).includes('not interested'),
  },
  {
    id: 'follow-up-not-ready',
    label: 'Follow-Up: Not Ready to Sell only',
    description: '30 / 60 / 90 day timers',
    match: (l) => l.stageId === 'Follow-Up' && followUpStatusText(l).includes('not ready'),
  },
  {
    id: 'dnc',
    label: 'Do Not Call (DNC)',
    description: 'DNC, sold already, ugly property',
    match: (l) => l.stageId === 'DNC',
  },
  {
    id: 'language-barrier',
    label: 'Language Barrier',
    description: 'Spanish speakers / translator needed',
    match: (l) => l.stageId === 'Language Barrier',
  },
  {
    id: 'needs-skiptracing',
    label: 'Needs Skiptracing/Deepdive',
    description: 'All numbers bad / needs research',
    match: (l) => l.stageId === 'Needs Skiptracing/Deepdive' || l.stageId === 'Needs Deepdive',
  },
];

export function buildCampaignGroups(campaigns: string[], leads: Lead[]): ExportGroup[] {
  // Include campaigns that only exist on leads (e.g. imported with a free-typed name)
  const names = new Set<string>(campaigns);
  leads.forEach((l) => {
    if (l.campaign) names.add(l.campaign);
  });
  return Array.from(names).map((name) => ({
    id: campaignGroupId(name),
    label: name,
    match: (l: Lead) => l.campaign === name,
  }));
}

/** Which export groups should be pre-ticked when the modal opens from a given screen. */
export function defaultGroupsForView(view: string): string[] {
  switch (view) {
    case 'power-dialer':
      return ['power-dialer'];
    case 'deal-pipeline':
      return ['project-mgmt'];
    case 'dnc':
      return ['dnc'];
    case 'language-barrier':
      return ['language-barrier'];
    case 'needs-skiptracing':
    case 'needs-deepdive':
      return ['needs-skiptracing'];
    default:
      return [];
  }
}

export interface GroupedLead {
  lead: Lead;
  groups: string[]; // labels of every selected group this lead matched
}

export function collectLeadsForGroups(leads: Lead[], selected: ExportGroup[]): GroupedLead[] {
  if (selected.length === 0) return [];
  const out: GroupedLead[] = [];
  for (const lead of leads) {
    const matched = selected.filter((g) => g.match(lead)).map((g) => g.label);
    if (matched.length > 0) out.push({ lead, groups: matched });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* CSV building                                                        */
/* ------------------------------------------------------------------ */

export type ExportLayout = 'per-lead' | 'per-phone';

export interface ExportOptions {
  layout: ExportLayout;
  includeNotes: boolean;
}

// RFC 4180 quoting + guard against spreadsheet formula injection.
function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d(). \-]+$/.test(s))) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',');

function leadColumns(lead: Lead, groups: string[], includeNotes: boolean): [string[], string[]] {
  const contacts = (lead.contacts || [])
    .map((c) => (c.role ? `${c.name} (${c.role})` : c.name))
    .join('; ');

  const headers = [
    'Group',
    'Lead ID',
    'Owner Name',
    'Contacts',
    'Property Address',
    'City',
    'State',
    'Zip',
    'County',
    'Mailing Address',
    'Mailing City',
    'Mailing Zip',
    'Stage',
    'Source Tab',
    'Campaign',
    'Assigned VA',
    'VA Status',
    'Outreach Status',
    'Calls Count',
    'Last Call Date',
    'Last Dispo',
    'Callback Date',
    'Follow-Up Date',
    'Asking Price',
    'Starting Offer',
    'Max Offer',
    'Counter Offer',
    'Date Added',
  ];
  const values = [
    groups.join('; '),
    lead.leadId,
    lead.ownerName,
    contacts,
    lead.propertyAddress,
    lead.city,
    lead.state,
    lead.zipCode,
    lead.county,
    lead.mailingAddress,
    lead.mailingCity,
    lead.mailingZip,
    lead.stageId,
    lead.sourceTab,
    lead.campaign,
    lead.assignedVA,
    lead.vaFollowUpStatus || lead.vaStatus,
    (lead.outreachStatus || '').replace(/\n/g, ' | '),
    lead.callsCount,
    lead.lastCallDate,
    lead.lastDispo,
    lead.callbackDate,
    lead.followUpDate,
    lead.askingPrice,
    lead.startingOffer,
    lead.maxOffer,
    lead.counterOffer,
    lead.dateAdded,
  ].map((v) => (v === undefined || v === null ? '' : String(v)));

  if (includeNotes) {
    headers.push('Call Notes');
    values.push(lead.callNotes || lead.vaNotes || lead.notes || '');
  }
  return [headers, values];
}

export function buildLeadsCsv(items: GroupedLead[], options: ExportOptions): string {
  const lines: string[] = [];

  if (options.layout === 'per-phone') {
    const [leadHeaders] = leadColumns(items[0]?.lead ?? ({} as Lead), [], options.includeNotes);
    const phoneHeaders = ['Phone', 'Phone Label', 'Phone Contact', 'Phone Contact Role', 'Phone Last Dispo'];
    lines.push(csvRow([...phoneHeaders, ...leadHeaders]));

    for (const { lead, groups } of items) {
      const [, values] = leadColumns(lead, groups, options.includeNotes);
      const phones = lead.phoneNumbers && lead.phoneNumbers.length > 0 ? lead.phoneNumbers : [null];
      for (const p of phones) {
        lines.push(
          csvRow([
            p?.number ?? '',
            p?.label ?? '',
            p?.contactName ?? '',
            p?.contactRole ?? '',
            p?.lastDispo ?? '',
            ...values,
          ])
        );
      }
    }
  } else {
    const maxPhones = items.reduce((m, { lead }) => Math.max(m, lead.phoneNumbers?.length || 0), 0);
    const [leadHeaders] = leadColumns(items[0]?.lead ?? ({} as Lead), [], options.includeNotes);
    const phoneHeaders: string[] = [];
    for (let i = 1; i <= maxPhones; i++) {
      phoneHeaders.push(`Phone ${i}`, `Phone ${i} Label`, `Phone ${i} Last Dispo`);
    }
    lines.push(csvRow([...leadHeaders, ...phoneHeaders]));

    for (const { lead, groups } of items) {
      const [, values] = leadColumns(lead, groups, options.includeNotes);
      const phoneValues: string[] = [];
      for (let i = 0; i < maxPhones; i++) {
        const p = lead.phoneNumbers?.[i];
        phoneValues.push(p?.number ?? '', p?.label ?? '', p?.lastDispo ?? '');
      }
      lines.push(csvRow([...values, ...phoneValues]));
    }
  }

  return lines.join('\r\n');
}

/* ------------------------------------------------------------------ */
/* Download                                                            */
/* ------------------------------------------------------------------ */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'export';

export function exportFileName(selected: ExportGroup[], date: string): string {
  const part = selected.length === 1 ? slug(selected[0].label) : `${selected.length}-groups`;
  return `groundwork_leads_${part}_${date}.csv`;
}

export function downloadCsv(csv: string, fileName: string) {
  // BOM so Excel opens UTF-8 correctly. Blob (not a data: URI) so '#' and long files are safe.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
