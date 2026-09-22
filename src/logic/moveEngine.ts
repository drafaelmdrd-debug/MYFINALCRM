import { Lead, CRMTask, StageId, TaskType, VA } from '../types';

export function isProjectStatus(status: string): boolean {
  const s = (status || '').trim();
  const projectStatuses = [
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
    'Asking too High',
    'Callback',
    'Callback Tomorrow',
    'Callback-Tomorrow',
    'Callback - Tomorrow',
    'Listed',
    'Deal Won',
    'Comps Needed',
    'Appointment In person',
    'In Person Meeting'
  ];
  return projectStatuses.some(ps => ps.toLowerCase() === s.toLowerCase());
}

export function isFollowupStatus(status: string): boolean {
  const s = (status || '').trim();
  const lower = s.toLowerCase();
  if (
    lower.startsWith('not interested') ||
    lower.startsWith('not ready') ||
    lower.startsWith('follow') ||
    lower.includes('not interested') ||
    lower.includes('not ready') ||
    lower === 'followup' ||
    lower === 'follow-up' ||
    lower === 'follow up'
  ) {
    return true;
  }
  const followupStatuses = [
    'Follow-Up',
    'Follow Up',
    'Followup',
    // Not Interested variants
    'Not Interested',
    'Not Interested - 30 Days',
    'Not Interested - 60 Days',
    'Not Interested - 90 Days',
    'Not Interested 30 Days',
    'Not Interested 60 Days',
    'Not Interested 90 Days',
    'NOT INTERESTED',
    // Not Ready variants
    'Not Ready to Sell',
    'Not Ready to Sell - 30 Days',
    'Not Ready to Sell - 60 Days',
    'Not Ready to Sell - 90 Days',
    'Not Ready',
    'Not Ready - 30 Days',
    'Not Ready - 60 Days',
    'Not Ready - 90 Days',
    'NOT READY',
    'NOT READY TO SELL',
  ];
  return followupStatuses.some((fs) => fs.toLowerCase() === lower);
}

export function isDNCStatus(status: string): boolean {
  const s = (status || '').trim();
  const dncStatuses = ['DNC', 'Sold Already', 'Ugly Property'];
  return dncStatuses.some(ds => ds.toLowerCase() === s.toLowerCase());
}

export function isLanguageStatus(status: string): boolean {
  const s = (status || '').trim();
  const langStatuses = ['Language Barrier', 'Spanish Speaker', 'Spanish'];
  return langStatuses.some(ls => ls.toLowerCase() === s.toLowerCase());
}

export function isNeedsDeepdiveStatus(status: string): boolean {
  const s = (status || '').trim().toUpperCase();
  return (
    s === 'NEEDS DEEPDIVE' ||
    s === 'NEEDS SKIPTRACING/DEEPDIVE' ||
    s === 'NEEDS SKIPTRACING' ||
    s === 'ALL NUMBERS BAD- NEEDS DEEPDIVE' ||
    s === 'ALL NUMBERS BAD - NEEDS DEEPDIVE' ||
    s.includes('NEEDS DEEPDIVE') ||
    s.includes('SKIPTRACING') ||
    s.includes('ALL NUMBERS BAD')
  );
}

/**
 * Call outcome dispositions that only apply to the specific phone number dialed
 * and MUST NOT move the lead out of the calling list / dialer or advance to another address target.
 * "VM, WRONG #, ANS MACHINE, HUNG UP, NO ANSWER, RINGING ONLY, CANNOT DIAL, BEEP/FAX TONE"
 */
export function isNumberOnlyDispo(status: string): boolean {
  const s = (status || '').trim().toUpperCase();
  return (
    s === 'VM' ||
    s === 'WRONG #' ||
    s === 'WRONG NUMBER' ||
    s === 'ANS MACHINE' ||
    s === 'ANSWERING MACHINE' ||
    s === 'HUNG UP' ||
    s === 'NO ANSWER' ||
    s === 'RINGING ONLY' ||
    s === 'CANNOT BE DIALED / NOT IN SERVICE' ||
    s === 'CANNOT DIAL' ||
    s === 'DC/ NOT A WORKING #' ||
    s === 'DC / NOT A WORKING #' ||
    s === 'BEEP/FAX TONE' ||
    s === 'BEEP / FAX TONE' ||
    s === 'FAX TONE'
  );
}

/**
 * Checks if a lead has been tagged to ANY Deal Pipeline stage or status
 * (Project Mgmt, Follow-Up, DNC, Language Barrier, Needs Skiptracing/Deepdive, or corresponding statuses).
 * When tagged, the lead must be removed from cold Calling Lists.
 */
export function isLeadInDealPipeline(lead: Lead): boolean {
  if (!lead) return false;
  if (
    lead.stageId === 'Project Mgmt' ||
    lead.stageId === 'Follow-Up' ||
    lead.stageId === 'DNC' ||
    lead.stageId === 'Language Barrier' ||
    lead.stageId === 'Needs Skiptracing/Deepdive' ||
    lead.stageId === 'Needs Deepdive' ||
    lead.promotedToPipeline
  ) {
    return true;
  }

  const candidates = [
    lead.vaStatus,
    lead.davidStatus,
    lead.vaFollowUpStatus,
  ].filter(Boolean) as string[];

  for (const status of candidates) {
    const s = status.trim();
    if (
      isProjectStatus(s) ||
      isFollowupStatus(s) ||
      isDNCStatus(s) ||
      isLanguageStatus(s) ||
      isNeedsDeepdiveStatus(s)
    ) {
      return true;
    }
  }

  return false;
}

export function formatDateToMMDDYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatDateToYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function calculateAutomatedDate(status: string): string | undefined {
  const clean = (status || '').trim();
  const lower = clean.toLowerCase();
  const today = new Date();

  // Rule 1: "Listed" -> +30 days
  if (lower === 'listed') {
    const future = new Date(today);
    future.setDate(today.getDate() + 30);
    return formatDateToYYYYMMDD(future);
  }

  // Rule 2: 30 / 60 / 90 days
  const daysMatch = clean.match(/\b(30|60|90)\b/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const future = new Date(today);
    future.setDate(today.getDate() + days);
    return formatDateToYYYYMMDD(future);
  }

  // Rule 3: Callback Tomorrow, Comps Needed, For Comps, For Offer -> tomorrow
  if (
    lower === 'callback tomorrow' ||
    lower === 'callback - tomorrow' ||
    lower === 'callback-tomorrow' ||
    lower === 'comps needed' ||
    lower === 'for comps' ||
    lower === 'for offer'
  ) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return formatDateToYYYYMMDD(tomorrow);
  }

  // Rule 4: Asking too High -> +20 days
  if (lower === 'asking too high') {
    const in20 = new Date(today);
    in20.setDate(today.getDate() + 20);
    return formatDateToYYYYMMDD(in20);
  }

  // Rule 5: Not Interested / Not Ready / Follow-Up -> default +30 days if not otherwise specified
  if (
    lower.includes('not interested') ||
    lower.includes('not ready') ||
    lower.startsWith('follow')
  ) {
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    return formatDateToYYYYMMDD(in30);
  }

  return undefined;
}

export function appendTimestampedNote(existingNotes: string, newText: string): string {
  const trimmedNew = (newText || '').trim();
  if (!trimmedNew) return existingNotes || '';

  const dateStr = formatDateToMMDDYY(new Date());
  const lines = trimmedNew.split('\n').filter(Boolean);

  const formattedAddedLines = lines.map(line => {
    const l = line.trim();
    if (/^\d{2}[/-]\d{2}[/-]\d{2}/.test(l)) {
      return l;
    }
    return `${dateStr} - ${l}`;
  });

  const addedBlock = formattedAddedLines.join('\n');
  if (!existingNotes || !existingNotes.trim()) {
    return addedBlock;
  }
  return `${existingNotes.trim()}\n\n${addedBlock}`;
}

export interface RouteResult {
  updatedLead: Lead;
  movedToStage?: StageId;
  reason: string;
}

/**
 * Master Move Engine Ported directly from Apps Script routeLead_ & moveToTargetTab_
 */
export function routeLead(
  lead: Lead,
  newStatus: string,
  dispoAgent?: VA | string
): RouteResult {
  const cleanStatus = (newStatus || '').trim();
  if (!cleanStatus) {
    return { updatedLead: lead, reason: 'No status change' };
  }

  // Status "Unresponsive" never triggers a move
  if (cleanStatus.toLowerCase() === 'unresponsive') {
    return {
      updatedLead: {
        ...lead,
        vaStatus: cleanStatus,
        outreachStatus: 'Unresponsive',
      },
      reason: 'Status set to Unresponsive (no stage change)',
    };
  }

  // Number-only call outcome dispositions (VM, WRONG #, ANS MACHINE, HUNG UP, NO ANSWER, RINGING ONLY, CANNOT DIAL, BEEP/FAX TONE)
  // NEVER trigger stage movement or route to deal pipeline
  if (isNumberOnlyDispo(cleanStatus)) {
    return {
      updatedLead: lead,
      reason: `Number-only disposition (${cleanStatus}) saved to phone number - no stage movement`,
    };
  }

  const updated: Lead = { ...lead };
  const currentStage = lead.stageId;
  const nowISO = new Date().toISOString();
  const calculatedFutureDate = calculateAutomatedDate(cleanStatus);

  // 1. Language Barrier
  if (isLanguageStatus(cleanStatus)) {
    updated.languageType = cleanStatus;
    updated.dateAdded = updated.dateAdded || nowISO;
    updated.vaStatus = cleanStatus;
    updated.promotedToPipeline = true;
    if (dispoAgent && ['Jah', 'Jen', 'Rain'].includes(dispoAgent)) {
      updated.assignedVA = dispoAgent as VA;
    }
    if (currentStage !== 'Language Barrier') {
      updated.stageId = 'Language Barrier';
      return {
        updatedLead: updated,
        movedToStage: 'Language Barrier',
        reason: `Auto-routed to Language Barrier on status: ${cleanStatus}`,
      };
    }
    return { updatedLead: updated, reason: `Updated Language Barrier status to: ${cleanStatus}` };
  }

  // 2. DNC
  if (isDNCStatus(cleanStatus)) {
    updated.dateAddedToDNC = nowISO;
    const marker = (dispoAgent as VA) || lead.assignedVA;
    updated.markedBy = marker;
    if (dispoAgent && ['Jah', 'Jen', 'Rain'].includes(dispoAgent)) {
      updated.assignedVA = dispoAgent as VA;
    }
    updated.vaStatus = cleanStatus;
    updated.promotedToPipeline = true;
    if (currentStage !== 'DNC') {
      updated.stageId = 'DNC';
      return {
        updatedLead: updated,
        movedToStage: 'DNC',
        reason: `Auto-routed to DNC on status: ${cleanStatus}`,
      };
    }
    return { updatedLead: updated, reason: `Updated DNC status to: ${cleanStatus}` };
  }

  // 3. Needs Skiptracing/Deepdive (All Numbers Bad - Needs Deepdive)
  if (isNeedsDeepdiveStatus(cleanStatus) || cleanStatus === 'Needs Skiptracing/Deepdive' || cleanStatus === 'Needs Deepdive') {
    updated.dateAddedToDeepdive = nowISO;
    if (dispoAgent && ['Jah', 'Jen', 'Rain'].includes(dispoAgent)) {
      updated.assignedVA = dispoAgent as VA;
    }
    if (!updated.vaStatus || updated.vaStatus === 'Not yet dialed') {
      updated.vaStatus = 'ALL NUMBERS BAD- NEEDS DEEPDIVE';
    }
    updated.promotedToPipeline = true;
    if (currentStage !== 'Needs Skiptracing/Deepdive' && currentStage !== 'Needs Deepdive') {
      updated.stageId = 'Needs Skiptracing/Deepdive';
      return {
        updatedLead: updated,
        movedToStage: 'Needs Skiptracing/Deepdive',
        reason: `Auto-routed to Needs Skiptracing/Deepdive on status: ${cleanStatus}`,
      };
    }
    return { updatedLead: updated, reason: `Updated Needs Skiptracing/Deepdive status to: ${cleanStatus}` };
  }

  // 3. Follow-Up (e.g. Not Interested - 30 Days, Not Ready to Sell - 30/60/90 Days)
  if (isFollowupStatus(cleanStatus)) {
    updated.originalStatus =
      lead.originalStatus || lead.vaStatus || lead.davidStatus || cleanStatus;
    updated.vaFollowUpStatus = cleanStatus;
    updated.pushedDate = nowISO;
    updated.vaStatus = cleanStatus;
    updated.stageId = 'Follow-Up';
    updated.promotedToPipeline = true;
    if (dispoAgent && ['Jah', 'Jen', 'Rain'].includes(dispoAgent)) {
      updated.assignedVA = dispoAgent as VA;
    }

    if (calculatedFutureDate) {
      updated.followUpDate = calculatedFutureDate;
    } else if (!updated.followUpDate) {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      updated.followUpDate = formatDateToYYYYMMDD(in30);
    }

    if (currentStage !== 'Follow-Up') {
      return {
        updatedLead: updated,
        movedToStage: 'Follow-Up',
        reason: `Auto-routed to Follow Up Kanban on status: ${cleanStatus}${
          updated.followUpDate ? ` (Follow-Up Due: ${updated.followUpDate})` : ''
        }`,
      };
    }
    return {
      updatedLead: updated,
      reason: `Updated Follow-Up status to: ${cleanStatus}`,
    };
  }

  // 4. Project Mgmt
  if (isProjectStatus(cleanStatus)) {
    updated.howTheyCameIn = lead.howTheyCameIn || cleanStatus;
    updated.davidStatus = cleanStatus;
    updated.pushedDate = updated.pushedDate || nowISO;
    updated.vaStatus = cleanStatus;
    updated.stageId = 'Project Mgmt';
    updated.promotedToPipeline = true;

    // Rule: "Make sure whoever dispo it will be the owner once moved on project management, if Jah, Jen or Rain."
    const eligibleVAs: (VA | string)[] = ['Jah', 'Jen', 'Rain'];
    if (dispoAgent && eligibleVAs.includes(dispoAgent)) {
      updated.assignedVA = dispoAgent as VA;
    } else if (lead.assignedVA && eligibleVAs.includes(lead.assignedVA)) {
      updated.assignedVA = lead.assignedVA;
    } else {
      updated.assignedVA = 'Rain';
    }

    if (calculatedFutureDate) {
      updated.callbackDate = calculatedFutureDate;
    }

    if (currentStage !== 'Project Mgmt') {
      return {
        updatedLead: updated,
        movedToStage: 'Project Mgmt',
        reason: `Auto-routed to Project Mgmt on status: ${cleanStatus} (Owner: ${updated.assignedVA})${
          calculatedFutureDate ? ` (Callback: ${calculatedFutureDate})` : ''
        }`,
      };
    }
    return {
      updatedLead: updated,
      reason: `Updated Project Mgmt status to: ${cleanStatus} (Owner: ${updated.assignedVA})`,
    };
  }

  // 5. Vice-Versa Movement: Return to Cold Outreach / Calling List / Campaigns
  const lower = cleanStatus.toLowerCase();
  if (
    lower.includes('cold') ||
    lower.includes('reset') ||
    lower.includes('restore') ||
    lower.includes('calling list') ||
    lower === 'not dialed' ||
    lower === 'dallas'
  ) {
    const targetStage: StageId =
      lead.sourceTab && !['Project Mgmt', 'Follow-Up', 'DNC', 'Language Barrier'].includes(lead.sourceTab)
        ? (lead.sourceTab as StageId)
        : 'Dallas';

    updated.stageId = targetStage;
    updated.promotedToPipeline = false;
    updated.vaFollowUpStatus = undefined;
    updated.davidStatus = undefined;
    updated.vaStatus = 'Not Dialed';
    updated.callbackDate = undefined;
    updated.followUpDate = undefined;
    updated.dateAddedToDNC = undefined;

    return {
      updatedLead: updated,
      movedToStage: targetStage,
      reason: `Returned lead to Cold Calling & Campaign List (${targetStage})`,
    };
  }

  // Otherwise stay in current stage and update status
  updated.vaStatus = cleanStatus;
  return { updatedLead: updated, reason: `Updated status to: ${cleanStatus}` };
}

/**
 * Ported from Apps Script compileDailyTasks()
 * Pulls leads whose callback/follow-up date is today or earlier from Project Mgmt and Follow-Up.
 */
export function generateDailyTasks(leads: Lead[]): CRMTask[] {
  const todayStr = formatDateToYYYYMMDD(new Date());
  const tasks: CRMTask[] = [];

  leads.forEach(lead => {
    let isEligible = false;
    let taskType: TaskType = 'Callback';
    let targetDate = '';
    let sourceTab: 'Project Mgmt' | 'Follow-Up' = 'Project Mgmt';

    if (lead.stageId === 'Project Mgmt') {
      sourceTab = 'Project Mgmt';
      targetDate = lead.callbackDate || '';
      const davidStatus = (lead.davidStatus || lead.vaStatus || '').toLowerCase();
      if (davidStatus === 'comps needed' || davidStatus === 'for comps') {
        taskType = 'Need Comps';
      } else if (davidStatus === 'appointment in person') {
        taskType = 'In Person Meeting';
      } else {
        taskType = 'Callback';
      }

      if (targetDate && targetDate <= todayStr) {
        isEligible = true;
      }
    } else if (
      lead.stageId === 'Follow-Up' ||
      isFollowupStatus(lead.vaStatus || lead.vaFollowUpStatus || lead.davidStatus || '')
    ) {
      sourceTab = 'Follow-Up';
      targetDate =
        lead.followUpDate ||
        calculateAutomatedDate(lead.vaFollowUpStatus || lead.vaStatus || '') ||
        todayStr;
      taskType = 'Follow up';

      if (targetDate && targetDate <= todayStr) {
        isEligible = true;
      }
    }

    if (isEligible) {
      const offerParts: string[] = [];
      if (lead.askingPrice) offerParts.push(`Asking Price: ${lead.askingPrice}`);
      if (lead.startingOffer) offerParts.push(`Starting Offer: ${lead.startingOffer}`);
      if (lead.maxOffer) offerParts.push(`Max Offer: ${lead.maxOffer}`);
      if (lead.counterOffer) offerParts.push(`Counter Offer: ${lead.counterOffer}`);

      const primaryPhone =
        lead.phoneNumbers.length > 0 ? lead.phoneNumbers[0].number : 'No Phone';

      const taskCompletedBy: VA = lead.taskAssignedTo || lead.assignedVA || 'Rain';
      const finalSourceTab: 'Project Mgmt' | 'Follow-Up' = sourceTab;

      tasks.push({
        id: `task-${lead.id}`,
        leadId: lead.id,
        ownerName: lead.ownerName || 'Unknown Owner',
        propertyAddress: lead.propertyAddress || 'No Address Link',
        notes: lead.callNotes || lead.vaNotes || '',
        taskType,
        time: '9:00 AM',
        assignedVA: lead.assignedVA || 'Rain',
        taskAssignedTo: taskCompletedBy,
        nextTaskDate: targetDate || todayStr,
        taskNotes: '',
        blankCol: '',
        phone: primaryPhone,
        status: lead.vaStatus || lead.davidStatus || lead.vaFollowUpStatus || 'Pending',
        offerDetails: offerParts.join(' | '),
        sourceTabName: finalSourceTab,
        completed: false,
      });
    }
  });

  return tasks;
}
