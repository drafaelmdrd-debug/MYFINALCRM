import { TimesheetPunch } from '../types';

export const INITIAL_PUNCHES: TimesheetPunch[] = [
  {
    id: 'punch-1',
    va: 'Rain',
    action: 'LOGIN',
    timestamp: '2026-09-18T09:00:00.000Z',
    date: '2026-09-18',
    note: 'Shift start - Cold outreach',
  },
  {
    id: 'punch-2',
    va: 'Rain',
    action: 'BIO_OUT',
    timestamp: '2026-09-18T12:00:00.000Z',
    date: '2026-09-18',
    note: 'Quick lunch/bio break',
  },
  {
    id: 'punch-3',
    va: 'Rain',
    action: 'BIO_IN',
    timestamp: '2026-09-18T12:30:00.000Z',
    date: '2026-09-18',
    note: 'Returned to dialer',
  },
  {
    id: 'punch-4',
    va: 'Jah',
    action: 'LOGIN',
    timestamp: '2026-09-18T09:15:00.000Z',
    date: '2026-09-18',
    note: 'Morning shift',
  },
  {
    id: 'punch-5',
    va: 'Jen',
    action: 'LOGIN',
    timestamp: '2026-09-18T08:45:00.000Z',
    date: '2026-09-18',
    note: 'Project management follow-ups',
  },
];
