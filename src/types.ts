export type VA = 'Rain' | 'Jah' | 'Jen' | 'David' | 'Unassigned';

export type DialerMode = 'desktop' | 'popout_only' | 'chrome' | 'hybrid';

export type MainNavView =
  | 'power-dialer'
  | 'deal-pipeline'
  | 'daily-tasks'
  | 'dnc'
  | 'language-barrier'
  | 'campaigns'
  | 'search'
  | 'metrics'
  | 'timesheet';

export type StageId =
  | 'Project Mgmt'
  | 'Follow-Up'
  | 'TASK'
  | "KPI's"
  | 'Dallas'
  | 'Tarrant'
  | 'Manually Found'
  | 'Vacant Lots'
  | 'DNC'
  | 'Language Barrier';

export type SourceTabId =
  | 'Dallas'
  | 'Tarrant'
  | 'Manually Found'
  | 'Vacant Lots'
  | 'Legacy Dallas'
  | 'Legacy Dallas Old'
  | 'Large Acres'
  | 'TAX'
  | '75210'
  | '75215'
  | '75210 & 75215'
  | 'ResempliAddressesPulled'
  | (string & {});

export interface FollowUpTaskKPIs {
  Jen: number;
  Jah: number;
  Rain: number;
  David: number;
}

export interface ContactPerson {
  id: string;
  name: string;
  role?: string;
  phoneNumbers?: PhoneNumberRecord[];
  notes?: string;
}

export interface PhoneNumberRecord {
  id: string;
  number: string;
  label: string;
  contactName?: string;
  contactRole?: string;
  lastDispo?: string;
  rawText?: string;
}

export interface Lead {
  id: string;
  leadId: string;
  ownerName: string;
  propertyAddress: string;
  city?: string;
  zipCode?: string;
  contacts?: ContactPerson[];
  phoneNumbers: PhoneNumberRecord[];
  stageId: StageId;
  sourceTab: SourceTabId;
  assignedVA: VA;
  vaStatus: string;
  davidStatus?: string;
  vaFollowUpStatus?: string;
  originalStatus?: string;
  howTheyCameIn?: string;
  outreachStatus: string;
  callNotes: string;
  vaNotes?: string;
  askingPrice?: string;
  startingOffer?: string;
  maxOffer?: string;
  counterOffer?: string;
  callbackDate?: string;
  followUpDate?: string;
  pushedDate?: string;
  dateAdded?: string;
  dateAddedToDNC?: string;
  markedBy?: string;
  languageType?: string;
  campaign: string;
  callsCount: number;
  lastCallDate?: string;
  lastDispo?: string;
  taskAssignedTo?: VA;
  promotedToPipeline?: boolean;
  propertyDetails?: {
    beds?: number;
    baths?: number;
    sqft?: number;
    taxDelinquentAmount?: string;
    estimatedValue?: string;
    parcelId?: string;
  };
}

export type Disposition =
  | 'VM'
  | 'Not Interested - 30 Days'
  | 'Not Interested - 60 Days'
  | 'Not Interested - 90 Days'
  | 'Not Ready to Sell - 30 Days'
  | 'Not Ready to Sell - 60 Days'
  | 'Not Ready to Sell - 90 Days'
  | 'WRONG #'
  | 'ANS MACHINE'
  | 'RINGING ONLY'
  | 'DNC'
  | 'DC/ NOT A WORKING #'
  | 'Spanish'
  | 'CANNOT BE DIALED / NOT IN SERVICE'
  | 'HUNG UP'
  | 'Interested'
  | 'Interested - Has Asking Price'
  | 'CALLBACK'
  | 'NO ANSWER'
  | 'LISTED ON MLS'
  | 'BEEP/FAX TONE';

export type TaskType = 'Callback' | 'Follow up' | 'Need Comps' | 'In Person Meeting';

export interface CRMTask {
  id: string;
  leadId: string;
  ownerName: string;
  propertyAddress: string;
  notes: string;
  taskType: TaskType;
  time: string;
  assignedVA: VA;
  taskAssignedTo?: VA;
  nextTaskDate: string;
  taskNotes: string;
  blankCol: string;
  phone: string;
  status: string;
  offerDetails: string;
  sourceTabName: 'Project Mgmt' | 'Follow-Up';
  completed?: boolean;
  completedAt?: string;
}

export interface CallResultCount {
  [disposition: string]: {
    Rain: number;
    Jah: number;
    Jen: number;
    David: number;
    total: number;
  };
}

export interface VAStats {
  myLeads: number;
  interested: number;
  callbacks: number;
  notInterested: number;
  notReady: number;
  listed: number;
  dealWon: number;
  dnc: number;
  spanish: number;
}

export interface CallLogEntry {
  id: string;
  leadId: string;
  phoneNumber: string;
  disposition: Disposition;
  agent: VA;
  timestamp: string; // ISO date string
  date: string; // YYYY-MM-DD
  notes?: string;
}

export type TimesheetAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'BIO_IN'
  | 'BIO_OUT'
  | 'EMERGENCY_IN'
  | 'EMERGENCY_OUT';

export interface TimesheetPunch {
  id: string;
  va: VA;
  action: TimesheetAction;
  timestamp: string; // ISO string e.g. "2026-09-17T09:00:00.000Z"
  date: string; // YYYY-MM-DD
  note?: string;
}

export type VAPunchStatus = 'LOGGED_OUT' | 'WORKING' | 'BIO_BREAK' | 'EMERGENCY_BREAK';

export interface DayWorkSummary {
  date: string; // YYYY-MM-DD
  formattedDate: string; // "Thu, Sep 17"
  firstLogin?: string;
  lastLogout?: string;
  workingMinutes: number;
  workingSeconds?: number;
  bioBreakMinutes: number;
  emergencyBreakMinutes: number;
  totalHoursFormatted: string; // e.g. "7h 45m"
  liveFormatted?: string; // e.g. "7h 45m 12s"
  punches: TimesheetPunch[];
}

export interface TimesheetPayPeriodSummary {
  va: VA;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  totalMinutes: number;
  totalSeconds?: number;
  totalHoursFormatted: string; // e.g. "78h 30m"
  dailySummaries: DayWorkSummary[];
}

