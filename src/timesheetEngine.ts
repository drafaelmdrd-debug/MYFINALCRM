import {
  VA,
  TimesheetAction,
  TimesheetPunch,
  VAPunchStatus,
  DayWorkSummary,
  TimesheetPayPeriodSummary,
} from '../types';

export const DEFAULT_SHIFT = {
  scheduledIn: '08:00', // 8:00 AM
  scheduledOut: '22:00', // 10:00 PM
  label: '8:00 AM - 10:00 PM',
};

export function getVAPunchStatus(punches: TimesheetPunch[]): {
  status: VAPunchStatus;
  lastActionTime?: string;
  lastAction?: TimesheetAction;
} {
  if (!punches || punches.length === 0) {
    return { status: 'LOGGED_OUT' };
  }

  // Sort ascending
  const sorted = [...punches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const lastPunch = sorted[sorted.length - 1];

  switch (lastPunch.action) {
    case 'LOGIN':
    case 'BIO_IN':
    case 'EMERGENCY_IN':
      return {
        status: 'WORKING',
        lastActionTime: lastPunch.timestamp,
        lastAction: lastPunch.action,
      };
    case 'BIO_OUT':
      return {
        status: 'BIO_BREAK',
        lastActionTime: lastPunch.timestamp,
        lastAction: lastPunch.action,
      };
    case 'EMERGENCY_OUT':
      return {
        status: 'EMERGENCY_BREAK',
        lastActionTime: lastPunch.timestamp,
        lastAction: lastPunch.action,
      };
    case 'LOGOUT':
    default:
      return {
        status: 'LOGGED_OUT',
        lastActionTime: lastPunch.timestamp,
        lastAction: lastPunch.action,
      };
  }
}

export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 00m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

export function formatLiveDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0h 00m 00s';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

export function formatDecimalHours(totalMinutes: number): string {
  const decimal = (totalMinutes / 60).toFixed(2);
  return `${decimal} hrs`;
}

export function calculateDaySummary(
  dateStr: string,
  punches: TimesheetPunch[],
  isToday: boolean = false
): DayWorkSummary {
  // Filter and sort punches for this specific day
  const dayPunches = punches
    .filter((p) => p.date === dateStr)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const dateObj = new Date(dateStr + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (dayPunches.length === 0) {
    return {
      date: dateStr,
      formattedDate,
      workingMinutes: 0,
      workingSeconds: 0,
      bioBreakMinutes: 0,
      emergencyBreakMinutes: 0,
      totalHoursFormatted: '0h 00m',
      liveFormatted: '0h 00m 00s',
      punches: [],
    };
  }

  let workingMs = 0;
  let bioMs = 0;
  let emergencyMs = 0;

  let currentWorkStart: number | null = null;
  let bioStart: number | null = null;
  let emergencyStart: number | null = null;

  let firstLoginTime: string | undefined = undefined;
  let lastLogoutTime: string | undefined = undefined;

  for (const punch of dayPunches) {
    const pTime = new Date(punch.timestamp).getTime();

    switch (punch.action) {
      case 'LOGIN':
        if (!firstLoginTime) {
          firstLoginTime = punch.timestamp;
        }
        // If already working from a previous open punch, accumulate elapsed time
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
        }
        // If was in break, close break
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
          bioStart = null;
        }
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
          emergencyStart = null;
        }
        currentWorkStart = pTime;
        break;

      case 'BIO_OUT':
        // Bio Out is start break -> pause duty
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
          currentWorkStart = null;
        }
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
        }
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
          emergencyStart = null;
        }
        bioStart = pTime;
        break;

      case 'BIO_IN':
        // Bio In is end break -> resume duty
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
          bioStart = null;
        }
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
          emergencyStart = null;
        }
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
        }
        currentWorkStart = pTime;
        break;

      case 'EMERGENCY_OUT':
        // Emergency Out is pause duty
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
          currentWorkStart = null;
        }
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
        }
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
          bioStart = null;
        }
        emergencyStart = pTime;
        break;

      case 'EMERGENCY_IN':
        // Emergency In is resume duty
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
          emergencyStart = null;
        }
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
          bioStart = null;
        }
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
        }
        currentWorkStart = pTime;
        break;

      case 'LOGOUT':
        if (currentWorkStart !== null && pTime > currentWorkStart) {
          workingMs += pTime - currentWorkStart;
          currentWorkStart = null;
        }
        if (bioStart !== null && pTime > bioStart) {
          bioMs += pTime - bioStart;
          bioStart = null;
        }
        if (emergencyStart !== null && pTime > emergencyStart) {
          emergencyMs += pTime - emergencyStart;
          emergencyStart = null;
        }
        lastLogoutTime = punch.timestamp;
        break;
    }
  }

  // If today and currently active, add real-time ongoing time
  if (isToday) {
    const now = Date.now();
    if (currentWorkStart !== null) {
      workingMs += Math.max(0, now - currentWorkStart);
    }
    if (bioStart !== null) {
      bioMs += Math.max(0, now - bioStart);
    }
    if (emergencyStart !== null) {
      emergencyMs += Math.max(0, now - emergencyStart);
    }
  } else {
    // For past days with unclosed open shifts:
    if (currentWorkStart !== null) {
      const lastPunchTime = dayPunches.length > 0
        ? new Date(dayPunches[dayPunches.length - 1].timestamp).getTime()
        : currentWorkStart;
      if (lastPunchTime > currentWorkStart) {
        workingMs += lastPunchTime - currentWorkStart;
      } else {
        // Standard shift cap: 8 hours or end of day
        const endOfDay = new Date(dateStr + 'T23:59:59').getTime();
        const standardShiftMs = 8 * 60 * 60 * 1000;
        const autoEndTime = Math.min(endOfDay, currentWorkStart + standardShiftMs);
        workingMs += Math.max(0, autoEndTime - currentWorkStart);
      }
    }
  }

  const workingSeconds = Math.max(0, Math.floor(workingMs / 1000));
  // Round to nearest minute for clean reporting, or floor if < 60s
  const workingMinutes = Math.max(0, Math.round(workingMs / 60000));
  const bioBreakMinutes = Math.max(0, Math.round(bioMs / 60000));
  const emergencyBreakMinutes = Math.max(0, Math.round(emergencyMs / 60000));

  return {
    date: dateStr,
    formattedDate,
    firstLogin: firstLoginTime,
    lastLogout: lastLogoutTime,
    workingMinutes,
    workingSeconds,
    bioBreakMinutes,
    emergencyBreakMinutes,
    totalHoursFormatted: formatDurationMinutes(workingMinutes),
    liveFormatted: formatLiveDuration(workingSeconds),
    punches: dayPunches,
  };
}

export function calculatePayPeriodSummary(
  va: VA,
  allPunches: TimesheetPunch[],
  periodDays: number = 14,
  customStartDate?: string,
  customEndDate?: string
): TimesheetPayPeriodSummary {
  // Filter for this VA
  const vaPunches = allPunches.filter((p) => p.va === va);

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];

  let dates: string[] = [];

  if (customStartDate && customEndDate) {
    const startObj = new Date(customStartDate + 'T12:00:00');
    const endObj = new Date(customEndDate + 'T12:00:00');
    if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime()) && startObj <= endObj) {
      const cur = new Date(startObj);
      while (cur <= endObj) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  // Fallback to periodDays up to today
  if (dates.length === 0) {
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  let totalMinutes = 0;
  let totalSeconds = 0;
  const dailySummaries: DayWorkSummary[] = [];

  for (const dateStr of dates) {
    const isToday = dateStr === todayDateStr;
    const summary = calculateDaySummary(dateStr, vaPunches, isToday);
    dailySummaries.push(summary);
    totalMinutes += summary.workingMinutes;
    totalSeconds += (summary.workingSeconds || summary.workingMinutes * 60);
  }

  return {
    va,
    periodStart,
    periodEnd,
    totalMinutes,
    totalSeconds,
    totalHoursFormatted: formatDurationMinutes(totalMinutes),
    dailySummaries,
  };
}
