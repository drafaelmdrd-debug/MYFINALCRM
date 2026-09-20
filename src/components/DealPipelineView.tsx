import React, { useState } from 'react';
import {
  Kanban,
  MapPin,
  Phone,
  PhoneForwarded,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
  RotateCcw,
  MoveHorizontal,
  Upload,
  Mail,
  Trash2,
} from 'lucide-react';
import { Lead, StageId, VA } from '../types';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';
import {
  isLeadInDealPipeline,
  isFollowupStatus,
  calculateAutomatedDate,
} from '../logic/moveEngine';

interface DealPipelineViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onUpdateStatus: (lead: Lead, newStatus: string) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onOpenImport?: () => void;
  onDeleteLead?: (leadId: string) => void;
}

export type PipelineOption = 'all_pipeline' | 'project_mgmt' | 'follow_up';

// Exact Project Management statuses requested
export const PROJECT_MGMT_STATUSES = [
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
] as const;

// Exact Follow-Up groups and statuses requested (bare versions removed)
export const NOT_INTERESTED_STATUSES = [
  'Not Interested - 30 Days',
  'Not Interested - 60 Days',
  'Not Interested - 90 Days',
] as const;

export const NOT_READY_STATUSES = [
  'Not Ready to Sell - 30 Days',
  'Not Ready to Sell - 60 Days',
  'Not Ready to Sell - 90 Days',
] as const;

export const DealPipelineView: React.FC<DealPipelineViewProps> = ({
  leads,
  onOpenLeadDetail,
  onUpdateStatus,
  onLaunchDialer,
  onOpenImport,
  onDeleteLead,
}) => {
  const [pipelineOption, setPipelineOption] = useState<PipelineOption>('project_mgmt');
  const [vaFilter, setVaFilter] = useState<string>('all');
  const [followupGroupFilter, setFollowupGroupFilter] = useState<'all' | 'not_interested' | 'not_ready'>('all');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);
  // Track displayed phone index per card (allows Next # without calling)
  const [cardPhoneIndices, setCardPhoneIndices] = useState<Record<string, number>>({});

  // Filter leads based on agent
  const agentFilteredLeads = leads.filter((l) => {
    if (vaFilter !== 'all' && l.assignedVA !== vaFilter) return false;
    return true;
  });

  // Pipeline stage groups for "All Leads & Pipeline Columns"
  const allStages = [
    {
      id: 'Project Mgmt' as const,
      title: 'Project Management (Active Deals)',
      color: 'border-t-4 border-t-[#B85338]',
      desc: 'Interested, Offers, Contracts, Callbacks',
      dropStatus: 'Interested',
    },
    {
      id: 'Follow-Up' as const,
      title: 'Follow-Up (Nurture Timers)',
      color: 'border-t-4 border-t-[#D97736]',
      desc: 'Not Interested & Not Ready (30/60/90 Days)',
      dropStatus: 'Not Interested - 30 Days',
    },
    {
      id: 'Language Barrier' as const,
      title: 'Language Barrier',
      color: 'border-t-4 border-t-[#365B6D]',
      desc: 'Spanish Speakers / Translator Needed',
      dropStatus: 'Spanish Speaker',
    },
    {
      id: 'DNC' as const,
      title: 'DNC / Dead',
      color: 'border-t-4 border-t-red-600',
      desc: 'Do Not Call, Sold Already, Ugly Property',
      dropStatus: 'DNC',
    },
  ];

  // Helper to test if a status matches a lane
  const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase();

  const getLeadStatus = (lead: Lead): string => {
    if (lead.stageId === 'Follow-Up') {
      return (
        lead.vaFollowUpStatus ||
        lead.vaStatus ||
        lead.originalStatus ||
        'Not Interested'
      );
    }
    return (
      lead.davidStatus ||
      lead.vaStatus ||
      lead.vaFollowUpStatus ||
      lead.originalStatus ||
      'Pending'
    );
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(lead.id);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setActiveDropZone(null);
  };

  const handleDragOver = (e: React.DragEvent, zoneKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropZone !== zoneKey) {
      setActiveDropZone(zoneKey);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setActiveDropZone(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (!leadId) return;

    const leadToMove = leads.find((l) => l.id === leadId);
    if (leadToMove) {
      onUpdateStatus(leadToMove, targetStatus);
    }
    setDraggedLeadId(null);
  };

  // Reusable lead card component with Drag-and-Drop, Click to Dial, and Next #
  const renderLeadCard = (lead: Lead, currentStatusLabel?: string) => {
    const phoneList = lead.phoneNumbers || [];
    const currentPhoneIdx = cardPhoneIndices[lead.id] || 0;
    const safePhoneIdx = phoneList.length > 0 ? currentPhoneIdx % phoneList.length : 0;
    const displayedPhone = phoneList[safePhoneIdx];

    const currentStatus = getLeadStatus(lead);
    const hasCallback = lead.callbackDate;
    const isFollowUpLead =
      lead.stageId === 'Follow-Up' || isFollowupStatus(currentStatus);
    const calculatedTimer = isFollowUpLead
      ? lead.followUpDate || calculateAutomatedDate(currentStatus)
      : undefined;
    const timerDisplay = lead.followUpDate || calculatedTimer;
    const isDragging = draggedLeadId === lead.id;

    const contactsCount = lead.contacts?.length || 1;
    const hasMultipleContacts = lead.contacts && lead.contacts.length > 1;

    return (
      <div
        key={lead.id}
        draggable
        onDragStart={(e) => handleDragStart(e, lead)}
        onDragEnd={handleDragEnd}
        className={`bg-white hover:bg-[#FDFBF7] border border-[#E4E0D6] rounded-lg p-3 space-y-2.5 shadow-2xs hover:shadow-xs transition-all text-xs group cursor-grab active:cursor-grabbing select-none ${
          isDragging ? 'opacity-40 ring-2 ring-[#B85338] scale-98' : ''
        }`}
      >
        {/* Header: Name, Contacts & VA */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onOpenLeadDetail(lead)}
              className="font-bold text-xs text-[#1F2421] group-hover:text-[#B85338] hover:underline text-left truncate block max-w-[170px]"
              title={lead.ownerName}
            >
              {lead.ownerName}
            </button>
            <div className="flex items-center gap-1 text-[11px] text-[#5E6660] mt-0.5">
              <MapPin className="w-3 h-3 shrink-0 text-[#8C948E]" />
              <span className="truncate max-w-[150px]" title={lead.propertyAddress}>
                {lead.propertyAddress}
              </span>
            </div>
            {lead.mailingAddress && (
              <div className="flex items-center gap-1 text-[10px] text-[#8C948E] mt-0.5">
                <Mail className="w-2.5 h-2.5 shrink-0 text-[#B85338]" />
                <span className="truncate max-w-[150px]" title={`Mailing: ${lead.mailingAddress}`}>
                  Mail: {lead.mailingAddress}
                </span>
              </div>
            )}
          </div>
          <VABadge va={lead.assignedVA} />
        </div>

        {/* 1 Lead / Property Badge if multiple contacts or multiple phone numbers */}
        {(hasMultipleContacts || phoneList.length > 1) && (
          <div className="flex items-center gap-1 text-[10px] text-[#5E6660] bg-[#F5F2EC] px-2 py-0.5 rounded border border-[#E4E0D6]">
            <Users className="w-3 h-3 text-[#B85338] shrink-0" />
            <span className="font-semibold text-[#1F2421]">
              1 Property
            </span>
            <span className="text-[#8C948E]">•</span>
            <span>{hasMultipleContacts ? `${contactsCount} Contacts` : '1 Contact'}</span>
            <span className="text-[#8C948E]">•</span>
            <span>{phoneList.length} Phone #s</span>
          </div>
        )}

        {/* Financials & Price */}
        {(lead.askingPrice || lead.startingOffer) && (
          <div className="flex items-center justify-between bg-[#F8F6F1] px-2 py-1 rounded text-[11px] font-mono">
            {lead.askingPrice && (
              <span className="text-[#4A7A5E] font-bold">
                Ask: {lead.askingPrice}
              </span>
            )}
            {lead.startingOffer && (
              <span className="text-[#5E6660]">
                Offer: {lead.startingOffer}
              </span>
            )}
          </div>
        )}

        {/* Automated Timers / Dates */}
        {(hasCallback || timerDisplay || isFollowUpLead) && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#5E6660] font-mono bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#E4E0D6]">
            <Clock className="w-3 h-3 text-[#B85338]" />
            <span className="font-semibold">
              {hasCallback
                ? `Callback: ${hasCallback}`
                : `Timer: ${timerDisplay || 'Follow-Up Active'}`}
            </span>
          </div>
        )}

        {/* Quick Action Bar: CLICK TO DIAL (CALL), NEXT #, and Status Dropdown */}
        <div className="space-y-1.5 pt-1 border-t border-[#E4E0D6]/60">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            {displayedPhone ? (
              <div className="flex items-center gap-1">
                {/* 1. CLICK TO DIAL -> call number currently displayed */}
                <DialLink
                  id={`card-call-${lead.id}`}
                  number={displayedPhone.number}
                  leadId={lead.id}
                  stopClickPropagation
                  onDial={() => {
                    onLaunchDialer(lead.id, displayedPhone.number, true);
                  }}
                  onNoNumber={() => {
                    onLaunchDialer(lead.id, undefined, false);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#4A7A5E] hover:bg-[#3E654E] text-white font-mono font-bold text-[10px] shadow-2xs transition-colors cursor-pointer no-underline"
                  title={`CLICK TO DIAL → call currently displayed number: ${displayedPhone.number}`}
                >
                  <Phone className="w-2.5 h-2.5 fill-white" />
                  <span>CALL</span>
                </DialLink>

                <span
                  className="font-mono text-[11px] font-semibold text-[#1F2421] max-w-[95px] truncate"
                  title={`${displayedPhone.number}${displayedPhone.contactName ? ` (${displayedPhone.contactName} - ${displayedPhone.label})` : ` (${displayedPhone.label})`}`}
                >
                  {displayedPhone.number}
                </span>

                {/* 2. NEXT # -> show next number -> DO NOT call it */}
                {phoneList.length > 1 && (
                  <button
                    type="button"
                    id={`card-next-num-${lead.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextIdx = (safePhoneIdx + 1) % phoneList.length;
                      setCardPhoneIndices((prev) => ({ ...prev, [lead.id]: nextIdx }));
                    }}
                    className="px-1.5 py-0.5 rounded bg-[#F0EDE6] hover:bg-[#E4E0D6] border border-[#D5D0C5] text-[9px] font-bold text-[#1F2421] flex items-center gap-0.5 cursor-pointer transition-colors"
                    title={`Click Next # → show next number (${((safePhoneIdx + 1) % phoneList.length) + 1} of ${phoneList.length}) → DO NOT call it`}
                  >
                    <PhoneForwarded className="w-2.5 h-2.5 text-[#5E6660]" />
                    <span>NEXT #</span>
                    <span className="text-[#5E6660] text-[8px]">
                      ({safePhoneIdx + 1}/{phoneList.length})
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-[#8C948E]">No Phone</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-[#5E6660] font-semibold uppercase tracking-wider">
              Stage:
            </span>
            <div className="flex items-center gap-1">
              {/* Quick status selector */}
              <select
                value={currentStatus}
                onChange={(e) => onUpdateStatus(lead, e.target.value)}
                className="bg-[#F8F6F1] hover:bg-white border border-[#E4E0D6] rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#1F2421] outline-none cursor-pointer w-full max-w-[155px] truncate"
                title="Move lead to another stage or status"
              >
                <optgroup label="Deal Pipeline">
                  {PROJECT_MGMT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Not Interested Timers">
                  {NOT_INTERESTED_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Not Ready Timers">
                  {NOT_READY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Archive / Stage">
                  <option value="Spanish Speaker">Spanish Speaker</option>
                  <option value="DNC">DNC (Do Not Call)</option>
                </optgroup>
                <optgroup label="Outreach Lists">
                  <option value="Restore to Calling List">↩ Return to Cold Calling List</option>
                </optgroup>
              </select>

              {onDeleteLead && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLead(lead.id);
                  }}
                  className="p-1 rounded text-[#8C948E] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer shrink-0 transition-colors"
                  title={`Delete lead ${lead.ownerName} immediately`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1850px] mx-auto space-y-5">
      {/* Top Header & 3-Option Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D6] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1F2421] tracking-tight">
              Deal Pipeline & Stage Tracking
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#B85338]/15 text-[#B85338] border border-[#B85338]/30">
              {agentFilteredLeads.filter((l) => l.stageId === 'Project Mgmt' || l.stageId === 'Follow-Up').length} Active in Deals
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-0.5">
            Stage governance powered by the Move Engine. Drag-and-drop or select any status dropdown to move leads across Project Mgmt, Follow-Up Timers, Language Barrier, and DNC.
          </p>
        </div>

        {/* Controls: 3 Options + VA Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 3 Pipeline Options Switcher */}
          <div className="flex bg-[#F0EDE6] p-1 rounded-lg text-xs font-semibold shadow-inner">
            <button
              type="button"
              onClick={() => setPipelineOption('all_pipeline')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                pipelineOption === 'all_pipeline'
                  ? 'bg-white text-[#1F2421] shadow-xs font-bold'
                  : 'text-[#5E6660] hover:text-[#1F2421]'
              }`}
            >
              All Leads & Pipeline (Kanban)
            </button>

            <button
              type="button"
              onClick={() => setPipelineOption('project_mgmt')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                pipelineOption === 'project_mgmt'
                  ? 'bg-white text-[#B85338] shadow-xs font-bold'
                  : 'text-[#5E6660] hover:text-[#1F2421]'
              }`}
            >
              Project Management (Kanban)
            </button>

            <button
              type="button"
              onClick={() => setPipelineOption('follow_up')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                pipelineOption === 'follow_up'
                  ? 'bg-white text-[#D97736] shadow-xs font-bold'
                  : 'text-[#5E6660] hover:text-[#1F2421]'
              }`}
            >
              Follow Up (Kanban)
            </button>
          </div>

          {/* VA Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-[#5E6660] text-[10px] uppercase">Agent:</span>
            <select
              value={vaFilter}
              onChange={(e) => setVaFilter(e.target.value)}
              className="bg-white border border-[#E4E0D6] rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none shadow-2xs"
            >
              <option value="all">All Agents</option>
              <option value="Rain">Rain (Cobalt)</option>
              <option value="Jah">Jah (Amber)</option>
              <option value="Jen">Jen (Coral)</option>
              <option value="David">David (Violet)</option>
            </select>
          </div>

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A7A5E] hover:bg-[#3D664E] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Import leads or deals directly into Deal Pipeline"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Deals</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPTION 1: ALL LEADS & PIPELINE COLUMNS (With Drag-and-Drop)                */}
      {/* ========================================================================= */}
      {pipelineOption === 'all_pipeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#5E6660]">
            <span className="flex items-center gap-1.5">
              <MoveHorizontal className="w-3.5 h-3.5 text-[#B85338]" />
              Drag any card to move leads between pipeline stages, or use the card dropdown.
            </span>
            <span className="font-mono text-[11px]">
              Total Records: {agentFilteredLeads.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {allStages.map((stage) => {
              const stageLeads = agentFilteredLeads.filter((l) => {
                if (stage.id === 'Follow-Up') {
                  return (
                    l.stageId === 'Follow-Up' ||
                    isFollowupStatus(getLeadStatus(l))
                  );
                }
                return l.stageId === stage.id;
              });

              const isDropActive = activeDropZone === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDrop={(e) => handleDrop(e, stage.dropStatus)}
                  className={`bg-[#FFFFFF] border rounded-xl overflow-hidden shadow-xs ${stage.color} flex flex-col min-h-[560px] transition-colors ${
                    isDropActive
                      ? 'border-[#B85338] bg-[#FDF8F5] ring-2 ring-[#B85338]/40'
                      : 'border-[#E4E0D6]'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-[#E4E0D6] bg-[#FDFBF7] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs text-[#1F2421]">{stage.title}</h3>
                      <div className="text-[10px] text-[#5E6660]">{stage.desc}</div>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F0EDE6] text-[#1F2421]">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Leads List */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[660px]">
                    {stageLeads.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#8C948E] italic border border-dashed border-[#E4E0D6] rounded-lg mt-2">
                        Drag leads here to route to {stage.title}
                      </div>
                    ) : (
                      stageLeads.map((lead) => renderLeadCard(lead))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 2: PROJECT MANAGEMENT (KANBAN VIEW OF STATUSES WITH DRAG & DROP)   */}
      {/* ========================================================================= */}
      {pipelineOption === 'project_mgmt' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-lg border border-[#E4E0D6]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B85338]" />
              <span className="font-bold text-[#1F2421]">
                Project Management Kanban Board
              </span>
              <span className="text-[#5E6660]">
                • 17 Dedicated Status Lanes for Active Acquisitions (Drag cards between lanes)
              </span>
            </div>
            <div className="text-[11px] text-[#5E6660] font-mono">
              Total in Project Mgmt:{' '}
              <strong className="text-[#B85338]">
                {agentFilteredLeads.filter((l) => l.stageId === 'Project Mgmt').length}
              </strong>
            </div>
          </div>

          {/* Horizontal scroll container for 17 lanes */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3.5 min-w-max items-start">
              {PROJECT_MGMT_STATUSES.map((statusName) => {
                const normalizedStatus = normalizeStatus(statusName);
                const laneLeads = agentFilteredLeads.filter((l) => {
                  if (l.stageId !== 'Project Mgmt') return false;
                  const st = normalizeStatus(getLeadStatus(l));
                  return st === normalizedStatus;
                });

                const isDropActive = activeDropZone === `pm-${statusName}`;

                return (
                  <div
                    key={statusName}
                    onDragOver={(e) => handleDragOver(e, `pm-${statusName}`)}
                    onDrop={(e) => handleDrop(e, statusName)}
                    className={`w-72 bg-[#F8F6F1]/80 border rounded-xl flex flex-col shrink-0 shadow-2xs overflow-hidden transition-colors ${
                      isDropActive
                        ? 'border-[#B85338] bg-[#FDF8F5] ring-2 ring-[#B85338]/40'
                        : 'border-[#E4E0D6]'
                    }`}
                  >
                    {/* Lane Header */}
                    <div className="p-3 bg-white border-b border-[#E4E0D6] flex items-center justify-between">
                      <div className="min-w-0 pr-1">
                        <span className="font-bold text-xs text-[#1F2421] truncate block" title={statusName}>
                          {statusName}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          laneLeads.length > 0
                            ? 'bg-[#B85338]/15 text-[#B85338]'
                            : 'bg-[#F0EDE6] text-[#8C948E]'
                        }`}
                      >
                        {laneLeads.length}
                      </span>
                    </div>

                    {/* Lane Cards */}
                    <div className="p-2.5 space-y-2.5 min-h-[460px] max-h-[640px] overflow-y-auto">
                      {laneLeads.length === 0 ? (
                        <div className="h-28 border border-dashed border-[#E4E0D6] rounded-lg flex items-center justify-center text-[11px] text-[#8C948E] italic">
                          Drop to move to {statusName}
                        </div>
                      ) : (
                        laneLeads.map((lead) => renderLeadCard(lead, statusName))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 3: FOLLOW UP (KANBAN VIEW: NOT INTERESTED & NOT READY WITH DRAG)    */}
      {/* ========================================================================= */}
      {pipelineOption === 'follow_up' && (
        <div className="space-y-4">
          {/* Sub-Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white p-3 rounded-lg border border-[#E4E0D6]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97736]" />
              <span className="font-bold text-[#1F2421]">Follow Up Kanban Board</span>
              <span className="text-[#5E6660]">
                • Automated Follow-up Timers & Nurture Buckets (Drag cards to recalculate timers)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-[#F0EDE6] p-0.5 rounded text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFollowupGroupFilter('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    followupGroupFilter === 'all'
                      ? 'bg-white text-[#1F2421] shadow-2xs font-bold'
                      : 'text-[#5E6660]'
                  }`}
                >
                  All Follow-Up
                </button>
                <button
                  type="button"
                  onClick={() => setFollowupGroupFilter('not_interested')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    followupGroupFilter === 'not_interested'
                      ? 'bg-white text-[#B85338] shadow-2xs font-bold'
                      : 'text-[#5E6660]'
                  }`}
                >
                  Not Interested Timers
                </button>
                <button
                  type="button"
                  onClick={() => setFollowupGroupFilter('not_ready')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    followupGroupFilter === 'not_ready'
                      ? 'bg-white text-[#D97736] shadow-2xs font-bold'
                      : 'text-[#5E6660]'
                  }`}
                >
                  Not Ready Timers
                </button>
              </div>

              <span className="text-[11px] text-[#5E6660] font-mono pl-2">
                Total in Follow-Up:{' '}
                <strong className="text-[#D97736]">
                  {agentFilteredLeads.filter((l) => l.stageId === 'Follow-Up').length}
                </strong>
              </span>
            </div>
          </div>

          {/* Section 1: Not Interested Timers */}
          {(followupGroupFilter === 'all' || followupGroupFilter === 'not_interested') && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#1F2421] uppercase tracking-wider">
                  Not Interested Timers
                </span>
                <span className="text-[11px] text-[#5E6660]">
                  (Auto-triggers 30/60/90 day follow-up dates when dropped or status updated)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {NOT_INTERESTED_STATUSES.map((statusName) => {
                  const normalizedStatus = normalizeStatus(statusName);
                  const laneLeads = agentFilteredLeads.filter((l) => {
                    const st = normalizeStatus(getLeadStatus(l));
                    if (l.stageId !== 'Follow-Up' && !isFollowupStatus(st)) return false;

                    if (normalizedStatus === 'not interested') {
                      return (
                        st === 'not interested' ||
                        st === 'not interested - 30 days' ||
                        (st.includes('not interested') && !st.includes('60') && !st.includes('90'))
                      );
                    }
                    if (normalizedStatus === 'not interested - 30 days') {
                      return st === 'not interested - 30 days' || st === 'not interested 30 days';
                    }
                    if (normalizedStatus === 'not interested - 60 days') {
                      return st === 'not interested - 60 days' || st === 'not interested 60 days';
                    }
                    if (normalizedStatus === 'not interested - 90 days') {
                      return st === 'not interested - 90 days' || st === 'not interested 90 days';
                    }
                    return st === normalizedStatus;
                  });

                  const isDropActive = activeDropZone === `ni-${statusName}`;

                  return (
                    <div
                      key={statusName}
                      onDragOver={(e) => handleDragOver(e, `ni-${statusName}`)}
                      onDrop={(e) => handleDrop(e, statusName)}
                      className={`bg-[#F8F6F1]/80 border rounded-xl flex flex-col shadow-2xs overflow-hidden min-h-[380px] transition-colors ${
                        isDropActive
                          ? 'border-[#B85338] bg-[#FDF8F5] ring-2 ring-[#B85338]/40'
                          : 'border-[#E4E0D6]'
                      }`}
                    >
                      {/* Lane Header */}
                      <div className="p-3 bg-white border-b border-[#E4E0D6] flex items-center justify-between">
                        <span className="font-bold text-xs text-[#1F2421] truncate" title={statusName}>
                          {statusName}
                        </span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0EDE6] text-[#1F2421]">
                          {laneLeads.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                        {laneLeads.length === 0 ? (
                          <div className="h-28 border border-dashed border-[#E4E0D6] rounded-lg flex items-center justify-center text-[11px] text-[#8C948E] italic">
                            Drop to set {statusName}
                          </div>
                        ) : (
                          laneLeads.map((lead) => renderLeadCard(lead, statusName))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Not Ready Timers */}
          {(followupGroupFilter === 'all' || followupGroupFilter === 'not_ready') && (
            <div className="space-y-2.5 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#1F2421] uppercase tracking-wider">
                  Not Ready to Sell Timers
                </span>
                <span className="text-[11px] text-[#5E6660]">
                  (Nurture pipeline with automated re-engagement)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {NOT_READY_STATUSES.map((statusName) => {
                  const normalizedStatus = normalizeStatus(statusName);
                  const laneLeads = agentFilteredLeads.filter((l) => {
                    const st = normalizeStatus(getLeadStatus(l));
                    if (l.stageId !== 'Follow-Up' && !isFollowupStatus(st)) return false;

                    if (
                      normalizedStatus === 'not ready' ||
                      normalizedStatus === 'not ready to sell'
                    ) {
                      return (
                        st === 'not ready' ||
                        st === 'not ready to sell' ||
                        ((st.includes('not ready') || st.includes('not ready to sell')) &&
                          !st.includes('30') &&
                          !st.includes('60') &&
                          !st.includes('90'))
                      );
                    }
                    if (normalizedStatus === 'not ready to sell - 30 days') {
                      return (
                        (st.includes('not ready') || st.includes('not ready to sell')) &&
                        st.includes('30')
                      );
                    }
                    if (normalizedStatus === 'not ready to sell - 60 days') {
                      return (
                        (st.includes('not ready') || st.includes('not ready to sell')) &&
                        st.includes('60')
                      );
                    }
                    if (normalizedStatus === 'not ready to sell - 90 days') {
                      return (
                        (st.includes('not ready') || st.includes('not ready to sell')) &&
                        st.includes('90')
                      );
                    }
                    return st === normalizedStatus;
                  });

                  const isDropActive = activeDropZone === `nr-${statusName}`;

                  return (
                    <div
                      key={statusName}
                      onDragOver={(e) => handleDragOver(e, `nr-${statusName}`)}
                      onDrop={(e) => handleDrop(e, statusName)}
                      className={`bg-[#F8F6F1]/80 border rounded-xl flex flex-col shadow-2xs overflow-hidden min-h-[380px] transition-colors ${
                        isDropActive
                          ? 'border-[#B85338] bg-[#FDF8F5] ring-2 ring-[#B85338]/40'
                          : 'border-[#E4E0D6]'
                      }`}
                    >
                      {/* Lane Header */}
                      <div className="p-3 bg-white border-b border-[#E4E0D6] flex items-center justify-between">
                        <span className="font-bold text-xs text-[#1F2421] truncate" title={statusName}>
                          {statusName}
                        </span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F0EDE6] text-[#1F2421]">
                          {laneLeads.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                        {laneLeads.length === 0 ? (
                          <div className="h-28 border border-dashed border-[#E4E0D6] rounded-lg flex items-center justify-center text-[11px] text-[#8C948E] italic">
                            Drop to set {statusName}
                          </div>
                        ) : (
                          laneLeads.map((lead) => renderLeadCard(lead, statusName))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
