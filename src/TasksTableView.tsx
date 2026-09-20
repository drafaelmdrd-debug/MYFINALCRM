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

interface TasksTableViewProps {
  tasks: CRMTask[];
  onRefreshTasks: () => void;
  onUpdateTask: (task: CRMTask, updatedFields: Partial<CRMTask>) => void;
  onCompleteTask: (taskId: string) => void;
  onOpenLeadDetail: (lead: Lead) => void;
  onLaunchDialer: (leadId: string, phoneNumber?: string, openedWithDial?: boolean) => void;
}

export function TasksTableView({
  tasks,
  onRefreshTasks,
  onUpdateTask,
  onCompleteTask,
  onOpenLeadDetail,
  onLaunchDialer,
}: TasksTableViewProps) {
  const [vaFilter, setVaFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tabFilter, setTabFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

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
                        onClick={() => onCompleteTask(task.id)}
                        className="cursor-pointer text-[#4A7A5E] hover:text-[#3E654E]"
                      >
                        {task.completed ? (
                          <CheckSquare className="w-5 h-5 fill-[#4A7A5E] text-white" />
                        ) : (
                          <Square className="w-5 h-5 text-stone-400" />
                        )}
                      </button>
                    </td>

                    {/* Task should be completed by: */}
                    <td className="py-3.5 px-4">
                      <select
                        value={task.taskAssignedTo || task.assignedVA || 'Rain'}
                        onChange={(e) => {
                          const newVA = e.target.value as VA;
                          onUpdateTask(task, { taskAssignedTo: newVA });
                        }}
                        className={`border rounded px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${
                          (task.taskAssignedTo || task.assignedVA) === 'David'
                            ? 'bg-purple-50 text-purple-900 border-purple-200'
                            : (task.taskAssignedTo || task.assignedVA) === 'Jah'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : (task.taskAssignedTo || task.assignedVA) === 'Jen'
                            ? 'bg-pink-50 text-pink-900 border-pink-200'
                            : 'bg-blue-50 text-blue-900 border-blue-200'
                        }`}
                        title="Task should be completed by: (David, Jah, Jen, Rain)"
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
                        onClick={() => onOpenLeadDetail({ id: task.leadId } as Lead)}
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
                      <p className="text-[11px] text-[#1F2421] line-clamp-2 leading-relaxed">
                        {task.taskNotes || task.notes || 'No task notes'}
                      </p>
                    </td>

                    {/* Assigned VA */}
                    <td className="py-3.5 px-4">
                      <select
                        value={task.assignedVA}
                        onChange={(e) =>
                          onUpdateTask(task, { assignedVA: e.target.value as VA })
                        }
                        className="bg-[#F8F6F1] hover:bg-white border border-[#E4E0D6] rounded px-2 py-1 text-xs font-bold text-[#1F2421] outline-none cursor-pointer"
                        title="Reassign Task to VA (Syncs to Lead)"
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
                        <Calendar className="w-3.5 h-3.5 text-[#5E6660]" />
                        <span>{task.nextTaskDate || 'No date set'}</span>
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
                      <div className="font-semibold text-[11px] text-[#1F2421]">
                        {task.status || 'Active'}
                      </div>
                      <span className="text-[10px] text-[#5E6660]">
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
