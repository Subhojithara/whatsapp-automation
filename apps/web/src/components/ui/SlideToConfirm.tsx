"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

/* ══ Slide to confirm ═════════════════════════════════════
   A handle you push across a track. It follows the finger
   exactly, and past the mark it takes over and finishes the
   journey itself.

   THE HANDLE BECOMES THE ANSWER. On commit it does not hand
   over to a tick somewhere else — it unfurls leftward and
   fills the track it was crossing, and the arrow it was
   carrying becomes a check. One object changing shape, which
   is the case a morph is actually for, and the reason this
   needs no second element to say "done".

   The right edge does not move while that happens: the width
   grows by exactly what the offset loses. So the handle
   arrives, plants itself, and opens out behind it.

   ── velurix adaptation ────────────────────────────────────
   Wrapped in a `confirming` gate and wired to an `onConfirm`
   callback: used as the launch control of the campaign wizard,
   where a bulk send to hundreds of recipients should cost more
   than one slip of the finger. When `onConfirm` is provided
   the finished state holds instead of resetting — the wizard
   closes on launch, and a self-resetting confirm would lie
   about whether the send went out. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const SPAN = 240;
const H = 48;
/* the inset the handle keeps from the track, all four sides */
const PAD = 4;
/* the handle is a circle in a 48 track, so it is sized by the
   HEIGHT and the width knob does not touch it. Widening the
   track buys travel, not a longer handle — the thing you push
   stays the thing you push. */
const GRIP = H - PAD * 2;
/* the shortest track worth drawing. Below this the centred
   label starts to sit under the resting handle, which is the
   one collision this layout has. */
const MIN = 200;
const MAX = 380;

/* a pill, and the top of the corner range */
const CORNER = H / 2;
const SPEED = 50;

/* ── how far the swell is, and it is TINY ──────────────────
   The dot sits four pixels inside the track, so the ring round
   it is the whole budget for a hover. 3% of 40 is 1.2, which
   is 0.6 a side and leaves 3.4. */
const SWELL = 1.03;

/* how long the finished state stands before it resets — only
   when there is no onConfirm callback to answer to */
const HOLD = 1500;

export function SlideConfirm({
  /* the label while the handle is at rest */
  label = "Slide to confirm",
  /* called once the slide commits. When provided, the done
     state holds rather than resetting */
  onConfirm,
  /* the track's length, px */
  width = SPAN,
  disabled = false,
}: {
  label?: string;
  onConfirm?: () => void;
  width?: number;
  disabled?: boolean;
} = {}) {
  const [done, setDone] = useState(false);
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);
  const track = useRef<HTMLDivElement | null>(null);
  /* the live grab. A ref rather than state for the reason every
     drag uses one: it changes on every frame of a gesture,
     which is exactly the value that must not render. */
  const grip = useRef<{ id: number; grab: number | null; moved: boolean } | null>(null);
  const beat = useRef(0);
  const fired = useRef(false);

  const x = useMotionValue(0);
  /* ── where the handle planted itself ─────────────────────
     Zero except while it is unfurling, and then it is the
     offset the handle had when it committed. The width is
     `GRIP + (anchor - x)`, so PAD + x + width comes to
     PAD + GRIP + anchor — a number with no x in it. The right
     edge is therefore stationary BY ARITHMETIC rather than by
     two animations agreeing. */
  const anchor = useMotionValue(0);
  /* ── the settle ──────────────────────────────────────────
     The unfurl ends with the handle exactly filling the track
     and nothing else happening, which reads as the animation
     stopping rather than as the thing landing. A dip of about
     three per cent and back gives it somewhere to arrive. */
  const pulse = useMotionValue(1);
  /* the arrow's own fade, so it can leave on the COMMIT rather
     than on x */
  const shown = useMotionValue(1);

  const span = clamp(Math.round(width), MIN, MAX);
  const TRAVEL = span - PAD * 2 - GRIP;

  const r = CORNER;
  /* ── the handle's corner is DERIVED ──────────────────────
     `r - PAD`, floored at zero: the radius of a thing inside
     another, less the gap between them, is what keeps the two
     curves parallel. */
  const gripR = Math.max(0, r - PAD);
  /* ── the end IS the commit ────────────────────────────────
     A slide-to-confirm that fires at 60% is one you can
     trigger by knocking the handle, which is the single thing
     the gesture exists to prevent. */
  const mark = TRAVEL;

  /* ── SPEED, and deliberately not Bounce ──────────────────
     This shape has a hard wall at both ends. On commit the
     handle exactly fills the track, so there is nowhere for an
     overshoot to go. Speed decides how fast it takes over once
     you let go, and the damping is derived to sit exactly on
     critical, so nothing overshoots at any setting of it. */
  const stiff = 260 + (SPEED / 100) * 640;
  /* the COMMIT stays exactly on critical. It has a wall at the
     far end and the settle is what gives it a landing. */
  const spring = {
    type: "spring" as const,
    stiffness: stiff,
    damping: 2 * Math.sqrt(stiff * 0.9),
    mass: 0.9,
  };
  /* ── the RETURN is not ───────────────────────────────────
     0.62 of critical, so it arrives with something left over
     rather than stopping dead. */
  const home = { ...spring, damping: 2 * Math.sqrt(stiff * 0.9) * 0.62 };

  useEffect(() => () => {
    window.clearTimeout(beat.current);
    loose.current?.();
  }, []);

  /* ── THE DRAG IS FOLLOWED ON THE WINDOW ──────────────────
     Listening on the window means a release ANYWHERE ends the
     drag — which is what a slider promises: your finger owns
     the handle until you lift it, not until you wander off the
     track. Bound at the press, not in an effect, so a fast
     flick cannot lose its first move to React's commit gap. */
  const loose = useRef<(() => void) | null>(null);
  /* the handlers are rebuilt every render and the listeners are
     not, so they are reached through a ref rather than captured */
  const live = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  }>({ move: () => {}, up: () => {} });

  const watch = () => {
    loose.current?.();
    const onMove = (e: PointerEvent) => live.current.move(e);
    const onUp = (e: PointerEvent) => { live.current.up(e); loose.current?.(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    loose.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      loose.current = null;
    };
  };

  /* ── everything else is read off x ────────────────────────
     The wash behind the handle, the label giving up its ink,
     and the arrow fading as the end approaches are three
     readings of one number rather than three things animated
     toward the same moment. Both readings clamp. */
  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL));
  const wide = useTransform([seen, anchor], ([v, a]: number[]) =>
    GRIP + clamp(a - v, 0, TRAVEL));

  /* ── the overshoot becomes a SQUASH ──────────────────────
     The return spring is under-damped, so it wants to carry
     past zero — and it cannot: at zero the handle is already
     against the end of its track. The position clamps and the
     energy turns into compression instead. Origin at the LEFT
     edge, because that is the wall it hit. */
  const over = useTransform(x, (v) => Math.max(0, -v));
  /* 8%, and the cap is the number that matters rather than the
     divisor: the return overshoots by about 18 units, so any
     real landing reaches the ceiling and the ceiling IS the
     squash. */
  const squash = useTransform(over, (o) => 1 - Math.min(0.08, o / 110));
  const wash = useTransform(seen, (v) => v + GRIP);
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0]);
  /* ── AND IT ANSWERS THE COMMIT, not just x ───────────────
     Read off x alone this faded back IN during the unfurl. */
  const arrow = useTransform([seen, shown], ([v, on]: number[]) =>
    on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1));

  /* both scales ride the same product — the swell has to be
     multiplied INTO the transform rather than set as its own
     `scale` property, which applies first and would move the
     handle along the track it is sitting on. */
  const sx = useTransform(squash, (q) => q * (hot && !held && !done ? SWELL : 1));
  const sy = useTransform(squash, (q) => (1 / q) * (hot && !held && !done ? SWELL : 1));

  const local = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return 0;
    const k = box.width / span;
    return (clientX - box.left) / (k || 1);
  };

  const finish = () => {
    setDone(true);
    if (onConfirm && !fired.current) {
      fired.current = true;
      onConfirm();
    }
    /* ── x goes to ZERO, and that is the whole morph ────────
       The handle is placed by `x` and sized by `width`, and on
       commit they move by the same amount in opposite
       directions: x loses TRAVEL, width gains it. Their sum is
       the right edge, so the right edge does not move. */
    anchor.set(x.get());
    animate(shown, 0, { duration: 0.12 });
    animate(x, 0, spring);
    animate(pulse, [1, 0.974, 1], {
      duration: 0.46,
      times: [0, 0.62, 1],
      ease: [0.33, 0.55, 0.2, 1],
      /* a beat behind the unfurl, so it is the landing that
         dips rather than the take-off */
      delay: 0.1,
    });
    if (!onConfirm) {
      beat.current = window.setTimeout(() => {
        setDone(false);
        fired.current = false;
        animate(shown, 1, { duration: 0.2, delay: 0.12 });
        /* the reset is the anchor coming home with x already
           at zero: the width shrinks back to the handle, so the
           RIGHT edge sweeps left to the start. */
        animate(anchor, 0, { type: "spring", stiffness: 380, damping: 34, mass: 0.9 });
      }, HOLD);
    }
  };

  const down = (e: React.PointerEvent) => {
    if (done || disabled) return;
    e.stopPropagation();
    /* ── NO OFFSET YET, it is taken at the first MOVE ───────
       Deciding it here is what makes a press away from the
       handle teleport it. Taken at the first move, that move
       asks for exactly the position the handle already has. */
    grip.current = { id: e.pointerId, grab: null, moved: false };
    setHeld(true);
    /* it throws if the id is not a live pointer, and the drag
       works without it — so it must not take the grab down */
    try { track.current?.setPointerCapture(e.pointerId); } catch { /* not live */ }
    watch();
  };

  const move = (e: PointerEvent | React.PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const at = local(e.clientX);
    if (g.grab === null) { g.grab = at - x.get(); return; }
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x.get()) > 0.5) g.moved = true;
    x.set(next);
  };

  const up = (e: PointerEvent | React.PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    grip.current = null;
    /* guarded: it throws when the pointer was never captured,
       and unguarded it threw before setHeld(false) */
    try { track.current?.releasePointerCapture?.(e.pointerId); } catch { /* never captured */ }
    setHeld(false);
    if (x.get() >= mark) finish();
    else {
      animate(x, 0, home);
    }
  };

  live.current = { move, up };

  return (
    <div className="sld" style={{ width: span, height: H, opacity: disabled ? 0.5 : 1 }}>
      <motion.div
        className="sld-track"
        ref={track}
        style={{ borderRadius: r, scale: pulse }}
        data-held={held || undefined}
        data-done={done || undefined}
        data-disabled={disabled || undefined}
        onPointerDown={down}
      >
        {/* the part already crossed. It is not a progress bar —
            it is the ground the handle has covered, which is why
            it ends AT the handle rather than under it */}
        <motion.i
          className="sld-wash"
          aria-hidden="true"
          style={{ width: wash, borderRadius: gripR }}
        />

        <motion.span className="sld-say" style={{ opacity: say }}>
          {label}
        </motion.span>

        <motion.button
          type="button"
          className="sld-grip"
          onPointerEnter={() => setHot(true)}
          onPointerLeave={() => setHot(false)}
          style={{
            x: seen,
            scaleX: sx,
            scaleY: sy,
            /* ── the morph, and it is ONE number ───────────
                `wide` is read off x and the anchor, so the
                width is not being animated at all — it is
                arithmetic on the value the spring is already
                moving. */
            width: wide,
            borderRadius: gripR,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.7 }}
          aria-label={done ? "Confirmed" : label}
        >
          <motion.span className="sld-arrow" style={{ opacity: arrow }} aria-hidden="true">
            <ArrowRight size={20} strokeWidth={2.4} />
          </motion.span>

          {/* the word only exists once there is room for it, and
              it arrives with the width rather than after it */}
          <motion.span
            className="sld-done"
            aria-hidden="true"
            initial={false}
            animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.7 }}
            transition={{ duration: 0.18, ease: [0.33, 0.55, 0.2, 1] }}
          >
            <Check size={19} strokeWidth={2.8} />
            Confirmed
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  );
}
