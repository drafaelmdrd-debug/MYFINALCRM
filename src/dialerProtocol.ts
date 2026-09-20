import { DialerMode } from './types';

let dialerMode: DialerMode = (() => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('groundwork_crm_dialer_mode') : null;
  if (saved === 'desktop' || saved === 'popout_only' || saved === 'chrome' || saved === 'hybrid') {
    return saved as DialerMode;
  }
  return 'desktop';
})();

let globalCallState = {
  isCalling: false,
  activeLeadId: undefined as string | undefined,
  activePhoneNumber: undefined as string | undefined,
  startTime: undefined as number | undefined,
  startedAt: undefined as number | undefined,
};

export function getDialerMode(): DialerMode {
  return dialerMode;
}

export function setDialerMode(mode: DialerMode): void {
  dialerMode = mode;
  if (typeof window !== 'undefined') {
    localStorage.setItem('groundwork_crm_dialer_mode', mode);
    window.dispatchEvent(new CustomEvent('crm-dialer-mode-changed', { detail: mode }));
  }
}

export function getDialHref(phoneNumber?: string): string {
  if (!phoneNumber) return '';
  return "dialpad:" + phoneNumber;
}

/**
 * Fastest immediate dialing protocol dispatch.
 * Fires direct top-level navigation (window.location = "dialpad:" + number)
 * which instantly hands off to the operating system / Dialpad client without delay,
 * backed by an instant hidden frame ping.
 */
export function triggerImmediateDial(phoneNumber?: string): void {
  if (!phoneNumber) return;
  const uri = "dialpad:" + phoneNumber;

  // Direct location assign is the fastest way to trigger the native OS handler
  try {
    window.location.assign(uri);
  } catch {
    try {
      (window as any).location = uri;
    } catch {
      window.location.href = uri;
    }
  }

  // Backup dispatch via hidden transport element to guarantee immediate OS wake
  try {
    let dialerFrame = document.getElementById('gw-dialer-transport') as HTMLIFrameElement | null;
    if (!dialerFrame) {
      dialerFrame = document.createElement('iframe');
      dialerFrame.id = 'gw-dialer-transport';
      dialerFrame.style.display = 'none';
      document.body.appendChild(dialerFrame);
    }
    dialerFrame.src = uri;
  } catch {
    // Ignore backup failure
  }
}

export function getGlobalCallState() {
  return { ...globalCallState };
}

export function setGlobalCallState(state: Partial<typeof globalCallState>) {
  globalCallState = {
    ...globalCallState,
    ...state,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-call-state-changed', { detail: globalCallState }));
  }
}

export function resetCallState() {
  globalCallState = {
    isCalling: false,
    activeLeadId: undefined,
    activePhoneNumber: undefined,
    startTime: undefined,
    startedAt: undefined,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-call-state-changed', { detail: globalCallState }));
  }
}
