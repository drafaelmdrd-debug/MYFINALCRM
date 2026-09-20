export interface DialerSyncPayload {
  action?: string;
  openPopout?: boolean;
  leadId?: string;
  phoneNumber?: string;
  phoneIndex?: number;
  nextDialIdx?: number;
  selectedDispo?: any;
  agent?: any;
  isCalling?: boolean;
  callSeconds?: number;
  startTime?: number | null;
  notes?: string;
  askingPrice?: string;
  [key: string]: any;
}

type SyncCallback = (data: DialerSyncPayload) => void;

const listeners = new Set<SyncCallback>();

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel('crm_dialer_sync');
    channel.onmessage = (event) => {
      if (event.data) {
        listeners.forEach((cb) => {
          try {
            cb(event.data);
          } catch (e) {
            console.error('Error in dialerSync listener', e);
          }
        });
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not supported or restricted', e);
  }
}

export function broadcastDialerSync(data: DialerSyncPayload): void {
  // 1. Broadcast across tabs
  if (channel) {
    try {
      channel.postMessage(data);
    } catch (e) {
      console.warn('Error broadcasting dialer sync', e);
    }
  }

  // 2. Broadcast within current window
  listeners.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('Error in local dialerSync listener', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_dialer_sync', { detail: data }));
  }
}

export function subscribeDialerSync(callback: SyncCallback): () => void {
  listeners.add(callback);

  const localHandler = (e: Event) => {
    const custom = e as CustomEvent<DialerSyncPayload>;
    if (custom.detail) {
      // Local handlers are already called directly, but window event acts as safety fallback
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('crm_dialer_sync', localHandler);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('crm_dialer_sync', localHandler);
    }
  };
}
