'use client';

/**
 * What has actually happened in this town, remembered across its systems.
 *
 * Before this, the civic systems were separate demos wearing a shared skin: each had its
 * own list of citizens and forgot everything the moment you walked out. This is the thread
 * that makes it one place — the same six adults move between the voting centre, the panchayat
 * and the bank (the school has its own graduating class), what they did in
 * one is visible in another, and the world outside changes when a case is resolved.
 *
 * It is deliberately not persisted. A visitor should get the pristine town every time, the
 * same way the map is reloaded fresh on every visit.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CITIZENS, Citizen } from './panchayat';

/** The town's roster. The panchayat's records are the richest, so they are the canonical ones. */
export const PEOPLE: Citizen[] = CITIZENS;
export const personById = (id: string) => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];

/** The bank account each person holds, so a name in one building is a balance in another. */
export const accountForPerson = (id: string): string => {
  const i = PEOPLE.findIndex((p) => p.id === id);
  return `AC${String((i < 0 ? 0 : i) + 1).padStart(3, '0')}`;
};

export type TownEventKind =
  | 'vote'            // a citizen cast a ballot
  | 'case'            // a grievance was filed and routed
  | 'resolved'        // a case came back resolved, and the world should show it
  | 'attack';         // someone tried to break something, and it held

export interface TownEvent {
  id: string;
  kind: TownEventKind;
  /** Who it happened to, when it happened to somebody. */
  personId?: string;
  /** Which system it came from. */
  system: 'voting' | 'panchayat' | 'bank' | 'school';
  label: string;
  detail: string;
  /** Grid tile the world should mark, when the event has a place. */
  at?: { x: number; y: number };
  ts: number;
}

/**
 * The attacks the town invites you to try. Naming them turns the security argument into
 * something you play rather than something you read.
 */
export interface Attack {
  id: string;
  system: 'voting' | 'panchayat' | 'bank' | 'school';
  title: string;
  /** What you actually do. */
  how: string;
  /** What holds, and why. */
  held: string;
}

export const ATTACKS: Attack[] = [
  {
    id: 'double-vote', system: 'voting',
    title: 'Vote twice as one person',
    how: 'Pick a citizen from the electoral roll who has already voted.',
    held: 'The roll is checked against the public chain before the booth. Her token is already in a block, so there is no second ballot to offer her.',
  },
  {
    id: 'rewrite-vote', system: 'voting',
    title: 'Rewrite a vote already cast',
    how: 'On the chain screen, click a sealed block and change who it voted for.',
    held: 'Every block from the break onward goes invalid at once, because each link is checked against what the previous block actually hashes to.',
  },
  {
    id: 'overstate', system: 'bank',
    title: 'Overstate the bank’s deposits',
    how: 'Press “Overstate by ₹50 L” on the solvency screen.',
    held: 'The product of the sealed account commitments no longer matches the declared total. No account had to be opened to catch it.',
  },
  {
    id: 'hide-rupee', system: 'bank',
    title: 'Hide a single rupee',
    how: 'Press “Hide ₹1” on the same screen.',
    held: 'A one-rupee lie fails exactly as loudly as a fifty-lakh one. The homomorphic check has no tolerance to hide inside.',
  },
  {
    id: 'forge-certificate', system: 'school',
    title: 'Change a mark on a degree',
    how: 'In the school, rewrite any field on an issued certificate.',
    held: 'The edited field stops hashing into the root the school signed, so its Merkle proof fails — while the signature itself still verifies, because the forger never touched the root.',
  },
  {
    id: 'confuse-desk', system: 'panchayat',
    title: 'Confuse the grievance desk',
    how: 'Speak or type nonsense into the panchayat, instead of a real problem.',
    held: 'Confidence collapses, the unseen-vocabulary gate trips, and the case is handed to a human instead of being guessed at.',
  },
];

interface TownStateValue {
  events: TownEvent[];
  record: (e: Omit<TownEvent, 'id' | 'ts'>) => void;
  /** Everything that has happened to one person, newest first. */
  forPerson: (personId: string) => TownEvent[];
  /** Attack ids the visitor has tried and seen hold. */
  defeated: string[];
  /** Mark an attack as attempted-and-held. Idempotent. */
  recordAttack: (attackId: string) => void;
  attacks: Attack[];
  clear: () => void;
}

const TownStateContext = createContext<TownStateValue | null>(null);

export const useTownState = (): TownStateValue => {
  const ctx = useContext(TownStateContext);
  if (!ctx) throw new Error('useTownState must be used inside <TownStateProvider>');
  return ctx;
};

let seq = 0;

export function TownStateProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [defeated, setDefeated] = useState<string[]>([]);

  const record = useCallback((e: Omit<TownEvent, 'id' | 'ts'>) => {
    seq += 1;
    // Date.now() only for ordering within a session; nothing here is persisted or compared
    // across visits.
    setEvents((prev) => [...prev, { ...e, id: `ev${seq}`, ts: Date.now() }]);
  }, []);

  const forPerson = useCallback(
    (personId: string) => events.filter((e) => e.personId === personId).slice().reverse(),
    [events],
  );

  const recordAttack = useCallback((attackId: string) => {
    setDefeated((prev) => (prev.includes(attackId) ? prev : [...prev, attackId]));
  }, []);

  const clear = useCallback(() => { setEvents([]); setDefeated([]); }, []);

  const value = useMemo<TownStateValue>(
    () => ({ events, record, forPerson, defeated, recordAttack, attacks: ATTACKS, clear }),
    [events, record, forPerson, defeated, recordAttack, clear],
  );

  return <TownStateContext.Provider value={value}>{children}</TownStateContext.Provider>;
}
