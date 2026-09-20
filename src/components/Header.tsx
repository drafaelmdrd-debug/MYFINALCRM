import React from 'react';
import { Search, Plus, Upload, Download, Building2, PhoneCall, LogOut } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenNewLead: () => void;
  onOpenImport: () => void;
  onOpenExport?: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onOpenNewLead,
  onOpenImport,
  onOpenExport,
  userEmail,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="h-16 bg-[#FFFFFF] border-b border-[#E4E0D6] px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#B85338] text-white flex items-center justify-center shadow-xs">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-[#1F2421]">
              GroundWork
            </span>
            <span className="text-[10px] font-mono font-bold bg-[#B85338]/10 text-[#B85338] px-1.5 py-0.5 rounded">
              CRM
            </span>
          </div>
          <p className="text-[11px] text-[#5E6660]">Real Estate Lead Pipeline & Power Dialer</p>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-lg mx-4">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#5E6660] absolute left-3 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads by owner, address, phone number, campaign..."
            className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] focus:bg-white text-xs text-[#1F2421] placeholder-[#5E6660]/70 rounded-lg pl-9 pr-4 py-2 outline-none transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 text-xs text-[#5E6660] hover:text-[#1F2421]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          id="btn-import-leads"
          type="button"
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-[#5E6660]" />
          <span>Import Leads</span>
        </button>

        {onOpenExport && (
          <button
            id="btn-export-leads"
            type="button"
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#5E6660]" />
            <span>Export Leads</span>
          </button>
        )}

        <button
          id="btn-new-lead"
          type="button"
          onClick={onOpenNewLead}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#B85338] hover:bg-[#A0452E] rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Lead</span>
        </button>

        {onSignOut && (
          <div className="flex items-center gap-2 pl-2.5 ml-1 border-l border-[#E4E0D6]">
            {userEmail && (
              <span className="text-[11px] text-[#5E6660] max-w-[140px] truncate hidden lg:inline">
                {userEmail}
              </span>
            )}
            <button
              id="btn-sign-out"
              type="button"
              onClick={onSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-[#5E6660] hover:text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
