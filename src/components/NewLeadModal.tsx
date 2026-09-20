import React, { useState } from 'react';
import { X, Plus, User, MapPin, Phone, DollarSign, Layers, Kanban, CheckCircle2 } from 'lucide-react';
import { Lead, VA, StageId, SourceTabId } from '../types';
import { routeLead } from '../logic/moveEngine';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: string[];
  onAddNewCampaign?: (name: string) => void;
  onAddLead: (newLead: Lead) => void;
}

type LeadDestination = 'existing_campaign' | 'new_campaign' | 'deal_pipeline';

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
  'Follow-Up',
];

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  onAddNewCampaign,
  onAddLead,
}) => {
  if (!isOpen) return null;

  const [destination, setDestination] = useState<LeadDestination>('existing_campaign');
  const [selectedCampaign, setSelectedCampaign] = useState<string>(
    campaigns[0] || 'Dallas Tax Delinquent'
  );
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [pipelineStage, setPipelineStage] = useState<'Project Mgmt' | 'Follow-Up'>('Project Mgmt');
  const [pipelineStatus, setPipelineStatus] = useState<string>('Interested');

  const [ownerName, setOwnerName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [city, setCity] = useState('Dallas');
  const [zipCode, setZipCode] = useState('75216');
  const [mailingAddress, setMailingAddress] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [assignedVA, setAssignedVA] = useState<VA>('Rain');
  const [askingPrice, setAskingPrice] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !propertyAddress.trim()) return;

    let finalCampaign = selectedCampaign;
    let targetStage: StageId = 'Dallas';
    let targetStatus = 'Not Dialed';

    if (destination === 'new_campaign') {
      const clean = newCampaignName.trim();
      if (!clean) return;
      finalCampaign = clean;
      targetStage = 'Dallas';
      if (onAddNewCampaign) {
        onAddNewCampaign(clean);
      }
    } else if (destination === 'existing_campaign') {
      finalCampaign = selectedCampaign;
      targetStage = 'Dallas';
    } else if (destination === 'deal_pipeline') {
      targetStage = pipelineStage;
      targetStatus = pipelineStatus;
      finalCampaign = 'Deal Pipeline Ingestion';
    }

    const phoneNumbers = [];
    if (phone1.trim()) {
      phoneNumbers.push({
        id: `p-${Date.now()}-1`,
        number: phone1.trim(),
        label: 'Mobile (Primary)',
      });
    }
    if (phone2.trim()) {
      phoneNumbers.push({
        id: `p-${Date.now()}-2`,
        number: phone2.trim(),
        label: 'Alt Contact',
      });
    }

    const baseLead: Lead = {
      id: `lead-${Date.now()}`,
      leadId: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerName: ownerName.trim(),
      propertyAddress: propertyAddress.trim(),
      city: city.trim(),
      zipCode: zipCode.trim(),
      mailingAddress: mailingAddress.trim() || undefined,
      phoneNumbers,
      campaign: finalCampaign,
      stageId: targetStage,
      sourceTab: (finalCampaign.slice(0, 20) as SourceTabId) || 'Dallas',
      assignedVA,
      vaStatus: targetStatus,
      outreachStatus: destination === 'deal_pipeline' ? targetStatus : 'Not yet dialed',
      callsCount: 0,
      callNotes: notes.trim(),
      askingPrice: askingPrice.trim() || undefined,
      dateAdded: new Date().toISOString(),
    };

    if (destination === 'deal_pipeline') {
      const routingResult = routeLead(baseLead, targetStatus);
      onAddLead(routingResult.updatedLead);
    } else {
      onAddLead(baseLead);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E4E0D6] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#B85338]/15 text-[#B85338] flex items-center justify-center font-bold">
              <Plus className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2421]">Add New Lead</h2>
              <p className="text-[11px] text-[#5E6660]">
                Add to an existing campaign, create a new campaign, or add to Deal Pipeline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-[#E4E0D6] hover:bg-[#F8F6F1] flex items-center justify-center text-[#5E6660]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Destination Selector */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-[#5E6660] uppercase">
              Target Destination
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDestination('existing_campaign')}
                className={`px-2.5 py-1.5 rounded-md border text-center font-semibold transition-all ${
                  destination === 'existing_campaign'
                    ? 'border-[#B85338] bg-[#FDFBF7] text-[#B85338]'
                    : 'border-[#E4E0D6] bg-white text-[#5E6660] hover:bg-[#F8F6F1]'
                }`}
              >
                Campaign
              </button>
              <button
                type="button"
                onClick={() => setDestination('new_campaign')}
                className={`px-2.5 py-1.5 rounded-md border text-center font-semibold transition-all ${
                  destination === 'new_campaign'
                    ? 'border-[#B85338] bg-[#FDFBF7] text-[#B85338]'
                    : 'border-[#E4E0D6] bg-white text-[#5E6660] hover:bg-[#F8F6F1]'
                }`}
              >
                + New Campaign
              </button>
              <button
                type="button"
                onClick={() => setDestination('deal_pipeline')}
                className={`px-2.5 py-1.5 rounded-md border text-center font-semibold transition-all ${
                  destination === 'deal_pipeline'
                    ? 'border-[#B85338] bg-[#FDFBF7] text-[#B85338]'
                    : 'border-[#E4E0D6] bg-white text-[#5E6660] hover:bg-[#F8F6F1]'
                }`}
              >
                Deal Pipeline
              </button>
            </div>

            {/* Contextual Destination Fields */}
            {destination === 'existing_campaign' && (
              <div>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
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
              <div>
                <input
                  type="text"
                  required
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Enter new campaign name (e.g. Collin County Absentee)"
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs text-[#1F2421] outline-none focus:border-[#B85338]"
                />
              </div>
            )}

            {destination === 'deal_pipeline' && (
              <div className="grid grid-cols-2 gap-2 bg-[#F8F6F1] p-2.5 rounded border border-[#E4E0D6]">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">
                    Stage
                  </label>
                  <select
                    value={pipelineStage}
                    onChange={(e) => {
                      const st = e.target.value as 'Project Mgmt' | 'Follow-Up';
                      setPipelineStage(st);
                      setPipelineStatus(st === 'Project Mgmt' ? 'Interested' : 'Follow-Up');
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs font-semibold text-[#1F2421] outline-none"
                  >
                    <option value="Project Mgmt">Project Mgmt</option>
                    <option value="Follow-Up">Follow Up</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-0.5">
                    Status
                  </label>
                  <select
                    value={pipelineStatus}
                    onChange={(e) => setPipelineStatus(e.target.value)}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs font-semibold text-[#1F2421] outline-none"
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

          {/* Owner & Address */}
          <div className="space-y-3 pt-1 border-t border-[#E4E0D6]">
            <div>
              <label className="block text-[11px] font-bold text-[#5E6660] uppercase mb-1">
                Owner Name *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Marcus Whitfield"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md px-3 py-1.5 outline-none font-semibold text-[#1F2421]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5E6660] uppercase mb-1">
                Property Address *
              </label>
              <input
                type="text"
                required
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="e.g. 4118 Rutledge St"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md px-3 py-1.5 outline-none font-semibold text-[#1F2421]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 outline-none font-semibold text-[#1F2421]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                  Zip Code
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 outline-none font-semibold text-[#1F2421]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                Mailing Address (Optional / Absentee Owner)
              </label>
              <input
                type="text"
                value={mailingAddress}
                onChange={(e) => setMailingAddress(e.target.value)}
                placeholder="e.g. 1042 Absentee Way, Suite 300, Plano, TX 75024 (Leave blank if same as property)"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:bg-white focus:border-[#B85338] rounded-md px-3 py-1.5 outline-none font-semibold text-[#1F2421]"
              />
            </div>
          </div>

          {/* Phones */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                Phone 1 (Primary)
              </label>
              <input
                type="text"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder="(214) 779-0802"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 outline-none font-mono text-xs font-semibold text-[#1F2421]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                Phone 2 (Alt)
              </label>
              <input
                type="text"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="(214) 555-0189"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 outline-none font-mono text-xs font-semibold text-[#1F2421]"
              />
            </div>
          </div>

          {/* VA Assignment & Asking Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                Assigned VA
              </label>
              <select
                value={assignedVA}
                onChange={(e) => setAssignedVA(e.target.value as VA)}
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
                Asking Price
              </label>
              <input
                type="text"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="e.g. $190,000"
                className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 outline-none font-mono text-xs font-semibold text-[#1F2421]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
              Initial Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Initial lead source background or notes..."
              className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded p-2 text-xs outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E0D6]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md border border-[#E4E0D6] hover:bg-[#F8F6F1] text-[#5E6660] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md bg-[#B85338] hover:bg-[#A34730] text-white font-semibold shadow-xs"
            >
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
