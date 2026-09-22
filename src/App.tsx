import React, { useState, useEffect, useMemo } from 'react';
import {
  Lead,
  CRMTask,
  MainNavView,
  VA,
  Disposition,
  CallResultCount,
  FollowUpTaskKPIs,
  TimesheetPunch,
  StageId,
} from './types';
import {
  INITIAL_LEADS,
  INITIAL_CALL_RESULTS,
  INITIAL_FOLLOWUP_TASK_CALLS,
} from './data/initialLeads';
import { INITIAL_PUNCHES } from './data/initialTimesheet';
import {
  routeLead,
  generateDailyTasks,
  appendTimestampedNote,
  formatDateToYYYYMMDD,
  isProjectStatus,
} from './logic/moveEngine';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PowerDialerView } from './components/PowerDialerView';
import { TasksTableView } from './components/TasksTableView';
import { KPIDashboardView } from './components/KPIDashboardView';
import { DealPipelineView } from './components/DealPipelineView';
import { CampaignsView } from './components/CampaignsView';
import { SearchView } from './components/SearchView';
import { TimesheetView } from './components/TimesheetView';
import { DNCView } from './components/DNCView';
import { LanguageBarrierView } from './components/LanguageBarrierView';
import { NeedsDeepdiveView } from './components/NeedsDeepdiveView';
import { triggerImmediateDial } from './dialerProtocol';
import { isLeadInDealPipeline, isDNCStatus, isLanguageStatus, isNumberOnlyDispo } from './logic/moveEngine';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { BulkImportModal, ImportDestination } from './components/BulkImportModal';
import { NewLeadModal } from './components/NewLeadModal';
import { ExportModal } from './components/ExportModal';
import { defaultGroupsForView } from './logic/exportLeads';
import { subscribeDialerSync } from './utils/dialerSyncChannel';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from './lib/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { useCloudState } from './lib/cloudSync';

const DEFAULT_CAMPAIGNS = [
  'Dallas Tax Delinquent',
  'Tarrant County',
  'DFW Infill Vacant Lots',
  'Legacy Dallas',
  'Large Acres',
  'TAX Delinquent 2026',
  '75210 South Dallas',
  '75215 South Dallas',
  'ResempliAddressesPulled',
  'Manually Found',
];

export default function App() {
  const { session, loading: authLoading, signOut } = useAuth();
  const signedIn = !!session;

  // Master Leads State — shared across every signed-in user via Supabase
  const [leads, setLeads, leadsLoaded] = useCloudState<Lead[]>('leads', INITIAL_LEADS, signedIn);

  // Campaigns State — shared
  const [campaigns, setCampaigns] = useCloudState<string[]>(
    'campaigns',
    DEFAULT_CAMPAIGNS,
    signedIn
  );

  // Helper to preserve task completion status across re-evaluations
  const mergeDailyTasks = (freshTasks: CRMTask[], prevTasks: CRMTask[]): CRMTask[] => {
    const prevMap = new Map(prevTasks.map((t) => [t.id, t]));
    return freshTasks.map((t) => {
      const existing = prevMap.get(t.id);
      if (existing) {
        return {
          ...t,
          completed: existing.completed,
          completedAt: existing.completedAt,
        };
      }
      return t;
    });
  };

  // Daily Tasks State
  const [tasks, setTasks] = useState<CRMTask[]>(() => {
    return generateDailyTasks(INITIAL_LEADS);
  });

  // KPI Call Results Counts State — shared
  const [callResults, setCallResults] = useCloudState<CallResultCount>(
    'call_results',
    INITIAL_CALL_RESULTS,
    signedIn
  );

  // Follow-Up Task Call Counts State — shared
  const [followupTaskCalls, setFollowupTaskCalls] = useCloudState<FollowUpTaskKPIs>(
    'followup_kpis',
    INITIAL_FOLLOWUP_TASK_CALLS,
    signedIn
  );

  // Operational Timesheet Punches State — shared
  const [punches, setPunches] = useCloudState<TimesheetPunch[]>(
    'timesheet_punches',
    INITIAL_PUNCHES,
    signedIn
  );

  // UI Navigation & Modals State
  const [currentView, setCurrentView] = useState<MainNavView>('power-dialer');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDialerLeadId, setActiveDialerLeadId] = useState<string | undefined>(undefined);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState<boolean>(false);
  const [bulkImportDestination, setBulkImportDestination] = useState<ImportDestination>('existing_campaign');
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; sub?: string } | null>(null);

  // Once leads have loaded from the shared workspace, recompile today's task
  // board from them (the initial `tasks` state above was built from the
  // local placeholder data before the real leads arrived).
  useEffect(() => {
    if (leadsLoaded) {
      setTasks((prev) => mergeDailyTasks(generateDailyTasks(leads), prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsLoaded]);

  // Daily Call Dispositions Matrix Refresh:
  // "Call Dispositions Matrix refreshes everyday"
  // This still uses localStorage for the *date marker* only — it's a
  // per-browser "have I already refreshed today" flag, not shared data.
  useEffect(() => {
    if (!signedIn) return;
    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem('groundwork_crm_call_results_date');
    if (lastDate && lastDate !== today) {
      const refreshed: CallResultCount = {};
      Object.keys(callResults).forEach((k) => {
        refreshed[k] = { Rain: 0, Jah: 0, Jen: 0, David: 0, total: 0 };
      });
      setCallResults(refreshed);
      showToast('Call Results Dispositions matrix refreshed for today’s session.', 'Daily Refresh');
    }
    localStorage.setItem('groundwork_crm_call_results_date', today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const showToast = (message: string, sub?: string) => {
    setToast({ message, sub });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Recompile daily tasks when leads change or manually requested
  const handleRefreshTasks = () => {
    const compiled = generateDailyTasks(leads);
    setTasks(compiled);
    showToast('Task board recompiled successfully.', 'Tasks Updated');
  };

  // Re-run full KPI count matching countExistingKPIs()
  const handleRefreshKPIs = () => {
    // 1. Recount follow-up task calls within this day's daily tasks that are done
    const taskKPIs = recalculateFollowUpKPIs(tasks);

    // 2. Re-evaluate leads list to trigger pipeline counts recount
    setLeads([...leads]);

    // 3. Re-evaluate call results and punches
    setCallResults({ ...callResults });
    setPunches([...punches]);

    showToast(
      `KPI Recount Complete: ${leads.length} leads evaluated. Rain: ${taskKPIs.Rain} | Jah: ${taskKPIs.Jah} | Jen: ${taskKPIs.Jen} | David: ${taskKPIs.David}`,
      'All Pipeline & Task Counts Verified'
    );
  };

  const handleRefreshPipelineCounts = () => {
    setLeads([...leads]);
    showToast(`Pipeline counts refreshed across all stages (${leads.length} leads audited).`, 'Pipeline Recount Accurate');
  };

  const handleRefreshCallResults = () => {
    setCallResults({ ...callResults });
    showToast('Call Results Dispositions matrix refreshed and synchronized.', 'Dispositions Recounted');
  };

  const handleRefreshTimesheet = () => {
    setPunches([...punches]);
    showToast('VA Timesheet & Hours Overview synchronized.', 'Timesheet Hours Updated');
  };

  // Attribution Rule Helper:
  // "All completed Project Management tasks are counted to Rain, except those assigned to David,
  // which count to David. Regular follow-up tasks are counted to whom they are named (Rain, Jah, or Jen)."
  const getTaskAttributedVA = (task: CRMTask): 'Rain' | 'Jah' | 'Jen' | 'David' => {
    const va = task.taskAssignedTo || task.assignedVA;
    if (va === 'Jen' || va === 'Jah' || va === 'Rain' || va === 'David') {
      return va;
    }
    return 'Rain';
  };

  const recalculateFollowUpKPIs = (taskList: CRMTask[] = tasks): FollowUpTaskKPIs => {
    const counts: FollowUpTaskKPIs = {
      Jen: 0,
      Jah: 0,
      Rain: 0,
      David: 0,
    };

    taskList.forEach((t) => {
      if (t.completed) {
        const va = getTaskAttributedVA(t);
        counts[va] = (counts[va] || 0) + 1;
      }
    });

    setFollowupTaskCalls(counts);
    return counts;
  };

  const handleUpdateFollowUpTaskKPIs = () => {
    const counts = recalculateFollowUpKPIs(tasks);
    showToast(
      `Recount complete for today's completed daily tasks: Rain: ${counts.Rain} | Jen: ${counts.Jen} | Jah: ${counts.Jah} | David: ${counts.David}`,
      'Daily Outreach Tasks Recounted'
    );
  };

  // Daily Refresh for Follow-Up Task Calls Made (Completed Outreaches)
  // Starts from 0 and adds +1 for every daily task done
  const handleDailyRefreshFollowUpTasks = () => {
    const zeroCounts: FollowUpTaskKPIs = { Jen: 0, Jah: 0, Rain: 0, David: 0 };
    setFollowupTaskCalls(zeroCounts);

    // Reset daily tasks to uncompleted so the team starts fresh from 0
    setTasks((prev) => prev.map((t) => ({ ...t, completed: false, completedAt: undefined })));

    showToast(
      'Daily Refresh: Follow-Up Task Calls reset to 0. Every daily task completed will add +1.',
      'Daily Outreach Reset to 0'
    );
  };

  // Daily Call Results Reset
  const handleResetDailyCallResults = () => {
    const refreshed: CallResultCount = {};
    Object.keys(callResults).forEach((k) => {
      refreshed[k] = { Rain: 0, Jah: 0, Jen: 0, David: 0, total: 0 };
    });
    setCallResults(refreshed);
    showToast('Call Results Dispositions reset for today’s session.', 'Daily Refresh Completed');
  };

  // Timesheet punch logging
  const handleAddPunch = (punch: Omit<TimesheetPunch, 'id'>) => {
    const newPunch: TimesheetPunch = {
      ...punch,
      id: `punch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setPunches((prev) => [...prev, newPunch]);
    showToast(
      `${punch.va}: ${punch.action.replace('_', ' ')} recorded at ${new Date(
        punch.timestamp
      ).toLocaleTimeString()}`,
      'Timesheet Punch Logged'
    );
  };

  // Timesheet full punches update (for 14-day pay period audit date editing)
  const handleUpdatePunches = (updatedPunches: TimesheetPunch[]) => {
    setPunches(updatedPunches);
    showToast('Timesheet punches and audit adjustments saved.', 'Audit Record Saved');
  };

  // Add Campaign Handler
  const handleAddNewCampaign = (name: string) => {
    const clean = name.trim();
    if (!clean || campaigns.includes(clean)) return;
    setCampaigns((prev) => [...prev, clean]);
    showToast(`Campaign "${clean}" created successfully.`, 'Campaign Added');
  };

  // Bulk Import Handler
  const handleBulkImportLeads = (newLeads: Lead[]) => {
    const updated = [...newLeads, ...leads];
    setLeads(updated);
    setTasks((prev) => mergeDailyTasks(generateDailyTasks(updated), prev));
    showToast(
      `Successfully imported ${newLeads.length} leads into the CRM.`,
      'Bulk Ingestion Complete'
    );
  };

  // Move Engine Status Change Handler
  const handleStatusChange = (lead: Lead, newStatus: string) => {
    const oldStage = lead.stageId;
    const result = routeLead(lead, newStatus, lead.assignedVA);
    const updated = result.updatedLead;

    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (selectedLead?.id === updated.id) {
      setSelectedLead(updated);
    }

    // Refresh task queue if date or stage changed
    setTimeout(() => {
      setTasks((prev) =>
        mergeDailyTasks(generateDailyTasks(leads.map((l) => (l.id === updated.id ? updated : l))), prev)
      );
    }, 100);

    // If lead was moved to Deal Pipeline, DNC, or Language Barrier, advance active dialer lead
    if (activeDialerLeadId === lead.id && isLeadInDealPipeline(updated)) {
      const remaining = leads.filter((l) => l.id !== lead.id && !isLeadInDealPipeline(l));
      if (remaining[0]) {
        setActiveDialerLeadId(remaining[0].id);
      }
    }

    if (result.movedToStage && result.movedToStage !== oldStage) {
      showToast(
        `Lead ${lead.ownerName} auto-routed from ${oldStage} → ${result.movedToStage}`,
        result.reason
      );
    } else {
      showToast(`Status updated: ${newStatus}`, result.reason);
    }
  };

  // Update full lead attributes from Drawer
  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    setSelectedLead(updatedLead);
    setTasks((prev) =>
      mergeDailyTasks(generateDailyTasks(leads.map((l) => (l.id === updatedLead.id ? updatedLead : l))), prev)
    );
    showToast(`Saved changes for ${updatedLead.ownerName}`);
  };

  // Delete entire lead permanently
  const handleDeleteLead = (leadId: string) => {
    const targetLead = leads.find((l) => l.id === leadId);
    const leadName = targetLead ? targetLead.ownerName : 'Lead';

    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setTasks((prev) => prev.filter((t) => t.leadId !== leadId));

    // If currently open in drawer, close it
    if (selectedLead?.id === leadId) {
      setSelectedLead(null);
      setIsDrawerOpen(false);
    }

    // If currently active in power dialer, shift to next lead
    if (activeDialerLeadId === leadId) {
      const remainingDialerLeads = leads
        .filter((l) => l.id !== leadId)
        .filter((l) => !isLeadInDealPipeline(l));
      setActiveDialerLeadId(remainingDialerLeads[0]?.id);
    }

    showToast(`Deleted entire lead: ${leadName}`, 'Lead Removed');
  };

  // Delete individual phone number record from a lead
  const handleDeletePhoneNumber = (leadId: string, phoneId: string) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    const phoneRec = targetLead.phoneNumbers.find((p) => p.id === phoneId);
    const numStr = phoneRec ? phoneRec.number : 'number';
    const updatedPhones = targetLead.phoneNumbers.filter((p) => p.id !== phoneId);

    const updatedLead: Lead = {
      ...targetLead,
      phoneNumbers: updatedPhones,
    };

    setLeads((prev) => prev.map((l) => (l.id === leadId ? updatedLead : l)));

    if (selectedLead?.id === leadId) {
      setSelectedLead(updatedLead);
    }

    showToast(`Deleted number ${numStr} from ${targetLead.ownerName}`, 'Number Removed');
  };

  // Save after call in Power Dialer (Matches saveAfterCall & recordCallResult_)
  const handleSaveAfterCall = (
    leadId: string,
    phoneNumber: string,
    disposition: Disposition,
    notes: string,
    askingPrice: string,
    agent: VA,
    fromPowerDialer: boolean = true
  ) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Special Exception for Power Dialer:
    // "keep everything on disposition the same, howveer make an exeption for the leads from power dialer, DNC and language barrier disposition will only dispo that certain number with the copied lead info ofcourseand move it to there designated location, other numbers will stay on the power dialer, again only applicable for leads under PowerDialer and only for disposition DNC and Language Barrier"
    const isGranularSpecialDispo =
      fromPowerDialer && (isDNCStatus(disposition) || isLanguageStatus(disposition));

    let newLeads: Lead[];
    let movedStage: StageId | undefined;
    let assignedOwner: VA = agent;

    if (isGranularSpecialDispo && lead.phoneNumbers.length > 1) {
      // Find the specific phone record being dispositioned
      const dispoPhoneRecord =
        lead.phoneNumbers.find((p) => p.number === phoneNumber) || lead.phoneNumbers[0];
      const remainingPhoneRecords = lead.phoneNumbers.filter(
        (p) => p !== dispoPhoneRecord && p.number !== dispoPhoneRecord.number
      );

      const isDNC = isDNCStatus(disposition);
      const targetStage: StageId = isDNC ? 'DNC' : 'Language Barrier';
      const targetContactName = dispoPhoneRecord.contactName || lead.ownerName;

      // 1. Create the copied lead record for designated location (DNC or Language Barrier)
      const copiedLead: Lead = {
        ...lead,
        id: `lead-dispo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        leadId: `${lead.leadId}-${isDNC ? 'DNC' : 'LANG'}`,
        ownerName: targetContactName,
        phoneNumbers: [
          {
            ...dispoPhoneRecord,
            lastDispo: disposition,
          },
        ],
        stageId: targetStage,
        promotedToPipeline: true,
        callsCount: 1,
        lastCallDate: formatDateToYYYYMMDD(new Date()),
        lastDispo: disposition,
        askingPrice: askingPrice || lead.askingPrice,
        assignedVA: ['Jah', 'Jen', 'Rain'].includes(agent) ? (agent as VA) : lead.assignedVA,
        dateAddedToDNC: isDNC ? new Date().toISOString() : undefined,
        dateAdded: !isDNC ? new Date().toISOString() : undefined,
        markedBy: agent,
        languageType: !isDNC ? disposition : undefined,
        vaStatus: disposition,
        outreachStatus: `1 call logged\nLast: ${disposition}`,
        callNotes: appendTimestampedNote(
          lead.callNotes || lead.vaNotes || '',
          `[${disposition} - ${dispoPhoneRecord.number} (${targetContactName})]: ${
            notes.trim() || 'Dispositioned from Power Dialer'
          }`
        ),
        vaNotes: appendTimestampedNote(
          lead.callNotes || lead.vaNotes || '',
          `[${disposition} - ${dispoPhoneRecord.number} (${targetContactName})]: ${
            notes.trim() || 'Dispositioned from Power Dialer'
          }`
        ),
      };

      movedStage = targetStage;
      assignedOwner = copiedLead.assignedVA;

      // 2. Original lead stays on Power Dialer with remaining numbers
      let updatedOriginalNotes = lead.callNotes || lead.vaNotes || '';
      if (notes.trim()) {
        updatedOriginalNotes = appendTimestampedNote(
          updatedOriginalNotes,
          `[${dispoPhoneRecord.number} (${targetContactName}) marked ${disposition}]: ${notes.trim()}`
        );
      } else {
        updatedOriginalNotes = appendTimestampedNote(
          updatedOriginalNotes,
          `[${dispoPhoneRecord.number} (${targetContactName}) moved to ${targetStage}]`
        );
      }

      const updatedOriginalLead: Lead = {
        ...lead,
        phoneNumbers: remainingPhoneRecords,
        callNotes: updatedOriginalNotes,
        vaNotes: updatedOriginalNotes,
        askingPrice: askingPrice || lead.askingPrice,
        callsCount: lead.callsCount + 1,
        lastCallDate: formatDateToYYYYMMDD(new Date()),
        lastDispo: disposition,
      };

      newLeads = [copiedLead, ...leads.map((l) => (l.id === lead.id ? updatedOriginalLead : l))];
      setLeads(newLeads);

      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedOriginalLead);
      }

      showToast(
        `Number ${dispoPhoneRecord.number} moved to ${targetStage}. Remaining ${remainingPhoneRecords.length} number(s) stay active on Power Dialer.`,
        'Granular Disposition'
      );
    } else if (isNumberOnlyDispo(disposition)) {
      // Number-only call outcome disposition (VM, WRONG #, ANS MACHINE, HUNG UP, NO ANSWER, RINGING ONLY, CANNOT DIAL, BEEP/FAX TONE)
      // "make sure when dispo for VM< WRONG # ,ans machine, hung up. no answer, ringing only, cannot dial, beep/faxtone, it will dispo save to only that number and will not move to other address target, continue on that record, other dispo will remain thesame including movement"
      const targetPhoneRecord = lead.phoneNumbers.find((p) => p.number === phoneNumber) || lead.phoneNumbers[0];
      const targetContactName = targetPhoneRecord?.contactName || lead.ownerName;

      const updatedPhones = lead.phoneNumbers.map((p) => {
        if (p.number === phoneNumber || (targetPhoneRecord && p.id === targetPhoneRecord.id)) {
          return {
            ...p,
            lastDispo: disposition,
          };
        }
        return p;
      });

      let updatedNotes = lead.callNotes || lead.vaNotes || '';
      const noteContent = notes.trim()
        ? `[${disposition} - ${targetPhoneRecord?.number || phoneNumber} (${targetContactName})]: ${notes.trim()}`
        : `[${disposition} - ${targetPhoneRecord?.number || phoneNumber} (${targetContactName})]`;
      updatedNotes = appendTimestampedNote(updatedNotes, noteContent);

      const isDispoVA = agent === 'Jah' || agent === 'Jen' || agent === 'Rain';
      const dispoOwner: VA = isDispoVA
        ? agent
        : (['Jah', 'Jen', 'Rain'].includes(lead.assignedVA) ? lead.assignedVA : 'Rain');

      const updatedLead: Lead = {
        ...lead,
        phoneNumbers: updatedPhones,
        callNotes: updatedNotes,
        vaNotes: updatedNotes,
        askingPrice: askingPrice || lead.askingPrice,
        callsCount: lead.callsCount + 1,
        lastCallDate: formatDateToYYYYMMDD(new Date()),
        lastDispo: disposition,
        outreachStatus: `${lead.callsCount + 1} call${lead.callsCount + 1 > 1 ? 's' : ''} logged\nLast: ${disposition} (${targetPhoneRecord?.number || phoneNumber})`,
        assignedVA: dispoOwner,
      };

      newLeads = leads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
      setLeads(newLeads);

      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Explicitly stay on THIS lead record (do NOT advance to other address target)
    } else {
      // Standard disposition flow with stage movement (Interested, Callback, Follow-Up, DNC, Spanish, etc.)
      const updatedPhones = lead.phoneNumbers.map((p) => {
        if (p.number === phoneNumber) {
          return {
            ...p,
            lastDispo: disposition,
          };
        }
        return p;
      });

      let updatedNotes = lead.callNotes || lead.vaNotes || '';
      if (notes.trim()) {
        updatedNotes = appendTimestampedNote(updatedNotes, notes);
      }

      const isDispoVA = agent === 'Jah' || agent === 'Jen' || agent === 'Rain';
      const dispoOwner: VA = isDispoVA
        ? agent
        : (['Jah', 'Jen', 'Rain'].includes(lead.assignedVA) ? lead.assignedVA : 'Rain');

      let updatedLead: Lead = {
        ...lead,
        phoneNumbers: updatedPhones,
        callNotes: updatedNotes,
        vaNotes: updatedNotes,
        askingPrice: askingPrice || lead.askingPrice,
        callsCount: lead.callsCount + 1,
        lastCallDate: formatDateToYYYYMMDD(new Date()),
        lastDispo: disposition,
        outreachStatus: `${lead.callsCount + 1} call${lead.callsCount + 1 > 1 ? 's' : ''} logged\nLast: ${disposition}`,
        assignedVA: dispoOwner,
      };

      let targetStatus = disposition as string;
      if (disposition === 'CALLBACK') targetStatus = 'Callback';
      if (disposition === 'LISTED ON MLS') targetStatus = 'Listed';

      const routeRes = routeLead(updatedLead, targetStatus, agent);
      updatedLead = routeRes.updatedLead;
      movedStage = routeRes.movedToStage;
      assignedOwner = updatedLead.assignedVA;

      newLeads = leads.map((l) => (l.id === updatedLead.id ? updatedLead : l));
      setLeads(newLeads);

      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Only advance active dialer lead IF this lead was actually moved out of the dialer workspace
      const isMovedOutOfDialer = isLeadInDealPipeline(updatedLead);
      if (isMovedOutOfDialer && activeDialerLeadId === leadId) {
        const remainingDialerLeads = newLeads.filter((l) => !isLeadInDealPipeline(l));
        const nextLead = remainingDialerLeads.find((l) => l.id !== leadId) || remainingDialerLeads[0];
        if (nextLead) {
          setActiveDialerLeadId(nextLead.id);
        }
      }
    }

    // 6. Update Call Results Dispositions Counter on KPI's tab (recordCallResult_)
    setCallResults((prev) => {
      const current = prev[disposition] || { Rain: 0, Jah: 0, Jen: 0, David: 0, total: 0 };
      const agentKey = (['Rain', 'Jah', 'Jen', 'David'].includes(agent) ? agent : 'Rain') as 'Rain' | 'Jah' | 'Jen' | 'David';
      const updatedAgentCount = (current[agentKey] || 0) + 1;
      const updatedTotal =
        (current.Rain || 0) +
        (current.Jah || 0) +
        (current.Jen || 0) +
        (current.David || 0) +
        1;

      return {
        ...prev,
        [disposition]: {
          ...current,
          [agentKey]: updatedAgentCount,
          total: updatedTotal,
        },
      };
    });

    // 7. Update Daily Tasks
    setTasks((prev) => mergeDailyTasks(generateDailyTasks(newLeads), prev));

    showToast(
      `Saved ${agent} | ${phoneNumber} | ${disposition}`,
      movedStage ? `Auto-routed to ${movedStage} (Owner: ${assignedOwner})` : undefined
    );
  };

  // Two-Way Back Sync for Task Edits (Matches syncTaskEditBackToSource_)
  const handleUpdateTask = (task: CRMTask, updatedFields: Partial<CRMTask>) => {
    // 1. Update task in task list
    const updatedTask = { ...task, ...updatedFields };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));

    // 2. Locate source lead and back-sync
    const sourceLead = leads.find((l) => l.id === task.leadId);
    if (!sourceLead) return;

    let leadUpdates: Partial<Lead> = {};

    // Date change back-sync
    if (updatedFields.nextTaskDate) {
      if (task.sourceTabName === 'Project Mgmt') {
        leadUpdates.callbackDate = updatedFields.nextTaskDate;
      } else {
        leadUpdates.followUpDate = updatedFields.nextTaskDate;
      }
    }

    // VA assignment back-sync (updates lead.taskAssignedTo so it survives daily refreshes)
    if (updatedFields.taskAssignedTo) {
      leadUpdates.taskAssignedTo = updatedFields.taskAssignedTo;
    } else if (updatedFields.assignedVA) {
      leadUpdates.taskAssignedTo = updatedFields.assignedVA;
    }

    // Inline note change back-sync
    if (updatedFields.taskNotes) {
      leadUpdates.callNotes = appendTimestampedNote(
        sourceLead.callNotes || '',
        updatedFields.taskNotes
      );
      leadUpdates.vaNotes = leadUpdates.callNotes;
    }

    // Status change back-sync
    if (updatedFields.status) {
      const routed = routeLead({ ...sourceLead, ...leadUpdates }, updatedFields.status);
      leadUpdates = routed.updatedLead;
      showToast(`Synced status to ${task.sourceTabName}: ${updatedFields.status}`);
    } else {
      showToast(`Synced task update to ${task.sourceTabName}!`);
    }

    if (updatedFields.completed !== undefined && updatedFields.completed !== task.completed) {
      const attributedVA = getTaskAttributedVA(task);
      const isNowDone = updatedFields.completed;
      setFollowupTaskCalls((prev) => {
        const currentVal = prev[attributedVA] || 0;
        const nextVal = isNowDone ? currentVal + 1 : Math.max(0, currentVal - 1);
        return { ...prev, [attributedVA]: nextVal };
      });
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === sourceLead.id ? { ...l, ...leadUpdates } : l))
    );
  };

  const handleCompleteTask = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const newCompleted = !target.completed;
    const attributedVA = getTaskAttributedVA(target);

    const updatedTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          completed: newCompleted,
          completedAt: newCompleted ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return t;
    });

    setTasks(updatedTasks);

    setFollowupTaskCalls((prev) => {
      const currentVal = prev[attributedVA] || 0;
      const nextVal = newCompleted ? currentVal + 1 : Math.max(0, currentVal - 1);
      return { ...prev, [attributedVA]: nextVal };
    });

    showToast(
      newCompleted
        ? `Task completed! +1 added to ${attributedVA} under Follow-Up Task Calls Made (${target.taskType})`
        : `Task marked incomplete (-1 for ${attributedVA}).`,
      'Daily Outreach Synchronized'
    );
  };

  const handleOpenLeadDetail = (leadOrId: Lead | string) => {
    const found =
      typeof leadOrId === 'string'
        ? leads.find((l) => l.id === leadOrId)
        : leadOrId;
    if (found) {
      setSelectedLead(found);
      setIsDrawerOpen(true);
    }
  };

  const handleLaunchDialer = (
    leadId?: string,
    phoneNumber?: string,
    _openedWithDial: boolean = false
  ) => {
    let targetPhone = phoneNumber;
    if (leadId) {
      const found = leads.find((l) => l.id === leadId);
      if (found) {
        targetPhone = phoneNumber || found.phoneNumbers[0]?.number;
        setActiveDialerLeadId(leadId);
      }
    } else {
      const firstAvailable = leads.find((l) => !isLeadInDealPipeline(l)) || leads[0];
      targetPhone = phoneNumber || firstAvailable?.phoneNumbers[0]?.number;
    }
    if (targetPhone) {
      triggerImmediateDial(targetPhone);
    }
  };

  // Listen for broadcasted dialer commands
  useEffect(() => {
    const handleOpenPopoutEvent = (e: any) => {
      const { leadId, phoneNumber, openedWithDial } = e.detail || {};
      handleLaunchDialer(leadId, phoneNumber, openedWithDial ?? true);
    };

    window.addEventListener('crm-open-popout-dialer', handleOpenPopoutEvent);

    const unsubscribeSync = subscribeDialerSync((data) => {
      if (data.action === 'dial' && data.phoneNumber) {
        if (data.leadId) {
          setActiveDialerLeadId(data.leadId);
        }
      } else if (data.action === 'select_lead' && data.leadId) {
        setActiveDialerLeadId(data.leadId);
      }
    });

    return () => {
      window.removeEventListener('crm-open-popout-dialer', handleOpenPopoutEvent);
      unsubscribeSync();
    };
  }, [leads]);

  const handlePromoteToPipeline = (lead: Lead) => {
    handleStatusChange(lead, 'Interested');
    showToast(`Promoted ${lead.ownerName} to Project Mgmt Pipeline!`);
  };

  const handleAddNewLead = (newLead: Lead) => {
    const updated = [newLead, ...leads];
    setLeads(updated);
    setTasks((prev) => mergeDailyTasks(generateDailyTasks(updated), prev));
    showToast(`Added ${newLead.ownerName} to ${newLead.campaign}`);
  };

  // Active Leads for Dialer Workspace:
  // "once a lead from Dsialer workspace was moved to any statuses on Deal Pipeline . DNC or Language bariier, removeit from the Dialer Workspace."
  const dialerWorkspaceLeads = useMemo(() => {
    return leads.filter((l: Lead) => !isLeadInDealPipeline(l));
  }, [leads]);

  // Keep active dialer lead synchronized with available dialer workspace leads
  useEffect(() => {
    if (dialerWorkspaceLeads.length > 0) {
      const exists = dialerWorkspaceLeads.some((l: Lead) => l.id === activeDialerLeadId);
      if (!exists) {
        setActiveDialerLeadId(dialerWorkspaceLeads[0].id);
      }
    }
  }, [dialerWorkspaceLeads, activeDialerLeadId]);

  // Counts for sidebar badges
  const coldCount = dialerWorkspaceLeads.length;
  const pipelineCount = leads.filter((l) => l.stageId === 'Project Mgmt').length;
  const dncCount = leads.filter((l) => l.stageId === 'DNC').length;
  const languageBarrierCount = leads.filter((l) => l.stageId === 'Language Barrier').length;
  const needsDeepdiveCount = leads.filter(
    (l) => l.stageId === 'Needs Skiptracing/Deepdive' || l.stageId === 'Needs Deepdive'
  ).length;
  const tasksDueCount = tasks.filter((t) => !t.completed).length;

  // Auth gate: don't show the workspace until we know who (if anyone) is signed in.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F1] text-sm text-[#5E6660]">
        Loading…
      </div>
    );
  }

  if (!signedIn) {
    return <LoginScreen />;
  }

  // Data gate: wait for the shared workspace data to load before rendering,
  // so nobody briefly sees the empty/placeholder state on first load.
  if (!leadsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F1] text-sm text-[#5E6660]">
        Loading shared workspace…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F1] text-[#1F2421] selection:bg-[#B85338]/20 selection:text-[#B85338]">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-16 right-6 z-50 bg-[#1F2421] text-white px-4 py-3 rounded-lg shadow-2xl border border-[#E4E0D6]/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 max-w-md">
          <div className="w-5 h-5 rounded-full bg-[#4A7A5E]/20 text-[#4A7A5E] flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-0.5">
            <div className="font-bold">{toast.message}</div>
            {toast.sub && <div className="text-[#A4AEA7] text-[11px]">{toast.sub}</div>}
          </div>
        </div>
      )}

      {/* Global Top Navigation Bar */}
      <Header
        searchQuery={globalSearch}
        onSearchChange={(q) => {
          setGlobalSearch(q);
          if (q.trim() && currentView !== 'search') {
            setCurrentView('search');
          }
        }}
        onOpenNewLead={() => setIsNewLeadModalOpen(true)}
        onOpenImport={() => setIsBulkImportOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        userEmail={session?.user?.email}
        onSignOut={signOut}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          callingListCount={coldCount}
          pipelineCount={pipelineCount}
          dailyTasksCount={tasksDueCount}
          dncCount={dncCount}
          languageBarrierCount={languageBarrierCount}
          needsDeepdiveCount={needsDeepdiveCount}
        />

        {/* View Routing Container */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'power-dialer' && (
            <PowerDialerView
              leads={dialerWorkspaceLeads}
              currentLeadId={activeDialerLeadId}
              onSaveAfterCall={handleSaveAfterCall}
              onLeadChange={setActiveDialerLeadId}
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
              onAddNewLead={() => setIsNewLeadModalOpen(true)}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}

          {currentView === 'daily-tasks' && (
            <TasksTableView
              tasks={tasks}
              onRefreshTasks={handleRefreshTasks}
              onUpdateTask={handleUpdateTask}
              onCompleteTask={handleCompleteTask}
              onOpenLeadDetail={handleOpenLeadDetail}
              onLaunchDialer={handleLaunchDialer}
            />
          )}

          {currentView === 'metrics' && (
            <KPIDashboardView
              leads={leads}
              callResults={callResults}
              followupTaskCalls={followupTaskCalls}
              tasks={tasks}
              onManualRefresh={handleRefreshKPIs}
              onUpdateFollowUpTaskKPIs={handleUpdateFollowUpTaskKPIs}
              onDailyRefreshFollowUpTasks={handleDailyRefreshFollowUpTasks}
              onRefreshPipelineCounts={handleRefreshPipelineCounts}
              onRefreshCallResults={handleRefreshCallResults}
              onRefreshTimesheet={handleRefreshTimesheet}
              onNavigateToTimesheet={() => setCurrentView('timesheet')}
              punches={punches}
              onAddPunch={handleAddPunch}
              onResetDailyCallResults={handleResetDailyCallResults}
            />
          )}

          {currentView === 'timesheet' && (
            <TimesheetView
              punches={punches}
              onAddPunch={handleAddPunch}
              onUpdatePunches={handleUpdatePunches}
            />
          )}

          {currentView === 'deal-pipeline' && (
            <DealPipelineView
              leads={leads}
              onOpenLeadDetail={handleOpenLeadDetail}
              onUpdateStatus={handleStatusChange}
              onLaunchDialer={handleLaunchDialer}
              onOpenImport={() => setIsBulkImportOpen(true)}
              onDeleteLead={handleDeleteLead}
            />
          )}

          {currentView === 'campaigns' && (
            <CampaignsView
              leads={leads}
              campaigns={campaigns}
              onAddNewCampaign={handleAddNewCampaign}
              onOpenBulkImport={() => setIsBulkImportOpen(true)}
              onOpenLeadDetail={handleOpenLeadDetail}
              onLaunchDialer={handleLaunchDialer}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}

          {currentView === 'dnc' && (
            <DNCView
              leads={leads}
              onOpenLeadDetail={handleOpenLeadDetail}
              onMoveLead={(lead, targetStage) => handleStatusChange(lead, targetStage)}
              onLaunchDialer={handleLaunchDialer}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}

          {currentView === 'language-barrier' && (
            <LanguageBarrierView
              leads={leads}
              onOpenLeadDetail={handleOpenLeadDetail}
              onMoveLead={(lead, targetStage) => handleStatusChange(lead, targetStage)}
              onAssignVA={(lead, newVA) => handleUpdateLead({ ...lead, assignedVA: newVA })}
              onLaunchDialer={handleLaunchDialer}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}

          {(currentView === 'needs-skiptracing' || currentView === 'needs-deepdive') && (
            <NeedsDeepdiveView
              leads={leads}
              onOpenLeadDetail={handleOpenLeadDetail}
              onMoveLead={(lead, targetStage) => handleStatusChange(lead, targetStage)}
              onUpdateLead={handleUpdateLead}
              onAddNewLead={handleAddNewLead}
              onOpenBulkImport={() => {
                setBulkImportDestination('needs_skiptracing');
                setIsBulkImportOpen(true);
              }}
              onImportLeads={handleBulkImportLeads}
              onLaunchDialer={handleLaunchDialer}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}

          {currentView === 'search' && (
            <SearchView
              leads={leads}
              onOpenLeadDetail={handleOpenLeadDetail}
              onLaunchDialer={handleLaunchDialer}
              onDeleteLead={handleDeleteLead}
              onDeletePhoneNumber={handleDeletePhoneNumber}
            />
          )}
        </main>
      </div>

      {/* Sliding Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateLead={handleUpdateLead}
        onLaunchDialer={handleLaunchDialer}
        onStatusChange={handleStatusChange}
        onDeleteLead={handleDeleteLead}
        onDeletePhoneNumber={handleDeletePhoneNumber}
      />

      {/* Bulk Lead Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        campaigns={campaigns}
        onAddNewCampaign={handleAddNewCampaign}
        onImportLeads={handleBulkImportLeads}
        defaultDestination={bulkImportDestination}
      />

      {/* Export Leads Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        leads={leads}
        campaigns={campaigns}
        defaultSelected={defaultGroupsForView(currentView)}
        onExported={(count, fileName) =>
          showToast(`Exported ${count} lead${count === 1 ? '' : 's'} to ${fileName}`, 'Export Complete')
        }
      />

      {/* New Lead Modal */}
      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        campaigns={campaigns}
        onAddNewCampaign={handleAddNewCampaign}
        onAddLead={handleAddNewLead}
      />
    </div>
  );
}
