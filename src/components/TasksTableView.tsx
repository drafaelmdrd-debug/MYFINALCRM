import React, { useState } from 'react';
import {
  CRMTask,
  Lead,
  VA,
  TaskType,
} from '../types';
import {
  CheckSquare,
  Square,
  RotateCw,
  Phone,
  Calendar,
  Clock,
  Filter,
  User,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { VABadge } from './VABadge';
import { DialLink } from './DialLink';

/** Edits an agent made on a task row that are NOT saved to the lead until Done is ticked. */
export type TaskEdits = Partial<
  Pick<CRMTask, 'taskAssignedTo' | 'assignedVA' | 'nextTaskDate' | 'status' | 'taskNotes'>
>;

interface TasksTableViewProps {
  tasks: CRMTask[];
  /** All leads — every task is a view onto one of these (Project Mgmt or Follow-Up). */
  leads?: Lead[];
  onRefreshTasks: () => void;
  /** Every edit made on the board is written back onto the source lead (its own group/stage). */
  onUpdateTask: (task: CRMTask, updatedFields: Partial<CRMTask>) => void;
  onEditLead?: (leadId: string, patch: Partial<Lead>) => void;
  onChangeStatus?: (leadId: string, newStatus: string) => void;
  /** Ticking Done saves every pending edit (VA, date, note, status) onto the original lead in one go. */
  onCompleteTask: (taskId: string, edits?: TaskEdits) => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
}


const STATUS_GROUPS: { label: string; options: { value: string; text: string }[] }[] = [
  {
    label: 'Project Mgmt (Active Acquisitions)',
    options: [
      { value: 'Interested', text: 'Interested' },
      { value: 'Interested - Has Asking Price', text: 'Interested - Has Asking Price' },
      { value: 'For Comps', text: 'For Comps' },
      { value: 'For Offer', text: 'For Offer' },
      { value: 'Offer Made', text: 'Offer Made' },
      { value: 'Negotiating', text: 'Negotiating' },
      { value: 'Asking too High', text: 'Asking too High (+20 days)' },
      { value: 'Callback - Tomorrow', text: 'Callback - Tomorrow' },
      { value: 'Comps Needed', text: 'Comps Needed (+1 day)' },
      { value: 'Appointment In person', text: 'Appointment In person' },
      { value: 'Accepted Offer', text: 'Accepted Offer' },
      { value: 'Contract Sent', text: 'Contract Sent' },
      { value: 'Deal Won', text: 'Deal Won' },
    ],
  },
  {
    label: 'Follow-Up (Nurture Timers)',
    options: [
      { value: 'Listed', text: 'Listed on MLS (+30 days)' },
      { value: 'Not Interested - 30 Days', text: 'Not Interested - 30 Days' },
      { value: 'Not Interested - 60 Days', text: 'Not Interested - 60 Days' },
      { value: 'Not Interested - 90 Days', text: 'Not Interested - 90 Days' },
      { value: 'Not Ready to Sell - 30 Days', text: 'Not Ready to Sell - 30 Days' },
      { value: 'Not Ready to Sell - 60 Days', text: 'Not Ready to Sell - 60 Days' },
      { value: 'Not Ready to Sell - 90 Days', text: 'Not Ready to Sell - 90 Days' },
    ],
  },
  {
    label: 'Routing Exceptions',
    options: [
      { value: 'Spanish Speaker', text: 'Spanish Speaker (Language Barrier)' },
      { value: 'Language Barrier', text: 'Language Barrier' },
      { value: 'DNC', text: 'DNC (Do Not Call)' },
      { value: 'Sold Already', text: 'Sold Already' },
      { value: 'Ugly Property', text: 'Ugly Property' },
    ],
  },
];
const ALL_STATUS_VALUES = STATUS_GROUPS.flatMap((g) => g.options.map((o) => o.value));

export function TasksTableView({
  tasks,
  leads,
  onRefreshTasks,
  onCompleteTask,
  onOpenLeadDetail,
  onLaunchDialer,
}: TasksTableViewProps) {
  const [vaFilter, setVaFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tabFilter, setTabFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  // Text typed into a task's "add note" box. Saved onto the lead only when Done is ticked.
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // Other pending edits (VA, due date, status) per task. Nothing here touches the
  // original lead until the agent ticks Done.
  const [drafts, setDrafts] = useState<Record<string, TaskEdits>>({});

  const setDraft = (task: CRMTask, patch: TaskEdits) => {
    setDrafts((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] || {}), ...patch } }));
  };

  // Only the fields that actually differ from the lead's current data.
  const buildEdits = (task: CRMTask): TaskEdits => {
    const d = drafts[task.id] || {};
    const edits: TaskEdits = {};
    if (d.taskAssignedTo && d.taskAssignedTo !== (task.taskAssignedTo || task.assignedVA)) {
      edits.taskAssignedTo = d.taskAssignedTo;
    }
    if (d.assignedVA && d.assignedVA !== task.assignedVA) edits.assignedVA = d.assignedVA;
    if (d.nextTaskDate && d.nextTaskDate !== task.nextTaskDate) edits.nextTaskDate = d.nextTaskDate;
    if (d.status && d.status !== task.status) edits.status = d.status;
    const note = (noteDrafts[task.id] || '').trim();
    if (note) edits.taskNotes = note;
    return edits;
  };

  const handleDone = (task: CRMTask) => {
    if (task.completed) {
      onCompleteTask(task.id); // un-tick: nothing to save
      return;
    }
    const edits = buildEdits(task);
    onCompleteTask(task.id, edits);
    setDrafts((prev) => {
      const { [task.id]: _d, ...rest } = prev;
      return rest;
    });
    setNoteDrafts((prev) => {
      const { [task.id]: _n, ...rest } = prev;
      return rest;
    });
  };

  // Newest entry of the lead's note trail (entries are separated by a blank line).
  const latestNote = (notes: string) => {
    const parts = (notes || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  };

  const shownCompletedBy = (t: CRMTask): VA =>
    (drafts[t.id]?.taskAssignedTo || t.taskAssignedTo || t.assignedVA || 'Rain') as VA;

  const filteredTasks = tasks.filter((t) => {
    const completedBy = t.taskAssignedTo || t.assignedVA || 'Rain';
    if (vaFilter !== 'all' && completedBy !== vaFilter) return false;
    if (typeFilter !== 'all' && t.taskType !== typeFilter) return false;
    if (tabFilter !== 'all' && t.sourceTabName !== tabFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const match =
        t.ownerName.toLowerCase().includes(q) ||
        t.propertyAddress.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.taskNotes.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#1F2421] tracking-tight">Daily Tasks Board</h1>
            <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
              {pendingCount} Pending / {completedCount} Done
            </span>
          </div>
          <p className="text-xs text-[#5E6660] mt-1">
            Automated task dispatch from Project Management & Follow-Up stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-refresh-tasks"
            type="button"
            onClick={onRefreshTasks}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#1F2421] bg-white hover:bg-[#F2EFE8] border border-[#E4E0D6] rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#5E6660]" />
            <span>Recompile Tasks</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E4E0D6] shadow-2xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#5E6660]">
          <Filter className="w-4 h-4 text-[#B85338]" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5E6660] font-semibold">VA:</span>
          <select
            value={vaFilter}
            onChange={(e) => setVaFilter(e.target.value)}
            className="text-xs font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-2 py-1 outline-none"
          >
            <option value="all">All VAs</option>
            <option value="Rain">Rain</option>
            <option value="Jah">Jah</option>
            <option value="Jen">Jen</option>
            <option value="David">David</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5E6660] font-semibold">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-2 py-1 outline-none"
          >
            <option value="all">All Task Types</option>
            <option value="Callback">Callback</option>
            <option value="Follow up">Follow up</option>
            <option value="Need Comps">Need Comps</option>
            <option value="In Person Meeting">In Person Meeting</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#5E6660] font-semibold">Stage Source:</span>
          <select
            value={tabFilter}
            onChange={(e) => setTabFilter(e.target.value)}
            className="text-xs font-semibold bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-2 py-1 outline-none"
          >
            <option value="all">All Sources</option>
            <option value="Project Mgmt">Project Mgmt</option>
            <option value="Follow-Up">Follow-Up</option>
          </select>
        </div>

        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter tasks by text..."
          className="text-xs bg-[#F8F6F1] border border-[#E4E0D6] rounded-md px-2.5 py-1 outline-none ml-auto"
        />
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl border border-[#E4E0D6] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F6F1] border-b border-[#E4E0D6] text-[11px] font-bold text-[#5E6660] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">Done</th>
                <th className="py-3 px-4 text-[#1F2421]">Task should be completed by:</th>
                <th className="py-3 px-4">Owner & Address</th>
                <th className="py-3 px-4">Task Details</th>
                <th className="py-3 px-4">Assigned VA</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4">Phone / Action</th>
                <th className="py-3 px-4">Status / Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D6] text-xs">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#5E6660]">
                    No daily tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`transition-colors hover:bg-[#F8F6F1]/60 ${
                      task.completed ? 'bg-stone-50/60 opacity-60' : ''
                    }`}
                  >
                    {/* Completion Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDone(task)}
                        className="cursor-pointer text-[#4A7A5E] hover:text-[#3E654E]"
                      >
                        {task.completed ? (
                          <CheckSquare className="w-5 h-5 fill-[#4A7A5E] text-white" />
                        ) : (
                          <Square className="w-5 h-5 text-stone-400" />
                        )}
                      </button>
                      {!task.completed && Object.keys(buildEdits(task)).length > 0 && (
                        <span
                          className="block mt-1 text-[9px] font-bold leading-tight text-amber-700"
                          title="These edits are saved to the lead when you tick Done"
                        >
                          Unsaved
                        </span>
                      )}
                    </td>

                    {/* Task should be completed by: */}
                    <td className="py-3.5 px-4">
                      <select
                        value={shownCompletedBy(task)}
                        onChange={(e) => {
                          const newVA = e.target.value as VA;
                          setDraft(task, { taskAssignedTo: newVA });
                        }}
                        className={`border rounded px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${
                          shownCompletedBy(task) === 'David'
                            ? 'bg-purple-50 text-purple-900 border-purple-200'
                            : shownCompletedBy(task) === 'Jah'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : shownCompletedBy(task) === 'Jen'
                            ? 'bg-pink-50 text-pink-900 border-pink-200'
                            : 'bg-blue-50 text-blue-900 border-blue-200'
                        }`}
                        disabled={!!task.completed}
                        title="Task should be completed by: (David, Jah, Jen, Rain) - saved when you tick Done"
                      >
                        <option value="David">David</option>
                        <option value="Jah">Jah</option>
                        <option value="Jen">Jen</option>
                        <option value="Rain">Rain</option>
                      </select>
                    </td>

                    {/* Owner & Address */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() =>
                          onOpenLeadDetail(
                            leads?.find((l) => l.id === task.leadId) ?? ({ id: task.leadId } as Lead)
                          )
                        }
                        className="cursor-pointer group"
                      >
                        <div className="font-bold text-[#1F2421] group-hover:text-[#B85338] flex items-center gap-1.5">
                          <span>{task.ownerName}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-[#5E6660] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{task.propertyAddress}</span>
                        </div>
                      </div>
                    </td>

                    {/* Task Details */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="inline-block font-semibold px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700 border border-stone-200 mb-1">
                        {task.taskType}
                      </span>
                      <p
                        className="text-[11px] text-[#1F2421] line-clamp-2 leading-relaxed"
                        title={task.notes || undefined}
                      >
                        {latestNote(task.notes) || 'No task notes'}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <input
                          type="text"
                          value={noteDrafts[task.id] || ''}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                          }
                          disabled={!!task.completed}
                          placeholder="Add note (saved to lead when Done)…"
                          className="flex-1 min-w-0 text-[11px] bg-[#F8F6F1] border border-[#E4E0D6] rounded px-2 py-1 outline-none focus:border-[#B85338]"
                        />
                      </div>
                    </td>

                    {/* Assigned VA */}
                    <td className="py-3.5 px-4">
                      <select
                        value={drafts[task.id]?.assignedVA ?? task.assignedVA}
                        onChange={(e) => setDraft(task, { assignedVA: e.target.value as VA })}
                        disabled={!!task.completed}
                        className="bg-[#F8F6F1] hover:bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs font-bold text-[#1F2421] outline-none cursor-pointer"
                        title="Reassign Task to VA (saved to the lead when you tick Done)"
                      >
                        <option value="Rain">Rain</option>
                        <option value="Jah">Jah</option>
                        <option value="Jen">Jen</option>
                        <option value="David">David</option>
                      </select>
                    </td>

                    {/* Next Due Date */}
                    <td className="py-3.5 px-4 font-mono font-medium text-[11px] text-[#1F2421]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#5E6660] shrink-0" />
                        <input
                          type="date"
                          value={drafts[task.id]?.nextTaskDate ?? (task.nextTaskDate || '')}
                          onChange={(e) => {
                            if (e.target.value) setDraft(task, { nextTaskDate: e.target.value });
                          }}
                          disabled={!!task.completed}
                          className="bg-[#F8F6F1] border border-[#E4E0D6] rounded px-1.5 py-1 text-[11px] font-mono text-[#1F2421] outline-none cursor-pointer"
                          title={`Saved on Done to the ${task.sourceTabName} lead's ${
                            task.sourceTabName === 'Project Mgmt' ? 'callback' : 'follow-up'
                          } date`}
                        />
                      </div>
                    </td>

                    {/* Phone / Dial */}
                    <td className="py-3.5 px-4">
                      {task.phone ? (
                        <div className="flex items-center gap-1.5">
                          <DialLink
                            number={task.phone}
                            leadId={task.leadId}
                            onDial={() => onLaunchDialer(task.leadId, task.phone, true)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-[#4A7A5E] hover:bg-[#3E654E] text-white font-mono font-bold text-[10px] shadow-2xs transition-colors cursor-pointer no-underline"
                            title={`Click to dial ${task.phone}`}
                          >
                            <Phone className="w-2.5 h-2.5 fill-white" />
                            <span>DIAL</span>
                          </DialLink>
                          <span className="font-mono text-[11px] text-[#1F2421]">
                            {task.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#5E6660] italic">No phone</span>
                      )}
                    </td>

                    {/* Status / Source */}
                    <td className="py-3.5 px-4">
                      <select
                        value={drafts[task.id]?.status ?? (task.status || '')}
                        onChange={(e) => setDraft(task, { status: e.target.value })}
                        disabled={!!task.completed}
                        className="max-w-[170px] bg-[#F8F6F1] hover:bg-white border border-[#E4E0D6] rounded px-2 py-1 text-[11px] font-semibold text-[#1F2421] outline-none cursor-pointer"
                        title="Changes the lead's status when you tick Done (auto-routes stage & dates, same as the lead drawer)"
                      >
                        {task.status && !ALL_STATUS_VALUES.includes(task.status) && (
                          <option value={task.status}>{task.status}</option>
                        )}
                        {STATUS_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.text}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="block mt-0.5 text-[10px] text-[#5E6660]">
                        {task.sourceTabName}
                      </span>
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
