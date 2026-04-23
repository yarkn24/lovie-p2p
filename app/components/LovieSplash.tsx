'use client';

import { useEffect, useMemo, useState } from 'react';
import './lovie-splash.css';

const WORD = 'Lovie';
const LETTERS = WORD.split('');

function Letter({ ch, i, delayStep = 0.08 }: { ch: string; i: number; delayStep?: number }) {
  return (
    <span style={{ animationDelay: `${i * delayStep}s` }}>
      {ch === ' ' ? ' ' : ch}
    </span>
  );
}

function Staggered({ className, delayStep = 0.08 }: { className: string; delayStep?: number }) {
  return (
    <span className={className}>
      {LETTERS.map((c, i) => (
        <Letter key={i} ch={c} i={i} delayStep={delayStep} />
      ))}
    </span>
  );
}

function Scramble({ duration = 1400 }: { duration?: number }) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%&*?!';
  const [text, setText] = useState('-----');
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const settled = Math.floor(t * LETTERS.length);
      let out = '';
      for (let i = 0; i < LETTERS.length; i++) {
        if (i < settled) out += LETTERS[i];
        else out += chars[Math.floor(Math.random() * chars.length)];
      }
      setText(out);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setText(WORD);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return <span className="lv-scramble">{text}</span>;
}

function ReelChar({ target, offset }: { target: string; offset: number }) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const targetIdx = chars.indexOf(target);
  const len = 22;
  const items = Array.from({ length: len }, (_, i) => chars[(i * 3 + offset) % chars.length]);
  items.push(target);
  return (
    <span className="lv-reel">
      <span className="lv-reel-inner" style={{ ['--steps' as string]: len, animationDelay: `${offset * 0.08}s` } as React.CSSProperties}>
        {items.map((c, i) => <span key={i}>{c === target && i === len ? target : c}</span>)}
      </span>
    </span>
  );
}

type VariantFn = () => React.ReactElement;

const variants: VariantFn[] = [
  // 01 typewriter
  () => (
    <div className="lv-full lv-bg-ink">
      <div className="lv-font-mono lv-big" style={{ fontWeight: 700 }}>
        <span className="lv-type">{WORD}</span><span className="lv-cursor" />
      </div>
    </div>
  ),

  // 02 vault
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-vault-inner lv-font-archivo lv-big" style={{ color: '#f59e0b', letterSpacing: '0.05em' }}>{WORD}</div>
      <div className="lv-vault-door lv-vault-door-l"><div className="lv-vault-wheel" /></div>
      <div className="lv-vault-door lv-vault-door-r"><div className="lv-vault-wheel" /></div>
    </div>
  ),

  // 03 cascade
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-serif lv-big lv-cascade" style={{ color: '#0f172a' }}>
        {LETTERS.map((c, i) => <Letter key={i} ch={c} i={i} delayStep={0.09} />)}
      </div>
    </div>
  ),

  // 04 gradient wipe
  () => (
    <div className="lv-full" style={{ background: '#0f172a' }}>
      <div className="lv-wipe-bg" />
      <div className="lv-wipe-text lv-font-sans lv-big" style={{ color: '#fff' }}>{WORD}</div>
    </div>
  ),

  // 05 neon
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-lobster lv-big lv-neon">{WORD}</div>
    </div>
  ),

  // 06 zoom blur
  () => (
    <div className="lv-full lv-bg-brand">
      <div className="lv-font-archivo lv-big lv-zoom-blur" style={{ color: '#fff' }}>{WORD}</div>
    </div>
  ),

  // 07 split reveal
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-fat lv-big">
        <span className="lv-split-wrap">
          <span className="lv-split-base">{WORD}</span>
          <span className="lv-split-top">{WORD}</span>
          <span className="lv-split-bot">{WORD}</span>
        </span>
      </div>
    </div>
  ),

  // 08 3D flip
  () => (
    <div className="lv-full lv-bg-ink">
      <div className="lv-font-engraved lv-mid lv-3d-flip" style={{ color: '#ffd36d' }}>{WORD}</div>
    </div>
  ),

  // 09 stagger pop
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-fat lv-big lv-stagger" style={{ color: '#0546bf' }}>
        {LETTERS.map((c, i) => <Letter key={i} ch={c} i={i} delayStep={0.1} />)}
      </div>
    </div>
  ),

  // 10 letter-spacing refine
  () => (
    <div className="lv-full lv-bg-white">
      <div className="lv-font-elegant lv-big lv-refine" style={{ color: '#0f172a' }}>{WORD}</div>
    </div>
  ),

  // 11 glitch
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-blocky lv-mid">
        <span className="lv-glitch-wrap" data-text={WORD}>
          <span className="lv-glitch-base">{WORD}</span>
        </span>
      </div>
    </div>
  ),

  // 12 gold shine
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-engraved lv-mid lv-gold">{WORD}</div>
    </div>
  ),

  // 13 wave
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-fat lv-big lv-wave" style={{ color: '#f97316' }}>
        {LETTERS.map((c, i) => <Letter key={i} ch={c} i={i} delayStep={0.1} />)}
      </div>
    </div>
  ),

  // 14 card flip
  () => (
    <div className="lv-full lv-bg-ink">
      <div className="lv-font-archivo lv-big lv-card-flip" style={{ color: '#fff' }}>
        {LETTERS.map((c, i) => <Letter key={i} ch={c} i={i} delayStep={0.12} />)}
      </div>
    </div>
  ),

  // 15 reel (slot machine)
  () => (
    <div className="lv-full lv-bg-ink">
      <div className="lv-font-mono lv-mid lv-reel-wrap" style={{ color: '#fff', fontWeight: 700 }}>
        {LETTERS.map((c, i) => <ReelChar key={i} target={c} offset={i} />)}
      </div>
    </div>
  ),

  // 16 curtain
  () => (
    <div className="lv-full" style={{ background: '#1a0606' }}>
      <div className="lv-font-engraved lv-big" style={{ color: '#fbbf24' }}>{WORD}</div>
      <div className="lv-curtain lv-curtain-l" />
      <div className="lv-curtain lv-curtain-r" />
    </div>
  ),

  // 17 zipper
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-blocky lv-big" style={{ color: '#0546bf' }}>{WORD}</div>
      <div className="lv-zip-panel lv-zip-top" />
      <div className="lv-zip-panel lv-zip-bot" />
    </div>
  ),

  // 18 ink bleed
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-serif lv-big lv-ink" style={{ color: '#0f172a' }}>{WORD}</div>
    </div>
  ),

  // 19 handwriting script
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-script lv-big lv-handwrite" style={{ color: '#0546bf' }}>
        {LETTERS.map((c, i) => <Letter key={i} ch={c} i={i} delayStep={0.12} />)}
      </div>
    </div>
  ),

  // 20 terminal
  () => (
    <div className="lv-full lv-term">
      <div className="lv-font-mono lv-mid" style={{ fontWeight: 700 }}>
        <span className="lv-term-prompt" />
        <span className="lv-type">{WORD}</span>
        <span className="lv-cursor" />
      </div>
    </div>
  ),

  // 21 spotlight
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-sans lv-big lv-spotlight" style={{ color: '#fff' }}>{WORD}</div>
    </div>
  ),

  // 22 paper fold
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-condensed lv-big lv-fold" style={{ color: '#0f172a' }}>{WORD}</div>
    </div>
  ),

  // 23 elastic
  () => (
    <div className="lv-full lv-bg-brand">
      <div className="lv-font-fat lv-big lv-elastic" style={{ color: '#fff' }}>{WORD}</div>
    </div>
  ),

  // 24 scramble
  () => (
    <div className="lv-full lv-bg-ink">
      <div className="lv-font-mono lv-mid" style={{ color: '#22c55e', fontWeight: 700 }}>
        <Scramble duration={1400} />
      </div>
    </div>
  ),

  // 25 marquee slide
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-condensed lv-huge lv-marquee" style={{ color: '#0546bf' }}>{WORD}</div>
    </div>
  ),

  // 26 heartbeat
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-fat lv-big lv-beat" style={{ color: '#dc2626' }}>{WORD}</div>
    </div>
  ),

  // 27 smoke
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-serif lv-big lv-smoke" style={{ color: '#fff' }}>{WORD}</div>
    </div>
  ),

  // 28 rainbow gradient
  () => (
    <div className="lv-full lv-bg-black">
      <div className="lv-font-archivo lv-big lv-rainbow">{WORD}</div>
    </div>
  ),

  // 29 origami
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-engraved lv-mid lv-origami" style={{ color: '#0f172a' }}>{WORD}</div>
    </div>
  ),

  // 30 liquid fill
  () => (
    <div className="lv-full lv-bg-cream">
      <div className="lv-font-archivo lv-big lv-liquid">{WORD}</div>
    </div>
  ),
];

export default function LovieSplash({
  onDone,
  duration = 2300,
}: {
  onDone: () => void;
  duration?: number;
}) {
  const idx = useMemo(() => Math.floor(Math.random() * variants.length), []);
  const [leaving, setLeaving] = useState(false);
  const Variant = variants[idx];

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), duration);
    const done = setTimeout(onDone, duration + 300);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, [onDone, duration]);

  return (
    <div className={leaving ? 'lv-leaving' : undefined}>
      <Variant />
    </div>
  );
}
