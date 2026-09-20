import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  AlertTriangle,
  Calendar,
  Download,
  Plus,
  CheckCircle2,
  Timer,
  FileText,
  UserCheck,
  ChevronRight,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { VA, TimesheetPunch, TimesheetAction, VAPunchStatus, DayWorkSummary } from '../types';
import {
  getVAPunchStatus,
  calculatePayPeriodSummary,
  calculateDaySummary,
  formatDurationMinutes,
  formatDecimalHours,
  DEFAULT_SHIFT,
} from '../logic/timesheetEngine';
import { VABadge } from './VABadge';

interface TimesheetViewProps {
  punches: TimesheetPunch[];
  onAddPunch: (punch: Omit<TimesheetPunch, 'id'>) => void;
  onUpdatePunches?: (updatedPunches: TimesheetPunch[]) => void;
  onExportCSV?: () => void;
}

export const TimesheetView: React.FC<TimesheetViewProps> = ({
  punches,
  onAddPunch,
  onUpdatePunches,
}) => {
  const vas: VA[] = ['Rain', 'Jah', 'Jen', 'David'];
  const [selectedVA, setSelectedVA] = useState<VA>('Rain');
  const [punchNote, setPunchNote] = useState('');
  const [selectedDateDetail, setSelectedDateDetail] = useState<string | null>(null);

  // Date editing state for 14-day table audit
  const [editingDay, setEditingDay] = useState<DayWorkSummary | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editFirstLoginTime, setEditFirstLoginTime] = useState<string>('09:00');
  const [editLastLogoutTime, setEditLastLogoutTime] = useState<string>('17:00');
  const [editBioMinutes, setEditBioMinutes] = useState<number>(0);
  const [editEmergencyMinutes, setEditEmergencyMinutes] = useState<number>(0);
  const [editAuditNote, setEditAuditNote] = useState<string>('');

  // Inline Add Punch for selected day details
  const [showAddPunchInline, setShowAddPunchInline] = useState(false);
  const [inlineAction, setInlineAction] = useState<TimesheetAction>('LOGIN');
  const [inlineTime, setInlineTime] = useState<string>('09:00');
  const [inlineNote, setInlineNote] = useState<string>('');

  // Date range state for 14-day table breakdown (defaults to 14 days ending today)
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 13);
    return start.toISOString().split('T')[0];
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Live timer tick for real-time second updates
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = currentTime.toISOString().split('T')[0];

  // Pay Period Summary (14 days or user-selected range)
  const payPeriod = calculatePayPeriodSummary(
    selectedVA,
    punches,
    14,
    rangeStart,
    rangeEnd
  );

  // Current Status of Selected VA
  const vaPunches = punches.filter((p) => p.va === selectedVA);
  const currentStatusInfo = getVAPunchStatus(vaPunches);
  const currentStatus = currentStatusInfo.status;

  // Today's summary
  const todaySummary = calculateDaySummary(todayStr, vaPunches, true);

  // Handle Action Trigger
  // Rule:
  // - bio out is the start break (action: BIO_OUT), bio in is the end break (action: BIO_IN)
  // - emergency out is paused duty (action: EMERGENCY_OUT), emergency in is resume (action: EMERGENCY_IN)
  // - allow multiple punches for emergency in and out as well as bio breaks
  const handleAction = (action: TimesheetAction) => {
    const now = new Date();
    onAddPunch({
      va: selectedVA,
      action,
      date: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      note: punchNote.trim() || undefined,
    });
    setPunchNote('');
  };

  // Delete an individual punch
  const handleDeletePunch = (punchId: string) => {
    if (onUpdatePunches) {
      onUpdatePunches(punches.filter((p) => p.id !== punchId));
    }
  };

  // Add an individual punch for the selected day
  const handleSaveInlinePunch = () => {
    if (!selectedDateDetail) return;
    const [hours, minutes] = inlineTime.split(':');
    const punchDate = new Date(`${selectedDateDetail}T${hours || '00'}:${minutes || '00'}:00`);
    const newPunch: TimesheetPunch = {
      id: `punch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      va: selectedVA,
      date: selectedDateDetail,
      timestamp: punchDate.toISOString(),
      action: inlineAction,
      note: inlineNote.trim() || undefined,
    };
    if (onUpdatePunches) {
      onUpdatePunches([...punches, newPunch]);
    } else {
      onAddPunch(newPunch);
    }
    setShowAddPunchInline(false);
    setInlineNote('');
  };

  // Open edit modal for a specific day in the 14-day audit table
  const handleOpenEditDay = (day: DayWorkSummary) => {
    setEditingDay(day);
    setEditDate(day.date);
    
    // Extract times if existing
    if (day.firstLogin) {
      const dt = new Date(day.firstLogin);
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      setEditFirstLoginTime(`${hh}:${mm}`);
    } else {
      setEditFirstLoginTime('09:00');
    }

    if (day.lastLogout) {
      const dt = new Date(day.lastLogout);
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      setEditLastLogoutTime(`${hh}:${mm}`);
    } else {
      setEditLastLogoutTime('17:00');
    }

    setEditBioMinutes(day.bioBreakMinutes || 0);
    setEditEmergencyMinutes(day.emergencyBreakMinutes || 0);
    setEditAuditNote('Audit adjustment on pay period table');
  };

  // Save changes to the day in the 14-day table
  const handleSaveDayEdit = () => {
    if (!editingDay || !onUpdatePunches) return;

    // Filter out previous punches for this VA on the original date
    const remainingPunches = punches.filter(
      (p) => !(p.va === selectedVA && p.date === editingDay.date)
    );

    // Build replacement punches for editDate
    const newPunches: TimesheetPunch[] = [];
    const targetDate = editDate || editingDay.date;

    // First Login
    const loginTs = `${targetDate}T${editFirstLoginTime}:00.000Z`;
    newPunches.push({
      id: `punch-edit-login-${Date.now()}-1`,
      va: selectedVA,
      action: 'LOGIN',
      date: targetDate,
      timestamp: loginTs,
      note: editAuditNote || 'Audited punch entry',
    });

    // Bio breaks if any
    if (editBioMinutes > 0) {
      const bioOutTs = `${targetDate}T12:00:00.000Z`;
      const bioInMin = 12 * 60 + editBioMinutes;
      const bioInHH = String(Math.floor(bioInMin / 60)).padStart(2, '0');
      const bioInMM = String(bioInMin % 60).padStart(2, '0');
      const bioInTs = `${targetDate}T${bioInHH}:${bioInMM}:00.000Z`;

      newPunches.push({
        id: `punch-edit-bio-out-${Date.now()}-2`,
        va: selectedVA,
        action: 'BIO_OUT',
        date: targetDate,
        timestamp: bioOutTs,
        note: `Bio Break (${editBioMinutes}m)`,
      });
      newPunches.push({
        id: `punch-edit-bio-in-${Date.now()}-3`,
        va: selectedVA,
        action: 'BIO_IN',
        date: targetDate,
        timestamp: bioInTs,
        note: `Bio Break End`,
      });
    }

    // Emergency breaks if any
    if (editEmergencyMinutes > 0) {
      const emOutTs = `${targetDate}T14:30:00.000Z`;
      const emInMin = 14 * 60 + 30 + editEmergencyMinutes;
      const emInHH = String(Math.floor(emInMin / 60)).padStart(2, '0');
      const emInMM = String(emInMin % 60).padStart(2, '0');
      const emInTs = `${targetDate}T${emInHH}:${emInMM}:00.000Z`;

      newPunches.push({
        id: `punch-edit-em-out-${Date.now()}-4`,
        va: selectedVA,
        action: 'EMERGENCY_OUT',
        date: targetDate,
        timestamp: emOutTs,
        note: `Emergency Pause (${editEmergencyMinutes}m)`,
      });
      newPunches.push({
        id: `punch-edit-em-in-${Date.now()}-5`,
        va: selectedVA,
        action: 'EMERGENCY_IN',
        date: targetDate,
        timestamp: emInTs,
        note: `Emergency Resume`,
      });
    }

    // Last Logout
    const logoutTs = `${targetDate}T${editLastLogoutTime}:00.000Z`;
    newPunches.push({
      id: `punch-edit-logout-${Date.now()}-6`,
      va: selectedVA,
      action: 'LOGOUT',
      date: targetDate,
      timestamp: logoutTs,
      note: 'Audited end of shift',
    });

    onUpdatePunches([...remainingPunches, ...newPunches]);
    setEditingDay(null);
  };

  // Delete all punches for the day being edited
  const handleDeleteDayPunches = () => {
    if (!editingDay || !onUpdatePunches) return;
    const remainingPunches = punches.filter(
      (p) => !(p.va === selectedVA && p.date === editingDay.date)
    );
    onUpdatePunches(remainingPunches);
    setEditingDay(null);
  };

  // CSV Export for current VA's 2-week period
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'VA',
      'First Login',
      'Last Logout',
      'Working Minutes',
      'Hours Worked',
      'Bio Break Mins',
      'Emergency Break Mins',
    ];
    const rows = payPeriod.dailySummaries.map((day) => [
      day.date,
      selectedVA,
      day.firstLogin ? new Date(day.firstLogin).toLocaleTimeString() : 'N/A',
      day.lastLogout ? new Date(day.lastLogout).toLocaleTimeString() : 'N/A',
      day.workingMinutes,
      (day.workingMinutes / 60).toFixed(2),
      day.bioBreakMinutes,
      day.emergencyBreakMinutes,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timesheet_${selectedVA}_2weeks_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D6] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1F2421] tracking-tight">
              VA Operational Timesheet & Hours Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#4A7A5E]/15 text-[#4A7A5E] border border-[#4A7A5E]/30">
              Bi-Weekly Pay Period Active
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#B85338]/15 text-[#B85338] border border-[#B85338]/30">
              Work Shift: 8:00 AM - 10:00 PM (Scheduled Out: 10:00 PM)
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-0.5">
            Shift Schedule: <strong className="text-[#1F2421]">8:00 AM - 10:00 PM</strong> (Scheduled Out: <strong className="text-[#1F2421]">10:00 PM</strong>). Automated time tracking with Log In/Out, Bio In/Out, and Emergency In/Out. Daily hours and 2-week totals calculated automatically based on high-precision timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-[#E4E0D6] bg-white hover:bg-[#F8F6F1] text-xs font-semibold text-[#1F2421] shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#5E6660]" />
            <span>Export 2-Week CSV</span>
          </button>
        </div>
      </div>

      {/* VA Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-[#E4E0D6] shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#5E6660] uppercase tracking-wider mr-1">
            Select Virtual Assistant:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {vas.map((va) => {
              const pSummary = calculatePayPeriodSummary(va, punches, 14);
              const pStatus = getVAPunchStatus(punches.filter((p) => p.va === va)).status;
              const isSelected = selectedVA === va;

              return (
                <button
                  key={va}
                  type="button"
                  onClick={() => setSelectedVA(va)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-[#B85338] text-white shadow-xs'
                      : 'bg-[#F8F6F1] text-[#1F2421] hover:bg-[#F0EDE6] border border-[#E4E0D6]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pStatus === 'WORKING'
                        ? 'bg-emerald-400 animate-pulse'
                        : pStatus === 'BIO_BREAK'
                        ? 'bg-amber-400'
                        : pStatus === 'EMERGENCY_BREAK'
                        ? 'bg-rose-400'
                        : 'bg-zinc-400'
                    }`}
                  />
                  <span>{va}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#E4E0D6] text-[#5E6660]'
                    }`}
                  >
                    {pSummary.totalHoursFormatted}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#5E6660]">
          <Clock className="w-3.5 h-3.5 text-[#B85338]" />
          <span>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}{' '}
            • {currentTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Primary 3-Card Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Live Status & Punch Control */}
        <div className="bg-white border border-[#E4E0D6] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5E6660] uppercase tracking-wider">
              Current Duty Status
            </span>
            <VABadge va={selectedVA} />
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                currentStatus === 'WORKING'
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : currentStatus === 'BIO_BREAK'
                  ? 'bg-amber-500 text-white'
                  : currentStatus === 'EMERGENCY_BREAK'
                  ? 'bg-rose-500 text-white'
                  : 'bg-zinc-400 text-white'
              }`}
            />
            <div>
              <div className="text-lg font-bold text-[#1F2421]">
                {currentStatus === 'WORKING' && 'Active on Shift (Working)'}
                {currentStatus === 'BIO_BREAK' && 'On Bio Break (Paused)'}
                {currentStatus === 'EMERGENCY_BREAK' && 'On Emergency Break (Paused)'}
                {currentStatus === 'LOGGED_OUT' && 'Off Duty (Logged Out)'}
              </div>
              <div className="text-[11px] text-[#5E6660]">
                {currentStatusInfo.lastActionTime
                  ? `Last punch: ${new Date(
                      currentStatusInfo.lastActionTime
                    ).toLocaleTimeString()} (${currentStatusInfo.lastAction})`
                  : 'No punches recorded today yet'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#E4E0D6]">
            <div className="text-[11px] font-semibold text-[#5E6660]">
              Punch Actions for {selectedVA}:
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Log In */}
              <button
                type="button"
                disabled={currentStatus === 'WORKING' || currentStatus === 'BIO_BREAK' || currentStatus === 'EMERGENCY_BREAK'}
                onClick={() => handleAction('LOGIN')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>

              {/* Log Out */}
              <button
                type="button"
                disabled={currentStatus === 'LOGGED_OUT'}
                onClick={() => handleAction('LOGOUT')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Bio Out (Start Break) */}
              <button
                type="button"
                disabled={currentStatus !== 'WORKING'}
                onClick={() => handleAction('BIO_OUT')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-amber-900 text-xs font-bold transition-colors"
                title="Start bio break (pauses work duty)"
              >
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                <span>Bio Out (Start Break)</span>
              </button>

              {/* Bio In (End Break) */}
              <button
                type="button"
                disabled={currentStatus !== 'BIO_BREAK'}
                onClick={() => handleAction('BIO_IN')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-900 text-xs font-bold transition-colors"
                title="End bio break (resumes work duty)"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bio In (End Break)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Emergency Out (Pause Duty) */}
              <button
                type="button"
                disabled={currentStatus !== 'WORKING' && currentStatus !== 'BIO_BREAK'}
                onClick={() => handleAction('EMERGENCY_OUT')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-900 text-xs font-bold transition-colors cursor-pointer"
                title="Emergency pause / paused duty"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Emergency Out (Pause)</span>
              </button>

              {/* Emergency In (Resume Duty) */}
              <button
                type="button"
                disabled={currentStatus !== 'EMERGENCY_BREAK'}
                onClick={() => handleAction('EMERGENCY_IN')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-900 text-xs font-bold transition-colors cursor-pointer"
                title="Emergency in (resumes duty)"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Emergency In (Resume)</span>
              </button>
            </div>

            {/* Note input */}
            <input
              type="text"
              value={punchNote}
              onChange={(e) => setPunchNote(e.target.value)}
              placeholder="Optional punch note (e.g. bio break, quick lunch)..."
              className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs text-[#1F2421] outline-none focus:bg-white focus:border-[#B85338]"
            />
          </div>
        </div>

        {/* Card 2: Today's Hours Breakdown */}
        <div className="bg-white border border-[#E4E0D6] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#5E6660] uppercase tracking-wider">
                Today's Working Hours
              </span>
              <span className="text-[10px] font-mono text-[#5E6660] bg-[#F0EDE6] px-2 py-0.5 rounded">
                Live Calculation
              </span>
            </div>

            <div className="text-3xl font-mono font-extrabold text-[#1F2421] flex flex-wrap items-baseline gap-2">
              <span>{todaySummary.totalHoursFormatted}</span>
              {currentStatus === 'WORKING' && todaySummary.liveFormatted && (
                <span className="text-sm font-semibold text-emerald-600 font-mono flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {todaySummary.liveFormatted}
                </span>
              )}
            </div>
            <div className="text-xs text-[#5E6660] mt-1">
              Decimal equivalent: <strong>{formatDecimalHours(todaySummary.workingMinutes)}</strong>
            </div>

            <div className="mt-4 space-y-2 text-xs border-t border-[#E4E0D6] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">First Log In:</span>
                <span className="font-mono font-bold text-[#1F2421]">
                  {todaySummary.firstLogin
                    ? new Date(todaySummary.firstLogin).toLocaleTimeString()
                    : 'Not logged in yet'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Bio Breaks (Total):</span>
                <span className="font-mono font-bold text-amber-700">
                  {formatDurationMinutes(todaySummary.bioBreakMinutes)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Emergency Breaks:</span>
                <span className="font-mono font-bold text-rose-700">
                  {formatDurationMinutes(todaySummary.emergencyBreakMinutes)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Latest Action:</span>
                <span className="font-mono font-bold text-[#1F2421]">
                  {todaySummary.lastLogout
                    ? `Logged out at ${new Date(todaySummary.lastLogout).toLocaleTimeString()}`
                    : currentStatus === 'WORKING'
                    ? 'Shift currently active'
                    : 'Off duty'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#F8F6F1] rounded-lg text-[11px] text-[#5E6660] flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-[#B85338] shrink-0" />
            <span>
              Break durations are automatically deducted from billable shift hours.
            </span>
          </div>
        </div>

        {/* Card 3: 2-Week Hours (Pay Period) */}
        <div className="bg-white border border-[#E4E0D6] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#5E6660] uppercase tracking-wider">
                2 Weeks Hours (Pay Period)
              </span>
              <span className="text-[10px] font-mono text-[#5E6660] bg-[#F0EDE6] px-2 py-0.5 rounded">
                14-Day Cycle
              </span>
            </div>

            <div className="text-3xl font-mono font-extrabold text-[#B85338]">
              {payPeriod.totalHoursFormatted}
            </div>
            <div className="text-xs text-[#5E6660] mt-1">
              Total Decimal:{' '}
              <strong>{formatDecimalHours(payPeriod.totalMinutes)}</strong> across{' '}
              {payPeriod.dailySummaries.length} days
            </div>

            <div className="mt-4 space-y-2 text-xs border-t border-[#E4E0D6] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Pay Period Range:</span>
                <span className="font-mono font-bold text-[#1F2421]">
                  {payPeriod.periodStart} → {payPeriod.periodEnd}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Avg Hours / Active Day:</span>
                <span className="font-mono font-bold text-[#1F2421]">
                  {(
                    payPeriod.totalMinutes /
                    Math.max(
                      1,
                      payPeriod.dailySummaries.filter((d) => d.workingMinutes > 0).length
                    ) /
                    60
                  ).toFixed(1)}{' '}
                  hrs/day
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Days Worked:</span>
                <span className="font-mono font-bold text-[#4A7A5E]">
                  {payPeriod.dailySummaries.filter((d) => d.workingMinutes > 0).length} of{' '}
                  {payPeriod.dailySummaries.length} days
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#5E6660]">Standard Target (80h):</span>
                <span className="font-mono font-bold text-[#1F2421]">
                  {((payPeriod.totalMinutes / (80 * 60)) * 100).toFixed(0)}% reached
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#4A7A5E]/10 border border-[#4A7A5E]/20 rounded-lg text-[11px] text-[#4A7A5E] flex items-center justify-between">
            <span className="font-semibold">Payroll Ready</span>
            <span className="font-mono">{payPeriod.totalHoursFormatted}</span>
          </div>
        </div>
      </div>

      {/* 2-Week Daily Breakdown Table */}
      <div className="bg-white border border-[#E4E0D6] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-[#E4E0D6] bg-[#FDFBF7] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#B85338]" />
            <div>
              <span className="font-bold text-xs text-[#1F2421]">
                14-Day Timesheet Breakdown for {selectedVA}
              </span>
              <span className="text-[10px] font-mono text-[#5E6660] ml-2">
                ({payPeriod.periodStart} to {payPeriod.periodEnd})
              </span>
            </div>
          </div>

          {/* Interactive Date Range Chooser */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-white border border-[#E4E0D6] rounded-lg px-2.5 py-1 shadow-2xs">
              <span className="text-[11px] font-medium text-[#5E6660]">Range:</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => {
                  const val = e.target.value;
                  setRangeStart(val);
                  if (val) {
                    const startObj = new Date(val + 'T12:00:00');
                    startObj.setDate(startObj.getDate() + 13);
                    setRangeEnd(startObj.toISOString().split('T')[0]);
                  }
                }}
                className="bg-transparent font-mono text-xs font-semibold text-[#1F2421] outline-none cursor-pointer"
                title="Start Date (selecting auto-calculates 14 days)"
              />
              <span className="text-[#8C948E] font-medium">to</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="bg-transparent font-mono text-xs font-semibold text-[#1F2421] outline-none cursor-pointer"
                title="End Date"
              />
            </div>

            {/* Quick Period Presets */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setRangeStart('2026-09-05');
                  setRangeEnd('2026-09-18');
                }}
                className={`px-2.5 py-1 rounded-md border font-mono text-xs transition-colors ${
                  rangeStart === '2026-09-05' && rangeEnd === '2026-09-18'
                    ? 'bg-[#B85338] text-white border-[#B85338] font-bold shadow-2xs'
                    : 'bg-white border-[#E4E0D6] text-[#5E6660] hover:bg-[#F8F6F1]'
                }`}
                title="Set exact pay period 2026-09-05 to 2026-09-18"
              >
                2026-09-05 to 2026-09-18
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeStart('2026-08-22');
                  setRangeEnd('2026-09-04');
                }}
                className={`px-2 py-1 rounded-md border font-mono text-xs transition-colors ${
                  rangeStart === '2026-08-22' && rangeEnd === '2026-09-04'
                    ? 'bg-[#B85338] text-white border-[#B85338] font-bold shadow-2xs'
                    : 'bg-white border-[#E4E0D6] text-[#5E6660] hover:bg-[#F8F6F1]'
                }`}
                title="Set previous 14-day pay period"
              >
                Previous 14 Days
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F6F1] text-[10px] uppercase font-bold text-[#5E6660] border-b border-[#E4E0D6]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">First Log In</th>
                <th className="py-2.5 px-4">Bio Breaks</th>
                <th className="py-2.5 px-4">Emergency Breaks</th>
                <th className="py-2.5 px-4">Last Log Out</th>
                <th className="py-2.5 px-4 text-right">Daily Hours</th>
                <th className="py-2.5 px-4 text-right">Decimal</th>
                <th className="py-2.5 px-4 text-center">Punches</th>
                <th className="py-2.5 px-4 text-center">Edit Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6]">
              {payPeriod.dailySummaries
                .slice()
                .reverse()
                .map((day) => {
                  const isToday = day.date === todayStr;
                  const isSelectedDay = selectedDateDetail === day.date;

                  return (
                    <tr
                      key={day.date}
                      onClick={() =>
                        setSelectedDateDetail(isSelectedDay ? null : day.date)
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelectedDay
                          ? 'bg-[#F4ECE4]/60'
                          : isToday
                          ? 'bg-amber-50/30 hover:bg-[#F8F6F1]'
                          : 'hover:bg-[#F8F6F1]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-bold text-[#1F2421] flex items-center gap-1.5">
                        <span>{day.formattedDate}</span>
                        {isToday && (
                          <span className="text-[9px] bg-[#B85338] text-white px-1.5 py-0.2 rounded font-mono uppercase">
                            Today
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#5E6660]">
                        {day.firstLogin
                          ? new Date(day.firstLogin).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-amber-700">
                        {day.bioBreakMinutes > 0
                          ? formatDurationMinutes(day.bioBreakMinutes)
                          : '0m'}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-rose-700">
                        {day.emergencyBreakMinutes > 0
                          ? formatDurationMinutes(day.emergencyBreakMinutes)
                          : '0m'}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#5E6660]">
                        {day.lastLogout
                          ? new Date(day.lastLogout).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : isToday && currentStatus === 'WORKING'
                          ? 'Active now'
                          : '—'}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-xs text-[#1F2421]">
                        {day.totalHoursFormatted}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-xs text-[#5E6660]">
                        {formatDecimalHours(day.workingMinutes)}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0EDE6] text-[#5E6660]">
                          {day.punches.length} punches
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditDay(day);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E4E0D6] bg-white hover:bg-[#B85338] hover:text-white text-[#1F2421] text-[11px] font-semibold transition-colors shadow-2xs"
                          title="Edit date and punch records for this day"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit Date</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot className="bg-[#F8F6F1] font-bold border-t border-[#E4E0D6] text-xs">
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right text-[#5E6660] uppercase tracking-wider">
                  2-Week Pay Period Total:
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-[#B85338]">
                  {payPeriod.totalHoursFormatted}
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs text-[#1F2421]">
                  {formatDecimalHours(payPeriod.totalMinutes)}
                </td>
                <td className="py-3 px-4 text-center text-[10px] text-[#5E6660]">
                  {payPeriod.dailySummaries.reduce((s, d) => s + d.punches.length, 0)} total
                </td>
                <td className="py-3 px-4 text-center text-[10px] text-[#5E6660]">
                  Auditable
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Date Editing Modal for 14-Day Pay Period Audit Table */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#E4E0D6] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1F2421] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B85338]" />
                  <span>Audit & Edit Timesheet Date</span>
                </h3>
                <p className="text-xs text-[#5E6660] mt-0.5">
                  Adjust date and recorded hours for <strong>{selectedVA}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="p-1 rounded-md text-[#5E6660] hover:bg-[#F8F6F1]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Target Date Input */}
              <div>
                <label className="block font-bold text-[#1F2421] mb-1">
                  Pay Period Date (YYYY-MM-DD):
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] focus:border-[#B85338] rounded-md px-3 py-1.5 text-xs font-mono font-bold text-[#1F2421] outline-none"
                />
                <span className="text-[10px] text-[#5E6660] mt-0.5 block">
                  You can edit or reassign punches to any valid pay period date.
                </span>
              </div>

              {/* Shift Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1F2421] mb-1">
                    First Log In Time:
                  </label>
                  <input
                    type="time"
                    value={editFirstLoginTime}
                    onChange={(e) => setEditFirstLoginTime(e.target.value)}
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs font-mono text-[#1F2421] outline-none focus:border-[#B85338]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1F2421] mb-1">
                    Last Log Out Time:
                  </label>
                  <input
                    type="time"
                    value={editLastLogoutTime}
                    onChange={(e) => setEditLastLogoutTime(e.target.value)}
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs font-mono text-[#1F2421] outline-none focus:border-[#B85338]"
                  />
                </div>
              </div>

              {/* Breaks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1F2421] mb-1">
                    Bio Break (mins):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={editBioMinutes}
                    onChange={(e) => setEditBioMinutes(Number(e.target.value) || 0)}
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs font-mono text-[#1F2421] outline-none focus:border-[#B85338]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1F2421] mb-1">
                    Emergency Break (mins):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={editEmergencyMinutes}
                    onChange={(e) => setEditEmergencyMinutes(Number(e.target.value) || 0)}
                    className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs font-mono text-[#1F2421] outline-none focus:border-[#B85338]"
                  />
                </div>
              </div>

              {/* Audit Note */}
              <div>
                <label className="block font-semibold text-[#1F2421] mb-1">
                  Audit Reason / Note:
                </label>
                <input
                  type="text"
                  value={editAuditNote}
                  onChange={(e) => setEditAuditNote(e.target.value)}
                  placeholder="Reason for date or hours adjustment..."
                  className="w-full bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-3 py-1.5 text-xs text-[#1F2421] outline-none focus:border-[#B85338]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E4E0D6]">
              <button
                type="button"
                onClick={handleDeleteDayPunches}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Day</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="px-3 py-1.5 rounded-md border border-[#E4E0D6] text-xs text-[#5E6660] hover:bg-[#F8F6F1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDayEdit}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-[#B85338] hover:bg-[#A34730] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Audit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Punch Log for Selected Day or Today */}
      {selectedDateDetail && (
        <div className="bg-white border border-[#E4E0D6] rounded-xl p-5 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-[#E4E0D6] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#B85338]" />
              <span className="font-bold text-xs text-[#1F2421]">
                Punch Details for {selectedDateDetail} ({selectedVA})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddPunchInline(!showAddPunchInline)}
                className="flex items-center gap-1 text-xs font-semibold text-[#B85338] hover:text-[#96422C] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddPunchInline ? 'Cancel' : 'Add Punch'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDateDetail(null);
                  setShowAddPunchInline(false);
                }}
                className="text-xs text-[#5E6660] hover:text-[#1F2421] underline cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>

          {/* Inline Add Punch Form */}
          {showAddPunchInline && (
            <div className="p-3 bg-[#F8F6F1] border border-[#E4E0D6] rounded-lg space-y-3">
              <div className="text-[11px] font-bold text-[#1F2421] uppercase tracking-wide">
                Log New Punch for {selectedDateDetail}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] mb-1 uppercase">
                    Action
                  </label>
                  <select
                    value={inlineAction}
                    onChange={(e) => setInlineAction(e.target.value as TimesheetAction)}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs text-[#1F2421] font-semibold"
                  >
                    <option value="LOGIN">LOGIN (Start Shift)</option>
                    <option value="LOGOUT">LOGOUT (End Shift)</option>
                    <option value="BIO_OUT">BIO OUT (Start Break)</option>
                    <option value="BIO_IN">BIO IN (End Break)</option>
                    <option value="EMERGENCY_OUT">EMERGENCY OUT (Pause)</option>
                    <option value="EMERGENCY_IN">EMERGENCY IN (Resume)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] mb-1 uppercase">
                    Time (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={inlineTime}
                    onChange={(e) => setInlineTime(e.target.value)}
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs font-mono font-bold text-[#1F2421]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6660] mb-1 uppercase">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                    placeholder="e.g. bio break, client call..."
                    className="w-full bg-white border border-[#E4E0D6] rounded px-2.5 py-1.5 text-xs text-[#1F2421]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPunchInline(false)}
                  className="px-3 py-1 text-xs text-[#5E6660] hover:text-[#1F2421] rounded border border-[#E4E0D6] bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInlinePunch}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#1F2421] hover:bg-[#2C332E] text-white text-xs font-bold rounded cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Punch</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {vaPunches.filter((p) => p.date === selectedDateDetail).length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8C948E] italic">
                No punches recorded for this date.
              </div>
            ) : (
              vaPunches
                .filter((p) => p.date === selectedDateDetail)
                .sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )
                .map((punch) => {
                  const pTime = new Date(punch.timestamp).toLocaleTimeString();
                  return (
                    <div
                      key={punch.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8F6F1] border border-[#E4E0D6] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                            punch.action === 'LOGIN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : punch.action === 'LOGOUT'
                              ? 'bg-zinc-200 text-zinc-800'
                              : punch.action.includes('BIO')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {punch.action.replace('_', ' ')}
                        </span>
                        <span className="font-mono font-bold text-[#1F2421]">{pTime}</span>
                        {punch.note && (
                          <span className="text-[#5E6660] italic">— "{punch.note}"</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-[#8C948E]">
                          {punch.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePunch(punch.id)}
                          className="p-1 rounded text-[#8C948E] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete this punch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
