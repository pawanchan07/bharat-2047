'use client';

/**
 * What the town has to show for your visit.
 *
 * Three things that only make sense together, so they live in one panel:
 *
 * - **What happened**: the consequence loop. Vote, file a grievance, catch the bank in a
 *   lie, and the town outside registers it instead of forgetting the moment you close a
 *   screen. MIT CityScope is listed in VISION as an inspiration; this is it.
 * - **Try to break it**: every named attack in the town. The attacks already existed; making them
 *   a checklist turns the security argument into the thing you play rather than read.
 * - **Your proof card**: a receipt of what you personally did here, drawn to a canvas you
 *   can save. A flagship project should leave with the visitor.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PEOPLE, useTownState } from './TownState';

type Tab = 'log' | 'break' | 'card';

const SYSTEM_META: Record<'voting' | 'panchayat' | 'bank' | 'school', { icon: string; name: string }> = {
  voting: { icon: '🗳️', name: 'Digital Voting Centre' },
  panchayat: { icon: '🏛️', name: 'AI Panchayat Kendra' },
  bank: { icon: '🏦', name: 'Bank of Bharat' },
  school: { icon: '🏫', name: 'National Digital School' },
};

export function TownLedger({ onClose }: { onClose: () => void }) {
  const town = useTownState();
  const [tab, setTab] = useState<Tab>('log');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  const people = useMemo(() => {
    return PEOPLE.map((p) => ({ person: p, events: town.forPerson(p.id) }))
      .filter((r) => r.events.length > 0);
  }, [town]);

  const votes = town.events.filter((e) => e.kind === 'vote').length;
  const cases = town.events.filter((e) => e.kind === 'case').length;
  const held = town.defeated.length;

  /**
   * Draw the receipt. A canvas rather than a screenshot, so the text is crisp and the card
   * says exactly what happened rather than whatever happened to be on screen.
   */
  const drawCard = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = 1200, H = 630;
    c.width = W; c.height = H;

    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);

    // tricolour rule
    const bar = 8;
    ['#FF9933', '#FFFFFF', '#138808'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, i * bar, W, bar);
    });

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('Bharat 2047', 64, 130);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('What I did in Rampur, Ward 04', 64, 172);

    // the three numbers
    const stats: [string, string][] = [
      [String(votes), votes === 1 ? 'vote cast' : 'votes cast'],
      [String(cases), cases === 1 ? 'grievance filed' : 'grievances filed'],
      [`${held}/${town.attacks.length}`, 'attacks that held'],
    ];
    stats.forEach(([big, small], i) => {
      const x = 64 + i * 370;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 220, 330, 130);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 62px system-ui, sans-serif';
      ctx.fillText(big, x + 24, 298);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(small, x + 24, 330);
    });

    // the last few things that happened
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('THE LAST FEW THINGS THAT HAPPENED', 64, 404);
    const recent = town.events.slice(-4).reverse();
    if (recent.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText('Nothing yet. Walk into a building.', 64, 448);
    }
    recent.forEach((e, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '22px system-ui, sans-serif';
      const line = `${SYSTEM_META[e.system].icon}  ${e.label}`;
      ctx.fillText(line.length > 74 ? line.slice(0, 71) + '…' : line, 64, 448 + i * 38);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Every mechanism above really ran, in my browser.  bharat.pawanchander.com', 64, 596);

    setCardUrl(c.toDataURL('image/png'));
  }, [town, votes, cases, held]);

  const openCardTab = useCallback(() => {
    setTab('card');
    // The canvas has to exist before it can be drawn on.
    requestAnimationFrame(drawCard);
  }, [drawCard]);

  return (
    <div className="absolute bottom-4 left-4 z-30 flex max-h-[min(74vh,600px)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1020]/97 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="font-semibold text-white">The town remembers</div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-1 border-b border-white/10 px-2 py-2">
        {([
          ['log', `What happened${town.events.length ? ` (${town.events.length})` : ''}`],
          ['break', `Try to break it (${held}/${town.attacks.length})`],
          ['card', 'Proof card'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => (key === 'card' ? openCardTab() : setTab(key))}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
              tab === key ? 'bg-amber-500 text-black' : 'text-white/55 hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* ------------------------------------------------------------- LOG */}
        {tab === 'log' && (
          town.events.length === 0 ? (
            <p className="text-sm text-white/45">
              Nothing has happened yet. Walk into a building, cast a vote, bring a grievance,
              try to cook the bank&apos;s books, and the town will register it here rather than
              forgetting the moment you close the screen.
            </p>
          ) : (
            <>
              {people.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-white/30">
                    The same people, across buildings
                  </div>
                  <div className="space-y-1.5">
                    {people.map(({ person, events }) => (
                      <div key={person.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-sm font-medium text-white/85">
                          {person.name} <span className="text-white/35">· {person.village}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {events.map((e) => (
                            <span key={e.id} className="text-[11px] text-emerald-300/80">
                              {SYSTEM_META[e.system].icon} {e.label.replace(person.name, '').trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-2 text-[10px] uppercase tracking-widest text-white/30">Everything, newest first</div>
              <ol className="space-y-3">
                {[...town.events].reverse().map((e) => (
                  <li key={e.id} className="border-l-2 border-white/10 pl-3">
                    <div className="flex items-start gap-2">
                      <span aria-hidden>{SYSTEM_META[e.system].icon}</span>
                      <div>
                        <div className={`text-sm font-medium ${
                          e.kind === 'attack' ? 'text-amber-200' : e.kind === 'resolved' ? 'text-emerald-300' : 'text-white/85'
                        }`}>
                          {e.label}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{e.detail}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )
        )}

        {/* ----------------------------------------------------------- BREAK */}
        {tab === 'break' && (
          <>
            <p className="mb-4 text-sm text-white/55">
              {town.attacks.length} things this town invites you to try. None of them is a trick question. Each
              one really works the way it says, and each one really holds. The point is not that
              you cannot break it; it is that you can watch exactly why not.
            </p>
            <div className="space-y-2.5">
              {town.attacks.map((a) => {
                const done = town.defeated.includes(a.id);
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl border p-3 ${
                      done ? 'border-emerald-400/35 bg-emerald-500/[0.07]' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={done ? 'text-emerald-400' : 'text-white/25'} aria-hidden>
                        {done ? '✓' : '○'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white/90">{a.title}</div>
                        <div className="text-[11px] text-white/40">
                          {SYSTEM_META[a.system].icon} {SYSTEM_META[a.system].name}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                          {done ? a.held : a.how}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {held === town.attacks.length && (
              <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-3 text-sm text-emerald-200">
                Every one held. That is the argument: not that the town is clever, but that you
                were able to check it yourself, without being asked to trust anyone.
              </p>
            )}
          </>
        )}

        {/* ------------------------------------------------------------ CARD */}
        {tab === 'card' && (
          <>
            <p className="mb-3 text-sm text-white/55">
              A receipt for your visit: what you did, and how much of it held. Drawn here in
              your browser, like everything else.
            </p>
            <canvas ref={canvasRef} className="hidden" />
            {cardUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardUrl}
                alt="Your Bharat 2047 proof card"
                className="mb-3 w-full rounded-xl border border-white/15"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={cardUrl ?? '#'}
                download="bharat-2047.png"
                onClick={(e) => { if (!cardUrl) e.preventDefault(); }}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
              >
                Save the card
              </a>
              <button
                onClick={drawCard}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                Redraw
              </button>
            </div>
            {town.events.length === 0 && (
              <p className="mt-3 text-[11px] text-white/35">
                It is mostly empty because nothing has happened yet. Go and do something first;
                the card is a record, not a poster.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
