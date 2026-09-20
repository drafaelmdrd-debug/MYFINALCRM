import React, { useState } from 'react';
import { Lead, VA, PhoneNumberRecord } from '../types';
import {
  FileSearch,
  Phone,
  MapPin,
  Trash2,
  Plus,
  Search,
  RotateCcw,
  Sparkles,
  Upload,
  X,
  Building2,
  DollarSign,
  User,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';

interface NeedsDeepdiveViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onMoveLead: (lead: Lead, targetStage: string) => void;
  onUpdateLead?: (lead: Lead) => void;
  onAddNewLead?: (lead: Lead) => void;
  onOpenBulkImport?: () => void;
  onImportLeads?: (leads: Lead[]) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export function NeedsDeepdiveView({
  leads,
  onOpenLeadDetail,
  onMoveLead,
  onUpdateLead,
  onAddNewLead,
  onOpenBulkImport,
  onImportLeads,
  onLaunchDialer,
  onDeleteLead,
  onDeletePhoneNumber,
}: NeedsDeepdiveViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEWLY_ADDED' | 'ALL_BAD'>('ALL');
  const [addingPhoneLeadId, setAddingPhoneLeadId] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState('');
  const [newLabel, setNewLabel] = useState('Mobile');

  // Manual Add Property Modal State
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [manualOwnerName, setManualOwnerName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCity, setManualCity] = useState('Dallas');
  const [manualState, setManualState] = useState('TX');
  const [manualZip, setManualZip] = useState('');
  const [manualCounty, setManualCounty] = useState('');
  const [manualMailing, setManualMailing] = useState('');
  const [manualAskingPrice, setManualAskingPrice] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualVA, setManualVA] = useState<VA>('Rain');
  const [manualPhones, setManualPhones] = useState<Array<{ number: string; label: string }>>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneLabelInput, setPhoneLabelInput] = useState('Mobile');

  // Fast Quick Paste Importer Modal State
  const [isQuickPasteOpen, setIsQuickPasteOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [quickPasteVA, setQuickPasteVA] = useState<VA>('Rain');
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  const deepdiveLeads = leads.filter(
    (l) => l.stageId === 'Needs Skiptracing/Deepdive' || l.stageId === 'Needs Deepdive'
  );

  const newlyAddedCount = deepdiveLeads.filter(
    (l) => l.vaStatus === 'Newly Added' || l.outreachStatus === 'Newly Added'
  ).length;

  const allBadCount = deepdiveLeads.filter(
    (l) => l.vaStatus === 'ALL NUMBERS BAD- NEEDS DEEPDIVE'
  ).length;

  const filteredLeads = deepdiveLeads.filter((l) => {
    // Status Filter
    if (statusFilter === 'NEWLY_ADDED') {
      const isNewly = l.vaStatus === 'Newly Added' || l.outreachStatus === 'Newly Added';
      if (!isNewly) return false;
    } else if (statusFilter === 'ALL_BAD') {
      if (l.vaStatus !== 'ALL NUMBERS BAD- NEEDS DEEPDIVE') return false;
    }

    // Search Term
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = l.ownerName?.toLowerCase().includes(term);
    const addrMatch = l.propertyAddress?.toLowerCase().includes(term);
    const idMatch = l.leadId?.toLowerCase().includes(term);
    const phoneMatch = l.phoneNumbers?.some((p) => p.number.includes(term));
    return nameMatch || addrMatch || idMatch || phoneMatch;
  });

  const handleQuickAddNumber = (lead: Lead) => {
    if (!newNumber.trim() || !onUpdateLead) return;
    const newRecord: PhoneNumberRecord = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      number: newNumber.trim(),
      label: newLabel.trim() || 'Mobile',
      contactName: lead.ownerName,
    };
    onUpdateLead({
      ...lead,
      phoneNumbers: [...lead.phoneNumbers, newRecord],
    });
    setNewNumber('');
    setAddingPhoneLeadId(null);
  };

  const handleRestoreToDialer = (lead: Lead) => {
    // Restore lead back to Cold Calling list so dialer can work newly enriched numbers
    if (onUpdateLead) {
      onUpdateLead({
        ...lead,
        stageId: (lead.sourceTab as any) || 'Dallas',
        promotedToPipeline: false,
        vaStatus: 'Cold Calling',
      });
    } else {
      onMoveLead(lead, 'Dallas');
    }
  };

  // Add a phone in the manual add modal
  const handleAddManualPhone = () => {
    if (!phoneInput.trim()) return;
    setManualPhones((prev) => [
      ...prev,
      { number: phoneInput.trim(), label: phoneLabelInput || 'Mobile' },
    ]);
    setPhoneInput('');
    setPhoneLabelInput('Mobile');
  };

  const handleRemoveManualPhone = (idx: number) => {
    setManualPhones((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit manual property
  const handleSubmitManualProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) {
      alert('Property address is required');
      return;
    }

    const newLeadRecord: Lead = {
      id: `lead-skip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId: `PROP-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerName: manualOwnerName.trim() || 'Unknown Owner',
      propertyAddress: manualAddress.trim(),
      city: manualCity.trim() || 'Dallas',
      zipCode: manualZip.trim() || '',
      county: manualCounty.trim() || undefined,
      mailingAddress: manualMailing.trim() || undefined,
      phoneNumbers: manualPhones.map((p, idx) => ({
        id: `p-${Date.now()}-${idx}`,
        number: p.number,
        label: p.label,
        contactName: manualOwnerName.trim() || 'Unknown Owner',
      })),
      campaign: 'Skiptracing Queue',
      stageId: 'Needs Skiptracing/Deepdive',
      sourceTab: 'Skiptracing Queue',
      assignedVA: manualVA,
      vaStatus: 'Newly Added', // Auto agent status
      outreachStatus: 'Newly Added', // Auto agent status
      promotedToPipeline: true,
      dateAddedToDeepdive: new Date().toISOString(),
      dateAdded: new Date().toISOString(),
      callsCount: 0,
      callNotes: manualNotes.trim()
        ? `[Newly Added to Skiptracing]: ${manualNotes.trim()}`
        : '[Newly Added to Skiptracing]',
      notes: manualNotes.trim()
        ? `[Newly Added to Skiptracing]: ${manualNotes.trim()}`
        : '[Newly Added to Skiptracing]',
      askingPrice: manualAskingPrice.trim() || undefined,
    };

    if (onAddNewLead) {
      onAddNewLead(newLeadRecord);
    } else if (onUpdateLead) {
      onUpdateLead(newLeadRecord);
    }

    // Reset Form
    setManualOwnerName('');
    setManualAddress('');
    setManualCity('Dallas');
    setManualState('TX');
    setManualZip('');
    setManualCounty('');
    setManualMailing('');
    setManualAskingPrice('');
    setManualNotes('');
    setManualPhones([]);
    setPhoneInput('');
    setIsManualAddOpen(false);
  };

  // Submit Fast Quick Paste Importer
  const handleProcessQuickPaste = () => {
    if (!pasteContent.trim()) {
      setPasteFeedback('Please paste at least one row of property data.');
      return;
    }

    const lines = pasteContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const createdLeads: Lead[] = [];

    lines.forEach((line, idx) => {
      // Split by tab or comma
      const delimiter = line.includes('\t') ? '\t' : ',';
      const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());

      let ownerName = '';
      let address = '';
      let city = 'Dallas';
      let zip = '';
      let mailing = '';
      let phone = '';

      if (parts.length === 1) {
        address = parts[0];
      } else if (parts.length === 2) {
        ownerName = parts[0];
        address = parts[1];
      } else if (parts.length === 3) {
        ownerName = parts[0];
        address = parts[1];
        city = parts[2];
      } else if (parts.length === 4) {
        ownerName = parts[0];
        address = parts[1];
        city = parts[2];
        zip = parts[3];
      } else if (parts.length >= 5) {
        ownerName = parts[0];
        address = parts[1];
        city = parts[2];
        zip = parts[3];
        mailing = parts[4];
        if (parts[5]) phone = parts[5];
      }

      if (!address && !ownerName) return;

      const phoneRecords: PhoneNumberRecord[] = [];
      if (phone) {
        phoneRecords.push({
          id: `p-quick-${Date.now()}-${idx}`,
          number: phone,
          label: 'Mobile',
          contactName: ownerName || 'Unknown Owner',
        });
      }

      createdLeads.push({
        id: `lead-quick-skip-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        leadId: `SKIP-${Math.floor(1000 + Math.random() * 9000)}`,
        ownerName: ownerName || 'Unknown Owner',
        propertyAddress: address || 'Address Pending',
        city: city || 'Dallas',
        zipCode: zip || '',
        mailingAddress: mailing || undefined,
        phoneNumbers: phoneRecords,
        campaign: 'Skiptracing Queue',
        stageId: 'Needs Skiptracing/Deepdive',
        sourceTab: 'Skiptracing Queue',
        assignedVA: quickPasteVA,
        vaStatus: 'Newly Added', // Auto agent status
        outreachStatus: 'Newly Added', // Auto agent status
        promotedToPipeline: true,
        dateAddedToDeepdive: new Date().toISOString(),
        dateAdded: new Date().toISOString(),
        callsCount: 0,
        callNotes: '[Newly Added via Quick Import]',
        notes: '[Newly Added via Quick Import]',
      });
    });

    if (createdLeads.length === 0) {
      setPasteFeedback('Could not parse any valid properties. Please check format.');
      return;
    }

    if (onImportLeads) {
      onImportLeads(createdLeads);
    } else if (onAddNewLead) {
      createdLeads.forEach((ld) => onAddNewLead(ld));
    }

    setPasteContent('');
    setPasteFeedback(null);
    setIsQuickPasteOpen(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-800 flex items-center justify-center border border-violet-200 shadow-2xs">
              <FileSearch className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1F2421] tracking-tight flex items-center gap-2.5">
                <span>Needs Skiptracing/Deepdive</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 font-bold border border-violet-200">
                  Skiptracing Queue
                </span>
              </h1>
              <p className="text-xs text-[#5E6660] mt-0.5">
                Properties and leads requiring skip-tracing, deep research, or new contact acquisition before dialing resumes.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#8C948E] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search owner, address, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg text-[#1F2421] placeholder-[#8C948E] focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-2xs"
            />
          </div>

          {/* Manually Add Property Button */}
          <button
            type="button"
            id="btn-manual-add-property"
            onClick={() => setIsManualAddOpen(true)}
            className="px-3.5 py-2 bg-violet-700 hover:bg-violet-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98"
            title="Manually add a property to Needs Skiptracing/Deepdive"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>

          {/* Bulk Import Button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-bulk-import-properties"
              onClick={() => {
                if (onOpenBulkImport) {
                  onOpenBulkImport();
                } else {
                  setIsQuickPasteOpen(true);
                }
              }}
              className="px-3.5 py-2 bg-white hover:bg-violet-50 text-violet-800 border border-violet-300 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              title="Bulk import spreadsheet or paste property list directly with auto 'Newly Added' status"
            >
              <Upload className="w-3.5 h-3.5 text-violet-700" />
              <span>Bulk Import Properties</span>
            </button>

            {/* Quick Paste Shortcut */}
            <button
              type="button"
              onClick={() => setIsQuickPasteOpen(true)}
              className="p-2 bg-white hover:bg-[#F8F6F1] text-[#5E6660] hover:text-[#1F2421] border border-[#E4E0D6] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Quick Paste text or spreadsheet rows"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Auto Status Explanation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E4E0D6] shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-violet-600 text-white'
                : 'bg-[#F8F6F1] text-[#5E6660] hover:text-[#1F2421]'
            }`}
          >
            All Properties ({deepdiveLeads.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('NEWLY_ADDED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'NEWLY_ADDED'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#F8F6F1] text-[#5E6660] hover:text-[#1F2421]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Newly Added ({newlyAddedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL_BAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL_BAD'
                ? 'bg-violet-100 text-violet-800 border border-violet-200'
                : 'bg-[#F8F6F1] text-[#5E6660] hover:text-[#1F2421]'
            }`}
          >
            All Numbers Bad ({allBadCount})
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#5E6660] bg-violet-50/60 px-3 py-1.5 rounded-lg border border-violet-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          <span>
            Properties added here manually or via bulk import automatically receive agent status{' '}
            <strong className="text-emerald-700 font-bold underline">Newly Added</strong>.
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#F8F6F1] border-b border-[#E4E0D6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1F2421]">
              Needs Skiptracing/Deepdive Queue:{' '}
              <strong className="font-mono text-violet-700">{deepdiveLeads.length}</strong>
            </span>
            {searchTerm && (
              <span className="text-xs text-[#5E6660]">
                ({filteredLeads.length} matching search)
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#5E6660] italic hidden sm:inline">
            Add new researched numbers below, then click &quot;To Calling List&quot; when ready to dial
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFFFFF] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4">Lead ID & Owner</th>
                <th className="py-3 px-4">Property Address</th>
                <th className="py-3 px-4">Associated Phone Numbers</th>
                <th className="py-3 px-4">Agent / Auto Status</th>
                <th className="py-3 px-4">Notes & Reason</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[#5E6660]">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <FileSearch className="w-10 h-10 text-violet-300 mb-2" />
                      <p className="font-bold text-sm text-[#1F2421]">
                        {searchTerm
                          ? 'No properties matching search'
                          : 'No properties currently in Needs Skiptracing/Deepdive'}
                      </p>
                      <p className="text-xs text-[#5E6660] mt-1 mb-4 text-center">
                        Manually add properties requiring skip-tracing, or bulk import a list directly into this group.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsManualAddOpen(true)}
                          className="px-3 py-1.5 bg-violet-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          + Add Property
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenBulkImport) onOpenBulkImport();
                            else setIsQuickPasteOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-[#E4E0D6] text-[#1F2421] rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Bulk Import
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isNewlyAdded =
                    lead.vaStatus === 'Newly Added' || lead.outreachStatus === 'Newly Added';
                  const isAllBad = lead.vaStatus === 'ALL NUMBERS BAD- NEEDS DEEPDIVE';

                  return (
                    <tr key={lead.id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-[#8C948E] font-semibold">
                            {lead.leadId}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenLeadDetail(lead)}
                            className="text-left font-bold text-[#1F2421] hover:text-violet-700 transition-colors cursor-pointer"
                          >
                            {lead.ownerName || 'Unknown Owner'}
                          </button>
                          <span className="text-[10px] text-[#8C948E]">
                            {lead.campaign || lead.sourceTab}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-1.5 max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-[#8C948E] shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[#1F2421] font-medium leading-tight">
                              {lead.propertyAddress}
                            </span>
                            {(lead.city || lead.zipCode) && (
                              <span className="text-[10px] text-[#8C948E]">
                                {[lead.city, lead.zipCode].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {lead.mailingAddress && (
                              <span className="text-[10px] text-[#5E6660] italic mt-0.5">
                                Mail: {lead.mailingAddress}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {lead.phoneNumbers.length === 0 ? (
                              <span className="text-[11px] text-[#8C948E] italic bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                ⚠️ Needs Skiptracing (0 numbers)
                              </span>
                            ) : (
                              lead.phoneNumbers.map((p, idx) => (
                                <div
                                  key={p.id || idx}
                                  className="inline-flex items-center gap-1 bg-[#F5F2EC] px-2 py-0.5 rounded border border-[#E4E0D6] font-mono text-[10px] text-[#5E6660]"
                                >
                                  <DialLink
                                    number={p.number}
                                    leadId={lead.id}
                                    onDial={() => onLaunchDialer(lead.id, p.number, true)}
                                    className="flex items-center gap-1 text-[#5E6660] hover:text-violet-700 transition-colors cursor-pointer no-underline"
                                    title={`Click to dial ${p.number}`}
                                  >
                                    <Phone className="w-2.5 h-2.5 text-violet-600" />
                                    <span>{p.number}</span>
                                    {p.label && (
                                      <span className="text-[9px] text-[#8C948E]">
                                        ({p.label})
                                      </span>
                                    )}
                                  </DialLink>
                                  {onDeletePhoneNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeletePhoneNumber(lead.id, p.id);
                                      }}
                                      className="p-0.5 text-[#8C948E] hover:text-red-600 rounded cursor-pointer transition-colors ml-0.5"
                                      title={`Delete number ${p.number}`}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Inline Add Number Option */}
                          {addingPhoneLeadId === lead.id ? (
                            <div className="flex items-center gap-1.5 mt-1 bg-white p-1.5 rounded border border-violet-200 shadow-2xs">
                              <input
                                type="tel"
                                placeholder="New phone #"
                                value={newNumber}
                                onChange={(e) => setNewNumber(e.target.value)}
                                className="text-xs font-mono px-2 py-1 border border-[#D5CFC4] rounded w-32 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                autoFocus
                              />
                              <select
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="text-xs px-1.5 py-1 border border-[#D5CFC4] rounded"
                              >
                                <option value="Mobile">Mobile</option>
                                <option value="Landline">Landline</option>
                                <option value="SkipTraced">SkipTraced</option>
                                <option value="Relative">Relative</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleQuickAddNumber(lead)}
                                disabled={!newNumber.trim()}
                                className="px-2 py-1 bg-violet-600 text-white rounded text-[11px] font-bold disabled:opacity-50 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingPhoneLeadId(null);
                                  setNewNumber('');
                                }}
                                className="text-[11px] text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingPhoneLeadId(lead.id);
                                setNewNumber('');
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 hover:text-violet-800 transition-colors cursor-pointer self-start"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add newly researched number</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {isNewlyAdded ? (
                            <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Newly Added</span>
                            </span>
                          ) : isAllBad ? (
                            <span className="inline-flex items-center self-start px-2 py-0.5 rounded bg-violet-100 text-violet-800 font-bold text-[10px] border border-violet-200">
                              ALL NUMBERS BAD
                            </span>
                          ) : (
                            <span className="inline-flex items-center self-start px-2 py-0.5 rounded bg-stone-100 text-stone-800 font-bold text-[10px] border border-stone-200">
                              {lead.vaStatus || 'Needs Skiptracing'}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#8C948E]">Agent:</span>
                            <VABadge va={lead.assignedVA || 'Rain'} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p
                          className="text-[#5E6660] text-xs line-clamp-2"
                          title={lead.callNotes || lead.notes || ''}
                        >
                          {lead.callNotes ||
                            lead.notes ||
                            'Properties in skiptracing queue awaiting contact enrichment.'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestoreToDialer(lead)}
                            className="px-2.5 py-1 text-xs font-bold bg-[#4A7A5E] hover:bg-[#3E654E] text-white rounded transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Restore to Cold Calling list so dialer can work new numbers"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>To Calling List</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenLeadDetail(lead)}
                            className="px-2.5 py-1 text-xs font-bold text-[#1F2421] hover:bg-[#E4E0D6]/40 border border-[#E4E0D6] rounded transition-colors cursor-pointer"
                          >
                            Details
                          </button>

                          {onDeleteLead && (
                            <button
                              type="button"
                              onClick={() => onDeleteLead(lead.id)}
                              className="p-1 text-[#8C948E] hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer ml-0.5"
                              title="Delete lead immediately"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Manually Add Property Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E4E0D6] shadow-xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-violet-50/70 border-b border-violet-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-800 flex items-center justify-center border border-violet-200">
                  <Building2 className="w-4 h-4 text-violet-700" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#1F2421]">
                    Manually Add Property
                  </h2>
                  <p className="text-xs text-[#5E6660]">
                    Add directly to <strong>Needs Skiptracing/Deepdive</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualAddOpen(false)}
                className="p-1 text-[#5E6660] hover:text-[#1F2421] rounded-lg hover:bg-white/80 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto Agent Status Notice */}
            <div className="mx-4 mt-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Auto Agent Status:</span> Newly added properties will
                automatically be assigned the status{' '}
                <strong className="underline font-black">Newly Added</strong>.
              </div>
            </div>

            <form onSubmit={handleSubmitManualProperty} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Property Address */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Property Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="e.g. 4812 Tremont St"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Owner Name */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={manualOwnerName}
                    onChange={(e) => setManualOwnerName(e.target.value)}
                    placeholder="e.g. Robert Hernandez"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    placeholder="e.g. Dallas"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Zip Code */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    value={manualZip}
                    onChange={(e) => setManualZip(e.target.value)}
                    placeholder="e.g. 75214"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* County */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    County
                  </label>
                  <input
                    type="text"
                    value={manualCounty}
                    onChange={(e) => setManualCounty(e.target.value)}
                    placeholder="e.g. Dallas County"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Mailing Address */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Mailing Address (if different)
                  </label>
                  <input
                    type="text"
                    value={manualMailing}
                    onChange={(e) => setManualMailing(e.target.value)}
                    placeholder="e.g. PO Box 8912 Plano TX 75024"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Assigned Agent & Asking Price */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Assigned Agent
                  </label>
                  <select
                    value={manualVA}
                    onChange={(e) => setManualVA(e.target.value as VA)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600 font-bold"
                  >
                    <option value="Rain">Rain</option>
                    <option value="Jah">Jah</option>
                    <option value="Jen">Jen</option>
                    <option value="David">David</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Estimated / Asking Price
                  </label>
                  <input
                    type="text"
                    value={manualAskingPrice}
                    onChange={(e) => setManualAskingPrice(e.target.value)}
                    placeholder="e.g. $185,000"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>

                {/* Known Phone Numbers (Optional) */}
                <div className="sm:col-span-2 bg-[#F8F6F1] p-3 rounded-lg border border-[#E4E0D6]">
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Known Phone Numbers (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="(214) 555-0199"
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600 font-mono"
                    />
                    <select
                      value={phoneLabelInput}
                      onChange={(e) => setPhoneLabelInput(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-white border border-[#E4E0D6] rounded-lg"
                    >
                      <option value="Mobile">Mobile</option>
                      <option value="Landline">Landline</option>
                      <option value="SkipTraced">SkipTraced</option>
                      <option value="Relative">Relative</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddManualPhone}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-violet-700"
                    >
                      Add
                    </button>
                  </div>

                  {manualPhones.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {manualPhones.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#E4E0D6] text-xs font-mono"
                        >
                          <span>{p.number}</span>
                          <span className="text-[10px] text-[#8C948E]">({p.label})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveManualPhone(idx)}
                            className="text-red-500 hover:text-red-700 ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                    Skiptracing / Research Notes
                  </label>
                  <textarea
                    rows={2}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="e.g. Heirs property, check probate filings or relatives..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E0D6]">
                <button
                  type="button"
                  onClick={() => setIsManualAddOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-2xs"
                >
                  Save to Needs Skiptracing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Fast Quick Paste Importer Modal */}
      {isQuickPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E4E0D6] shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-violet-50/70 border-b border-violet-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-800 flex items-center justify-center border border-violet-200">
                  <Upload className="w-4 h-4 text-violet-700" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#1F2421]">
                    Bulk Import Properties to Needs Skiptracing/Deepdive
                  </h2>
                  <p className="text-xs text-[#5E6660]">
                    Auto Agent Status:{' '}
                    <strong className="text-emerald-700 font-bold underline">Newly Added</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPasteOpen(false)}
                className="p-1 text-[#5E6660] hover:text-[#1F2421] rounded-lg hover:bg-white/80 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-violet-50 p-3 rounded-lg border border-violet-200 text-xs text-violet-950">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-700 shrink-0" />
                  <span>
                    Every imported property will be added with <strong>Auto Agent Status: Newly Added</strong>.
                  </span>
                </div>
                {onOpenBulkImport && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickPasteOpen(false);
                      onOpenBulkImport();
                    }}
                    className="text-xs font-bold text-violet-800 hover:text-violet-950 underline cursor-pointer"
                  >
                    Open CSV File Uploader
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1F2421] uppercase mb-1">
                  Paste Property Rows (from Excel, Google Sheets, or CSV)
                </label>
                <p className="text-[11px] text-[#5E6660] mb-2">
                  Supported columns (comma or tab-separated):{' '}
                  <code className="bg-[#F8F6F1] px-1 py-0.5 rounded text-[10px] text-violet-800 font-mono">
                    Owner Name, Property Address, City, Zip, Mailing Address, Phone
                  </code>{' '}
                  (or just paste addresses).
                </p>
                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Robert Hernandez, 4812 Tremont St, Dallas, 75214, PO Box 12 Dallas TX\nElena Rostova, 1904 Cedar Crest Blvd, Dallas, 75203\nThomas Sterling, 820 E 12th St, Dallas, 75203, 1502 N Main St Fort Worth TX`}
                  className="w-full p-3 font-mono text-xs bg-white border border-[#E4E0D6] rounded-lg focus:outline-none focus:border-violet-600 placeholder:text-[#8C948E]"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1F2421]">Assign Agent:</span>
                  <select
                    value={quickPasteVA}
                    onChange={(e) => setQuickPasteVA(e.target.value as VA)}
                    className="px-2.5 py-1 text-xs bg-white border border-[#E4E0D6] rounded font-bold"
                  >
                    <option value="Rain">Rain</option>
                    <option value="Jah">Jah</option>
                    <option value="Jen">Jen</option>
                    <option value="David">David</option>
                  </select>
                </div>

                {pasteFeedback && (
                  <span className="text-xs text-red-600 font-semibold">{pasteFeedback}</span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#E4E0D6]">
                <button
                  type="button"
                  onClick={() =>
                    setPasteContent(
                      `Arthur Pendelton, 742 Evergreen Terrace, Dallas, 75201, 742 Evergreen Terrace Dallas TX\nBrenda Vance, 1209 Oak Ridge Lane, Dallas, 75208, 401 Wilshire Blvd Santa Monica CA\nCarlos Gutierrez, 3318 Pecan Blvd, Dallas, 75216, 3318 Pecan Blvd Dallas TX`
                    )
                  }
                  className="text-xs text-violet-700 hover:text-violet-900 font-bold underline cursor-pointer"
                >
                  Load Sample Data
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickPasteOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-[#5E6660] hover:text-[#1F2421] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessQuickPaste}
                    className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-2xs"
                  >
                    Import Properties (Auto &apos;Newly Added&apos;)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export alias to support either component naming smoothly
export { NeedsDeepdiveView as NeedsSkiptracingView };
