import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Phone,
  Clock,
  Calendar,
  DollarSign,
  User,
  Layers,
  ArrowRight,
  Send,
  Home,
  AlertCircle,
  FileText,
  Building,
} from 'lucide-react';
import { Lead, VA, StageId } from '../types';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';
import { appendTimestampedNote, calculateAutomatedDate } from '../logic/moveEngine';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onStatusChange: (lead: Lead, newStatus: string) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  onLaunchDialer,
  onStatusChange,
}) => {
  if (!isOpen || !lead) return null;

  const [newNoteInput, setNewNoteInput] = useState('');
  const [askingPrice, setAskingPrice] = useState(lead.askingPrice || '');
  const [startingOffer, setStartingOffer] = useState(lead.startingOffer || '');
  const [maxOffer, setMaxOffer] = useState(lead.maxOffer || '');
  const [counterOffer, setCounterOffer] = useState(lead.counterOffer || '');
  const [callbackDate, setCallbackDate] = useState(lead.callbackDate || lead.followUpDate || '');
  const [assignedVA, setAssignedVA] = useState<VA>(lead.assignedVA);
  const [taskAssignedTo, setTaskAssignedTo] = useState<VA>(lead.taskAssignedTo || lead.assignedVA || 'Rain');

  useEffect(() => {
    setAskingPrice(lead.askingPrice || '');
    setStartingOffer(lead.startingOffer || '');
    setMaxOffer(lead.maxOffer || '');
    setCounterOffer(lead.counterOffer || '');
    setCallbackDate(lead.callbackDate || lead.followUpDate || '');
    setAssignedVA(lead.assignedVA);
    setTaskAssignedTo(lead.taskAssignedTo || lead.assignedVA || 'Rain');
  }, [lead.id]);

  const handleAppendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    const updatedNotes = appendTimestampedNote(lead.callNotes || lead.vaNotes || '', newNoteInput);
    const updatedLead: Lead = {
      ...lead,
      callNotes: updatedNotes,
      vaNotes: updatedNotes,
    };
    onUpdateLead(updatedLead);
    setNewNoteInput('');
  };

  const handleSaveFinancials = () => {
    const updatedLead: Lead = {
      ...lead,
      askingPrice,
      startingOffer,
      maxOffer,
      counterOffer,
      callbackDate: lead.stageId === 'Project Mgmt' ? callbackDate : lead.callbackDate,
      followUpDate: lead.stageId === 'Follow-Up' ? callbackDate : lead.followUpDate,
      assignedVA,
      taskAssignedTo,
    };
    onUpdateLead(updatedLead);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-[#FFFFFF] border-l border-[#E4E0D6] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E4E0D6] bg-[#FDFBF7] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#E4E0D6]/60 text-[#1F2421]">
                  {lead.leadId}
                </span>
                <span className="text-xs font-bold text-[#B85338]">
                  {lead.campaign}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#1F2421] mt-1">
                {lead.ownerName}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <DialLink
                number={lead.phoneNumbers[0]?.number}
                leadId={lead.id}
                onDial={() => onLaunchDialer(lead.id, lead.phoneNumbers[0]?.number, true)}
                onNoNumber={() => onLaunchDialer(lead.id, undefined, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#B85338] hover:bg-[#A34730] text-white text-xs font-bold shadow-xs transition-colors no-underline cursor-pointer"
                title="Open in Dialer & Call"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Open in Dialer</span>
              </DialLink>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-md border border-[#E4E0D6] hover:bg-[#F8F6F1] flex items-center justify-center text-[#5E6660] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {/* Stage Progression & Status Bar */}
            <div className="bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider">
                  Stage Progression & Move Engine
                </span>
                <span className="text-[11px] font-mono text-[#365B6D] font-bold">
                  Current: {lead.stageId}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1F2421] mb-1">
                  Change Lead Status (Auto-routes stage & dates)
                </label>
                <select
                  value={lead.davidStatus || lead.vaFollowUpStatus || lead.vaStatus}
                  onChange={(e) => onStatusChange(lead, e.target.value)}
                  className="w-full bg-white border border-[#E4E0D6] hover:border-[#B85338] focus:border-[#B85338] rounded-md px-3 py-2 text-xs font-semibold text-[#1F2421] outline-none cursor-pointer"
                >
                  <optgroup label="Project Mgmt (Active Acquisitions)">
                    <option value="Interested">Interested</option>
                    <option value="Interested - Has Asking Price">Interested - Has Asking Price</option>
                    <option value="For Comps">For Comps</option>
                    <option value="For Offer">For Offer</option>
                    <option value="Offer Made">Offer Made</option>
                    <option value="Negotiating">Negotiating</option>
                    <option value="Asking too High">Asking too High (+20 days)</option>
                    <option value="Callback - Tomorrow">Callback - Tomorrow</option>
                    <option value="Comps Needed">Comps Needed (+1 day)</option>
                    <option value="Appointment In person">Appointment In person</option>
                    <option value="Accepted Offer">Accepted Offer</option>
                    <option value="Contract Sent">Contract Sent</option>
                    <option value="Deal Won">Deal Won</option>
                  </optgroup>
                  <optgroup label="Follow-Up (Nurture Timers)">
                    <option value="Listed">Listed on MLS (+30 days)</option>
                    <option value="Not Interested - 30 Days">Not Interested - 30 Days</option>
                    <option value="Not Interested - 60 Days">Not Interested - 60 Days</option>
                    <option value="Not Interested - 90 Days">Not Interested - 90 Days</option>
                    <option value="Not Ready to Sell - 30 Days">Not Ready to Sell - 30 Days</option>
                    <option value="Not Ready to Sell - 60 Days">Not Ready to Sell - 60 Days</option>
                    <option value="Not Ready to Sell - 90 Days">Not Ready to Sell - 90 Days</option>
                  </optgroup>
                  <optgroup label="Routing Exceptions">
                    <option value="Spanish Speaker">Spanish Speaker (Language Barrier)</option>
                    <option value="Language Barrier">Language Barrier</option>
                    <option value="DNC">DNC (Do Not Call)</option>
                    <option value="Sold Already">Sold Already</option>
                    <option value="Ugly Property">Ugly Property</option>
                    <option value="Unresponsive">Unresponsive (Never moves)</option>
                  </optgroup>
                  <optgroup label="Outreach & Campaigns">
                    <option value="Restore to Calling List">↩ Return to Cold Calling List</option>
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Assigned VA
                  </label>
                  <select
                    value={assignedVA}
                    onChange={(e) => {
                      setAssignedVA(e.target.value as VA);
                      onUpdateLead({ ...lead, assignedVA: e.target.value as VA });
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  >
                    <option value="Rain">Rain (Cobalt)</option>
                    <option value="Jah">Jah (Amber)</option>
                    <option value="Jen">Jen (Coral)</option>
                    <option value="David">David (Violet)</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Task / Callback Due Date
                  </label>
                  <input
                    type="date"
                    value={callbackDate}
                    onChange={(e) => {
                      setCallbackDate(e.target.value);
                      if (lead.stageId === 'Project Mgmt') {
                        onUpdateLead({ ...lead, callbackDate: e.target.value });
                      } else {
                        onUpdateLead({ ...lead, followUpDate: e.target.value });
                      }
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-mono text-[#1F2421] outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Task should be completed by
                  </label>
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => {
                      const newVA = e.target.value as VA;
                      setTaskAssignedTo(newVA);
                      onUpdateLead({ ...lead, taskAssignedTo: newVA });
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none cursor-pointer"
                  >
                    <option value="Rain">Rain</option>
                    <option value="Jah">Jah</option>
                    <option value="Jen">Jen</option>
                    <option value="David">David</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Property Attributes */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-3 bg-white">
              <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-[#B85338]" />
                <span>Property Attributes & Location</span>
              </div>

              <div className="text-sm font-semibold text-[#1F2421]">
                {lead.propertyAddress}, {lead.city} {lead.zipCode}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-[#F8F6F1] p-2 rounded">
                  <div className="text-[10px] text-[#5E6660]">Bed / Bath</div>
                  <div className="font-mono font-bold text-xs">
                    {lead.propertyDetails?.beds || '3'} bd / {lead.propertyDetails?.baths || '2'} ba
                  </div>
                </div>

                <div className="bg-[#F8F6F1] p-2 rounded">
                  <div className="text-[10px] text-[#5E6660]">Square Feet</div>
                  <div className="font-mono font-bold text-xs">
                    {lead.propertyDetails?.sqft ? `${lead.propertyDetails.sqft.toLocaleString()} sqft` : '1,350 sqft'}
                  </div>
                </div>

                <div className="bg-[#F8F6F1] p-2 rounded">
                  <div className="text-[10px] text-[#5E6660]">Est. Market Value</div>
                  <div className="font-mono font-bold text-xs text-[#4A7A5E]">
                    {lead.propertyDetails?.estimatedValue || '$195,000'}
                  </div>
                </div>
              </div>

              {lead.propertyDetails?.taxDelinquentAmount && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Tax Delinquency Owed: <strong className="font-mono">{lead.propertyDetails.taxDelinquentAmount}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Phone Records */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-2.5 bg-white">
              <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center justify-between">
                <span>Associated Phone Records ({lead.phoneNumbers.length})</span>
                <span className="text-[10px] font-normal text-[#5E6660]">
                  Columns J/K dialer targets
                </span>
              </div>

              <div className="space-y-1.5">
                {lead.phoneNumbers.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="flex items-center justify-between p-2.5 rounded bg-[#F8F6F1] border border-[#E4E0D6]"
                  >
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#B85338]" />
                      <span className="font-mono font-bold text-xs text-[#1F2421]">
                        {p.number}
                      </span>
                      <span className="text-[10px] text-[#5E6660]">
                        ({p.label})
                      </span>
                      {p.lastDispo && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold ml-1">
                          {p.lastDispo}
                        </span>
                      )}
                    </div>

                    <DialLink
                      number={p.number}
                      leadId={lead.id}
                      onDial={() => onLaunchDialer(lead.id, p.number, true)}
                      onNoNumber={() => onLaunchDialer(lead.id, undefined, false)}
                      className="px-2.5 py-1 rounded bg-white hover:bg-gray-100 border border-[#E4E0D6] text-[11px] font-semibold text-[#1F2421] cursor-pointer no-underline flex items-center gap-1"
                      title={`Click to dial ${p.number}`}
                    >
                      <span>Dial 📞</span>
                    </DialLink>
                  </div>
                ))}
              </div>
            </div>

            {/* Offer Calculator / Details */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#4A7A5E]" />
                  <span>Offer Negotiation Matrix (Project Mgmt Columns I, L, M, N)</span>
                </span>
                <button
                  type="button"
                  onClick={handleSaveFinancials}
                  className="text-[11px] font-bold text-[#4A7A5E] hover:underline"
                >
                  Save Amounts
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-[10px] font-sans font-bold text-[#5E6660] uppercase mb-1">
                    Asking Price (Col I)
                  </label>
                  <input
                    type="text"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    placeholder="$175,000"
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-[#5E6660] uppercase mb-1">
                    Starting Offer (Col L)
                  </label>
                  <input
                    type="text"
                    value={startingOffer}
                    onChange={(e) => setStartingOffer(e.target.value)}
                    placeholder="$120,000"
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-[#5E6660] uppercase mb-1">
                    Max Offer (Col M)
                  </label>
                  <input
                    type="text"
                    value={maxOffer}
                    onChange={(e) => setMaxOffer(e.target.value)}
                    placeholder="$145,000"
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-bold text-[#5E6660] uppercase mb-1">
                    Counter Offer (Col N)
                  </label>
                  <input
                    type="text"
                    value={counterOffer}
                    onChange={(e) => setCounterOffer(e.target.value)}
                    placeholder="$155,000"
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Chronological Notes History & Note Appender */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-3 bg-white">
              <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center justify-between">
                <span>Timestamped Note Trail</span>
                <span className="text-[10px] text-[#5E6660]">
                  New lines auto-date prefixed (MM/dd/yy)
                </span>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAppendNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={newNoteInput}
                  onChange={(e) => setNewNoteInput(e.target.value)}
                  placeholder="Type updates or conversation details..."
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md p-2.5 text-xs text-[#1F2421] outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNoteInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A7A5E] hover:bg-[#3E654E] disabled:opacity-40 text-white rounded text-xs font-bold transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>Append Note</span>
                  </button>
                </div>
              </form>

              {/* Existing Notes Log */}
              <div className="p-3 bg-[#F8F6F1] rounded border border-[#E4E0D6] max-h-48 overflow-y-auto whitespace-pre-line font-mono text-[11px] text-[#1F2421] leading-relaxed">
                {lead.callNotes || lead.vaNotes || 'No previous note entries found for this record.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
