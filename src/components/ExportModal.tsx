import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, Check } from 'lucide-react';
import { Lead } from '../types';
import {
  ExportGroup,
  ExportLayout,
  LIST_EXPORT_GROUPS,
  buildCampaignGroups,
  buildLeadsCsv,
  collectLeadsForGroups,
  downloadCsv,
  exportFileName,
} from '../logic/exportLeads';
import { formatDateToYYYYMMDD } from '../logic/moveEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  campaigns: string[];
  /** Group ids to pre-tick when the modal opens (e.g. the screen the user is on). */
  defaultSelected?: string[];
  onExported?: (leadCount: number, fileName: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  leads,
  campaigns,
  defaultSelected = [],
  onExported,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultSelected);
  const [layout, setLayout] = useState<ExportLayout>('per-lead');
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);

  // Reset the selection each time the modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(defaultSelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const campaignGroups = useMemo(() => buildCampaignGroups(campaigns, leads), [campaigns, leads]);
  const allGroups: ExportGroup[] = useMemo(
    () => [...LIST_EXPORT_GROUPS, ...campaignGroups],
    [campaignGroups]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    allGroups.forEach((g) => {
      map[g.id] = leads.filter(g.match).length;
    });
    return map;
  }, [allGroups, leads]);

  const selectedGroups = useMemo(
    () => allGroups.filter((g) => selectedIds.includes(g.id)),
    [allGroups, selectedIds]
  );

  const exportItems = useMemo(
    () => collectLeadsForGroups(leads, selectedGroups),
    [leads, selectedGroups]
  );
  const phoneCount = useMemo(
    () => exportItems.reduce((sum, { lead }) => sum + (lead.phoneNumbers?.length || 0), 0),
    [exportItems]
  );

  if (!isOpen) return null;

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setMany = (ids: string[], on: boolean) =>
    setSelectedIds((prev) => {
      const rest = prev.filter((x) => !ids.includes(x));
      return on ? [...rest, ...ids] : rest;
    });

  const listIds = LIST_EXPORT_GROUPS.map((g) => g.id);
  const campaignIds = campaignGroups.map((g) => g.id);

  const handleExport = () => {
    if (exportItems.length === 0) return;
    const csv = buildLeadsCsv(exportItems, { layout, includeNotes });
    const fileName = exportFileName(selectedGroups, formatDateToYYYYMMDD(new Date()));
    downloadCsv(csv, fileName);
    onExported?.(exportItems.length, fileName);
    onClose();
  };

  const renderRow = (g: ExportGroup) => {
    const checked = selectedIds.includes(g.id);
    return (
      <button
        key={g.id}
        type="button"
        onClick={() => toggle(g.id)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md border text-left transition-all cursor-pointer ${
          checked
            ? 'border-[#B85338] bg-[#FDFBF7]'
            : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              checked ? 'bg-[#B85338] border-[#B85338] text-white' : 'border-[#C9C4B8] bg-white'
            }`}
          >
            {checked && <Check className="w-3 h-3 stroke-[3]" />}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-[#1F2421] truncate">{g.label}</div>
            {g.description && (
              <div className="text-[10px] text-[#5E6660] truncate">{g.description}</div>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F2EFE8] text-[#5E6660] shrink-0">
          {counts[g.id] ?? 0}
        </span>
      </button>
    );
  };

  const renderSectionHeader = (title: string, ids: string[]) => (
    <div className="flex items-center justify-between">
      <label className="block text-[11px] font-bold text-[#5E6660] uppercase">{title}</label>
      <div className="flex items-center gap-3 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setMany(ids, true)}
          className="text-[#B85338] hover:underline cursor-pointer"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setMany(ids, false)}
          className="text-[#5E6660] hover:underline cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E4E0D6] rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#B85338]/15 text-[#B85338] flex items-center justify-center font-bold">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2421]">Export Leads</h2>
              <p className="text-[11px] text-[#5E6660]">
                Choose which groups to export. Selected groups are combined into one CSV file.
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

        <div className="space-y-5 text-xs">
          {/* Workspace lists */}
          <div className="space-y-2">
            {renderSectionHeader('Workspace Lists', listIds)}
            <div className="space-y-1.5">{LIST_EXPORT_GROUPS.map(renderRow)}</div>
          </div>

          {/* Campaigns */}
          {campaignGroups.length > 0 && (
            <div className="space-y-2">
              {renderSectionHeader('Campaigns', campaignIds)}
              <p className="text-[10px] text-[#5E6660]">
                Includes every lead tagged to the campaign, wherever it currently sits.
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {campaignGroups.map(renderRow)}
              </div>
            </div>
          )}

          {/* Format */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-[#5E6660] uppercase">
              File Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'per-lead', title: 'One row per lead', sub: 'Phone 1, Phone 2, ... in columns' },
                  { id: 'per-phone', title: 'One row per phone number', sub: 'Lead info repeated on each row' },
                ] as { id: ExportLayout; title: string; sub: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLayout(opt.id)}
                  className={`px-3 py-2 rounded-md border text-left transition-all cursor-pointer ${
                    layout === opt.id
                      ? 'border-[#B85338] bg-[#FDFBF7] text-[#B85338]'
                      : 'border-[#E4E0D6] bg-white text-[#5E6660] hover:bg-[#F8F6F1]'
                  }`}
                >
                  <div className="font-semibold">{opt.title}</div>
                  <div className="text-[10px] opacity-80">{opt.sub}</div>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 pt-1 text-[#1F2421] font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="accent-[#B85338]"
              />
              Include call notes
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E4E0D6] pt-4">
          <div className="text-[11px] text-[#5E6660]">
            {selectedGroups.length === 0 ? (
              'Select at least one group to export.'
            ) : (
              <>
                <strong className="text-[#1F2421]">{exportItems.length}</strong> unique lead
                {exportItems.length === 1 ? '' : 's'} ·{' '}
                <strong className="text-[#1F2421]">{phoneCount}</strong> phone number
                {phoneCount === 1 ? '' : 's'} · {selectedGroups.length} group
                {selectedGroups.length === 1 ? '' : 's'}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-export-confirm"
              type="button"
              onClick={handleExport}
              disabled={exportItems.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#B85338] hover:bg-[#A0452E] rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
