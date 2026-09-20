import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneForwarded,
  Users,
  Timer,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Volume2,
  Upload,
  Plus,
} from 'lucide-react';
import { Lead, VA, Disposition } from '../types';
import { isLeadInDealPipeline } from '../logic/moveEngine';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';
import { DialerModeSelector } from './DialerModeSelector';
import {
  getDialHref,
  getGlobalCallState,
  resetCallState,
  getDialerMode,
} from '../dialerProtocol';
import {
  broadcastDialerSync,
  subscribeDialerSync,
} from '../utils/dialerSyncChannel';

interface PowerDialerViewProps {
  leads: Lead[];
  currentLeadId?: string;
  onSaveAfterCall: (
    leadId: string,
    phoneNumber: string,
    disposition: Disposition,
    notes: string,
    askingPrice: string,
    agent: VA
  ) => void;
  onLeadChange: (leadId: string) => void;
  onOpenBulkImport?: () => void;
  onAddNewLead?: () => void;
}

export const PowerDialerView: React.FC<PowerDialerViewProps> = ({
  leads,
  currentLeadId,
  onSaveAfterCall,
  onLeadChange,
  onOpenBulkImport,
  onAddNewLead,
}) => {
  const [activeAgent, setActiveAgent] = useState<VA>('Rain');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [dialStatusFilter, setDialStatusFilter] = useState<string>('all');
  const [selectedDispo, setSelectedDispo] = useState<Disposition | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [askingPrice, setAskingPrice] = useState<string>('');
  const [currentPhoneIndex, setCurrentPhoneIndex] = useState<number>(0);
  const [nextDialIdx, setNextDialIdx] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter out any leads moved to Deal Pipeline, DNC, or Language Barrier
  const dialerLeads = leads.filter((l) => !isLeadInDealPipeline(l));
  const currentLead = dialerLeads.find((l) => l.id === currentLeadId) || dialerLeads[0];
  const currentLeadIndex = dialerLeads.findIndex((l) => l.id === currentLead?.id);

  // Synchronize live call state across all dialers and quick dial buttons via 'crm_dialer_sync'
  useEffect(() => {
    const globalState = getGlobalCallState();
    if (globalState.isCalling) {
      setIsTimerActive(true);
      if (globalState.startTime) {
        setCallSeconds(Math.max(0, Math.floor((Date.now() - globalState.startTime) / 1000)));
      }
    }

    const unsubscribe = subscribeDialerSync((data) => {
      // If a different lead was selected elsewhere, switch to it
      if (data.action === 'select_lead' && data.leadId && data.leadId !== currentLead?.id) {
        onLeadChange(data.leadId);
        return;
      }
      if (data.leadId && currentLead && data.leadId !== currentLead.id) return;
      if (data.notes !== undefined) setNotes(data.notes);
      if (data.selectedDispo !== undefined) setSelectedDispo(data.selectedDispo);
      if (data.askingPrice !== undefined) setAskingPrice(data.askingPrice);
      if (data.agent !== undefined) setActiveAgent(data.agent);
      if (data.isCalling !== undefined) setIsTimerActive(data.isCalling);
      if (data.callSeconds !== undefined) setCallSeconds(data.callSeconds);
      if (data.phoneIndex !== undefined) setCurrentPhoneIndex(data.phoneIndex);
      if (data.nextDialIdx !== undefined) setNextDialIdx(data.nextDialIdx);
    });

    const handleCallStarted = (e: any) => {
      setIsTimerActive(true);
      if (e.detail?.startTime) {
        setCallSeconds(Math.max(0, Math.floor((Date.now() - e.detail.startTime) / 1000)));
      } else {
        setCallSeconds(0);
      }
    };

    window.addEventListener('groundwork-call-started', handleCallStarted);
    return () => {
      unsubscribe();
      window.removeEventListener('groundwork-call-started', handleCallStarted);
    };
  }, [currentLead?.id]);

  // Sync asking price and reset states when current lead changes
  useEffect(() => {
    if (currentLead) {
      setAskingPrice(currentLead.askingPrice || '');
      setCurrentPhoneIndex(0);
      setNextDialIdx(0);
      setSelectedDispo(null);
      setNotes('');
      setIsTimerActive(false);
      setCallSeconds(0);

      broadcastDialerSync({
        action: 'select_lead',
        leadId: currentLead.id,
        phoneNumber: currentLead.phoneNumbers[0]?.number || '',
        phoneIndex: 0,
        nextDialIdx: 0,
        isCalling: false,
        callSeconds: 0,
        startTime: null,
        selectedDispo: null,
        notes: '',
        askingPrice: currentLead.askingPrice || '',
        agent: activeAgent,
      });
    }
  }, [currentLead?.id]);

  // Call timer effect (ticks when timer is active)
  useEffect(() => {
    let timer: any;
    if (isTimerActive) {
      timer = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerActive]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activePhone =
    currentLead?.phoneNumbers[currentPhoneIndex] ||
    currentLead?.phoneNumbers[0] || {
      number: '',
      label: 'Main',
    };

  const handleSelectDispo = (dispo: Disposition) => {
    setSelectedDispo(dispo);
    broadcastDialerSync({ selectedDispo: dispo, leadId: currentLead?.id });
  };

  /**
   * Direct Phone Record Selection (Shows selected number as target, does not call)
   */
  const handleSelectPhone = (idx: number) => {
    if (!currentLead || !currentLead.phoneNumbers[idx]) return;
    setCurrentPhoneIndex(idx);
    const targetPhone = currentLead.phoneNumbers[idx];
    broadcastDialerSync({
      phoneIndex: idx,
      nextDialIdx: idx + 1,
      phoneNumber: targetPhone.number,
      leadId: currentLead.id,
    });
    showToast(
      `Selected ${targetPhone.label} (${targetPhone.number}). Click CLICK TO DIAL to call.`
    );
  };

  const handleSubmitDispo = (agent: VA) => {
    if (!selectedDispo) {
      showToast('⚠️ Please select a disposition first!');
      return;
    }
    if (!currentLead) return;

    setIsTimerActive(false);
    setCallSeconds(0);
    resetCallState();

    onSaveAfterCall(
      currentLead.id,
      activePhone.number || 'No Phone',
      selectedDispo,
      notes,
      askingPrice,
      agent
    );

    showToast(`✅ Saved: ${agent} | ${selectedDispo} | ${activePhone.number}`);
    setSelectedDispo(null);
    setNotes('');

    // Auto advance to next lead in dialer workspace
    if (currentLeadIndex < dialerLeads.length - 1) {
      onLeadChange(dialerLeads[currentLeadIndex + 1].id);
    } else if (dialerLeads.length > 0) {
      onLeadChange(dialerLeads[0].id);
    }
  };

  // Next Number calculation: next number in order without wrap-around
  const hasNextNumber = Boolean(currentLead && nextDialIdx < currentLead.phoneNumbers.length);
  const nextPhoneToDial = hasNextNumber ? currentLead.phoneNumbers[nextDialIdx] : undefined;

  // Lead Queue (Campaign / Agent / Dial status), strictly excluding Deal Pipeline, DNC, or Language Barrier
  const queueCampaigns = Array.from(new Set(dialerLeads.map((l) => l.campaign).filter(Boolean)));
  const queueLeads = dialerLeads.filter((l) => {
    if (campaignFilter !== 'all' && l.campaign !== campaignFilter) return false;
    if (agentFilter !== 'all' && l.assignedVA !== agentFilter) return false;
    if (dialStatusFilter === 'not-dialed' && l.callsCount > 0) return false;
    if (dialStatusFilter === 'dialed' && l.callsCount === 0) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F2421] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#E4E0D6]/20 transition-all">
          <Volume2 className="w-4 h-4 text-[#B85338]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Lead Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D6] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1F2421] tracking-tight">
              Dialer Workspace
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#B85338]/15 text-[#B85338] border border-[#B85338]/30">
              Active Agent: {activeAgent}
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-0.5">
            Two-column high-velocity dialer with 16-disposition matrix, instant multi-number cycling, and live Move Engine routing.
          </p>
        </div>

        {/* Controls: Dialer Method Selector & Lead Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          <DialerModeSelector id="power-dialer-mode-selector" />

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-md border border-[#E4E0D6] shadow-2xs">
            <button
              type="button"
              disabled={currentLeadIndex <= 0}
              onClick={() => onLeadChange(dialerLeads[currentLeadIndex - 1].id)}
              className="p-1 rounded border border-[#E4E0D6] bg-white hover:bg-[#F8F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-[#1F2421]" />
            </button>
            <span className="text-xs font-mono font-medium text-[#5E6660] px-1">
              Lead {dialerLeads.length > 0 ? currentLeadIndex + 1 : 0} of {dialerLeads.length}
            </span>
            <button
              type="button"
              disabled={currentLeadIndex >= dialerLeads.length - 1}
              onClick={() => onLeadChange(dialerLeads[currentLeadIndex + 1].id)}
              className="p-1 rounded border border-[#E4E0D6] bg-white hover:bg-[#F8F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-[#1F2421]" />
            </button>
          </div>
        </div>
      </div>

      {/* Lead Queue: Bulk Import, Add Single, and Campaign / Agent / Dial Status
          filters — moved in from the former Calling List. Clicking a row loads
          that lead into the dialer below. */}
      <div className="bg-[#FFFFFF] border border-[#E4E0D6] rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#5E6660]" />
            <span className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
              Lead Queue
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0EDE6] text-[#5E6660]">
              {queueLeads.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenBulkImport && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-[#F8F6F1] border border-[#E4E0D6] text-xs font-semibold text-[#1F2421] transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#5E6660]" />
                <span>Bulk Import Leads</span>
              </button>
            )}
            {onAddNewLead && (
              <button
                type="button"
                onClick={onAddNewLead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-[#F8F6F1] border border-[#E4E0D6] text-xs font-semibold text-[#1F2421] transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#5E6660]" />
                <span>Add Single</span>
              </button>
            )}
          </div>
        </div>

        {/* Campaign / Agent / Dial Status filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#5E6660] uppercase text-[10px] tracking-wider">
              Campaign:
            </span>
            <div className="relative">
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="appearance-none bg-white border border-[#E4E0D6] rounded-md px-3 py-1.5 pr-8 text-xs font-medium text-[#1F2421] hover:border-[#5E6660] focus:border-[#B85338] outline-none cursor-pointer"
              >
                <option value="all">All Campaigns</option>
                {queueCampaigns.map((camp) => (
                  <option key={camp} value={camp}>
                    {camp}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#5E6660] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#5E6660] uppercase text-[10px] tracking-wider">
              Agent:
            </span>
            <div className="relative">
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="appearance-none bg-white border border-[#E4E0D6] rounded-md px-3 py-1.5 pr-8 text-xs font-medium text-[#1F2421] hover:border-[#5E6660] focus:border-[#B85338] outline-none cursor-pointer"
              >
                <option value="all">All Agents</option>
                <option value="Rain">Rain</option>
                <option value="Jah">Jah</option>
                <option value="Jen">Jen</option>
                <option value="David">David</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#5E6660] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#5E6660] uppercase text-[10px] tracking-wider">
              Dial Status:
            </span>
            <div className="relative">
              <select
                value={dialStatusFilter}
                onChange={(e) => setDialStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-[#E4E0D6] rounded-md px-3 py-1.5 pr-8 text-xs font-medium text-[#1F2421] hover:border-[#5E6660] focus:border-[#B85338] outline-none cursor-pointer"
              >
                <option value="all">All ({queueLeads.length})</option>
                <option value="not-dialed">Not yet dialed</option>
                <option value="dialed">Dialed</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#5E6660] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Scrollable queue — click a row to load that lead into the dialer below */}
        <div className="max-h-56 overflow-y-auto border border-[#E4E0D6] rounded-md divide-y divide-[#E4E0D6]">
          {queueLeads.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-[#8C948E] italic">
              No leads match these filters.
            </div>
          ) : (
            queueLeads.map((l) => (
              <button
                type="button"
                key={l.id}
                onClick={() => onLeadChange(l.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[#F8F6F1] transition-colors ${
                  l.id === currentLead?.id ? 'bg-[#F4ECE4]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#1F2421] truncate">{l.ownerName}</div>
                  <div className="text-[10px] text-[#5E6660] truncate">
                    {l.propertyAddress}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#9C4129] shrink-0 max-w-[140px] truncate">
                  {l.campaign}
                </span>
                <span className="shrink-0">
                  <VABadge va={l.assignedVA} />
                </span>
                <span
                  className={`text-[10px] font-semibold shrink-0 ${
                    l.callsCount > 0 ? 'text-[#4A7A5E]' : 'text-[#8C948E]'
                  }`}
                >
                  {l.callsCount > 0 ? `${l.callsCount} call${l.callsCount > 1 ? 's' : ''}` : 'Not dialed'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Two Column Ergonomic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Contact Intelligence & Multi-number Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Agent Row Lock (Matches Apps Script) */}
          <div className="bg-[#FFFFFF] border border-[#E4E0D6] rounded-lg p-4 space-y-2.5 shadow-xs">
            <div className="text-[11px] font-bold text-[#5E6660] uppercase tracking-wider flex items-center justify-between">
              <span>Select Active Agent / Lock Row</span>
              <span className="text-[10px] lowercase font-normal text-[#5E6660]">
                (column J & K lock)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveAgent('Rain');
                  broadcastDialerSync({ agent: 'Rain', leadId: currentLead?.id });
                  showToast('🌧 Rain locked active lead row');
                }}
                className={`py-2.5 px-2 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeAgent === 'Rain'
                    ? 'bg-[#2563EB] text-white shadow-sm ring-2 ring-[#2563EB]/20'
                    : 'bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/20'
                }`}
              >
                <span>🌧</span>
                <span>RAIN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAgent('Jah');
                  broadcastDialerSync({ agent: 'Jah', leadId: currentLead?.id });
                  showToast('⚡ Jah locked active lead row');
                }}
                className={`py-2.5 px-2 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeAgent === 'Jah'
                    ? 'bg-[#F59E0B] text-white shadow-sm ring-2 ring-[#F59E0B]/20'
                    : 'bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/20'
                }`}
              >
                <span>⚡</span>
                <span>JAH</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAgent('Jen');
                  broadcastDialerSync({ agent: 'Jen', leadId: currentLead?.id });
                  showToast('🌸 Jen locked active lead row');
                }}
                className={`py-2.5 px-2 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeAgent === 'Jen'
                    ? 'bg-[#EC4899] text-white shadow-sm ring-2 ring-[#EC4899]/20'
                    : 'bg-[#EC4899]/10 text-[#BE185D] hover:bg-[#EC4899]/20'
                }`}
              >
                <span>🌸</span>
                <span>JEN</span>
              </button>
            </div>
          </div>

          {/* Contact Card & Active Number */}
          {currentLead && (
            <div className="bg-[#FFFFFF] border border-[#E4E0D6] rounded-lg p-5 space-y-4 shadow-xs">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-[#1F2421]">
                      {currentLead.ownerName}
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-[#5E6660] mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {currentLead.propertyAddress}, {currentLead.city}{' '}
                        {currentLead.zipCode}
                      </span>
                    </div>
                  </div>
                  <VABadge va={currentLead.assignedVA} />
                </div>

                {/* 1 Property badge if multi-contact */}
                {currentLead.contacts && currentLead.contacts.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs text-[#5E6660] bg-[#F5F2EC] px-2.5 py-1 rounded-md border border-[#E4E0D6] mt-2">
                    <Users className="w-3.5 h-3.5 text-[#B85338]" />
                    <span className="font-semibold text-[#1F2421]">1 Lead / Property</span>
                    <span>•</span>
                    <span>{currentLead.contacts.length} Contacts</span>
                    <span>•</span>
                    <span>{currentLead.phoneNumbers.length} Phone Numbers</span>
                  </div>
                )}

                {/* Campaign & Stage pills */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#F8F6F1] border border-[#E4E0D6] font-semibold text-[#1F2421]">
                    {currentLead.campaign}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#365B6D]/15 text-[#365B6D] font-bold text-[11px]">
                    Stage: {currentLead.stageId}
                  </span>
                  {currentLead.vaStatus && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                      Status: {currentLead.vaStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Dialing Box */}
              <div className="p-4 rounded-lg bg-[#F8F6F1] border border-[#E4E0D6] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#5E6660] uppercase tracking-wider">
                    Target Phone ({currentPhoneIndex + 1} of{' '}
                    {currentLead.phoneNumbers.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[#B85338] bg-white px-2 py-0.5 rounded border border-[#E4E0D6]">
                      {activePhone.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xl font-mono font-extrabold text-[#1F2421] tracking-tight">
                    {activePhone.number || 'No Phone'}
                  </div>
                  {(isTimerActive || callSeconds > 0) && (
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#B85338]">
                      <Timer className="w-3.5 h-3.5 animate-pulse" />
                      <span>{formatTimer(callSeconds)}</span>
                    </div>
                  )}
                </div>

                {/* Dial Controls: CLICK TO DIAL on first number only, NEXT # for succeeding numbers */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {currentPhoneIndex === 0 ? (
                    <DialLink
                      id="btn-call-number"
                      number={activePhone.number}
                      leadId={currentLead.id}
                      onDial={({ number }) => {
                        const nextIdx = 1;
                        setNextDialIdx(nextIdx);
                        setIsTimerActive(true);
                        setCallSeconds(0);
                        broadcastDialerSync({
                          action: 'dial',
                          phoneIndex: 0,
                          nextDialIdx: nextIdx,
                          phoneNumber: number,
                          leadId: currentLead.id,
                          isCalling: true,
                          callSeconds: 0,
                        });
                        showToast(`Dialing 1st number ${number}...`);
                      }}
                      onNoNumber={() => {
                        showToast('⚠️ No phone number available to call for this lead.');
                      }}
                      className="py-2.5 px-3 rounded-md bg-[#4A7A5E] hover:bg-[#3E654E] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer no-underline"
                      title={`Click to dial 1st number: ${activePhone.number}`}
                    >
                      <Phone className="w-3.5 h-3.5 fill-white" />
                      <span>CLICK TO DIAL / CALL</span>
                    </DialLink>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="py-2.5 px-3 rounded-md bg-[#E4E0D6]/60 text-[#5E6660] font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-70"
                      title="1st number already dialed. Use NEXT # to dial succeeding numbers."
                    >
                      <Phone className="w-3.5 h-3.5 opacity-50" />
                      <span>CLICK TO DIAL</span>
                    </button>
                  )}

                  <DialLink
                    id="btn-next-number"
                    number={nextPhoneToDial?.number}
                    leadId={currentLead.id}
                    onDial={({ number }) => {
                      const newTargetIdx = nextDialIdx;
                      const newNextIdx = nextDialIdx + 1;
                      setCurrentPhoneIndex(newTargetIdx);
                      setNextDialIdx(newNextIdx);
                      setIsTimerActive(true);
                      setCallSeconds(0);
                      broadcastDialerSync({
                        action: 'dial',
                        phoneIndex: newTargetIdx,
                        nextDialIdx: newNextIdx,
                        phoneNumber: number,
                        leadId: currentLead.id,
                        isCalling: true,
                        callSeconds: 0,
                      });
                      showToast(
                        `Dialing Next # (${newTargetIdx + 1} of ${currentLead.phoneNumbers.length}): ${number}...`
                      );
                    }}
                    onNoNumber={() => {
                      showToast('No more numbers for this lead');
                    }}
                    className={`py-2.5 px-3 rounded-md border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors no-underline ${
                      hasNextNumber
                        ? 'bg-[#1F2421] text-white border-[#1F2421] hover:bg-[#363E38] cursor-pointer shadow-sm'
                        : 'bg-[#FFFFFF] text-[#5E6660] border-[#E4E0D6] opacity-60 cursor-not-allowed'
                    }`}
                    title={
                      nextPhoneToDial
                        ? `Dial next number: ${nextPhoneToDial.number}`
                        : 'No more numbers for this lead'
                    }
                  >
                    <PhoneForwarded className="w-3.5 h-3.5" />
                    <span>NEXT #</span>
                    {currentLead.phoneNumbers.length > 0 && (
                      <span className="text-[10px] opacity-80 font-mono">
                        ({Math.min(nextDialIdx + 1, currentLead.phoneNumbers.length)}/{currentLead.phoneNumbers.length})
                      </span>
                    )}
                  </DialLink>
                </div>

                <div className="text-[10px] text-[#5E6660] flex items-center justify-between border-t border-[#E8E4DA] pt-2">
                  <span>Target: <strong className="font-mono text-[#1F2421]">{getDialHref(activePhone.number)}</strong></span>
                  <span className="italic font-semibold text-[#4A7A5E]">
                    Native dialpad: URI (Direct Dial)
                  </span>
                </div>
              </div>

              {/* All Phone Numbers list for this lead */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#5E6660] uppercase tracking-wider">
                  <span>Associated Phone Records ({currentLead.phoneNumbers.length})</span>
                  <span className="text-[9px] lowercase font-normal italic">click to display number</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {currentLead.phoneNumbers.map((p, idx) => (
                    <DialLink
                      key={p.id || idx}
                      number={p.number}
                      leadId={currentLead.id}
                      onDial={({ number }) => {
                        setCurrentPhoneIndex(idx);
                        setNextDialIdx(idx + 1);
                        setIsTimerActive(true);
                        setCallSeconds(0);
                        showToast(`Dialing ${p.label}: ${number}...`);
                      }}
                      onNoNumber={() => {
                        handleSelectPhone(idx);
                      }}
                      className={`flex items-center justify-between p-2 rounded text-xs font-mono cursor-pointer transition-colors no-underline ${
                        idx === currentPhoneIndex
                          ? 'bg-[#F4ECE4] border border-[#B85338]/30 font-bold text-[#1F2421]'
                          : 'hover:bg-[#F8F6F1] text-[#5E6660]'
                      }`}
                      title={`Click to dial ${p.label}: ${p.number}`}
                    >
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-[#B85338]" />
                        <span>{p.number}</span>
                        <span className="font-sans text-[10px] text-[#5E6660]">
                          ({p.label}{p.contactName ? ` • ${p.contactName}` : ''})
                        </span>
                      </div>
                      {p.lastDispo && (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                          {p.lastDispo}
                        </span>
                      )}
                    </DialLink>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 16-Disposition Matrix, Notes, Asking Price & Save (7 cols) */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E4E0D6] rounded-lg p-5 space-y-5 shadow-xs">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3">
            <h3 className="font-bold text-sm text-[#1F2421]">
              Dispositions (21 Call Results)
            </h3>
            <span className="text-xs text-[#5E6660]">
              {selectedDispo ? (
                <span className="font-bold text-[#B85338]">
                  Selected: {selectedDispo}
                </span>
              ) : (
                'Select 1 disposition to log'
              )}
            </span>
          </div>

          {/* Exact 21 Disposition Buttons Grid (2 Columns) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* 1. VM */}
            <button
              type="button"
              onClick={() => handleSelectDispo('VM')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'VM'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              VM
            </button>

            {/* 2. Not Interested - 30 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Interested - 30 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Interested - 30 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Interested - 30 Days
            </button>

            {/* 3. Not Interested - 60 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Interested - 60 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Interested - 60 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Interested - 60 Days
            </button>

            {/* 4. Not Interested - 90 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Interested - 90 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Interested - 90 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Interested - 90 Days
            </button>

            {/* 5. Not Ready to Sell - 30 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Ready to Sell - 30 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Ready to Sell - 30 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Ready to Sell - 30 Days
            </button>

            {/* 6. Not Ready to Sell - 60 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Ready to Sell - 60 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Ready to Sell - 60 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Ready to Sell - 60 Days
            </button>

            {/* 7. Not Ready to Sell - 90 Days */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Not Ready to Sell - 90 Days')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Not Ready to Sell - 90 Days'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Not Ready to Sell - 90 Days
            </button>

            {/* 8. WRONG # */}
            <button
              type="button"
              onClick={() => handleSelectDispo('WRONG #')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'WRONG #'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              WRONG #
            </button>

            {/* 9. ANS MACHINE */}
            <button
              type="button"
              onClick={() => handleSelectDispo('ANS MACHINE')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'ANS MACHINE'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              ANS MACHINE
            </button>

            {/* 10. RINGING ONLY */}
            <button
              type="button"
              onClick={() => handleSelectDispo('RINGING ONLY')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'RINGING ONLY'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              RINGING ONLY
            </button>

            {/* 11. DNC (Red highlight) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('DNC')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'DNC'
                  ? 'bg-[#991B1B] text-white border-[#991B1B] shadow-xs'
                  : 'bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] border-[#F87171]'
              }`}
            >
              DNC
            </button>

            {/* 12. DC/ NOT A WORKING # */}
            <button
              type="button"
              onClick={() => handleSelectDispo('DC/ NOT A WORKING #')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'DC/ NOT A WORKING #'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              DC/ NOT A WORKING #
            </button>

            {/* 13. Spanish */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Spanish')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Spanish'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              Spanish
            </button>

            {/* 14. CANNOT DIAL */}
            <button
              type="button"
              onClick={() => handleSelectDispo('CANNOT BE DIALED / NOT IN SERVICE')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'CANNOT BE DIALED / NOT IN SERVICE'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              CANNOT DIAL
            </button>

            {/* 15. HUNG UP */}
            <button
              type="button"
              onClick={() => handleSelectDispo('HUNG UP')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'HUNG UP'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              HUNG UP
            </button>

            {/* 16. Interested (Green star highlight) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Interested')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Interested'
                  ? 'bg-[#2E7D32] text-white border-[#2E7D32] ring-2 ring-[#4CAF50]/30 shadow-sm'
                  : 'bg-[#4CAF50] hover:bg-[#43A047] text-white border-[#4CAF50]'
              }`}
            >
              ★ Interested
            </button>

            {/* 17. Interested - Has Asking Price (Green star highlight) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('Interested - Has Asking Price')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'Interested - Has Asking Price'
                  ? 'bg-[#2E7D32] text-white border-[#2E7D32] ring-2 ring-[#4CAF50]/30 shadow-sm'
                  : 'bg-[#4CAF50] hover:bg-[#43A047] text-white border-[#4CAF50]'
              }`}
            >
              ★ Interested - Has Asking Price
            </button>

            {/* 18. CALLBACK (Amber highlight) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('CALLBACK')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'CALLBACK'
                  ? 'bg-[#E65100] text-white border-[#E65100] ring-2 ring-[#FB8C00]/30 shadow-sm'
                  : 'bg-[#FB8C00] hover:bg-[#F57C00] text-white border-[#FB8C00]'
              }`}
            >
              ⏰ CALLBACK
            </button>

            {/* 19. NO ANSWER */}
            <button
              type="button"
              onClick={() => handleSelectDispo('NO ANSWER')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'NO ANSWER'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              NO ANSWER
            </button>

            {/* 20. LISTED ON MLS (Purple highlight) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('LISTED ON MLS')}
              className={`py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'LISTED ON MLS'
                  ? 'bg-[#6A1B9A] text-white border-[#6A1B9A] ring-2 ring-[#8E24AA]/30 shadow-sm'
                  : 'bg-[#8E24AA] hover:bg-[#7B1FA2] text-white border-[#8E24AA]'
              }`}
            >
              📋 LISTED ON MLS
            </button>

            {/* 21. BEEP/FAX TONE (Spanning 2 columns) */}
            <button
              type="button"
              onClick={() => handleSelectDispo('BEEP/FAX TONE')}
              className={`col-span-2 py-2 px-3 rounded-md font-bold text-center border transition-all cursor-pointer ${
                selectedDispo === 'BEEP/FAX TONE'
                  ? 'bg-[#1F2421] text-white border-[#1F2421] shadow-xs'
                  : 'bg-[#F8F6F1] hover:bg-[#F0EDE6] text-[#1F2421] border-[#E4E0D6]'
              }`}
            >
              BEEP/FAX TONE
            </button>
          </div>

          {/* Notes & Asking Price Inputs */}
          <div className="space-y-3 pt-2">
            <div>
              <label
                htmlFor="dialer-notes"
                className="block text-[11px] font-bold text-[#5E6660] uppercase tracking-wider mb-1"
              >
                Call Notes (Auto-prefixed with today's date)
              </label>
              <textarea
                id="dialer-notes"
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  broadcastDialerSync({ notes: e.target.value, leadId: currentLead?.id });
                }}
                placeholder="Type seller conversation notes..."
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md p-2.5 text-xs text-[#1F2421] outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="dialer-asking-price"
                className="block text-[11px] font-bold text-[#5E6660] uppercase tracking-wider mb-1"
              >
                Seller Asking Price
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-[#5E6660] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="dialer-asking-price"
                  type="text"
                  value={askingPrice}
                  onChange={(e) => {
                    setAskingPrice(e.target.value);
                    broadcastDialerSync({ askingPrice: e.target.value, leadId: currentLead?.id });
                  }}
                  placeholder="e.g. $185,000"
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md pl-8 pr-3 py-2 text-xs font-mono font-semibold text-[#1F2421] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Save After Call Buttons (Per Agent, Matches Apps Script) */}
          <div className="pt-2 border-t border-[#E4E0D6]">
            <div className="text-[10px] font-bold text-[#5E6660] uppercase tracking-wider mb-2">
              Save After Call & Trigger Move Engine
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSubmitDispo('Rain')}
                className="py-3 px-2 rounded-md bg-[#2E7D32] hover:bg-[#256628] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE RAIN</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitDispo('Jah')}
                className="py-3 px-2 rounded-md bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE JAH</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitDispo('Jen')}
                className="py-3 px-2 rounded-md bg-[#E64A19] hover:bg-[#D84315] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE JEN</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
