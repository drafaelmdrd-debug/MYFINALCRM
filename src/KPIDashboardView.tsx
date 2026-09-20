import React, { useState } from 'react';
import {
  BarChart3,
  RefreshCw,
  Clock,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Coffee,
  AlertTriangle,
  LogIn,
  LogOut,
  Calendar,
} from 'lucide-react';
import { Lead, CallResultCount, VAStats, FollowUpTaskKPIs, TimesheetPunch, VA, TimesheetAction, CRMTask } from '../types';
import {
  calculatePayPeriodSummary,
  calculateDaySummary,
  getVAPunchStatus,
} from '../logic/timesheetEngine';

interface KPIDashboardViewProps {
  leads: Lead[];
  callResults: CallResultCount;
  followupTaskCalls: FollowUpTaskKPIs;
  tasks?: CRMTask[];
  onManualRefresh: () => void;
  onUpdateFollowUpTaskKPIs: () => void;
  onRefreshPipelineCounts?: () => void;
  onRefreshCallResults?: () => void;
  onRefreshTimesheet?: () => void;
  onNavigateToTimesheet?: () => void;
  punches?: TimesheetPunch[];
  onAddPunch?: (punch: Omit<TimesheetPunch, 'id'>) => void;
  onResetDailyCallResults?: () => void;
  onDailyRefreshFollowUpTasks?: () => void;
}

export const KPIDashboardView: React.FC<KPIDashboardViewProps> = ({
  leads,
  callResults,
  followupTaskCalls,
  tasks = [],
  onManualRefresh,
  onUpdateFollowUpTaskKPIs,
  onRefreshPipelineCounts,
  onRefreshCallResults,
  onRefreshTimesheet,
  onNavigateToTimesheet,
  punches = [],
  onAddPunch,
  onResetDailyCallResults,
  onDailyRefreshFollowUpTasks,
}) => {
  const [callResultsFilter, setCallResultsFilter] = useState<'today' | 'all-time'>('today');
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [isRefreshingPipeline, setIsRefreshingPipeline] = useState(false);
  const [isRefreshingDispo, setIsRefreshingDispo] = useState(false);
  const [isRefreshingHours, setIsRefreshingHours] = useState(false);
  const [lastRecountTime, setLastRecountTime] = useState<string>('Just now');

  const triggerRecountAll = () => {
    setIsRefreshingAll(true);
    setIsRefreshingPipeline(true);
    setIsRefreshingDispo(true);
    setIsRefreshingHours(true);
    onManualRefresh();
    setLastRecountTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setTimeout(() => {
      setIsRefreshingAll(false);
      setIsRefreshingPipeline(false);
      setIsRefreshingDispo(false);
      setIsRefreshingHours(false);
    }, 600);
  };

  const triggerRecountPipeline = () => {
    setIsRefreshingPipeline(true);
    if (onRefreshPipelineCounts) {
      onRefreshPipelineCounts();
    } else {
      onManualRefresh();
    }
    setLastRecountTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setTimeout(() => setIsRefreshingPipeline(false), 500);
  };

  const triggerRecountDispo = () => {
    setIsRefreshingDispo(true);
    if (onRefreshCallResults) {
      onRefreshCallResults();
    } else {
      onManualRefresh();
    }
    setTimeout(() => setIsRefreshingDispo(false), 500);
  };

  const triggerRecountHours = () => {
    setIsRefreshingHours(true);
    if (onRefreshTimesheet) {
      onRefreshTimesheet();
    } else {
      onManualRefresh();
    }
    setTimeout(() => setIsRefreshingHours(false), 500);
  };

  // Dispositions table (Rows 13-24)
  const dispoList = Object.keys(callResults);
  const totalCallsRain = dispoList.reduce((sum, d) => sum + (callResults[d]?.Rain || 0), 0);
  const totalCallsJah = dispoList.reduce((sum, d) => sum + (callResults[d]?.Jah || 0), 0);
  const totalCallsJen = dispoList.reduce((sum, d) => sum + (callResults[d]?.Jen || 0), 0);
  const totalCallsDavid = dispoList.reduce((sum, d) => sum + (callResults[d]?.David || 0), 0);
  const grandTotalCalls = totalCallsRain + totalCallsJah + totalCallsJen + totalCallsDavid;

  // Compute real-time Pipeline Counts (Rows 1-9) per VA matching specification
  const computeVAStats = (vaName: 'Jah' | 'Jen' | 'Rain' | 'David'): VAStats => {
    const stats: VAStats = {
      myLeads: 0,
      interested: 0,
      callbacks: 0,
      notInterested: 0,
      notReady: 0,
      listed: 0,
      dealWon: 0,
      dnc: 0,
      spanish: 0,
    };

    const target = vaName.toLowerCase();

    const interestedStatuses = [
      'interested',
      'interested - has asking price',
      'interested-has asking price',
      'for comps',
      'for offer',
      'offer made',
      'negotiating',
      'under contract',
      'rejected offer',
      'accepted offer',
      'contract sent',
      'contract signed',
      'asking too high',
      'appointment in person',
    ];

    leads.forEach((lead) => {
      const assigned = (lead.assignedVA || '').trim().toLowerCase();
      // Rows 1-9 are counted strictly from the Assigned VA across Deal Pipeline, DNC, Language Barrier, etc.
      if (assigned !== target) return;

      // 1. My Leads (Total): Any list/stage - every lead where assignedVA matches
      stats.myLeads++;

      const inProjectMgmt = lead.stageId === 'Project Mgmt';
      const status = (lead.davidStatus || lead.vaFollowUpStatus || lead.vaStatus || '').trim().toLowerCase();

      // 2. Interested / Offers: stageId === 'Project Mgmt'
      if (inProjectMgmt && interestedStatuses.includes(status)) {
        stats.interested++;
      }

      // 3. Callbacks Scheduled: stageId === 'Project Mgmt'
      if (inProjectMgmt && (status === 'callback' || status === 'callback tomorrow' || status.startsWith('callback'))) {
        stats.callbacks++;
      }

      // 4. Not Interested: stageId === 'Follow-Up'
      if (
        lead.stageId === 'Follow-Up' &&
        (status === 'not interested - 30 days' ||
          status === 'not interested - 60 days' ||
          status === 'not interested - 90 days' ||
          status === 'not interested' ||
          status.includes('not interested'))
      ) {
        stats.notInterested++;
      }

      // 5. Not Ready to Sell: stageId === 'Follow-Up'
      if (
        lead.stageId === 'Follow-Up' &&
        (status === 'not ready to sell - 30 days' ||
          status === 'not ready to sell - 60 days' ||
          status === 'not ready to sell - 90 days' ||
          status === 'not ready to sell' ||
          status.includes('not ready'))
      ) {
        stats.notReady++;
      }

      // 6. Listed: stageId === 'Project Mgmt'
      if (inProjectMgmt && (status === 'listed' || status.includes('listed'))) {
        stats.listed++;
      }

      // 7. Deal Won / Closed: stageId === 'Project Mgmt'
      if (inProjectMgmt && (status === 'deal won' || status.includes('deal won'))) {
        stats.dealWon++;
      }

      // 8. DNC (Do Not Call): stageId === 'DNC' (all leads in DNC)
      if (lead.stageId === 'DNC') {
        stats.dnc++;
      }

      // 9. Spanish / Language: stageId === 'Language Barrier' (all leads in Language Barrier)
      if (lead.stageId === 'Language Barrier') {
        stats.spanish++;
      }
    });

    return stats;
  };

  const jahStats = computeVAStats('Jah');
  const jenStats = computeVAStats('Jen');
  const rainStats = computeVAStats('Rain');
  const davidStats = computeVAStats('David');

  const pipelineRows = [
    {
      label: 'My Leads (Total)',
      jah: jahStats.myLeads,
      jen: jenStats.myLeads,
      rain: rainStats.myLeads,
      david: davidStats.myLeads,
      total: jahStats.myLeads + jenStats.myLeads + rainStats.myLeads + davidStats.myLeads,
    },
    {
      label: 'Interested / Offers',
      jah: jahStats.interested,
      jen: jenStats.interested,
      rain: rainStats.interested,
      david: davidStats.interested,
      total: jahStats.interested + jenStats.interested + rainStats.interested + davidStats.interested,
    },
    {
      label: 'Callbacks Scheduled',
      jah: jahStats.callbacks,
      jen: jenStats.callbacks,
      rain: rainStats.callbacks,
      david: davidStats.callbacks,
      total: jahStats.callbacks + jenStats.callbacks + rainStats.callbacks + davidStats.callbacks,
    },
    {
      label: 'Not Interested',
      jah: jahStats.notInterested,
      jen: jenStats.notInterested,
      rain: rainStats.notInterested,
      david: davidStats.notInterested,
      total: jahStats.notInterested + jenStats.notInterested + rainStats.notInterested + davidStats.notInterested,
    },
    {
      label: 'Not Ready to Sell',
      jah: jahStats.notReady,
      jen: jenStats.notReady,
      rain: rainStats.notReady,
      david: davidStats.notReady,
      total: jahStats.notReady + jenStats.notReady + rainStats.notReady + davidStats.notReady,
    },
    {
      label: 'Listed',
      jah: jahStats.listed,
      jen: jenStats.listed,
      rain: rainStats.listed,
      david: davidStats.listed,
      total: jahStats.listed + jenStats.listed + rainStats.listed + davidStats.listed,
    },
    {
      label: 'Deal Won / Closed',
      jah: jahStats.dealWon,
      jen: jenStats.dealWon,
      rain: rainStats.dealWon,
      david: davidStats.dealWon,
      total: jahStats.dealWon + jenStats.dealWon + rainStats.dealWon + davidStats.dealWon,
    },
    {
      label: 'DNC (Do Not Call)',
      jah: jahStats.dnc,
      jen: jenStats.dnc,
      rain: rainStats.dnc,
      david: davidStats.dnc,
      total: jahStats.dnc + jenStats.dnc + rainStats.dnc + davidStats.dnc,
    },
    {
      label: 'Spanish / Language',
      jah: jahStats.spanish,
      jen: jenStats.spanish,
      rain: rainStats.spanish,
      david: davidStats.spanish,
      total: jahStats.spanish + jenStats.spanish + rainStats.spanish + davidStats.spanish,
    },
  ];

  // Timesheet data for current day
  const todayDateStr = new Date().toISOString().split('T')[0];
  const teamVAs: VA[] = ['Rain', 'Jah', 'Jen', 'David'];

  const handleQuickPunch = (va: VA, action: TimesheetAction) => {
    if (!onAddPunch) return;
    const now = new Date();
    onAddPunch({
      va,
      action,
      date: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      note: 'Quick punch via KPI Dashboard',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Title & Operational Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D6] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1F2421] tracking-tight">
              Metrics & KPI Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#B85338]/15 text-[#B85338] border border-[#B85338]/30">
              Operational KPI Engine
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-0.5">
            Tabular tracking of pipeline progress, task completions, and dialer velocity with attribution governance and accurate recounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-[#5E6660] font-mono mr-1 hidden sm:block">
            Last Recount: <strong>{lastRecountTime}</strong>
          </div>

          <button
            type="button"
            onClick={onUpdateFollowUpTaskKPIs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E4E0D6] bg-white hover:bg-[#F8F6F1] text-xs font-semibold text-[#1F2421] shadow-xs transition-colors"
            title="Recount task completions according to Rain/David governance rules"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#5E6660]" />
            <span>Update Task KPIs</span>
          </button>

          <button
            type="button"
            onClick={triggerRecountAll}
            disabled={isRefreshingAll}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#B85338] hover:bg-[#A34730] disabled:opacity-75 text-xs font-semibold text-white shadow-sm transition-colors"
            title="Recount all pipeline stages, outreach tasks, call dispositions, and timesheet hours"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
            <span>{isRefreshingAll ? 'Recounting...' : 'Recount All KPIs'}</span>
          </button>
        </div>
      </div>

      {/* Follow-Up Task KPI Standalone Cards */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-[#1F2421] uppercase tracking-wider">
              Follow-Up Task Calls Made (Completed Outreaches)
            </span>
            <p className="text-[10px] text-[#5E6660]">
              Counts based on "Task should be completed by:" for all tasks completed within this day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onDailyRefreshFollowUpTasks && (
              <button
                type="button"
                onClick={onDailyRefreshFollowUpTasks}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#F8F6F1] hover:bg-[#F0EDE6] border border-[#E4E0D6] text-[10px] font-semibold text-[#1F2421] shadow-2xs transition-colors cursor-pointer"
                title="Daily Refresh: Recount today's task outreaches for current session"
              >
                <RefreshCw className="w-3 h-3 text-[#5E6660]" />
                <span>Daily Refresh</span>
              </button>
            )}
            <button
              type="button"
              onClick={onUpdateFollowUpTaskKPIs}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F8F6F1] border border-[#E4E0D6] text-[10px] font-semibold text-[#1F2421] shadow-2xs transition-colors cursor-pointer"
              title="Recount follow-up and project outreach task completions"
            >
              <RotateCcw className="w-3 h-3 text-[#B85338]" />
              <span>Recount Outreaches</span>
            </button>
            <span className="text-[10px] text-[#5E6660] font-mono bg-[#F0EDE6] px-2 py-0.5 rounded">
              Auto-Attribution Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rain Card */}
          <div className="bg-white border border-[#E4E0D6] rounded-lg p-4 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                <span className="text-xs font-bold text-[#1F2421]">RAIN</span>
              </div>
              <div className="text-[10px] text-[#5E6660] mt-0.5">
                Completed Tasks
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#2563EB]">
              {followupTaskCalls.Rain}
            </div>
          </div>

          {/* Jen Card */}
          <div className="bg-white border border-[#E4E0D6] rounded-lg p-4 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EC4899]" />
                <span className="text-xs font-bold text-[#1F2421]">JEN</span>
              </div>
              <div className="text-[10px] text-[#5E6660] mt-0.5">
                Completed Tasks
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#EC4899]">
              {followupTaskCalls.Jen}
            </div>
          </div>

          {/* Jah Card */}
          <div className="bg-white border border-[#E4E0D6] rounded-lg p-4 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-xs font-bold text-[#1F2421]">JAH</span>
              </div>
              <div className="text-[10px] text-[#5E6660] mt-0.5">
                Completed Tasks
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#D97736]">
              {followupTaskCalls.Jah}
            </div>
          </div>

          {/* David Card */}
          <div className="bg-white border border-[#E4E0D6] rounded-lg p-4 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                <span className="text-xs font-bold text-[#1F2421]">DAVID</span>
              </div>
              <div className="text-[10px] text-[#5E6660] mt-0.5">
                Completed Tasks
              </div>
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#8B5CF6]">
              {followupTaskCalls.David || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Two Core Tables: Pipeline Counts & Call Results Dispositions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table 1: Pipeline Counts (Rows 2–11) - 6 cols */}
        <div className="lg:col-span-6 bg-white border border-[#E4E0D6] rounded-lg overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-[#E4E0D6] bg-[#FDFBF7] flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-xs text-[#1F2421]">
                Pipeline Counts (Rows 1–9)
              </span>
              <span className="text-[10px] text-[#5E6660] block">
                Live audit of {leads.length} leads across all stages & assignments
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerRecountPipeline}
                disabled={isRefreshingPipeline}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-[#F8F6F1] border border-[#E4E0D6] text-[10px] font-semibold text-[#1F2421] shadow-2xs transition-colors"
                title="Recount pipeline tallies across all agent assignments"
              >
                <RefreshCw className={`w-3 h-3 text-[#B85338] ${isRefreshingPipeline ? 'animate-spin' : ''}`} />
                <span>{isRefreshingPipeline ? 'Recounting...' : 'Recount Pipeline'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E4E0D6] bg-[#F8F6F1] text-[10px] font-bold text-[#5E6660] uppercase">
                  <th className="px-3 py-2">Metric / Stage</th>
                  <th className="px-3 py-2 text-right text-[#B45309]">Jah</th>
                  <th className="px-3 py-2 text-right text-[#BE185D]">Jen</th>
                  <th className="px-3 py-2 text-right text-[#1D4ED8]">Rain</th>
                  <th className="px-3 py-2 text-right text-[#8B5CF6]">David</th>
                  <th className="px-3 py-2 text-right font-extrabold text-[#1F2421]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E0D6]">
                {pipelineRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-[#F8F6F1]/60 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-[#1F2421]">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[#B45309]">
                      {row.jah}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[#BE185D]">
                      {row.jen}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[#1D4ED8]">
                      {row.rain}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[#8B5CF6]">
                      {row.david}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-[#1F2421]">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Call Results Dispositions (Rows 13–24) - 6 cols */}
        <div className="lg:col-span-6 bg-white border border-[#E4E0D6] rounded-lg overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            <div className="px-4 py-3 border-b border-[#E4E0D6] bg-[#FDFBF7] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-xs text-[#1F2421]">
                  Call Results Dispositions (Rows 13–24)
                </span>
                <span className="text-[10px] text-[#4A7A5E] block font-semibold">
                  • Refreshes daily for today's calling session
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={triggerRecountDispo}
                  disabled={isRefreshingDispo}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#F8F6F1] hover:bg-[#E4E0D6] text-[10px] font-semibold text-[#5E6660] transition-colors"
                  title="Recount and sync disposition matrix"
                >
                  <RefreshCw className={`w-3 h-3 text-[#4A7A5E] ${isRefreshingDispo ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingDispo ? 'Recounting...' : 'Recount Dispositions'}</span>
                </button>

                {onResetDailyCallResults && (
                  <button
                    type="button"
                    onClick={onResetDailyCallResults}
                    title="Reset today's disposition counter"
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#F8F6F1] hover:bg-[#E4E0D6] text-[10px] font-semibold text-[#5E6660] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-[#B85338]" />
                    <span>Daily Reset</span>
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#F8F6F1] z-10">
                  <tr className="border-b border-[#E4E0D6] text-[10px] font-bold text-[#5E6660] uppercase">
                    <th className="px-3 py-2">Call Result</th>
                    <th className="px-3 py-2 text-right text-[#B45309]">Jah</th>
                    <th className="px-3 py-2 text-right text-[#BE185D]">Jen</th>
                    <th className="px-3 py-2 text-right text-[#1D4ED8]">Rain</th>
                    <th className="px-3 py-2 text-right text-[#8B5CF6]">David</th>
                    <th className="px-3 py-2 text-right font-extrabold text-[#1F2421]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E0D6]">
                  {dispoList.map((dispo, idx) => {
                    const entry = callResults[dispo] || { Rain: 0, Jah: 0, Jen: 0, David: 0, total: 0 };
                    const lineTotal = (entry.Rain || 0) + (entry.Jah || 0) + (entry.Jen || 0) + (entry.David || 0);
                    const isHighlighted = dispo === 'INTERESTED' || dispo === 'CALLBACK';

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-[#F8F6F1]/60 transition-colors ${
                          isHighlighted ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 font-medium text-[#1F2421]">
                          {dispo}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-[#B45309]">
                          {entry.Jah || 0}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-[#BE185D]">
                          {entry.Jen || 0}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-[#1D4ED8]">
                          {entry.Rain || 0}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-[#8B5CF6]">
                          {entry.David || 0}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-[#1F2421]">
                          {lineTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[#1F2421] bg-[#FDFBF7] font-bold">
                  <tr>
                    <td className="px-3 py-2 uppercase text-[11px] text-[#1F2421]">
                      TOTAL CALLS
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#B45309]">
                      {totalCallsJah}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#BE185D]">
                      {totalCallsJen}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#1D4ED8]">
                      {totalCallsRain}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#8B5CF6]">
                      {totalCallsDavid}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[#1F2421]">
                      {grandTotalCalls}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Section directly below KPI Dashboard under Insights & Campaigns */}
      <div className="bg-white border border-[#E4E0D6] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E0D6] pb-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#B85338]" />
            <div>
              <h2 className="text-sm font-bold text-[#1F2421]">
                VA Timesheet & Hours Overview
              </h2>
              <p className="text-[11px] text-[#5E6660]">
                Live duty status, actual elapsed hours worked, and bi-weekly (14-day) payroll totals computed to exact seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerRecountHours}
              disabled={isRefreshingHours}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E4E0D6] bg-white hover:bg-[#F8F6F1] text-xs font-semibold text-[#1F2421] shadow-2xs transition-colors"
              title="Refresh punch records and re-calculate actual hours"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#B85338] ${isRefreshingHours ? 'animate-spin' : ''}`} />
              <span>{isRefreshingHours ? 'Updating...' : 'Refresh Hours'}</span>
            </button>

            {onNavigateToTimesheet && (
              <button
                type="button"
                onClick={onNavigateToTimesheet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#B85338] hover:bg-[#A34730] text-xs font-semibold text-white shadow-xs transition-colors"
              >
                <span>Open Full Timesheet View</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 VA Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamVAs.map((va) => {
            const vaPunches = punches.filter((p) => p.va === va);
            const statusInfo = getVAPunchStatus(vaPunches);
            const todaySum = calculateDaySummary(todayDateStr, vaPunches, true);
            const periodSum = calculatePayPeriodSummary(va, punches, 14);

            return (
              <div
                key={va}
                className="bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1F2421]">{va}</span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      statusInfo.status === 'WORKING'
                        ? 'bg-emerald-100 text-emerald-800'
                        : statusInfo.status === 'BIO_BREAK'
                        ? 'bg-amber-100 text-amber-800'
                        : statusInfo.status === 'EMERGENCY_BREAK'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {statusInfo.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Hours Stats */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5E6660]">Today's Actual:</span>
                    <span className="font-mono font-bold text-[#1F2421] flex items-center gap-1">
                      {todaySum.totalHoursFormatted}
                      {statusInfo.status === 'WORKING' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active shift ticking" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5E6660]">14-Day Total:</span>
                    <span className="font-mono font-extrabold text-[#B85338]">
                      {periodSum.totalHoursFormatted}
                    </span>
                  </div>
                </div>

                {/* Quick Punch Controls */}
                <div className="pt-2 border-t border-[#E4E0D6] grid grid-cols-2 gap-1.5 text-[10px]">
                  {statusInfo.status === 'LOGGED_OUT' ? (
                    <button
                      type="button"
                      onClick={() => handleQuickPunch(va, 'LOGIN')}
                      className="col-span-2 py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Log In Shift</span>
                    </button>
                  ) : (
                    <>
                      {statusInfo.status === 'WORKING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickPunch(va, 'BIO_OUT')}
                            className="py-1 px-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold flex items-center justify-center gap-1"
                            title="Start bio break"
                          >
                            <Coffee className="w-2.5 h-2.5 text-amber-600" />
                            <span>Bio Out</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickPunch(va, 'EMERGENCY_OUT')}
                            className="py-1 px-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold flex items-center justify-center gap-1"
                            title="Emergency paused duty"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            <span>Emerg Out</span>
                          </button>
                        </>
                      ) : statusInfo.status === 'BIO_BREAK' ? (
                        <button
                          type="button"
                          onClick={() => handleQuickPunch(va, 'BIO_IN')}
                          className="col-span-1 py-1 px-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold flex items-center justify-center gap-1"
                          title="End bio break (resume work)"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Bio In</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickPunch(va, 'EMERGENCY_IN')}
                          className="col-span-1 py-1 px-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold flex items-center justify-center gap-1"
                          title="Resume from emergency break"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Emerg In</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleQuickPunch(va, 'LOGOUT')}
                        className={`py-1 px-1.5 rounded bg-zinc-700 hover:bg-zinc-800 text-white font-semibold flex items-center justify-center gap-1 ${
                          statusInfo.status !== 'WORKING' ? 'col-span-1' : 'col-span-2'
                        }`}
                      >
                        <LogOut className="w-2.5 h-2.5" />
                        <span>Log Out</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
