import React from 'react';
import { getDialHref, triggerImmediateDial } from '../dialerProtocol';
import { broadcastDialerSync } from '../utils/dialerSyncChannel';

interface DialLinkProps {
  id?: string;
  number?: string;
  leadId?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  stopClickPropagation?: boolean;
  openPopout?: boolean;
  onDial?: (arg: { number: string }) => void;
  onNoNumber?: () => void;
}

export function DialLink({
  id,
  number,
  leadId,
  children,
  className = '',
  title,
  stopClickPropagation = false,
  onDial,
  onNoNumber,
}: DialLinkProps) {
  const href = number ? getDialHref(number) : undefined;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Prevent default anchor link navigation so browser doesn't execute dual-navigation
    // and wait to resolve competing href + window.location
    e.preventDefault();

    if (stopClickPropagation) {
      e.stopPropagation();
    }

    if (!number) {
      onNoNumber?.();
      return;
    }

    // Immediately send request to dial using window.location="dialpad:" + number (not number sensitive)
    triggerImmediateDial(number);

    // Trigger onDial callback
    onDial?.({ number });

    // Sync state for active dialer lead without opening interactive popout
    broadcastDialerSync({
      action: 'dial',
      leadId,
      phoneNumber: number,
      isCalling: true,
    });
  };

  return (
    <a
      id={id}
      href={href || '#'}
      onClick={handleClick}
      className={className}
      title={title}
    >
      {children}
    </a>
  );
}
