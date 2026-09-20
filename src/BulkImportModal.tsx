import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Plus,
  Layers,
  Kanban,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  ArrowRight,
  Settings2,
  Users,
  DollarSign,
  Phone,
  Mail,
  FileSearch,
} from 'lucide-react';
import { Lead, VA, StageId, SourceTabId, ContactPerson, PhoneNumberRecord } from '../types';
import { routeLead } from '../logic/moveEngine';

export type ImportDestination = 'existing_campaign' | 'new_campaign' | 'deal_pipeline' | 'needs_skiptracing';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: string[];
  onAddNewCampaign?: (name: string) => void;
  onImportLeads: (leads: Lead[]) => void;
  defaultDestination?: ImportDestination;
}

// Sample Multi-Owner Campaign CSV
const SAMPLE_CAMPAIGN_MULTI_OWNER_CSV = `Owner 1 Name,Address,City,Zip,Mailing Address,Owner 1 Phone 1,Owner 1 Phone 2,Owner 1 Phone 3,Owner 2 Name,Owner 2 Phone 1,Owner 2 Phone 2,Owner 3 Name,Owner 3 Phone 1
Robert Hernandez,4812 Tremont St,Dallas,75214,4812 Tremont St Dallas TX 75214,(214) 555-0142,(214) 555-0199,,Maria Hernandez,(214) 555-0188,,Carlos Hernandez,(214) 555-0177
Elena Rostova,1904 Cedar Crest Blvd,Dallas,75203,PO Box 8912 Plano TX 75024,(214) 432-8819,,,(972) 432-9900,Dmitri Rostov,(214) 432-8820,,
Thomas Sterling,820 E 12th St,Dallas,75203,1502 N Main St Fort Worth TX 76102,(214) 771-4091,(972) 341-9022,,Margaret Sterling,(214) 771-4095,,,`;

// Sample Deal Pipeline CSV
const SAMPLE_DEAL_PIPELINE_CSV = `Owner Name,Address,City,Zip,Mailing Address,Phone Number,Asking Price,Notes,Starting Offer,Max Offer,Counter Offer
Arthur Pendelton,742 Evergreen Terrace,Dallas,75201,742 Evergreen Terrace Dallas TX 75201,(214) 883-9102,$240,000,Heirs agreed to sell quickly,$190,000,$215,000,$230,000
Brenda Vance,1209 Oak Ridge Lane,Dallas,75208,401 Wilshire Blvd Santa Monica CA 90401,(214) 902-3341,$175,000,Needs roof and foundation work,$135,000,$155,000,
Carlos Gutierrez,3318 Pecan Blvd,Dallas,75216,3318 Pecan Blvd Dallas TX 75216,(972) 551-7788,$310,000,Vacant rental property,$250,000,$285,000,$295,000`;

const PROJECT_MGMT_STATUSES = [
  'Interested',
  'Interested - Has Asking Price',
  'For Comps',
  'For Offer',
  'Offer Made',
  'Negotiating',
  'Under Contract',
  'Rejected Offer',
  'Accepted Offer',
  'Contract Sent',
  'Contract Signed',
  'Asking Too High',
  'Callback',
  'Callback Tomorrow',
  'Listed',
  'Appointment In Person',
  'Deal Won',
];

const FOLLOW_UP_STATUSES = [
  'Not Interested - 30 Days',
  'Not Interested - 60 Days',
  'Not Interested - 90 Days',
  'Not Ready to Sell - 30 Days',
  'Not Ready to Sell - 60 Days',
  'Not Ready to Sell - 90 Days',
];

// Target fields available for explicit column mapping
export type StandardField =
  | 'skip'
  | 'ownerName'
  | 'address'
  | 'city'
  | 'zip'
  | 'mailingAddress'
  | 'mailingCity'
  | 'mailingZip'
  | 'phone'
  | 'askingPrice'
  | 'notes'
  | 'startingOffer'
  | 'maxOffer'
  | 'counterOffer'
  | 'owner1Name'
  | 'owner1Phone1'
  | 'owner1Phone2'
  | 'owner1Phone3'
  | 'owner2Name'
  | 'owner2Phone1'
  | 'owner2Phone2'
  | 'owner2Phone3'
  | 'owner3Name'
  | 'owner3Phone1'
  | 'owner3Phone2'
  | 'owner3Phone3';

// Helper to detect if a text string looks like a call log, date stamp, or note rather than a person's name
const isNoteOrDateText = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Date formats: "05-21-26", "05/21/2026", "2026-05-21", "06-04-26 Talked..."
  if (/^(\d{1,4}[-/. ]\d{1,2}[-/. ]\d{2,4}|\d{1,2}[-/. ]\d{1,2})/i.test(trimmed)) {
    return true;
  }

  // Common call log prefixes
  if (
    /^(va:|call:|called|talked|spoke|speaking|lvm|left\s*vm|left\s*voicemail|unreached|not\s*ready|not\s*interested|callback|follow\s*up|contacted|texted|sms|email|he\s+is|she\s+is|they\s+are|owner\s+said|needs\s|wants\s|no\s*answer|disconnected|busy|wrong\s*number|offer\s+made|sent\s+offer)/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Sentences or conversational phrases with verbs / activity words
  if (
    trimmed.length > 25 &&
    /\b(call|called|talked|spoke|interested|not ready|selling|sell|price|offer|voicemail|appointment|follow up|reaching)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return false;
};

// Check if string looks like a street address
const isLikelyAddress = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (isNoteOrDateText(trimmed)) return false;

  // Has numbers and street suffix or standard street pattern
  const hasDigits = /^\d+[\s\w]*/.test(trimmed);
  const streetSuffix =
    /\b(st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|way|ct|court|ln|lane|cir|circle|hwy|highway|pkwy|parkway|pl|place|trail|trl|loop|box)\b/i.test(
      trimmed
    );

  return (hasDigits && streetSuffix) || (hasDigits && trimmed.split(/\s+/).length >= 3);
};

// Check if string contains a plausible phone number
const isLikelyPhone = (text: string): boolean => {
  if (!text) return false;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

interface ParsedGrid {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

// Parses raw CSV/TSV while fully preserving newlines and commas/tabs inside quotes (RFC 4180)
const parseDelimitedGrid = (text: string): ParsedGrid => {
  if (!text || !text.trim()) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  // Detect delimiter from first non-empty line
  const linesPreview = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sampleLine = linesPreview[0] || '';
  const tabCount = (sampleLine.match(/\t/g) || []).length;
  const commaCount = (sampleLine.match(/,/g) || []).length;
  const delimiter = tabCount >= commaCount && tabCount > 0 ? '\t' : ',';

  const allRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim().replace(/^"|"$/g, ''));
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim().replace(/^"|"$/g, ''));
      currentField = '';

      if (currentRow.some((c) => c.length > 0)) {
        allRows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Push final field/row if any
  currentRow.push(currentField.trim().replace(/^"|"$/g, ''));
  if (currentRow.some((c) => c.length > 0)) {
    allRows.push(currentRow);
  }

  if (allRows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  // Determine if row 0 looks like a header row
  const firstRow = allRows[0];
  const firstRowLower = firstRow.map((c) => c.toLowerCase());
  const looksLikeHeader = firstRowLower.some(
    (c) =>
      c.includes('name') ||
      c.includes('owner') ||
      c.includes('address') ||
      c.includes('phone') ||
      c.includes('zip') ||
      c.includes('price') ||
      c.includes('offer') ||
      c.includes('city') ||
      c.includes('mail') ||
      c.includes('note') ||
      c.includes('call')
  );

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (looksLikeHeader) {
    headers = firstRow;
    dataRows = allRows.slice(1);
  } else {
    const maxCols = Math.max(...allRows.map((r) => r.length));
    headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
    dataRows = allRows;
  }

  return { headers, rows: dataRows, delimiter };
};

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  onAddNewCampaign,
  onImportLeads,
  defaultDestination,
}) => {
  if (!isOpen) return null;

  // Destination State
  const [destination, setDestination] = useState<ImportDestination>(
    defaultDestination || 'existing_campaign'
  );
  const [selectedCampaign, setSelectedCampaign] = useState<string>(
    campaigns[0] || 'Dallas Tax Delinquent'
  );
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [pipelineStage, setPipelineStage] = useState<'Project Mgmt' | 'Follow-Up'>('Project Mgmt');
  const [pipelineStatus, setPipelineStatus] = useState<string>('Interested');
  const [assignedVA, setAssignedVA] = useState<VA>('Rain');

  // Input Data State
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [showMappingConfig, setShowMappingConfig] = useState<boolean>(false);
  const [customMappings, setCustomMappings] = useState<Record<number, StandardField>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Raw parsing of lines and columns respecting multi-line quotes
  const parsedSheet = useMemo(() => {
    return parseDelimitedGrid(rawText);
  }, [rawText]);

  // 2. Automatic Header Detection logic based on Destination & Column Names
  const defaultAutoMappings = useMemo(() => {
    const mappings: Record<number, StandardField> = {};
    const { headers } = parsedSheet;
    if (headers.length === 0) return mappings;

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().trim();

      // Owner 1, Owner 2, Owner 3 specific checks
      if (lower.includes('owner 1') || lower.includes('owner1') || lower === 'owner 1,name') {
        if (lower.includes('phone 3') || lower.includes('phone3')) mappings[idx] = 'owner1Phone3';
        else if (lower.includes('phone 2') || lower.includes('phone2')) mappings[idx] = 'owner1Phone2';
        else if (lower.includes('phone 1') || lower.includes('phone1') || lower.includes('phone')) mappings[idx] = 'owner1Phone1';
        else mappings[idx] = 'owner1Name';
        return;
      }

      if (lower.includes('owner 2') || lower.includes('owner2')) {
        if (lower.includes('phone 3') || lower.includes('phone3')) mappings[idx] = 'owner2Phone3';
        else if (lower.includes('phone 2') || lower.includes('phone2')) mappings[idx] = 'owner2Phone2';
        else if (lower.includes('phone 1') || lower.includes('phone1') || lower.includes('phone')) mappings[idx] = 'owner2Phone1';
        else mappings[idx] = 'owner2Name';
        return;
      }

      if (lower.includes('owner 3') || lower.includes('owner3')) {
        if (lower.includes('phone 3') || lower.includes('phone3')) mappings[idx] = 'owner3Phone3';
        else if (lower.includes('phone 2') || lower.includes('phone2')) mappings[idx] = 'owner3Phone2';
        else if (lower.includes('phone 1') || lower.includes('phone1') || lower.includes('phone')) mappings[idx] = 'owner3Phone1';
        else mappings[idx] = 'owner3Name';
        return;
      }

      // Deal Pipeline offers & pricing
      if (lower.includes('starting offer') || lower.includes('start offer')) {
        mappings[idx] = 'startingOffer';
        return;
      }
      if (lower.includes('max offer') || lower.includes('maximum offer')) {
        mappings[idx] = 'maxOffer';
        return;
      }
      if (lower.includes('counter offer') || lower.includes('counter')) {
        mappings[idx] = 'counterOffer';
        return;
      }
      if (lower.includes('asking') || lower.includes('price') || lower.includes('asking price')) {
        mappings[idx] = 'askingPrice';
        return;
      }

      // Mailing Address detection (must precede generic address/city/zip)
      if (lower.includes('mail') || lower.includes('mailing')) {
        if (lower.includes('city')) {
          mappings[idx] = 'mailingCity';
          return;
        }
        if (lower.includes('zip') || lower.includes('postal')) {
          mappings[idx] = 'mailingZip';
          return;
        }
        mappings[idx] = 'mailingAddress';
        return;
      }

      // Address & Location
      if (lower.includes('address') || lower.includes('property') || lower.includes('street')) {
        mappings[idx] = 'address';
        return;
      }
      if (lower.includes('city') || lower.includes('municipality')) {
        mappings[idx] = 'city';
        return;
      }
      if (lower.includes('zip') || lower.includes('postal')) {
        mappings[idx] = 'zip';
        return;
      }

      // Notes & Call Logs
      if (
        lower.includes('note') ||
        lower.includes('comment') ||
        lower.includes('remark') ||
        lower.includes('history') ||
        lower.includes('call') ||
        lower.includes('log') ||
        lower.includes('disposition')
      ) {
        mappings[idx] = 'notes';
        return;
      }

      // Generic Phone & Name
      if (lower.includes('phone') || lower.includes('cell') || lower.includes('mobile')) {
        mappings[idx] = 'phone';
        return;
      }
      if (lower.includes('name') || lower.includes('owner') || lower.includes('contact')) {
        mappings[idx] = 'ownerName';
        return;
      }

      mappings[idx] = 'skip';
    });

    return mappings;
  }, [parsedSheet]);

  // Combined Active Mappings (default + user overrides)
  const activeMappings = useMemo(() => {
    const combined: Record<number, StandardField> = { ...defaultAutoMappings };
    Object.keys(customMappings).forEach((k) => {
      const idx = Number(k);
      combined[idx] = customMappings[idx];
    });
    return combined;
  }, [defaultAutoMappings, customMappings]);

  // 3. Process each row into structured Lead objects
  const parsedLeads = useMemo(() => {
    const { rows, headers } = parsedSheet;
    if (rows.length === 0) return [];

    let finalCampaign = selectedCampaign;
    let targetStage: StageId = 'Dallas';
    let targetStatus = 'Not Dialed';

    if (destination === 'new_campaign') {
      finalCampaign = newCampaignName.trim() || 'New Campaign';
      targetStage = 'Dallas';
    } else if (destination === 'existing_campaign') {
      finalCampaign = selectedCampaign;
      targetStage = 'Dallas';
    } else if (destination === 'deal_pipeline') {
      targetStage = pipelineStage;
      targetStatus = pipelineStatus;
      finalCampaign = 'Deal Pipeline Ingestion';
    } else if (destination === 'needs_skiptracing') {
      targetStage = 'Needs Skiptracing/Deepdive';
      targetStatus = 'Newly Added';
      finalCampaign = 'Skiptracing Queue';
    }

    const leads: Lead[] = [];

    rows.forEach((cols, rowIdx) => {
      // 1. Continuation check: Is this row an orphaned call log or note line?
      const firstColText = (cols[0] || '').trim();
      const secondColText = (cols[1] || '').trim();
      const allJoinedText = cols.filter(Boolean).join(' ');
      const hasAnyPhone = cols.some((c) => isLikelyPhone(c));
      const hasAnyAddress = cols.some((c) => isLikelyAddress(c));

      const isContinuation =
        !hasAnyPhone &&
        !hasAnyAddress &&
        (isNoteOrDateText(firstColText) || isNoteOrDateText(secondColText) || isNoteOrDateText(allJoinedText));

      if (isContinuation) {
        // If we already have at least one lead, append this orphaned text to that lead's call notes
        if (leads.length > 0) {
          const prevLead = leads[leads.length - 1];
          const noteSnippet = cols.filter(Boolean).join(' - ').trim();
          if (noteSnippet) {
            prevLead.callNotes = prevLead.callNotes
              ? `${prevLead.callNotes}\n${noteSnippet}`
              : noteSnippet;
          }
        }
        return; // Do NOT generate a fake lead for this note line!
      }

      // Collect values by mapped field
      let mainOwnerName = '';
      let propertyAddress = '';
      let city = '';
      let zip = '';
      let mailingAddress = '';
      let mailingCity = '';
      let mailingZip = '';
      let notes = '';
      let askingPrice = '';
      let startingOffer = '';
      let maxOffer = '';
      let counterOffer = '';

      // Owner-specific maps
      const ownerNames: Record<number, string> = {};
      const ownerPhones: Record<number, string[]> = {};
      const genericPhones: string[] = [];

      cols.forEach((val, colIdx) => {
        const cleanVal = (val || '').trim();
        const mapping = activeMappings[colIdx];

        if (!mapping || mapping === 'skip') {
          // Check if unmapped column header says Owner N Phone M
          const headerName = (headers[colIdx] || '').toLowerCase();
          const matchOwner = headerName.match(/owner\s*(\d+)/);
          const ownerNum = matchOwner ? parseInt(matchOwner[1], 10) : 0;

          if (ownerNum > 0) {
            if (headerName.includes('name') && cleanVal) {
              ownerNames[ownerNum] = cleanVal;
            } else if (headerName.includes('phone') && cleanVal) {
              if (!ownerPhones[ownerNum]) ownerPhones[ownerNum] = [];
              ownerPhones[ownerNum].push(cleanVal);
            }
          }
          return;
        }

        switch (mapping) {
          case 'ownerName':
            if (cleanVal) mainOwnerName = cleanVal;
            break;
          case 'address':
            if (cleanVal) propertyAddress = cleanVal;
            break;
          case 'city':
            if (cleanVal) city = cleanVal;
            break;
          case 'zip':
            if (cleanVal) zip = cleanVal;
            break;
          case 'mailingAddress':
            if (cleanVal) mailingAddress = cleanVal;
            break;
          case 'mailingCity':
            if (cleanVal) mailingCity = cleanVal;
            break;
          case 'mailingZip':
            if (cleanVal) mailingZip = cleanVal;
            break;
          case 'phone':
            if (cleanVal) genericPhones.push(cleanVal);
            break;
          case 'askingPrice':
            if (cleanVal) askingPrice = cleanVal;
            break;
          case 'notes':
            if (cleanVal) notes = cleanVal;
            break;
          case 'startingOffer':
            if (cleanVal) startingOffer = cleanVal;
            break;
          case 'maxOffer':
            if (cleanVal) maxOffer = cleanVal;
            break;
          case 'counterOffer':
            if (cleanVal) counterOffer = cleanVal;
            break;

          // Owner 1
          case 'owner1Name':
            if (cleanVal) ownerNames[1] = cleanVal;
            break;
          case 'owner1Phone1':
          case 'owner1Phone2':
          case 'owner1Phone3':
            if (cleanVal) {
              if (!ownerPhones[1]) ownerPhones[1] = [];
              ownerPhones[1].push(cleanVal);
            }
            break;

          // Owner 2
          case 'owner2Name':
            if (cleanVal) ownerNames[2] = cleanVal;
            break;
          case 'owner2Phone1':
          case 'owner2Phone2':
          case 'owner2Phone3':
            if (cleanVal) {
              if (!ownerPhones[2]) ownerPhones[2] = [];
              ownerPhones[2].push(cleanVal);
            }
            break;

          // Owner 3
          case 'owner3Name':
            if (cleanVal) ownerNames[3] = cleanVal;
            break;
          case 'owner3Phone1':
          case 'owner3Phone2':
          case 'owner3Phone3':
            if (cleanVal) {
              if (!ownerPhones[3]) ownerPhones[3] = [];
              ownerPhones[3].push(cleanVal);
            }
            break;
        }
      });

      // Also scan for Owner 4, Owner 5, etc. from column headers if not mapped
      headers.forEach((h, colIdx) => {
        const val = (cols[colIdx] || '').trim();
        if (!val) return;
        const lowerH = h.toLowerCase().trim();
        const match = lowerH.match(/owner\s*(\d+)/);
        if (match) {
          const ownerNum = parseInt(match[1], 10);
          if (lowerH.includes('phone')) {
            if (!ownerPhones[ownerNum]) ownerPhones[ownerNum] = [];
            if (!ownerPhones[ownerNum].includes(val)) {
              ownerPhones[ownerNum].push(val);
            }
          } else if (lowerH.includes('name') || !lowerH.includes('phone')) {
            if (!ownerNames[ownerNum]) {
              ownerNames[ownerNum] = val;
            }
          }
        }
      });

      // Determine the primary owner name for this property record
      let resolvedPrimaryName =
        ownerNames[1] || mainOwnerName || (Object.values(ownerNames)[0] ?? '');

      // Sanitize Owner Name: Check if the detected owner name is actually a date stamp or call note
      if (isNoteOrDateText(resolvedPrimaryName)) {
        if (resolvedPrimaryName) {
          notes = notes ? `${resolvedPrimaryName}\n${notes}` : resolvedPrimaryName;
        }
        resolvedPrimaryName = '';
      }

      // Sanitize Property Address: Check if the detected address is conversational notes (e.g. "he is still not ready...")
      let resolvedPropertyAddress = propertyAddress;
      if (
        resolvedPropertyAddress &&
        (!isLikelyAddress(resolvedPropertyAddress) || isNoteOrDateText(resolvedPropertyAddress))
      ) {
        notes = notes ? `${notes}\n${resolvedPropertyAddress}` : resolvedPropertyAddress;
        resolvedPropertyAddress = '';
      }

      // Skip row if completely blank or invalid (no valid human name and no valid property address)
      if (!resolvedPrimaryName && !resolvedPropertyAddress) {
        if (notes && leads.length > 0) {
          const prevLead = leads[leads.length - 1];
          prevLead.callNotes = prevLead.callNotes ? `${prevLead.callNotes}\n${notes}` : notes;
        }
        return;
      }

      // Construct Phone Records & Contacts list
      const phoneRecords: PhoneNumberRecord[] = [];
      const contactsList: ContactPerson[] = [];

      // Add owner contacts and their phones
      const allOwnerNums = Array.from(
        new Set([...Object.keys(ownerNames).map(Number), ...Object.keys(ownerPhones).map(Number)])
      ).sort((a, b) => a - b);

      if (allOwnerNums.length > 0) {
        allOwnerNums.forEach((num) => {
          const name = ownerNames[num] || `Owner ${num}`;
          const phones = ownerPhones[num] || [];
          const contactPhoneRecords: PhoneNumberRecord[] = [];

          phones.forEach((p, pIdx) => {
            const pRec: PhoneNumberRecord = {
              id: `p-${Date.now()}-${rowIdx}-${num}-${pIdx}`,
              number: p,
              label: `Owner ${num} Phone ${pIdx + 1}`,
              contactName: name,
            };
            phoneRecords.push(pRec);
            contactPhoneRecords.push(pRec);
          });

          contactsList.push({
            id: `c-${Date.now()}-${rowIdx}-${num}`,
            name,
            role: num === 1 ? 'Primary Owner' : `Co-Owner (${num})`,
            phoneNumbers: contactPhoneRecords,
          });
        });
      }

      // Add generic phones if present
      genericPhones.forEach((p, gIdx) => {
        phoneRecords.push({
          id: `p-${Date.now()}-${rowIdx}-gen-${gIdx}`,
          number: p,
          label: gIdx === 0 ? 'Primary Phone' : `Phone ${gIdx + 1}`,
          contactName: resolvedPrimaryName || 'Unknown Owner',
        });
      });

      // Resolve mailing address combining street, city, zip if mapped separately
      let finalMailingAddress = mailingAddress;
      if (mailingCity || mailingZip) {
        const cityZip = [mailingCity, mailingZip].filter(Boolean).join(' ');
        if (finalMailingAddress && !finalMailingAddress.includes(mailingCity)) {
          finalMailingAddress = `${finalMailingAddress}, ${cityZip}`.trim();
        } else if (!finalMailingAddress) {
          finalMailingAddress = cityZip;
        }
      }

      const initialLead: Lead = {
        id: `lead-${Date.now()}-${rowIdx}`,
        leadId: `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
        ownerName: resolvedPrimaryName || 'Unknown Owner',
        propertyAddress: resolvedPropertyAddress || '',
        city: city || '',
        zipCode: zip || '',
        mailingAddress: finalMailingAddress || undefined,
        mailingCity: mailingCity || undefined,
        mailingZip: mailingZip || undefined,
        phoneNumbers: phoneRecords,
        contacts: contactsList.length > 0 ? contactsList : undefined,
        campaign: finalCampaign,
        stageId: targetStage,
        sourceTab: (finalCampaign.slice(0, 20) as SourceTabId) || 'Dallas',
        assignedVA,
        vaStatus: destination === 'needs_skiptracing' ? 'Newly Added' : targetStatus,
        outreachStatus:
          destination === 'needs_skiptracing'
            ? 'Newly Added'
            : destination === 'deal_pipeline'
            ? targetStatus
            : 'Not yet dialed',
        promotedToPipeline: destination === 'needs_skiptracing' ? true : undefined,
        dateAddedToDeepdive: destination === 'needs_skiptracing' ? new Date().toISOString() : undefined,
        callsCount: 0,
        callNotes: notes || '',
        askingPrice: askingPrice || undefined,
        startingOffer: startingOffer || undefined,
        maxOffer: maxOffer || undefined,
        counterOffer: counterOffer || undefined,
        dateAdded: new Date().toISOString(),
      };

      if (destination === 'deal_pipeline') {
        const routed = routeLead(initialLead, targetStatus);
        leads.push(routed.updatedLead);
      } else {
        leads.push(initialLead);
      }
    });

    return leads;
  }, [parsedSheet, activeMappings, destination, selectedCampaign, newCampaignName, pipelineStage, pipelineStatus, assignedVA]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      setCustomMappings({});
      setParseError(null);
    };
    reader.onerror = () => {
      setParseError('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (type: 'campaign' | 'deal_pipeline') => {
    if (type === 'campaign') {
      setRawText(SAMPLE_CAMPAIGN_MULTI_OWNER_CSV);
    } else {
      setRawText(SAMPLE_DEAL_PIPELINE_CSV);
      setDestination('deal_pipeline');
    }
    setCustomMappings({});
    setParseError(null);
  };

  const handleDownloadTemplate = (type: 'campaign' | 'deal_pipeline') => {
    const csvContent =
      type === 'campaign' ? SAMPLE_CAMPAIGN_MULTI_OWNER_CSV : SAMPLE_DEAL_PIPELINE_CSV;
    const filename =
      type === 'campaign'
        ? 'groundwork_multi_owner_leads_template.csv'
        : 'groundwork_deal_pipeline_template.csv';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    if (parsedLeads.length === 0) {
      setParseError('No valid rows found. Please paste data or upload a file.');
      return;
    }

    if (destination === 'new_campaign') {
      const cleanName = newCampaignName.trim();
      if (!cleanName) {
        setParseError('Please enter a name for the new campaign.');
        return;
      }
      if (onAddNewCampaign) {
        onAddNewCampaign(cleanName);
      }
    }

    onImportLeads(parsedLeads);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E4E0D6] rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#B85338]/15 text-[#B85338] flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2421]">Bulk Lead & Deal Import</h2>
              <p className="text-xs text-[#5E6660]">
                Supports multi-owner addresses, phone numbers, and full Deal Pipeline columns.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#5E6660] hover:text-[#1F2421] hover:bg-[#F8F6F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Destination Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1F2421] uppercase tracking-wider">
              Step 1: Choose Import Destination
            </span>
            <span className="text-[11px] text-[#5E6660]">
              Campaign Lists or Deal Pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Option 1: Existing Campaign */}
            <button
              type="button"
              onClick={() => setDestination('existing_campaign')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                destination === 'existing_campaign'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Layers className="w-4 h-4 text-[#B85338]" />
                <span>Existing Campaign</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Add leads to an established outreach list
              </p>
            </button>

            {/* Option 2: Add New Campaign */}
            <button
              type="button"
              onClick={() => setDestination('new_campaign')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                destination === 'new_campaign'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Plus className="w-4 h-4 text-[#4A7A5E]" />
                <span>New Campaign</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Create a brand new campaign bucket
              </p>
            </button>

            {/* Option 3: Add to Deal Pipeline */}
            <button
              type="button"
              onClick={() => setDestination('deal_pipeline')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                destination === 'deal_pipeline'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Kanban className="w-4 h-4 text-[#2563EB]" />
                <span>Deal Pipeline</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Route directly with offers & asking price
              </p>
            </button>

            {/* Option 4: Needs Skiptracing/Deepdive */}
            <button
              type="button"
              id="btn-dest-skiptracing"
              onClick={() => setDestination('needs_skiptracing')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                destination === 'needs_skiptracing'
                  ? 'border-violet-600 bg-violet-50/80 ring-1 ring-violet-600'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <FileSearch className="w-4 h-4 text-violet-600" />
                <span>Needs Skiptracing</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Auto status: <strong className="text-violet-700">Newly Added</strong>
              </p>
            </button>
          </div>

          {/* Contextual Destination Options */}
          <div className="p-3 bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg">
            {destination === 'needs_skiptracing' && (
              <div className="flex items-center gap-2 text-xs text-violet-950 bg-violet-50 p-2.5 rounded border border-violet-200">
                <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0" />
                <span>
                  All imported properties will be placed into <strong>Needs Skiptracing/Deepdive</strong> with agent status automatically set to <strong className="text-violet-700 underline">Newly Added</strong>.
                </span>
              </div>
            )}
            {destination === 'existing_campaign' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-[#1F2421]">Target Campaign:</span>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="bg-white border border-[#E4E0D6] rounded px-3 py-1.5 text-xs font-semibold text-[#1F2421] outline-none min-w-[240px]"
                >
                  {campaigns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destination === 'new_campaign' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-[#1F2421]">New Campaign Name:</span>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Dallas Tax Delinquent Multi-Owner 2026"
                  className="flex-1 bg-white border border-[#E4E0D6] rounded px-3 py-1.5 text-xs text-[#1F2421] outline-none focus:border-[#B85338]"
                />
              </div>
            )}

            {destination === 'deal_pipeline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Target Pipeline Section
                  </label>
                  <select
                    value={pipelineStage}
                    onChange={(e) => {
                      const st = e.target.value as 'Project Mgmt' | 'Follow-Up';
                      setPipelineStage(st);
                      setPipelineStatus(st === 'Project Mgmt' ? 'Interested' : 'Follow-Up');
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  >
                    <option value="Project Mgmt">Project Management (Active Deals)</option>
                    <option value="Follow-Up">Follow Up (Nurture Timers)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Initial Status
                  </label>
                  <select
                    value={pipelineStatus}
                    onChange={(e) => setPipelineStatus(e.target.value)}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  >
                    {pipelineStage === 'Project Mgmt'
                      ? PROJECT_MGMT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))
                      : FOLLOW_UP_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: VA Assignment */}
        <div className="flex items-center justify-between gap-4 p-2.5 bg-white border border-[#E4E0D6] rounded-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#1F2421]">Assigned VA:</span>
            <span className="text-[11px] text-[#5E6660]">Default caller or manager for these imported records</span>
          </div>
          <select
            value={assignedVA}
            onChange={(e) => setAssignedVA(e.target.value as VA)}
            className="bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 text-xs font-bold text-[#1F2421] outline-none"
          >
            <option value="Rain">Rain</option>
            <option value="Jah">Jah</option>
            <option value="Jen">Jen</option>
            <option value="David">David</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>

        {/* Step 3: Input Method & Templates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex bg-[#F0EDE6] p-0.5 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  activeInputTab === 'paste' ? 'bg-white text-[#1F2421] shadow-xs' : 'text-[#5E6660]'
                }`}
              >
                Paste Spreadsheet / CSV Text
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('file')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  activeInputTab === 'file' ? 'bg-white text-[#1F2421] shadow-xs' : 'text-[#5E6660]'
                }`}
              >
                Upload CSV File
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {destination === 'deal_pipeline' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('deal_pipeline')}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Load Deal Pipeline Sample</span>
                  </button>
                  <span className="text-[#E4E0D6]">|</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('deal_pipeline')}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Pipeline Template</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('campaign')}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#B85338] hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Load Multi-Owner Sample</span>
                  </button>
                  <span className="text-[#E4E0D6]">|</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('campaign')}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Multi-Owner Template</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {activeInputTab === 'paste' ? (
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setParseError(null);
              }}
              placeholder={
                destination === 'deal_pipeline'
                  ? `Paste rows from Excel, Google Sheets, or CSV file here...\nFormat: Owner Name, Address, City, Zip, Phone Number, Asking Price, Notes, Starting Offer, Max Offer, Counter Offer`
                  : `Paste rows from Excel, Google Sheets, or CSV file here...\nFormat: Owner 1 Name, Address, City, Zip, Owner 1 Phone 1, Owner 1 Phone 2, Owner 1 Phone 3, Owner 2 Name, Owner 2 Phone 1...`
              }
              className="w-full h-32 p-3 text-xs font-mono bg-[#FDFBF7] border border-[#E4E0D6] rounded-lg outline-none focus:border-[#B85338] resize-none leading-relaxed placeholder:text-[#8C948E]"
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-[#E4E0D6] hover:border-[#B85338] rounded-lg flex flex-col items-center justify-center cursor-pointer bg-[#FDFBF7] hover:bg-[#F8F6F1] transition-colors p-4 text-center space-y-1"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="w-8 h-8 text-[#5E6660]" />
              <div className="text-xs font-bold text-[#1F2421]">
                {fileName ? fileName : 'Click to browse or drag & drop CSV'}
              </div>
              <div className="text-[11px] text-[#5E6660]">Supports comma or tab-delimited files</div>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Column Mapping Toggle & Drawer */}
        {parsedSheet.headers.length > 0 && (
          <div className="border border-[#E4E0D6] rounded-lg overflow-hidden bg-white">
            <div
              onClick={() => setShowMappingConfig(!showMappingConfig)}
              className="p-2.5 bg-[#F8F6F1] flex items-center justify-between cursor-pointer hover:bg-[#F0EDE6] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#B85338]" />
                <span className="text-xs font-bold text-[#1F2421]">
                  Column Mapping ({parsedSheet.headers.length} detected columns)
                </span>
                <span className="text-[11px] text-[#5E6660]">
                  {showMappingConfig ? 'Click to hide mapping' : 'Click to verify or change field mappings'}
                </span>
              </div>
              <span className="text-xs font-bold text-[#B85338]">
                {showMappingConfig ? 'Close ▲' : 'Adjust Mapping ▼'}
              </span>
            </div>

            {showMappingConfig && (
              <div className="p-3 bg-white border-t border-[#E4E0D6] max-h-48 overflow-y-auto space-y-2">
                <p className="text-[11px] text-[#5E6660]">
                  Leave any unneeded column set to <strong>[Skip Column]</strong>. Blank values in data rows will simply be kept blank.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {parsedSheet.headers.map((hdr, colIdx) => (
                    <div key={colIdx} className="p-2 rounded bg-[#FDFBF7] border border-[#E4E0D6] space-y-1">
                      <div className="text-[10px] font-mono font-bold text-[#5E6660] truncate" title={hdr}>
                        Col {colIdx + 1}: {hdr}
                      </div>
                      <select
                        value={activeMappings[colIdx] || 'skip'}
                        onChange={(e) => {
                          const val = e.target.value as StandardField;
                          setCustomMappings((prev) => ({
                            ...prev,
                            [colIdx]: val,
                          }));
                        }}
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs text-[#1F2421] font-semibold outline-none focus:border-[#B85338]"
                      >
                        <option value="skip">[Skip Column]</option>
                        <optgroup label="Core Property & Mailing Info">
                          <option value="ownerName">Owner Name (Single)</option>
                          <option value="address">Property Address</option>
                          <option value="city">City</option>
                          <option value="zip">Zip Code</option>
                          <option value="mailingAddress">Mailing Address (Street or Full)</option>
                          <option value="mailingCity">Mailing City</option>
                          <option value="mailingZip">Mailing Zip Code</option>
                          <option value="phone">Generic Phone</option>
                          <option value="notes">Notes / Comments</option>
                        </optgroup>
                        <optgroup label="Deal Pipeline Fields">
                          <option value="askingPrice">Asking Price</option>
                          <option value="startingOffer">Starting Offer</option>
                          <option value="maxOffer">Max Offer</option>
                          <option value="counterOffer">Counter Offer</option>
                        </optgroup>
                        <optgroup label="Multi-Owner: Owner 1">
                          <option value="owner1Name">Owner 1 Name</option>
                          <option value="owner1Phone1">Owner 1 Phone 1</option>
                          <option value="owner1Phone2">Owner 1 Phone 2</option>
                          <option value="owner1Phone3">Owner 1 Phone 3</option>
                        </optgroup>
                        <optgroup label="Multi-Owner: Owner 2">
                          <option value="owner2Name">Owner 2 Name</option>
                          <option value="owner2Phone1">Owner 2 Phone 1</option>
                          <option value="owner2Phone2">Owner 2 Phone 2</option>
                          <option value="owner2Phone3">Owner 2 Phone 3</option>
                        </optgroup>
                        <optgroup label="Multi-Owner: Owner 3">
                          <option value="owner3Name">Owner 3 Name</option>
                          <option value="owner3Phone1">Owner 3 Phone 1</option>
                          <option value="owner3Phone2">Owner 3 Phone 2</option>
                          <option value="owner3Phone3">Owner 3 Phone 3</option>
                        </optgroup>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Preview Table - Accurately matches parsed leads and multiple owners/offers */}
        {parsedLeads.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#5E6660] uppercase">
              <span className="flex items-center gap-1.5 text-[#1F2421]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4A7A5E]" />
                <span>Preview Parsed Records ({parsedLeads.length} Ready to Import)</span>
              </span>
              <span className="text-[#4A7A5E] font-semibold lowercase">
                Showing preview of first {Math.min(parsedLeads.length, 4)} records
              </span>
            </div>

            <div className="border border-[#E4E0D6] rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
              {destination === 'deal_pipeline' ? (
                /* Deal Pipeline Preview Format */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F6F1] text-[10px] uppercase font-bold text-[#5E6660] border-b border-[#E4E0D6] sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5">Owner Name</th>
                      <th className="px-2.5 py-1.5">Property Address</th>
                      <th className="px-2.5 py-1.5">Mailing Address</th>
                      <th className="px-2.5 py-1.5">City / Zip</th>
                      <th className="px-2.5 py-1.5">Phone</th>
                      <th className="px-2.5 py-1.5">Asking Price</th>
                      <th className="px-2.5 py-1.5">Starting Offer</th>
                      <th className="px-2.5 py-1.5">Max Offer</th>
                      <th className="px-2.5 py-1.5">Counter Offer</th>
                      <th className="px-2.5 py-1.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E0D6]">
                    {parsedLeads.slice(0, 4).map((lead, i) => (
                      <tr key={lead.id || i} className="hover:bg-[#FDFBF7]">
                        <td className="px-2.5 py-1.5 font-bold text-[#1F2421] truncate max-w-[120px]">
                          {lead.ownerName || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[130px]" title={lead.propertyAddress}>
                          {lead.propertyAddress || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[130px]" title={lead.mailingAddress}>
                          {lead.mailingAddress ? (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#B85338] shrink-0" />
                              <span className="truncate">{lead.mailingAddress}</span>
                            </span>
                          ) : (
                            <span className="text-[#8C948E] italic">Same / None</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] whitespace-nowrap">
                          {lead.city || ''} {lead.zipCode || ''}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-[#1F2421] whitespace-nowrap">
                          {lead.phoneNumbers[0]?.number || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-[#4A7A5E] font-bold whitespace-nowrap">
                          {lead.askingPrice || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-[#2563EB] whitespace-nowrap">
                          {lead.startingOffer || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-amber-700 whitespace-nowrap">
                          {lead.maxOffer || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-purple-700 whitespace-nowrap">
                          {lead.counterOffer || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[140px]">
                          {lead.callNotes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Campaign Multi-Owner Preview Format */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F6F1] text-[10px] uppercase font-bold text-[#5E6660] border-b border-[#E4E0D6] sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5">Primary Owner</th>
                      <th className="px-2.5 py-1.5">Address</th>
                      <th className="px-2.5 py-1.5">Mailing Address</th>
                      <th className="px-2.5 py-1.5">City / Zip</th>
                      <th className="px-2.5 py-1.5">All Associated Owners</th>
                      <th className="px-2.5 py-1.5">Total Phones</th>
                      <th className="px-2.5 py-1.5">Direct Dial 1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E0D6]">
                    {parsedLeads.slice(0, 4).map((lead, i) => (
                      <tr key={lead.id || i} className="hover:bg-[#FDFBF7]">
                        <td className="px-2.5 py-1.5 font-bold text-[#1F2421] truncate max-w-[120px]">
                          {lead.ownerName || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[130px]" title={lead.propertyAddress}>
                          {lead.propertyAddress || '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[130px]" title={lead.mailingAddress}>
                          {lead.mailingAddress ? (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#B85338] shrink-0" />
                              <span className="truncate">{lead.mailingAddress}</span>
                            </span>
                          ) : (
                            <span className="text-[#8C948E] italic">Same / None</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#5E6660] whitespace-nowrap">
                          {lead.city || ''} {lead.zipCode || ''}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {lead.contacts && lead.contacts.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {lead.contacts.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0EDE6] text-[#1F2421] font-medium"
                                >
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#8C948E] text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#1F2421] whitespace-nowrap">
                          <span className="font-bold text-xs bg-[#B85338]/10 text-[#B85338] px-2 py-0.5 rounded-full">
                            {lead.phoneNumbers.length} Phone{lead.phoneNumbers.length === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 font-mono text-[#1F2421] whitespace-nowrap">
                          {lead.phoneNumbers[0]?.number ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-[#4A7A5E]" />
                              {lead.phoneNumbers[0].number}
                            </span>
                          ) : (
                            <span className="text-[#8C948E] italic">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#E4E0D6] pt-3.5">
          <div className="text-xs text-[#5E6660]">
            {parsedLeads.length > 0 ? (
              <span>
                Ready to import <strong className="text-[#1F2421]">{parsedLeads.length}</strong>{' '}
                records into{' '}
                <strong className="text-[#B85338]">
                  {destination === 'deal_pipeline'
                    ? `Deal Pipeline (${pipelineStage} › ${pipelineStatus})`
                    : destination === 'new_campaign'
                    ? newCampaignName || 'New Campaign'
                    : selectedCampaign}
                </strong>
              </span>
            ) : (
              <span>No records loaded yet</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#E4E0D6] bg-white text-xs font-bold text-[#5E6660] hover:text-[#1F2421] hover:bg-[#F8F6F1] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedLeads.length === 0}
              onClick={handleConfirmImport}
              className="px-4 py-2 rounded-lg bg-[#B85338] hover:bg-[#A3432B] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Import {parsedLeads.length} Leads</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
