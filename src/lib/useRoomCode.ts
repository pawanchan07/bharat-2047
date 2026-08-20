'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { ROOM_SHELL } from './roomShell';

/**
 * The room code the visitor actually followed.
 *
 * Read from the address bar rather than from the route params, because after the Worker
 * rewrites a room URL onto the shell, the param Next hands back is the placeholder rather
 * than the code. The params are still
 * consulted first so this keeps working in `next dev`, where the route really is dynamic.
 */
export function useRoomCode(): string | undefined {
  const params = useParams();
  const fromParams = (params?.roomCode as string | undefined)?.toUpperCase();

  const [code, setCode] = useState<string | undefined>(
    fromParams && fromParams !== ROOM_SHELL.toUpperCase() ? fromParams : undefined,
  );

  // The URL is only readable in the browser, and only after hydration, so the shell renders
  // once without a code and fills it in immediately. The modal treats an absent code as
  // "ask me for one", which is the correct state for that single frame anyway.
  useEffect(() => {
    const last = window.location.pathname.split('/').filter(Boolean).pop();
    if (last && last.toUpperCase() !== ROOM_SHELL.toUpperCase()) {
      setCode(last.toUpperCase());
    }
  }, []);

  return code;
}
