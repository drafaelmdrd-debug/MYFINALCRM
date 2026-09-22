import React, { useState, useEffect, useMemo } from 'react';
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
  SkipForward,
  Trash2,
} from 'lucide-react';
import { Lead, VA, Disposition } from '../types';

// Determine the owner/contact name associated with a specific phone record on a lead.
// Mirrors the lookup priority used for the currently targeted number's display name,
// generalized so it can be run for ANY phone record on the lead. This lets us group /
// scope phone numbers by owner (see NEXT #, Skip Number, and Next Owner below).
function getOwnerNameForPhone(lead: Lead, phone: Lead['phoneNumbers'][number]): string {
  // 1. Direct contactName explicitly set on the phone record
  if (phone.contactName && phone.contactName.trim()) {
    return phone.contactName.trim();
  }

  // 2. Lookup in lead.contacts by phone number match
  if (lead.contacts && lead.contacts.length > 0) {
    const matchByNumber = lead.contacts.find((c) =>
      c.phoneNumbers?.some(
        (p) =>
          (p.number && phone.number && p.number.replace(/\D/g, '') === phone.number.replace(/\D/g, '')) ||
          (phone.id && p.id === phone.id)
      )
    );
    if (matchByNumber && matchByNumber.name && matchByNumber.name.trim()) {
      return matchByNumber.name.trim();
    }

    // 3. Lookup in lead.contacts by Owner number parsed from label (e.g. "Owner 2 Phone 1" -> Owner 2)
    const ownerLabelMatch = phone.label?.match(/Owner\s*(\d+)/i);
    if (ownerLabelMatch) {
      const ownerNum = parseInt(ownerLabelMatch[1], 10);
      const contactByRole = lead.contacts.find(
        (c) =>
          c.role?.toLowerCase().includes(`owner ${ownerNum}`) ||
          c.name?.toLowerCase().includes(`owner ${ownerNum}`)
      );
      if (contactByRole && contactByRole.name) return contactByRole.name.trim();

      if (lead.contacts[ownerNum - 1]?.name) {
        return lead.contacts[ownerNum - 1].name.trim();
      }
    }
  }

  // 4. Check if any other phone record with the same Owner label prefix has a contact name
  const ownerPrefixMatch = phone.label?.match(/^(Owner\s*\d+)/i);
  if (ownerPrefixMatch && lead.phoneNumbers) {
    const prefix = ownerPrefixMatch[1].toLowerCase();
    const peerPhone = lead.phoneNumbers.find(
      (p) => p.label?.toLowerCase().startsWith(prefix) && p.contactName && p.contactName.trim()
    );
    if (peerPhone && peerPhone.contactName) {
      return peerPhone.contactName.trim();
    }
  }

  // 5. Fallback to the lead's primary ownerName
  return lead.ownerName || 'Unknown Owner';
}
import { isLeadInDealPipeline, isDNCStatus, isLanguageStatus } from '../logic/moveEngine';
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
    agent: VA,
    fromPowerDialer?: boolean
  ) => void;
  onLeadChange: (leadId: string) => void;
  onOpenBulkImport?: () => void;
  onAddNewLead?: () => void;
  onUpdateLead?: (updatedLead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export const PowerDialerView: React.FC<PowerDialerViewProps> = ({
  leads,
  currentLeadId,
  onSaveAfterCall,
  onLeadChange,
  onOpenBulkImport,
  onAddNewLead,
  onUpdateLead,
  onDeleteLead,
  onDeletePhoneNumber,
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
  const [isAddingPhone, setIsAddingPhone] = useState<boolean>(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [newPhoneLabel, setNewPhoneLabel] = useState<string>('Mobile');
  const [newPhoneContact, setNewPhoneContact] = useState<string>('');
  const [lastSavedLead, setLastSavedLead] = useState<Lead | null>(null);

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
      if (data.action === 'dial' && data.phoneNumber && currentLead) {
        const pIdx = currentLead.phoneNumbers.findIndex(
          (p) => p.number.replace(/\D/g, '') === data.phoneNumber?.replace(/\D/g, '')
        );
        if (pIdx >= 0) {
          setCurrentPhoneIndex(pIdx);
          setNextDialIdx(pIdx + 1);
        }
      }
    });

    const handleCallStarted = (e: any) => {
      setIsTimerActive(true);
      if (e.detail?.startTime) {
        setCallSeconds(Math.max(0, Math.floor((Date.now() - e.detail.startTime) / 1000)));
      } else {
        setCallSeconds(0);
      }
      if (e.detail?.phoneNumber && currentLead) {
        const pIdx = currentLead.phoneNumbers.findIndex(
          (p) => p.number.replace(/\D/g, '') === e.detail.phoneNumber?.replace(/\D/g, '')
        );
        if (pIdx >= 0) {
          setCurrentPhoneIndex(pIdx);
          setNextDialIdx(pIdx + 1);
        }
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

  // Direct option to delete an associated phone number - immediately deletes on click
  const handleDeletePhoneRecord = (phoneId: string, numberStr: string) => {
    if (!currentLead) return;
    if (onDeletePhoneNumber) {
      onDeletePhoneNumber(currentLead.id, phoneId);
    } else if (onUpdateLead) {
      const updatedPhones = currentLead.phoneNumbers.filter((p) => p.id !== phoneId);
      onUpdateLead({
        ...currentLead,
        phoneNumbers: updatedPhones,
      });
    }

    const deletedIdx = currentLead.phoneNumbers.findIndex((p) => p.id === phoneId);
    if (deletedIdx >= 0) {
      if (deletedIdx === currentPhoneIndex) {
        setCurrentPhoneIndex(0);
        setNextDialIdx(0);
      } else if (deletedIdx < currentPhoneIndex) {
        setCurrentPhoneIndex((prev) => Math.max(0, prev - 1));
        setNextDialIdx((prev) => Math.max(0, prev - 1));
      }
    }
    showToast(`Deleted phone number ${numberStr}`);
  };

  // Direct option to delete the entire lead - immediately deletes on click
  const handleDeleteCurrentLead = () => {
    if (!currentLead) return;
    if (onDeleteLead) {
      onDeleteLead(currentLead.id);
    }
  };

  const activePhone =
    currentLead?.phoneNumbers[currentPhoneIndex] ||
    currentLead?.phoneNumbers[0] || {
      number: '',
      label: 'Main',
    };

  // Distinct owners detection across contacts, primary owner name, and phone records
  const distinctOwnerNames = useMemo(() => {
    if (!currentLead) return [];
    const names = new Set<string>();
    if (currentLead.ownerName && currentLead.ownerName.trim()) {
      names.add(currentLead.ownerName.trim());
    }
    currentLead.contacts?.forEach((c) => {
      if (c.name && c.name.trim()) names.add(c.name.trim());
    });
    currentLead.phoneNumbers?.forEach((p) => {
      if (p.contactName && p.contactName.trim()) names.add(p.contactName.trim());
    });
    return Array.from(names);
  }, [currentLead]);

  const hasMultipleOwners =
    distinctOwnerNames.length > 1 ||
    Boolean(currentLead?.contacts && currentLead.contacts.length > 1) ||
    Boolean(currentLead?.phoneNumbers.some((p) => /Owner\s*[2-9]/i.test(p.label || '')));

  // Determine active contact name for whoever's phone number is currently targeted or being dialed
  const displayedOwnerName = useMemo(() => {
    if (!currentLead) return '';
    return getOwnerNameForPhone(currentLead, activePhone);
  }, [currentLead, activePhone]);

  // Owner name for every phone record on this lead, in list order — used to scope
  // NEXT #, Skip Number, and Next Owner to same-owner groups instead of jumping owners.
  const phoneOwnerNames = useMemo(() => {
    if (!currentLead) return [];
    return currentLead.phoneNumbers.map((p) => getOwnerNameForPhone(currentLead, p));
  }, [currentLead]);

  // Ordered list of distinct owners as they first appear across this lead's phone numbers
  const ownerGroups = useMemo(() => {
    if (!currentLead) return [];
    const seen = new Set<string>();
    const groups: { name: string; firstIndex: number }[] = [];
    phoneOwnerNames.forEach((name, idx) => {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ name, firstIndex: idx });
      }
    });
    return groups;
  }, [currentLead, phoneOwnerNames]);

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
    const targetOwner = targetPhone.contactName || currentLead.ownerName;
    showToast(
      `Selected ${targetOwner} • ${targetPhone.label} (${targetPhone.number}). Click CLICK TO DIAL to call.`
    );
  };

  // Skip Number is scoped the same way as NEXT # — same-owner only. `hasNextNumber` /
  // `nextPhoneToDial` (declared below) already stop at the current owner's last number.
  const handleSkipNumber = () => {
    if (!currentLead || !hasNextNumber || !nextPhoneToDial) {
      showToast('No more numbers to skip to for this owner.');
      return;
    }
    const skippedIdx = nextDialIdx;
    const targetPhone = nextPhoneToDial;
    setCurrentPhoneIndex(skippedIdx);
    setNextDialIdx(skippedIdx + 1);
    setIsTimerActive(false);
    setCallSeconds(0);
    resetCallState();
    broadcastDialerSync({
      phoneIndex: skippedIdx,
      nextDialIdx: skippedIdx + 1,
      phoneNumber: targetPhone.number,
      leadId: currentLead.id,
    });
    const targetOwner = targetPhone.contactName || currentLead.ownerName;
    showToast(`Skipped to ${targetOwner} • ${targetPhone.label} (${targetPhone.number})`);
  };

  // Next Owner: jumps straight to the next distinct owner's first phone number.
  const handleNextOwner = () => {
    if (!currentLead || !nextOwnerGroup) {
      showToast('No more owners for this lead.');
      return;
    }
    const targetIdx = nextOwnerGroup.firstIndex;
    const targetPhone = currentLead.phoneNumbers[targetIdx];
    setCurrentPhoneIndex(targetIdx);
    setNextDialIdx(targetIdx + 1);
    setIsTimerActive(false);
    setCallSeconds(0);
    resetCallState();
    broadcastDialerSync({
      phoneIndex: targetIdx,
      nextDialIdx: targetIdx + 1,
      phoneNumber: targetPhone.number,
      leadId: currentLead.id,
    });
    showToast(`Jumped to next owner: ${nextOwnerGroup.name} • ${targetPhone.label} (${targetPhone.number})`);
  };

  // Next Address: advances to the next lead/address in the current dialer queue,
  // reusing the same lead-navigation logic as the top ChevronRight control. The
  // existing "lead changed" effect resets phone/owner tracking for the new address.
  const handleNextAddress = () => {
    if (!hasNextAddress) {
      showToast('No more leads/addresses in the queue.');
      return;
    }
    const nextLead = dialerLeads[currentLeadIndex + 1];
    onLeadChange(nextLead.id);
  };

  const handleSubmitDispo = (agent: VA) => {
    if (!selectedDispo) {
      showToast('⚠️ Please select a disposition first!');
      return;
    }
    if (!currentLead) return;

    const isSpecialGranular = isDNCStatus(selectedDispo) || isLanguageStatus(selectedDispo);
    const hasRemainingPhones = currentLead.phoneNumbers.length > 1;

    setIsTimerActive(false);
    setCallSeconds(0);
    resetCallState();

    onSaveAfterCall(
      currentLead.id,
      activePhone.number || 'No Phone',
      selectedDispo,
      notes,
      askingPrice,
      agent,
      true
    );

    if (isSpecialGranular && hasRemainingPhones) {
      showToast(
        `✅ Number ${activePhone.number} (${displayedOwnerName}) moved to ${selectedDispo}. ${currentLead.phoneNumbers.length - 1} number(s) remain on dialer.`
      );
      // Reset target phone index to 0 so the agent can immediately continue calling remaining numbers
      setCurrentPhoneIndex(0);
      setNextDialIdx(1);
    } else if (hasRemainingPhones && currentPhoneIndex < currentLead.phoneNumbers.length - 1) {
      const nextIdx = currentPhoneIndex + 1;
      setCurrentPhoneIndex(nextIdx);
      setNextDialIdx(nextIdx + 1);
      showToast(
        `✅ Saved ${agent} | ${selectedDispo}. Switched to phone #${nextIdx + 1} (${currentLead.phoneNumbers[nextIdx].number}).`
      );
    } else {
      showToast(`✅ Saved: ${agent} | ${selectedDispo} | ${displayedOwnerName} (${activePhone.number})`);
      setLastSavedLead(currentLead);
    }

    setSelectedDispo(null);
    setNotes('');
  };

  const handleAddNewPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhoneNumber.trim() || !currentLead) return;
    const newRecord = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      number: newPhoneNumber.trim(),
      label: newPhoneLabel.trim() || 'Mobile',
      contactName: newPhoneContact.trim() || currentLead.ownerName,
    };
    const updatedPhones = [...currentLead.phoneNumbers, newRecord];
    const updatedLead: Lead = {
      ...currentLead,
      phoneNumbers: updatedPhones,
    };
    if (onUpdateLead) {
      onUpdateLead(updatedLead);
    }
    setNewPhoneNumber('');
    setNewPhoneContact('');
    setIsAddingPhone(false);
    showToast(`✅ Added number ${newRecord.number} (${newRecord.label}) to ${currentLead.ownerName}`);
  };

  const handleMoveToNeedsDeepdive = () => {
    const targetLead = currentLead || lastSavedLead;
    if (!targetLead) {
      showToast('⚠️ No active lead to move');
      return;
    }

    // If an agent had notes/disposition entered but not saved yet, save them
    if (selectedDispo || notes.trim()) {
      onSaveAfterCall(
        targetLead.id,
        activePhone?.number || 'No Phone',
        selectedDispo || ('ALL NUMBERS BAD- NEEDS DEEPDIVE' as any),
        notes,
        askingPrice,
        activeAgent,
        true
      );
    }

    const nowISO = new Date().toISOString();
    const updatedLead: Lead = {
      ...targetLead,
      stageId: 'Needs Skiptracing/Deepdive',
      vaStatus: 'ALL NUMBERS BAD- NEEDS DEEPDIVE',
      promotedToPipeline: true,
      lastDispo: 'ALL NUMBERS BAD- NEEDS DEEPDIVE',
      dateAddedToDeepdive: nowISO,
      assignedVA: activeAgent,
      callNotes: notes.trim()
        ? `${targetLead.callNotes ? targetLead.callNotes + ' | ' : ''}[ALL NUMBERS BAD- NEEDS DEEPDIVE by ${activeAgent}]: ${notes.trim()}`
        : targetLead.callNotes || 'ALL NUMBERS BAD- NEEDS DEEPDIVE',
      notes: notes.trim()
        ? `${targetLead.notes ? targetLead.notes + '\n' : ''}[ALL NUMBERS BAD- NEEDS DEEPDIVE by ${activeAgent}]: ${notes.trim()}`
        : targetLead.notes || '[ALL NUMBERS BAD- NEEDS DEEPDIVE]',
    };

    if (onUpdateLead) {
      onUpdateLead(updatedLead);
    }

    showToast(`💜 Moved ${targetLead.ownerName} to Needs Skiptracing/Deepdive`);

    setSelectedDispo(null);
    setNotes('');
    setAskingPrice('');
    setIsTimerActive(false);
    setCallSeconds(0);
    resetCallState();
    setLastSavedLead(null);

    // Auto advance to next remaining lead
    const remaining = dialerLeads.filter((l) => l.id !== targetLead.id);
    if (remaining.length > 0) {
      const nextIdx = currentLeadIndex < remaining.length ? currentLeadIndex : 0;
      onLeadChange(remaining[nextIdx].id);
    }
  };

  // Owner of the currently targeted phone number (the one CLICK TO DIAL / NEXT # would call)
  const currentOwnerName = currentLead ? phoneOwnerNames[currentPhoneIndex] || displayedOwnerName : '';

  // Next Number calculation: next number in order, without wrap-around, AND scoped to the
  // SAME owner as the currently targeted number. Once that owner's last number is reached,
  // this goes false (greying out NEXT # / Skip Number) instead of jumping to the next owner.
  const hasNextNumber = Boolean(
    currentLead &&
      nextDialIdx < currentLead.phoneNumbers.length &&
      phoneOwnerNames[nextDialIdx]?.toLowerCase() === currentOwnerName.toLowerCase()
  );
  const nextPhoneToDial = hasNextNumber ? currentLead.phoneNumbers[nextDialIdx] : undefined;

  // Next Owner calculation: the next distinct owner group after the currently targeted owner
  const currentOwnerGroupIndex = ownerGroups.findIndex(
    (g) => g.name.toLowerCase() === currentOwnerName.toLowerCase()
  );
  const nextOwnerGroup =
    currentOwnerGroupIndex >= 0 && currentOwnerGroupIndex < ownerGroups.length - 1
      ? ownerGroups[currentOwnerGroupIndex + 1]
      : undefined;
  const hasNextOwner = Boolean(currentLead && nextOwnerGroup);

  // Next Address calculation: is there another lead after this one in the current dialer queue?
  const hasNextAddress = Boolean(
    currentLead && currentLeadIndex >= 0 && currentLeadIndex < dialerLeads.length - 1
  );

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-[#1F2421]">
                        {displayedOwnerName}
                      </h2>
                      {hasMultipleOwners && displayedOwnerName.toLowerCase() !== currentLead.ownerName.toLowerCase() && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B85338]/15 text-[#B85338] border border-[#B85338]/30">
                          {activePhone.label ? activePhone.label.split(' Phone')[0] : 'Co-Owner'} • Primary: {currentLead.ownerName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#5E6660] mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {currentLead.propertyAddress}, {currentLead.city}{' '}
                        {currentLead.zipCode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <VABadge va={currentLead.assignedVA} />
                    {onDeleteLead && (
                      <button
                        type="button"
                        onClick={handleDeleteCurrentLead}
                        className="p-1.5 rounded text-[#8C948E] hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer flex items-center gap-1 text-xs font-semibold transition-colors"
                        title="Delete entire lead record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete Lead</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 1 Property badge if multi-contact */}
                {(hasMultipleOwners || (currentLead.contacts && currentLead.contacts.length > 1)) && (
                  <div className="flex items-center gap-1.5 text-xs text-[#5E6660] bg-[#F5F2EC] px-2.5 py-1 rounded-md border border-[#E4E0D6] mt-2">
                    <Users className="w-3.5 h-3.5 text-[#B85338]" />
                    <span className="font-semibold text-[#1F2421]">1 Lead / Property</span>
                    <span>•</span>
                    <span>{Math.max(currentLead.contacts?.length || 0, distinctOwnerNames.length)} Contacts</span>
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
                <div className="grid grid-cols-2 gap-2 pt-1 items-start">
                  <div>
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
                          showToast(`Dialing ${displayedOwnerName} (${activePhone.label}): ${number}...`);
                        }}
                        onNoNumber={() => {
                          showToast('⚠️ No phone number available to call for this lead.');
                        }}
                        className="py-2.5 px-3 rounded-md bg-[#4A7A5E] hover:bg-[#3E654E] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer no-underline w-full"
                        title={`Click to dial 1st number: ${activePhone.number}`}
                      >
                        <Phone className="w-3.5 h-3.5 fill-white" />
                        <span>CLICK TO DIAL / CALL</span>
                      </DialLink>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="py-2.5 px-3 rounded-md bg-[#E4E0D6]/60 text-[#5E6660] font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-70 w-full"
                        title="1st number already dialed. Use NEXT # to dial succeeding numbers."
                      >
                        <Phone className="w-3.5 h-3.5 opacity-50" />
                        <span>CLICK TO DIAL</span>
                      </button>
                    )}
                  </div>

                  <div>
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
                        const nextContactName = nextPhoneToDial?.contactName || currentLead.ownerName;
                        showToast(
                          `Dialing Next # (${newTargetIdx + 1} of ${currentLead.phoneNumbers.length} • ${nextContactName}): ${number}...`
                        );
                      }}
                      onNoNumber={() => {
                        showToast('No more numbers for this owner. Use NEXT OWNER to move on.');
                      }}
                      className={`py-2.5 px-3 rounded-md border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors no-underline w-full ${
                        hasNextNumber
                          ? 'bg-[#1F2421] text-white border-[#1F2421] hover:bg-[#363E38] cursor-pointer shadow-sm'
                          : 'bg-[#FFFFFF] text-[#5E6660] border-[#E4E0D6] opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        nextPhoneToDial
                          ? `Dial next number: ${nextPhoneToDial.number}`
                          : 'No more numbers for this owner'
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

                    {/* Skip Number option just below NEXT # */}
                    <button
                      type="button"
                      id="btn-skip-number"
                      onClick={handleSkipNumber}
                      disabled={!hasNextNumber}
                      className={`w-full mt-1.5 py-1.5 px-2 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        hasNextNumber
                          ? 'bg-white hover:bg-gray-50 text-[#1F2421] border-[#E4E0D6] hover:border-[#B85338] shadow-2xs'
                          : 'bg-gray-50 text-[#8C948E] border-[#E4E0D6] opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        hasNextNumber && nextPhoneToDial
                          ? `Skip to next number: ${nextPhoneToDial.number} (${nextPhoneToDial.contactName || nextPhoneToDial.label}) without dialing`
                          : 'No more numbers to skip to'
                      }
                    >
                      <SkipForward className="w-3 h-3 text-[#B85338]" />
                      <span>Skip Number</span>
                    </button>

                    {/* Next Owner: jumps straight to the next owner's first number */}
                    <button
                      type="button"
                      id="btn-next-owner"
                      onClick={handleNextOwner}
                      disabled={!hasNextOwner}
                      className={`w-full mt-1.5 py-2 px-3 rounded-md border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                        hasNextOwner
                          ? 'bg-[#1F2421] text-white border-[#1F2421] hover:bg-[#363E38] cursor-pointer shadow-sm'
                          : 'bg-[#FFFFFF] text-[#5E6660] border-[#E4E0D6] opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        hasNextOwner && nextOwnerGroup
                          ? `Jump to next owner: ${nextOwnerGroup.name}`
                          : 'No more owners for this lead'
                      }
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>NEXT OWNER</span>
                    </button>

                    {/* Next Address: advances to the next lead/address in the queue */}
                    <button
                      type="button"
                      id="btn-next-address"
                      onClick={handleNextAddress}
                      disabled={!hasNextAddress}
                      className={`w-full mt-1.5 py-2 px-3 rounded-md border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                        hasNextAddress
                          ? 'bg-[#1F2421] text-white border-[#1F2421] hover:bg-[#363E38] cursor-pointer shadow-sm'
                          : 'bg-[#FFFFFF] text-[#5E6660] border-[#E4E0D6] opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        hasNextAddress
                          ? `Advance to next lead/address: ${dialerLeads[currentLeadIndex + 1]?.propertyAddress}`
                          : 'No more leads in the queue'
                      }
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>NEXT ADDRESS</span>
                    </button>
                  </div>
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
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {currentLead.phoneNumbers.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className={`flex items-center justify-between p-1.5 px-2 rounded text-xs font-mono transition-colors ${
                        idx === currentPhoneIndex
                          ? 'bg-[#F4ECE4] border border-[#B85338]/30 font-bold text-[#1F2421]'
                          : 'hover:bg-[#F8F6F1] text-[#5E6660]'
                      }`}
                    >
                      <DialLink
                        number={p.number}
                        leadId={currentLead.id}
                        onDial={({ number }) => {
                          setCurrentPhoneIndex(idx);
                          setNextDialIdx(idx + 1);
                          setIsTimerActive(true);
                          setCallSeconds(0);
                          showToast(`Dialing ${p.contactName || p.label}: ${number}...`);
                        }}
                        onNoNumber={() => {
                          handleSelectPhone(idx);
                        }}
                        className="flex-1 flex items-center justify-between no-underline cursor-pointer min-w-0 pr-2"
                        title={`Click to dial ${p.label}: ${p.number}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="w-3 h-3 text-[#B85338] shrink-0" />
                          <span className="truncate">{p.number}</span>
                          <span className="font-sans text-[10px] text-[#5E6660] truncate">
                            ({p.label}{p.contactName ? ` • ${p.contactName}` : ''})
                          </span>
                        </div>
                        {p.lastDispo && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold shrink-0 ml-1">
                            {p.lastDispo}
                          </span>
                        )}
                      </DialLink>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeletePhoneRecord(p.id, p.number);
                        }}
                        className="p-1 rounded text-[#8C948E] hover:text-red-600 hover:bg-white border border-transparent hover:border-red-200 cursor-pointer shrink-0 transition-colors ml-1"
                        title={`Delete phone number ${p.number}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Option below associated phone numbers for add numbers */}
                {!isAddingPhone ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPhone(true);
                      setNewPhoneLabel(`Phone ${currentLead.phoneNumbers.length + 1}`);
                      setNewPhoneNumber('');
                      setNewPhoneContact(currentLead.ownerName);
                    }}
                    className="w-full py-1.5 px-2.5 rounded-md border border-dashed border-[#B85338]/40 hover:border-[#B85338] text-[#B85338] hover:bg-[#B85338]/5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Number</span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleAddNewPhone}
                    className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E4E0D6] space-y-2 mt-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#1F2421] uppercase tracking-wider">
                        Add New Phone Number
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPhone(false)}
                        className="text-[10px] text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        placeholder="e.g. 214-555-0199"
                        value={newPhoneNumber}
                        onChange={(e) => setNewPhoneNumber(e.target.value)}
                        className="w-full text-xs font-mono px-2 py-1.5 rounded border border-[#D5CFC4] bg-white text-[#1F2421] focus:ring-1 focus:ring-[#B85338] focus:outline-none"
                        autoFocus
                      />
                      <select
                        value={newPhoneLabel}
                        onChange={(e) => setNewPhoneLabel(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 rounded border border-[#D5CFC4] bg-white text-[#1F2421] focus:ring-1 focus:ring-[#B85338] focus:outline-none"
                      >
                        <option value="Mobile">Mobile</option>
                        <option value="Landline">Landline</option>
                        <option value="Work">Work</option>
                        <option value="Home">Home</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Contact name (optional, defaults to ${currentLead.ownerName})`}
                        value={newPhoneContact}
                        onChange={(e) => setNewPhoneContact(e.target.value)}
                        className="flex-1 text-xs px-2 py-1.5 rounded border border-[#D5CFC4] bg-white text-[#1F2421] focus:ring-1 focus:ring-[#B85338] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newPhoneNumber.trim()}
                        className="px-3 py-1.5 rounded bg-[#4A7A5E] hover:bg-[#3E654E] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}
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
          <div className="pt-2 border-t border-[#E4E0D6] space-y-2">
            <div className="text-[10px] font-bold text-[#5E6660] uppercase tracking-wider">
              Save After Call & Trigger Move Engine
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-save-rain"
                onClick={() => handleSubmitDispo('Rain')}
                className="py-3 px-2 rounded-md bg-[#2E7D32] hover:bg-[#256628] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE RAIN</span>
              </button>

              <button
                type="button"
                id="btn-save-jah"
                onClick={() => handleSubmitDispo('Jah')}
                className="py-3 px-2 rounded-md bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE JAH</span>
              </button>

              <button
                type="button"
                id="btn-save-jen"
                onClick={() => handleSubmitDispo('Jen')}
                className="py-3 px-2 rounded-md bg-[#E64A19] hover:bg-[#D84315] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>SAVE JEN</span>
              </button>
            </div>

            {/* Violet ALL NUMBERS BAD- NEEDS DEEPDIVE Button */}
            <button
              type="button"
              id="btn-all-numbers-bad-needs-deepdive"
              onClick={handleMoveToNeedsDeepdive}
              className="w-full py-3 px-2 rounded-md bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Move this lead to Needs Deepdive"
            >
              <span>ALL NUMBERS BAD- NEEDS DEEPDIVE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
