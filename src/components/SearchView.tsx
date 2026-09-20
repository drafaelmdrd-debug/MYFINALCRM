import React, { useState } from 'react';
import { Lead } from '../types';
import { Search, MapPin, Phone, User, ExternalLink, Filter } from 'lucide-react';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';

interface SearchViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
}

export function SearchView({
  leads,
  onOpenLeadDetail,
  onLaunchDialer,
}: SearchViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const filtered = leads.filter((l) => {
    if (stageFilter !== 'all' && l.stageId !== stageFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const phoneMatch = l.phoneNumbers.some((p) => p.number.toLowerCase().includes(q));
    return (
      l.ownerName.toLowerCase().includes(q) ||
      l.propertyAddress.toLowerCase().includes(q) ||
      l.campaign.toLowerCase().includes(q) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.callNotes && l.callNotes.toLowerCase().includes(q)) ||
      phoneMatch
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-[#1F2421] tracking-tight">Search Directory</h1>
        <p className="text-xs text-[#5E6660] mt-1">
          Instant multi-field search across property addresses, owner names, phone numbers, and notes.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E0D6] shadow-2xs flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-[#5E6660] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type owner name, street address, or phone number..."
            className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] text-xs text-[#1F2421] rounded-md pl-9 pr-3 py-2 outline-none font-semibold"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5E6660] font-semibold">Stage:</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-2.5 py-1.5 outline-none"
          >
            <option value="all">All Stages</option>
            <option value="Project Mgmt">Project Mgmt</option>
            <option value="Follow-Up">Follow-Up</option>
            <option value="Dallas">Dallas</option>
            <option value="Tarrant">Tarrant</option>
            <option value="DNC">DNC</option>
            <option value="Language Barrier">Language Barrier</option>
          </select>
        </div>

        <span className="text-xs font-bold text-[#5E6660] ml-auto">
          {filtered.length} matches found
        </span>
      </div>

      {/* Search Results Table */}
      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F6F1] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4">Owner Name</th>
                <th className="py-3 px-4">Property Address</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">Assigned VA</th>
                <th className="py-3 px-4">Phone Numbers</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#5E6660]">
                    No leads matched your search query.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8F6F1]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#1F2421]">
                      <button
                        type="button"
                        onClick={() => onOpenLeadDetail(lead)}
                        className="hover:text-[#B85338] text-left cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{lead.ownerName}</span>
                        <ExternalLink className="w-3 h-3 text-[#5E6660]" />
                      </button>
                    </td>

                    <td className="py-3 px-4 text-[#5E6660]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#5E6660] shrink-0" />
                        <span>{lead.propertyAddress}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-[#1F2421]">
                      {lead.stageId}
                    </td>

                    <td className="py-3 px-4 text-[#5E6660]">
                      {lead.campaign}
                    </td>

                    <td className="py-3 px-4">
                      <VABadge va={lead.assignedVA} />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {lead.phoneNumbers.map((p, idx) => (
                          <DialLink
                            key={p.id || idx}
                            number={p.number}
                            leadId={lead.id}
                            onDial={() => onLaunchDialer(lead.id, p.number, true)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] text-[#1F2421] font-mono text-[10px] transition-colors cursor-pointer no-underline"
                            title={`Click to dial ${p.number}`}
                          >
                            <Phone className="w-2.5 h-2.5 text-[#4A7A5E]" />
                            <span>{p.number}</span>
                          </DialLink>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenLeadDetail(lead)}
                        className="px-2.5 py-1 text-xs font-bold text-[#4A7A5E] hover:bg-[#4A7A5E]/10 rounded transition-colors cursor-pointer"
                      >
                        Open Lead
                      </button>
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
