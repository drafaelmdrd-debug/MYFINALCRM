import React from 'react';
import { Lead, VA } from '../types';
import { Languages, Phone, MapPin, User, ExternalLink, Trash2 } from 'lucide-react';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';

interface LanguageBarrierViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onMoveLead: (lead: Lead, targetStage: string) => void;
  onAssignVA: (lead: Lead, newVA: VA) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
  onDeleteLead?: (leadId: string) => void;
  onDeletePhoneNumber?: (leadId: string, phoneId: string) => void;
}

export function LanguageBarrierView({
  leads,
  onOpenLeadDetail,
  onMoveLead,
  onAssignVA,
  onLaunchDialer,
  onDeleteLead,
  onDeletePhoneNumber,
}: LanguageBarrierViewProps) {
  const languageLeads = leads.filter((l) => l.stageId === 'Language Barrier');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <Languages className="w-5 h-5 text-blue-700" />
            </div>
            <h1 className="text-2xl font-black text-[#1F2421] tracking-tight">
              Language Barrier Leads (Spanish / Non-English)
            </h1>
          </div>
          <p className="text-xs text-[#5E6660] mt-1">
            Homeowners requiring bilingual outreach or translation support.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#F8F6F1] border-b border-[#E4E0D6] flex items-center justify-between">
          <span className="text-xs font-bold text-[#1F2421]">
            Active Language Barrier Leads: <strong className="font-mono text-blue-700">{languageLeads.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FFFFFF] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4">Owner & Address</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Assigned Bilingual VA</th>
                <th className="py-3 px-4">Phone Numbers / Call</th>
                <th className="py-3 px-4">Conversation Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {languageLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#5E6660]">
                    No leads currently designated under Language Barrier.
                  </td>
                </tr>
              ) : (
                languageLeads.map((lead) => (
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

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                        {lead.languageType || 'Spanish'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <VABadge va={lead.assignedVA} />
                        <select
                          value={lead.assignedVA}
                          onChange={(e) => onAssignVA(lead, e.target.value as VA)}
                          className="text-[11px] font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="Rain">Rain</option>
                          <option value="Jah">Jah</option>
                          <option value="Jen">Jen</option>
                          <option value="David">David</option>
                          <option value="Unassigned">Unassigned</option>
                        </select>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {lead.phoneNumbers.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="inline-flex items-center gap-1 bg-[#4A7A5E] text-white px-2 py-0.5 rounded font-mono text-[10px]"
                          >
                            <DialLink
                              number={p.number}
                              leadId={lead.id}
                              onDial={() => onLaunchDialer(lead.id, p.number, true)}
                              className="flex items-center gap-1 text-white hover:text-white/80 transition-colors cursor-pointer no-underline"
                              title={`Click to dial ${p.number}`}
                            >
                              <Phone className="w-2.5 h-2.5 fill-white" />
                              <span>{p.number}</span>
                            </DialLink>
                            {onDeletePhoneNumber && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeletePhoneNumber(lead.id, p.id);
                                }}
                                className="p-0.5 hover:text-red-200 cursor-pointer transition-colors ml-0.5"
                                title={`Delete number ${p.number}`}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="text-[11px] text-[#1F2421] line-clamp-2">
                        {lead.callNotes || lead.vaNotes || 'No notes yet'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onMoveLead(lead, 'Project Mgmt')}
                          className="px-2.5 py-1 text-xs font-bold text-[#B85338] hover:bg-[#B85338]/10 rounded border border-[#B85338]/30 transition-colors cursor-pointer"
                        >
                          To Project Mgmt
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
