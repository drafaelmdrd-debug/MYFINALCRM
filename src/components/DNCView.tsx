import React from 'react';
import { Lead } from '../types';
import { ShieldAlert, RotateCcw, MapPin, Phone, User, ExternalLink, Trash2 } from 'lucide-react';
import { VABadge } from './VABadge';

interface DNCViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onMoveLead: (lead: Lead, targetStage: string) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export function DNCView({
  leads,
  onOpenLeadDetail,
  onMoveLead,
  onLaunchDialer,
  onDeleteLead,
  onDeletePhoneNumber,
}: DNCViewProps) {
  const dncLeads = leads.filter((l) => l.stageId === 'DNC');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-800 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-[#1F2421] tracking-tight">Do Not Call (DNC) Registry</h1>
          </div>
          <p className="text-xs text-[#5E6660] mt-1">
            Protected registry of opt-out homeowners, sold properties, or hostile contacts excluded from dialers.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#F8F6F1] border-b border-[#E4E0D6] flex items-center justify-between">
          <span className="text-xs font-bold text-[#1F2421]">
            Total DNC Leads: <strong className="font-mono text-red-600">{dncLeads.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFFFFF] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4">Owner & Address</th>
                <th className="py-3 px-4">Phone Numbers</th>
                <th className="py-3 px-4">Date Added to DNC</th>
                <th className="py-3 px-4">Marked By</th>
                <th className="py-3 px-4">Dispo Reason / Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {dncLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#5E6660]">
                    No leads currently marked as Do Not Call.
                  </td>
                </tr>
              ) : (
                dncLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8F6F1]/60 transition-colors">
                    <td className="py-3.5 px-4">
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

                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#5E6660]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {lead.phoneNumbers.length === 0 ? (
                          <span>No phone</span>
                        ) : (
                          lead.phoneNumbers.map((p, idx) => (
                            <div
                              key={p.id || idx}
                              className="inline-flex items-center gap-1 bg-[#F5F2EC] px-1.5 py-0.5 rounded border border-[#E4E0D6]"
                            >
                              <span>{p.number}</span>
                              {onDeletePhoneNumber && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePhoneNumber(lead.id, p.id);
                                  }}
                                  className="p-0.5 text-[#8C948E] hover:text-red-600 rounded cursor-pointer transition-colors"
                                  title={`Delete number ${p.number}`}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#5E6660]">
                      {lead.dateAddedToDNC || lead.lastCallDate || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <VABadge va={lead.markedBy || lead.assignedVA} />
                    </td>

                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="text-[11px] text-[#1F2421] line-clamp-2">
                        {lead.callNotes || lead.vaNotes || 'Marked as DNC'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onMoveLead(lead, lead.sourceTab || 'Dallas')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#4A7A5E] hover:bg-[#4A7A5E]/10 rounded border border-[#4A7A5E]/30 transition-colors cursor-pointer"
                          title="Remove from DNC and return to Calling List"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        {onDeleteLead && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteLead(lead.id);
                            }}
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
