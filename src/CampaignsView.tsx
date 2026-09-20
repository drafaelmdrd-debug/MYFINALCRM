import React, { useState } from 'react';
import { Lead } from '../types';
import {
  Layers,
  Plus,
  Upload,
  Phone,
  User,
  MapPin,
  ExternalLink,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';

interface CampaignsViewProps {
  leads: Lead[];
  campaigns: string[];
  onAddNewCampaign: (name: string) => void;
  onOpenBulkImport: () => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export function CampaignsView({
  leads,
  campaigns,
  onAddNewCampaign,
  onOpenBulkImport,
  onOpenLeadDetail,
  onLaunchDialer,
  onDeleteLead,
  onDeletePhoneNumber,
}: CampaignsViewProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaigns[0] || 'All');
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [isAddingCampaign, setIsAddingCampaign] = useState<boolean>(false);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCampaignName.trim()) {
      onAddNewCampaign(newCampaignName.trim());
      setSelectedCampaign(newCampaignName.trim());
      setNewCampaignName('');
      setIsAddingCampaign(false);
    }
  };

  const campaignLeads = selectedCampaign === 'All'
    ? leads
    : leads.filter((l) => l.campaign === selectedCampaign);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F2421] tracking-tight">Campaigns & Lists</h1>
          <p className="text-xs text-[#5E6660] mt-1">
            Organize lists, target county delinquencies, and monitor list conversion rates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenBulkImport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#5E6660]" />
            <span>Import to Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddingCampaign(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#B85338] hover:bg-[#A0452E] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Add Campaign Inline Modal / Form */}
      {isAddingCampaign && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-white p-4 rounded-xl border border-[#B85338] shadow-sm flex items-center gap-3 animate-in fade-in duration-150"
        >
          <Layers className="w-4 h-4 text-[#B85338]" />
          <input
            type="text"
            value={newCampaignName}
            onChange={(e) => setNewCampaignName(e.target.value)}
            placeholder="Enter new campaign name (e.g. Collin County Absentee)..."
            className="flex-1 text-xs bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 outline-none font-semibold"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#4A7A5E] text-white text-xs font-bold rounded-md hover:bg-[#3E654E] cursor-pointer"
          >
            Save Campaign
          </button>
          <button
            type="button"
            onClick={() => setIsAddingCampaign(false)}
            className="px-3 py-1.5 text-xs text-[#5E6660] hover:text-[#1F2421]"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Campaigns Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setSelectedCampaign('All')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer ${
            selectedCampaign === 'All'
              ? 'bg-[#1F2421] text-white'
              : 'bg-white text-[#5E6660] border border-[#E4E0D6] hover:bg-[#F8F6F1]'
          }`}
        >
          All Campaigns ({leads.length})
        </button>

        {campaigns.map((c) => {
          const count = leads.filter((l) => l.campaign === c).length;
          const isActive = selectedCampaign === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCampaign(c)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#1F2421] text-white'
                  : 'bg-white text-[#5E6660] border border-[#E4E0D6] hover:bg-[#F8F6F1]'
              }`}
            >
              <span>{c}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Campaign Leads Table */}
      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#F8F6F1] border-b border-[#E4E0D6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#B85338]" />
            <h2 className="text-sm font-black text-[#1F2421]">
              {selectedCampaign} Leads ({campaignLeads.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFFFFF] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4">Owner & Address</th>
                <th className="py-3 px-4">Stage / Status</th>
                <th className="py-3 px-4">Assigned VA</th>
                <th className="py-3 px-4">Phone Numbers / Quick Dial</th>
                <th className="py-3 px-4">Calls Made</th>
                <th className="py-3 px-4">Last Dispo</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {campaignLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#5E6660]">
                    No leads in this campaign yet. Use "Import to Campaign" to upload CSV records.
                  </td>
                </tr>
              ) : (
                campaignLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8F6F1]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div
                        onClick={() => onOpenLeadDetail(lead)}
                        className="cursor-pointer group"
                      >
                        <div className="font-bold text-[#1F2421] group-hover:text-[#B85338] flex items-center gap-1.5">
                          <span>{lead.ownerName}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-[#5E6660] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{lead.propertyAddress}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-[11px] text-[#1F2421] block">
                        {lead.stageId}
                      </span>
                      <span className="text-[10px] text-[#5E6660]">
                        {lead.vaStatus || 'Ready'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <VABadge va={lead.assignedVA} />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {lead.phoneNumbers.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] text-[#1F2421] font-mono text-[10px]"
                          >
                            <DialLink
                              number={p.number}
                              leadId={lead.id}
                              onDial={() => onLaunchDialer(lead.id, p.number, true)}
                              className="flex items-center gap-1 text-[#1F2421] transition-colors cursor-pointer no-underline"
                              title={`Click to dial ${p.number}`}
                            >
                              <Phone className="w-2.5 h-2.5 text-[#4A7A5E]" />
                              <span>{p.number}</span>
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
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-xs text-[#1F2421]">
                      {lead.callsCount}
                    </td>

                    <td className="py-3 px-4">
                      {lead.lastDispo ? (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                          {lead.lastDispo}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#5E6660] italic">None</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenLeadDetail(lead)}
                          className="px-2.5 py-1 text-xs font-bold text-[#4A7A5E] hover:bg-[#4A7A5E]/10 rounded transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        {onDeleteLead && (
                          <button
                            type="button"
                            onClick={() => onDeleteLead(lead.id)}
                            className="p-1 text-[#8C948E] hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete entire lead immediately"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
