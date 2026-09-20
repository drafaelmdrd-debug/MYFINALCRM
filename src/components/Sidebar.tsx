import React from 'react';
import {
  PhoneCall,
  Kanban,
  CheckSquare,
  ShieldAlert,
  Languages,
  Layers,
  BarChart3,
  Clock,
  Search,
  FileSearch,
} from 'lucide-react';
import { MainNavView } from '../types';

interface SidebarProps {
  currentView: MainNavView;
  onViewChange: (view: MainNavView) => void;
  callingListCount: number;
  pipelineCount: number;
  dailyTasksCount: number;
  dncCount: number;
  languageBarrierCount: number;
  needsDeepdiveCount?: number;
}

export function Sidebar({
  currentView,
  onViewChange,
  callingListCount,
  pipelineCount,
  dailyTasksCount,
  dncCount,
  languageBarrierCount,
  needsDeepdiveCount = 0,
}: SidebarProps) {
  const navItems: {
    id: MainNavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'power-dialer',
      label: 'Power Dialer',
      icon: PhoneCall,
      count: callingListCount,
      badgeColor: 'bg-[#4A7A5E]/15 text-[#4A7A5E]',
    },
    {
      id: 'deal-pipeline',
      label: 'Deal Pipeline',
      icon: Kanban,
      count: pipelineCount,
      badgeColor: 'bg-[#B85338]/15 text-[#B85338]',
    },
    {
      id: 'daily-tasks',
      label: 'Daily Tasks',
      icon: CheckSquare,
      count: dailyTasksCount,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'dnc',
      label: 'Do Not Call (DNC)',
      icon: ShieldAlert,
      count: dncCount,
      badgeColor: 'bg-stone-200 text-stone-700',
    },
    {
      id: 'language-barrier',
      label: 'Language Barrier',
      icon: Languages,
      count: languageBarrierCount,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'needs-skiptracing',
      label: 'Needs Skiptracing/Deepdive',
      icon: FileSearch,
      count: needsDeepdiveCount,
      badgeColor: 'bg-violet-100 text-violet-800',
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: Layers,
    },
    {
      id: 'metrics',
      label: 'KPIs & Analytics',
      icon: BarChart3,
    },
    {
      id: 'timesheet',
      label: 'VA Timesheet',
      icon: Clock,
    },
  ];

  return (
    <aside className="w-64 bg-[#FFFFFF] border-r border-[#E4E0D6] flex flex-col justify-between shrink-0 select-none">
      <div className="p-4 space-y-1">
        <div className="text-[10px] font-bold text-[#5E6660] uppercase tracking-wider px-3 mb-2">
          CRM Workspace
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.id ||
            (item.id === 'needs-skiptracing' && currentView === 'needs-deepdive');
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1F2421] text-white shadow-xs'
                  : 'text-[#5E6660] hover:text-[#1F2421] hover:bg-[#F8F6F1]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#B85338]' : 'text-[#5E6660]'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {typeof item.count === 'number' && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-[#E4E0D6] text-[11px] text-[#5E6660] space-y-1">
        <div className="font-semibold text-[#1F2421]">GroundWork Automated Sync</div>
        <p className="text-[10px] leading-relaxed">
          Lead routing & KPI tracking active across Power Dialer and Pipelines.
        </p>
      </div>
    </aside>
  );
}
