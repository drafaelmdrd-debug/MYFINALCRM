import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Plus,
  Layers,
  Kanban,
  CheckCircle2,
  AlertCircle,
  Download,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Lead, VA, StageId, SourceTabId } from '../types';
import { routeLead } from '../logic/moveEngine';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: string[];
  onAddNewCampaign?: (name: string) => void;
  onImportLeads: (leads: Lead[]) => void;
}

type ImportDestination = 'existing_campaign' | 'new_campaign' | 'deal_pipeline';

const SAMPLE_CSV = `Owner Name,Property Address,City,Zip,Phone 1,Phone 2,Asking Price,Notes
Robert Hernandez,4812 Tremont St,Dallas,75214,(214) 555-0142,(214) 555-0199,$225000,Heir property with probate completed
Elena Rostova,1904 Cedar Crest Blvd,Dallas,75203,(214) 432-8819,,$185000,Interested in quick cash sale
Thomas Sterling,820 E 12th St,Dallas,75203,(214) 771-4091,(972) 341-9022,,Inherited 2-story duplex needs cleanout
Sarah Jenkins,3114 Peabody Ave,Dallas,75215,(214) 662-8114,,$140000,Out of state owner wants offer by Friday`;

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

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  onAddNewCampaign,
  onImportLeads,
}) => {
  if (!isOpen) return null;

  // Destination State
  const [destination, setDestination] = useState<ImportDestination>('existing_campaign');
  const [selectedCampaign, setSelectedCampaign] = useState<string>(
    campaigns[0] || 'Dallas Tax Delinquent'
  );
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [pipelineStage, setPipelineStage] = useState<'Project Mgmt' | 'Follow-Up'>('Project Mgmt');
  const [pipelineStatus, setPipelineStatus] = useState<string>('Interested');
  const [assignedVA, setAssignedVA] = useState<VA>('Rain');

  // Input Data State
  const [activeInputTab, setActiveInputTab] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV/TSV
  const parseRows = (text: string) => {
    if (!text.trim()) return [];

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    // Detect delimiter: tab or comma
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const header = parseLine(firstLine).map((h) => h.toLowerCase());

    // Check if first line is a header
    const hasHeader =
      header.some((h) => h.includes('name') || h.includes('address') || h.includes('phone')) ||
      lines.length > 1;

    const dataLines = hasHeader ? lines.slice(1) : lines;

    const colIndex = {
      name: header.findIndex((h) => h.includes('name') || h.includes('owner')),
      address: header.findIndex((h) => h.includes('address') || h.includes('street') || h.includes('prop')),
      city: header.findIndex((h) => h.includes('city')),
      zip: header.findIndex((h) => h.includes('zip') || h.includes('postal')),
      phone1: header.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('cell')),
      phone2: header.findIndex((h) => h.includes('phone 2') || h.includes('alt') || h.includes('landline')),
      price: header.findIndex((h) => h.includes('price') || h.includes('asking') || h.includes('value')),
      notes: header.findIndex((h) => h.includes('note') || h.includes('comment') || h.includes('detail')),
    };

    // Fallbacks if no header match
    if (colIndex.name === -1) colIndex.name = 0;
    if (colIndex.address === -1) colIndex.address = 1;
    if (colIndex.city === -1) colIndex.city = 2;
    if (colIndex.zip === -1) colIndex.zip = 3;
    if (colIndex.phone1 === -1) colIndex.phone1 = 4;
    if (colIndex.phone2 === -1) colIndex.phone2 = 5;
    if (colIndex.price === -1) colIndex.price = 6;
    if (colIndex.notes === -1) colIndex.notes = 7;

    const parsed: Array<{
      name: string;
      address: string;
      city: string;
      zip: string;
      phone1: string;
      phone2: string;
      price: string;
      notes: string;
    }> = [];

    dataLines.forEach((line) => {
      const cols = parseLine(line);
      if (cols.length === 0) return;

      const name = cols[colIndex.name] || '';
      const address = cols[colIndex.address] || '';
      if (!name && !address) return;

      parsed.push({
        name: name || 'Unknown Owner',
        address: address || 'Dallas, TX',
        city: cols[colIndex.city] || 'Dallas',
        zip: cols[colIndex.zip] || '75216',
        phone1: cols[colIndex.phone1] || '',
        phone2: cols[colIndex.phone2] || '',
        price: cols[colIndex.price] || '',
        notes: cols[colIndex.notes] || '',
      });
    });

    return parsed;
  };

  const parsedRecords = parseRows(rawText);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      setParseError(null);
    };
    reader.onerror = () => {
      setParseError('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_CSV);
    setParseError(null);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'groundwork_crm_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    if (parsedRecords.length === 0) {
      setParseError('Please paste or upload lead data before importing.');
      return;
    }

    // Determine target campaign / stage
    let finalCampaign = selectedCampaign;
    let targetStage: StageId = 'Dallas';
    let targetStatus = 'Not Dialed';

    if (destination === 'new_campaign') {
      const cleanName = newCampaignName.trim();
      if (!cleanName) {
        setParseError('Please enter a name for the new campaign.');
        return;
      }
      finalCampaign = cleanName;
      targetStage = 'Dallas';
      if (onAddNewCampaign) {
        onAddNewCampaign(cleanName);
      }
    } else if (destination === 'existing_campaign') {
      finalCampaign = selectedCampaign;
      targetStage = 'Dallas';
    } else if (destination === 'deal_pipeline') {
      targetStage = pipelineStage;
      targetStatus = pipelineStatus;
      finalCampaign = 'Deal Pipeline Ingestion';
    }

    const newLeads: Lead[] = parsedRecords.map((r, idx) => {
      const phones = [];
      if (r.phone1.trim()) {
        phones.push({
          id: `p-${Date.now()}-${idx}-1`,
          number: r.phone1.trim(),
          label: 'Mobile (Primary)',
        });
      }
      if (r.phone2.trim()) {
        phones.push({
          id: `p-${Date.now()}-${idx}-2`,
          number: r.phone2.trim(),
          label: 'Alt Contact',
        });
      }

      const initialLead: Lead = {
        id: `lead-${Date.now()}-${idx}`,
        leadId: `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
        ownerName: r.name,
        propertyAddress: r.address,
        city: r.city,
        zipCode: r.zip,
        phoneNumbers: phones,
        campaign: finalCampaign,
        stageId: targetStage,
        sourceTab: (finalCampaign.slice(0, 20) as SourceTabId) || 'Dallas',
        assignedVA,
        vaStatus: targetStatus,
        outreachStatus:
          destination === 'deal_pipeline' ? targetStatus : 'Not yet dialed',
        callsCount: 0,
        callNotes: r.notes,
        askingPrice: r.price || undefined,
        dateAdded: new Date().toISOString(),
      };

      if (destination === 'deal_pipeline') {
        const routed = routeLead(initialLead, targetStatus);
        return routed.updatedLead;
      }

      return initialLead;
    });

    onImportLeads(newLeads);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E4E0D6] rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#B85338]/15 text-[#B85338] flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F2421]">Bulk Lead Import</h2>
              <p className="text-xs text-[#5E6660]">
                Ingest cold calling lists, new county campaigns, or route directly into your Deal Pipeline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-[#E4E0D6] hover:bg-[#F8F6F1] flex items-center justify-center text-[#5E6660] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Chooser (3 Options) */}
        <div className="space-y-2.5">
          <label className="block text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
            1. Select Ingestion Destination
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Option 1: Existing Campaign */}
            <button
              type="button"
              onClick={() => setDestination('existing_campaign')}
              className={`p-3 rounded-lg border text-left transition-all ${
                destination === 'existing_campaign'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Layers className="w-4 h-4 text-[#B85338]" />
                <span>Existing Campaign</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Add leads to an established outreach list
              </p>
            </button>

            {/* Option 2: Add New Campaign */}
            <button
              type="button"
              onClick={() => setDestination('new_campaign')}
              className={`p-3 rounded-lg border text-left transition-all ${
                destination === 'new_campaign'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Plus className="w-4 h-4 text-[#4A7A5E]" />
                <span>New Campaign</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Create a brand new campaign bucket
              </p>
            </button>

            {/* Option 3: Add to Deal Pipeline */}
            <button
              type="button"
              onClick={() => setDestination('deal_pipeline')}
              className={`p-3 rounded-lg border text-left transition-all ${
                destination === 'deal_pipeline'
                  ? 'border-[#B85338] bg-[#FDFBF7] ring-1 ring-[#B85338]'
                  : 'border-[#E4E0D6] bg-white hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-[#1F2421]">
                <Kanban className="w-4 h-4 text-[#2563EB]" />
                <span>Deal Pipeline</span>
              </div>
              <p className="text-[11px] text-[#5E6660] mt-1">
                Route directly into Project Mgmt or Follow-Up
              </p>
            </button>
          </div>

          {/* Contextual Destination Options */}
          <div className="p-3.5 bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg">
            {destination === 'existing_campaign' && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-[#1F2421]">Choose Campaign:</span>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="bg-white border border-[#E4E0D6] rounded px-3 py-1.5 text-xs font-semibold text-[#1F2421] outline-none min-w-[240px]"
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
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-[#1F2421]">New Campaign Name:</span>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Collin County Pre-Foreclosures 2026"
                  className="flex-1 bg-white border border-[#E4E0D6] rounded px-3 py-1.5 text-xs text-[#1F2421] outline-none focus:border-[#B85338]"
                />
              </div>
            )}

            {destination === 'deal_pipeline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Target Pipeline Section
                  </label>
                  <select
                    value={pipelineStage}
                    onChange={(e) => {
                      const st = e.target.value as 'Project Mgmt' | 'Follow-Up';
                      setPipelineStage(st);
                      setPipelineStatus(st === 'Project Mgmt' ? 'Interested' : 'Follow-Up');
                    }}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
                  >
                    <option value="Project Mgmt">Project Management (Active Deals)</option>
                    <option value="Follow-Up">Follow Up (Nurture Timers)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] uppercase mb-1">
                    Initial Status
                  </label>
                  <select
                    value={pipelineStatus}
                    onChange={(e) => setPipelineStatus(e.target.value)}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-semibold text-[#1F2421] outline-none"
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
        </div>

        {/* Step 2: VA Assignment */}
        <div className="flex items-center justify-between gap-4 p-3 bg-white border border-[#E4E0D6] rounded-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#1F2421]">Assign Imported Leads To:</span>
            <span className="text-[11px] text-[#5E6660]">Default VA for outreach ownership</span>
          </div>
          <select
            value={assignedVA}
            onChange={(e) => setAssignedVA(e.target.value as VA)}
            className="bg-[#F8F6F1] border border-[#E4E0D6] rounded px-3 py-1.5 text-xs font-bold text-[#1F2421] outline-none"
          >
            <option value="Rain">Rain</option>
            <option value="Jah">Jah</option>
            <option value="Jen">Jen</option>
            <option value="David">David</option>
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>

        {/* Step 3: Input Method (Paste or File) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex bg-[#F0EDE6] p-0.5 rounded-md text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeInputTab === 'paste' ? 'bg-white text-[#1F2421] shadow-xs' : 'text-[#5E6660]'
                }`}
              >
                Paste Spreadsheet / CSV Text
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('file')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeInputTab === 'file' ? 'bg-white text-[#1F2421] shadow-xs' : 'text-[#5E6660]'
                }`}
              >
                Upload CSV File
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="flex items-center gap-1 text-[11px] font-bold text-[#B85338] hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                <span>Load Sample Leads</span>
              </button>
              <span className="text-[#E4E0D6]">|</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-[11px] font-bold text-[#5E6660] hover:text-[#1F2421]"
              >
                <Download className="w-3 h-3" />
                <span>Template</span>
              </button>
            </div>
          </div>

          {activeInputTab === 'paste' ? (
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setParseError(null);
              }}
              placeholder={`Paste rows from Excel, Google Sheets, or CSV file here...\nFormat: Owner Name, Address, City, Zip, Phone 1, Phone 2, Asking Price, Notes`}
              className="w-full h-36 p-3 text-xs font-mono bg-[#FDFBF7] border border-[#E4E0D6] rounded-lg outline-none focus:border-[#B85338] resize-none leading-relaxed placeholder:text-[#5E6660]"
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-36 border-2 border-dashed border-[#E4E0D6] hover:border-[#B85338] rounded-lg flex flex-col items-center justify-center cursor-pointer bg-[#FDFBF7] hover:bg-[#F8F6F1] transition-colors p-4 text-center space-y-1"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="w-8 h-8 text-[#5E6660]" />
              <div className="text-xs font-bold text-[#1F2421]">
                {fileName ? fileName : 'Click to browse or drag & drop CSV'}
              </div>
              <div className="text-[11px] text-[#5E6660]">Supports comma or tab-delimited files</div>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Live Preview Table */}
        {parsedRecords.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#5E6660] uppercase">
              <span>Preview Parsed Records ({parsedRecords.length} Ready)</span>
              <span className="text-[#4A7A5E] font-semibold lowercase">
                Showing first {Math.min(parsedRecords.length, 4)} rows
              </span>
            </div>
            <div className="border border-[#E4E0D6] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8F6F1] text-[10px] uppercase font-bold text-[#5E6660] border-b border-[#E4E0D6] sticky top-0">
                  <tr>
                    <th className="px-2.5 py-1.5">Owner Name</th>
                    <th className="px-2.5 py-1.5">Property Address</th>
                    <th className="px-2.5 py-1.5">City / Zip</th>
                    <th className="px-2.5 py-1.5">Phone 1</th>
                    <th className="px-2.5 py-1.5">Asking Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E0D6] bg-white">
                  {parsedRecords.slice(0, 4).map((r, i) => (
                    <tr key={i} className="hover:bg-[#FDFBF7]">
                      <td className="px-2.5 py-1.5 font-bold text-[#1F2421] truncate max-w-[120px]">
                        {r.name}
                      </td>
                      <td className="px-2.5 py-1.5 text-[#5E6660] truncate max-w-[160px]">
                        {r.address}
                      </td>
                      <td className="px-2.5 py-1.5 text-[#5E6660]">
                        {r.city} {r.zip}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[#1F2421]">
                        {r.phone1 || '—'}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-[#4A7A5E] font-bold">
                        {r.price || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#E4E0D6] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-[#E4E0D6] text-xs font-semibold text-[#5E6660] hover:text-[#1F2421] hover:bg-[#F8F6F1] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={parsedRecords.length === 0}
            onClick={handleConfirmImport}
            className={`flex items-center gap-2 px-5 py-2 rounded-md font-semibold text-xs text-white shadow-sm transition-all ${
              parsedRecords.length > 0
                ? 'bg-[#B85338] hover:bg-[#A34730]'
                : 'bg-gray-300 cursor-not-allowed text-gray-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Import {parsedRecords.length > 0 ? `${parsedRecords.length} Leads` : 'Leads'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
