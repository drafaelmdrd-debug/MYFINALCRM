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
  Users,
  UserCheck,
  Mail,
  Check,
  Edit2,
  Trash2,
  Plus,
  Save,
} from 'lucide-react';
import { Lead, VA, StageId, PhoneNumberRecord } from '../types';
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
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  onLaunchDialer,
  onStatusChange,
  onDeleteLead,
  onDeletePhoneNumber,
}) => {
  if (!isOpen || !lead) return null;

  const [newNoteInput, setNewNoteInput] = useState('');
  const [askingPrice, setAskingPrice] = useState(lead.askingPrice || '');
  const [startingOffer, setStartingOffer] = useState(lead.startingOffer || '');
  const [maxOffer, setMaxOffer] = useState(lead.maxOffer || '');
  const [counterOffer, setCounterOffer] = useState(lead.counterOffer || '');
  const [mailingAddress, setMailingAddress] = useState(lead.mailingAddress || '');
  const [callbackDate, setCallbackDate] = useState(lead.callbackDate || lead.followUpDate || '');
  const [assignedVA, setAssignedVA] = useState<VA>(lead.assignedVA);
  const [taskAssignedTo, setTaskAssignedTo] = useState<VA>(lead.taskAssignedTo || lead.assignedVA || 'Rain');

  // Manual Editing States
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [ownerNameInput, setOwnerNameInput] = useState(lead.ownerName || '');

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [propAddress, setPropAddress] = useState(lead.propertyAddress || '');
  const [propCity, setPropCity] = useState(lead.city || '');
  const [propState, setPropState] = useState(lead.state || 'TX');
  const [propZip, setPropZip] = useState(lead.zipCode || '');
  const [propCounty, setPropCounty] = useState(lead.county || '');

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [bedsInput, setBedsInput] = useState(lead.propertyDetails?.beds?.toString() || '3');
  const [bathsInput, setBathsInput] = useState(lead.propertyDetails?.baths?.toString() || '2');
  const [sqftInput, setSqftInput] = useState(lead.propertyDetails?.sqft?.toString() || '1350');
  const [estValueInput, setEstValueInput] = useState(lead.propertyDetails?.estimatedValue || '$195,000');
  const [taxDelinquentInput, setTaxDelinquentInput] = useState(lead.propertyDetails?.taxDelinquentAmount || '');

  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhoneNum, setNewPhoneNum] = useState('');
  const [newPhoneLabel, setNewPhoneLabel] = useState('Owner 1 Phone 1');
  const [newPhoneContact, setNewPhoneContact] = useState(lead.ownerName || '');

  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editPhoneNum, setEditPhoneNum] = useState('');
  const [editPhoneLabel, setEditPhoneLabel] = useState('');
  const [editPhoneContact, setEditPhoneContact] = useState('');

  useEffect(() => {
    setAskingPrice(lead.askingPrice || '');
    setStartingOffer(lead.startingOffer || '');
    setMaxOffer(lead.maxOffer || '');
    setCounterOffer(lead.counterOffer || '');
    setMailingAddress(lead.mailingAddress || '');
    setCallbackDate(lead.callbackDate || lead.followUpDate || '');
    setAssignedVA(lead.assignedVA);
    setTaskAssignedTo(lead.taskAssignedTo || lead.assignedVA || 'Rain');

    setOwnerNameInput(lead.ownerName || '');
    setPropAddress(lead.propertyAddress || '');
    setPropCity(lead.city || '');
    setPropState(lead.state || 'TX');
    setPropZip(lead.zipCode || '');
    setPropCounty(lead.county || '');
    setBedsInput(lead.propertyDetails?.beds?.toString() || '3');
    setBathsInput(lead.propertyDetails?.baths?.toString() || '2');
    setSqftInput(lead.propertyDetails?.sqft?.toString() || '1350');
    setEstValueInput(lead.propertyDetails?.estimatedValue || '$195,000');
    setTaxDelinquentInput(lead.propertyDetails?.taxDelinquentAmount || '');
    setNewPhoneContact(lead.ownerName || '');
    setIsEditingOwner(false);
    setIsEditingAddress(false);
    setIsEditingDetails(false);
    setIsAddingPhone(false);
    setEditingPhoneId(null);
  }, [lead.id]);

  const handleSaveOwnerName = () => {
    if (!ownerNameInput.trim()) return;
    onUpdateLead({
      ...lead,
      ownerName: ownerNameInput.trim(),
    });
    setIsEditingOwner(false);
  };

  const handleSaveAddress = () => {
    onUpdateLead({
      ...lead,
      propertyAddress: propAddress.trim(),
      city: propCity.trim(),
      state: propState.trim(),
      zipCode: propZip.trim(),
      county: propCounty.trim(),
    });
    setIsEditingAddress(false);
  };

  const handleDeleteAddress = () => {
    if (window.confirm('Are you sure you want to delete/clear the property address?')) {
      setPropAddress('');
      setPropCity('');
      setPropZip('');
      setPropCounty('');
      onUpdateLead({
        ...lead,
        propertyAddress: '',
        city: '',
        zipCode: '',
        county: '',
      });
      setIsEditingAddress(false);
    }
  };

  const handleDeleteMailingAddress = () => {
    setMailingAddress('');
    onUpdateLead({
      ...lead,
      mailingAddress: undefined,
    });
  };

  const handleSavePropertyDetails = () => {
    onUpdateLead({
      ...lead,
      propertyDetails: {
        ...lead.propertyDetails,
        beds: bedsInput ? parseFloat(bedsInput) : undefined,
        baths: bathsInput ? parseFloat(bathsInput) : undefined,
        sqft: sqftInput ? parseInt(sqftInput, 10) : undefined,
        estimatedValue: estValueInput.trim(),
        taxDelinquentAmount: taxDelinquentInput.trim() || undefined,
      },
    });
    setIsEditingDetails(false);
  };

  const handleAddPhoneNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhoneNum.trim()) return;
    const newRecord: PhoneNumberRecord = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      number: newPhoneNum.trim(),
      label: newPhoneLabel.trim() || 'Mobile',
      contactName: newPhoneContact.trim() || lead.ownerName,
    };
    const updatedPhones = [...lead.phoneNumbers, newRecord];
    onUpdateLead({
      ...lead,
      phoneNumbers: updatedPhones,
    });
    setNewPhoneNum('');
    setIsAddingPhone(false);
  };

  const handleStartEditPhone = (p: PhoneNumberRecord) => {
    setEditingPhoneId(p.id);
    setEditPhoneNum(p.number);
    setEditPhoneLabel(p.label);
    setEditPhoneContact(p.contactName || '');
  };

  const handleSaveEditPhone = (phoneId: string) => {
    if (!editPhoneNum.trim()) return;
    const updatedPhones = lead.phoneNumbers.map((p) => {
      if (p.id === phoneId) {
        return {
          ...p,
          number: editPhoneNum.trim(),
          label: editPhoneLabel.trim() || 'Mobile',
          contactName: editPhoneContact.trim() || undefined,
        };
      }
      return p;
    });
    onUpdateLead({
      ...lead,
      phoneNumbers: updatedPhones,
    });
    setEditingPhoneId(null);
  };

  const handleDeletePhoneNumber = (phoneId: string, numberStr: string) => {
    if (onDeletePhoneNumber) {
      onDeletePhoneNumber(lead.id, phoneId);
    } else {
      const updatedPhones = lead.phoneNumbers.filter((p) => p.id !== phoneId);
      onUpdateLead({
        ...lead,
        phoneNumbers: updatedPhones,
      });
    }
  };

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
      mailingAddress: mailingAddress.trim() || undefined,
      callbackDate: lead.stageId === 'Project Mgmt' ? callbackDate : lead.callbackDate,
      followUpDate: lead.stageId === 'Follow-Up' ? callbackDate : lead.followUpDate,
      assignedVA,
      taskAssignedTo,
    };
    onUpdateLead(updatedLead);
  };

  // Auto-save the offer amounts when a box loses focus (so typed values are never lost
  // if the drawer is closed or the page refreshed before "Save Amounts" is clicked).
  const handleAutoSaveFinancials = () => {
    const changed =
      askingPrice !== (lead.askingPrice || '') ||
      startingOffer !== (lead.startingOffer || '') ||
      maxOffer !== (lead.maxOffer || '') ||
      counterOffer !== (lead.counterOffer || '');
    if (changed) handleSaveFinancials();
  };

  const handleSaveMailingAddress = () => {
    const trimmed = mailingAddress.trim();
    onUpdateLead({
      ...lead,
      mailingAddress: trimmed || undefined,
    });
  };

  const handleCopyPropertyAddressToMailing = () => {
    const fullProp = [lead.propertyAddress, lead.city, lead.zipCode].filter(Boolean).join(', ');
    setMailingAddress(fullProp);
    onUpdateLead({
      ...lead,
      mailingAddress: fullProp,
    });
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
              <div className="flex items-center gap-2 mt-1">
                {isEditingOwner ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={ownerNameInput}
                      onChange={(e) => setOwnerNameInput(e.target.value)}
                      className="bg-white border border-[#B85338] text-base font-bold text-[#1F2421] rounded px-2 py-0.5 outline-none"
                      placeholder="Primary Owner Name"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveOwnerName}
                      className="p-1.5 rounded bg-[#B85338] text-white hover:bg-[#A3432B] cursor-pointer"
                      title="Save owner name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerNameInput(lead.ownerName || '');
                        setIsEditingOwner(false);
                      }}
                      className="p-1.5 rounded bg-gray-100 text-[#5E6660] hover:bg-gray-200 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1F2421]">
                      {lead.ownerName}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsEditingOwner(true)}
                      className="p-1 text-[#8C948E] hover:text-[#B85338] hover:bg-[#F8F6F1] rounded cursor-pointer transition-colors"
                      title="Edit Owner Name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {lead.contacts && lead.contacts.length > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#B85338]/15 text-[#B85338] font-bold border border-[#B85338]/30">
                    {lead.contacts.length} Owners
                  </span>
                )}
              </div>
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

              {onDeleteLead && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteLead(lead.id);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                  title="Delete entire lead record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Lead</span>
                </button>
              )}

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

            {/* Property Attributes & Location */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-[#B85338]" />
                  <span>Property Attributes & Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(!isEditingAddress)}
                    className="text-[11px] font-bold text-[#B85338] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingAddress ? 'Close Address Edit' : 'Edit Address'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(!isEditingDetails)}
                    className="text-[11px] font-bold text-[#4A7A5E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingDetails ? 'Close Specs' : 'Edit Specs'}</span>
                  </button>
                </div>
              </div>

              {/* Property Address View or Edit Mode */}
              {isEditingAddress ? (
                <div className="p-3 bg-[#FDFBF7] border border-[#E4E0D6] rounded-md space-y-2.5">
                  <div className="text-[11px] font-bold text-[#1F2421] flex items-center justify-between">
                    <span>Edit Property Physical Address</span>
                    <button
                      type="button"
                      onClick={handleDeleteAddress}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                      title="Clear / Delete property address"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete / Clear Address</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Street Address</label>
                    <input
                      type="text"
                      value={propAddress}
                      onChange={(e) => setPropAddress(e.target.value)}
                      placeholder="e.g. 1042 Elm Street"
                      className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs text-[#1F2421] outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">City</label>
                      <input
                        type="text"
                        value={propCity}
                        onChange={(e) => setPropCity(e.target.value)}
                        placeholder="Dallas"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs text-[#1F2421] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">State</label>
                      <input
                        type="text"
                        value={propState}
                        onChange={(e) => setPropState(e.target.value)}
                        placeholder="TX"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs text-[#1F2421] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">ZIP</label>
                      <input
                        type="text"
                        value={propZip}
                        onChange={(e) => setPropZip(e.target.value)}
                        placeholder="75201"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs text-[#1F2421] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">County</label>
                    <input
                      type="text"
                      value={propCounty}
                      onChange={(e) => setPropCounty(e.target.value)}
                      placeholder="Dallas County"
                      className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs text-[#1F2421] outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPropAddress(lead.propertyAddress || '');
                        setPropCity(lead.city || '');
                        setPropState(lead.state || 'TX');
                        setPropZip(lead.zipCode || '');
                        setPropCounty(lead.county || '');
                        setIsEditingAddress(false);
                      }}
                      className="px-2.5 py-1 rounded bg-gray-100 text-[#5E6660] hover:bg-gray-200 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAddress}
                      className="px-3 py-1 bg-[#B85338] text-white rounded text-xs font-bold hover:bg-[#A3432B] flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save Address</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm font-semibold text-[#1F2421] flex items-center justify-between">
                  <span>
                    {lead.propertyAddress ? `${lead.propertyAddress}, ${lead.city || ''} ${lead.zipCode || ''}` : <span className="text-[#8C948E] italic">No physical address specified</span>}
                  </span>
                </div>
              )}

              {/* Specs View or Edit Mode */}
              {isEditingDetails ? (
                <div className="p-3 bg-[#FDFBF7] border border-[#E4E0D6] rounded-md space-y-2.5">
                  <div className="text-[11px] font-bold text-[#1F2421]">Edit Property Details</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Beds</label>
                      <input
                        type="number"
                        value={bedsInput}
                        onChange={(e) => setBedsInput(e.target.value)}
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Baths</label>
                      <input
                        type="number"
                        step="0.5"
                        value={bathsInput}
                        onChange={(e) => setBathsInput(e.target.value)}
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Sqft</label>
                      <input
                        type="number"
                        value={sqftInput}
                        onChange={(e) => setSqftInput(e.target.value)}
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Est. Market Value</label>
                      <input
                        type="text"
                        value={estValueInput}
                        onChange={(e) => setEstValueInput(e.target.value)}
                        placeholder="$195,000"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Tax Delinquent Owed</label>
                      <input
                        type="text"
                        value={taxDelinquentInput}
                        onChange={(e) => setTaxDelinquentInput(e.target.value)}
                        placeholder="$0 or $3,500"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      className="px-2.5 py-1 rounded bg-gray-100 text-[#5E6660] text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePropertyDetails}
                      className="px-3 py-1 bg-[#4A7A5E] text-white rounded text-xs font-bold hover:bg-[#3D664E] flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save Specs</span>
                    </button>
                  </div>
                </div>
              ) : (
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
              )}

              {!isEditingDetails && lead.propertyDetails?.taxDelinquentAmount && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Tax Delinquency Owed: <strong className="font-mono">{lead.propertyDetails.taxDelinquentAmount}</strong>
                  </span>
                </div>
              )}

              {/* Dedicated Mailing Address Field */}
              <div className="pt-3 border-t border-[#E4E0D6] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#B85338]" />
                    <span>Mailing Address</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {mailingAddress ? (
                      <>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            lead.propertyAddress &&
                            mailingAddress.toLowerCase().includes(lead.propertyAddress.toLowerCase().trim())
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {lead.propertyAddress &&
                          mailingAddress.toLowerCase().includes(lead.propertyAddress.toLowerCase().trim())
                            ? 'Owner-Occupied'
                            : 'Absentee Owner'}
                        </span>
                        <button
                          type="button"
                          onClick={handleDeleteMailingAddress}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                          title="Clear / Delete Mailing Address"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#8C948E] italic">Not specified</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mailingAddress}
                    onChange={(e) => setMailingAddress(e.target.value)}
                    onBlur={handleSaveMailingAddress}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveMailingAddress();
                    }}
                    placeholder="e.g. 1042 Absentee Way, Suite 300, Plano, TX 75024"
                    className="flex-1 bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] text-xs text-[#1F2421] font-medium rounded-md px-2.5 py-1.5 outline-none"
                  />
                  {!mailingAddress && (
                    <button
                      type="button"
                      onClick={handleCopyPropertyAddressToMailing}
                      className="text-[11px] font-bold text-[#B85338] hover:underline whitespace-nowrap cursor-pointer px-1"
                      title="Copy physical property address to mailing address"
                    >
                      Use Property Address
                    </button>
                  )}
                  {mailingAddress !== (lead.mailingAddress || '') && (
                    <button
                      type="button"
                      onClick={handleSaveMailingAddress}
                      className="px-2.5 py-1.5 bg-[#B85338] text-white text-xs font-bold rounded-md cursor-pointer hover:bg-[#A3432B] flex items-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Owners & Contacts (Multiple Owners Support) */}
            {lead.contacts && lead.contacts.length > 0 && (
              <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-2.5 bg-white">
                <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#B85338]" />
                    <span>Associated Owners & Contacts ({lead.contacts.length})</span>
                  </span>
                  <span className="text-[10px] font-normal text-[#5E6660]">
                    1 Property Record
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lead.contacts.map((contact, idx) => (
                    <div
                      key={contact.id || idx}
                      className="p-2.5 rounded bg-[#F8F6F1] border border-[#E4E0D6] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1F2421] flex items-center gap-1">
                          <User className="w-3 h-3 text-[#5E6660]" />
                          {contact.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8E4DA] text-[#5E6660] font-semibold">
                          {contact.role || contact.relationship || `Owner ${idx + 1}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5E6660]">
                        {contact.phoneNumbers && contact.phoneNumbers.length > 0 ? (
                          <span>{contact.phoneNumbers.length} Phone Number{contact.phoneNumbers.length > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="italic text-[#8C948E]">No phone listed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phone Records */}
            <div className="border border-[#E4E0D6] rounded-lg p-4 space-y-2.5 bg-white">
              <div className="font-bold text-[11px] text-[#5E6660] uppercase tracking-wider flex items-center justify-between">
                <span>Associated Phone Records ({lead.phoneNumbers.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPhone(!isAddingPhone);
                    setNewPhoneNum('');
                    setNewPhoneLabel(`Owner ${lead.contacts && lead.contacts.length > 1 ? '1' : '1'} Phone ${lead.phoneNumbers.length + 1}`);
                    setNewPhoneContact(lead.ownerName || '');
                  }}
                  className="text-[11px] font-bold text-[#B85338] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingPhone ? 'Cancel Adding' : '+ Add Phone Number'}</span>
                </button>
              </div>

              {/* Add Phone Number Form */}
              {isAddingPhone && (
                <form onSubmit={handleAddPhoneNumber} className="p-3 bg-[#FDFBF7] border border-[#B85338]/30 rounded-md space-y-2">
                  <div className="text-[11px] font-bold text-[#1F2421]">Add New Phone Number Record</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Phone Number *</label>
                      <input
                        type="text"
                        value={newPhoneNum}
                        onChange={(e) => setNewPhoneNum(e.target.value)}
                        placeholder="(214) 555-0199"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs font-mono outline-none"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Label</label>
                      <input
                        type="text"
                        value={newPhoneLabel}
                        onChange={(e) => setNewPhoneLabel(e.target.value)}
                        placeholder="Owner 1 Phone 2 or Mobile"
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">Contact Name</label>
                      <input
                        type="text"
                        value={newPhoneContact}
                        onChange={(e) => setNewPhoneContact(e.target.value)}
                        placeholder={lead.ownerName}
                        className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingPhone(false)}
                      className="px-2.5 py-1 rounded bg-gray-100 text-[#5E6660] text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-[#B85338] text-white rounded text-xs font-bold hover:bg-[#A3432B] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Number</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1.5">
                {lead.phoneNumbers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[#8C948E] italic bg-[#F8F6F1] rounded border border-dashed border-[#E4E0D6]">
                    No phone numbers listed. Click "+ Add Phone Number" above to add one manually.
                  </div>
                ) : (
                  lead.phoneNumbers.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-2.5 rounded bg-[#F8F6F1] border border-[#E4E0D6] transition-colors"
                    >
                      {editingPhoneId === p.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-[#5E6660] uppercase mb-0.5">Number</label>
                              <input
                                type="text"
                                value={editPhoneNum}
                                onChange={(e) => setEditPhoneNum(e.target.value)}
                                className="w-full bg-white border border-[#B85338] rounded px-2 py-1 text-xs font-mono outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[#5E6660] uppercase mb-0.5">Label</label>
                              <input
                                type="text"
                                value={editPhoneLabel}
                                onChange={(e) => setEditPhoneLabel(e.target.value)}
                                className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-[#5E6660] uppercase mb-0.5">Contact Name</label>
                              <input
                                type="text"
                                value={editPhoneContact}
                                onChange={(e) => setEditPhoneContact(e.target.value)}
                                className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPhoneId(null)}
                              className="px-2 py-0.5 rounded bg-gray-100 text-[#5E6660] text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditPhone(p.id)}
                              className="px-2.5 py-0.5 bg-[#B85338] text-white rounded text-xs font-bold hover:bg-[#A3432B] flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Phone className="w-3.5 h-3.5 text-[#B85338]" />
                            <span className="font-mono font-bold text-xs text-[#1F2421]">
                              {p.number}
                            </span>
                            <span className="text-[10px] text-[#5E6660]">
                              ({p.label}{p.contactName ? ` • ${p.contactName}` : ''})
                            </span>
                            {p.lastDispo && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold ml-1">
                                {p.lastDispo}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditPhone(p)}
                              className="p-1 rounded text-[#8C948E] hover:text-[#1F2421] hover:bg-white border border-transparent hover:border-[#E4E0D6] cursor-pointer"
                              title="Edit number details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePhoneNumber(p.id, p.number)}
                              className="p-1 rounded text-[#8C948E] hover:text-red-600 hover:bg-white border border-transparent hover:border-red-200 cursor-pointer"
                              title="Delete phone number"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <DialLink
                              number={p.number}
                              leadId={lead.id}
                              onDial={() => onLaunchDialer(lead.id, p.number, true)}
                              onNoNumber={() => onLaunchDialer(lead.id, undefined, false)}
                              className="px-2.5 py-1 rounded bg-white hover:bg-gray-100 border border-[#E4E0D6] text-[11px] font-semibold text-[#1F2421] cursor-pointer no-underline flex items-center gap-1 shrink-0 ml-1"
                              title={`Click to dial ${p.number}`}
                            >
                              <span>Dial 📞</span>
                            </DialLink>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
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
                    onBlur={handleAutoSaveFinancials}
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
                    onBlur={handleAutoSaveFinancials}
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
                    onBlur={handleAutoSaveFinancials}
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
                    onBlur={handleAutoSaveFinancials}
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

            {/* Danger Zone: Delete Entire Lead */}
            {onDeleteLead && (
              <div className="border border-red-200 bg-red-50/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs text-red-900 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Delete Entire Lead Record</span>
                  </div>
                  <div className="text-[11px] text-red-700 mt-0.5">
                    Permanently removes {lead.ownerName} ({lead.leadId}) and all associated records from the CRM.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteLead(lead.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Entire Lead</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
