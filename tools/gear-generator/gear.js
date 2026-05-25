// Involute spur-gear generator.
// All linear dimensions in millimetres. Angles in radians internally.

const TAU = Math.PI * 2;
const inv = (b) => Math.tan(b) - b;      // involute function

/**
 * Compute key geometry for a spur gear.
 * @param {number} N  tooth count
 * @param {number} m  module (mm)
 * @param {number} alphaDeg  pressure angle in degrees (commonly 20)
 */
export function gearGeometry(N, m, alphaDeg) {
  const alpha = (alphaDeg * Math.PI) / 180;
  const rp = (N * m) / 2;             // pitch radius
  const rb = rp * Math.cos(alpha);    // base radius
  const ra = rp + m;                  // addendum (outside) radius
  const rf = Math.max(rp - 1.25 * m, m * 0.2); // dedendum (root) radius

  // Pressure angle at the tip
  const betaTip = Math.acos(Math.min(1, rb / ra));

  // Tooth tip angular gap = π/N + 2 invAlpha − 2 inv(βtip).
  // If ≤ 0 the flanks meet before reaching ra — clamp βtip so the gap becomes 0 (pointed tip).
  const invAlpha = inv(alpha);
  const tipGap = Math.PI / N + 2 * invAlpha - 2 * inv(betaTip);
  let betaTipEff = betaTip;
  let raEff = ra;
  if (tipGap <= 0) {
    const targetInv = invAlpha + Math.PI / (2 * N);
    let lo = 0, hi = Math.PI / 2 - 1e-4;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inv(mid) < targetInv) lo = mid; else hi = mid;
    }
    betaTipEff = (lo + hi) / 2;
    raEff = rb / Math.cos(betaTipEff);
  }

  return {
    N, m, alpha, alphaDeg,
    rp, rb, ra, rf, raEff,
    betaTip: betaTipEff,
    invAlpha,
    pointedTip: tipGap <= 0,
  };
}

/**
 * Build an SVG path string ("d" attribute) describing the gear outline.
 * Points returned in mm, y-axis flipped for SVG (positive y goes down on screen).
 */
export function gearPathData(g, opts = {}) {
  const steps = opts.steps ?? 18;
  const { N, rb, rf, raEff, betaTip, invAlpha } = g;
  const halfPitch = Math.PI / (2 * N);

  // Where the involute starts radially. If base circle is below root, involute is clipped at root.
  const rStart = Math.max(rb, rf);
  const betaStart = rStart > rb ? Math.acos(rb / rStart) : 0;

  // Flip y for SVG output
  const px = (r, a) => +(r * Math.cos(a)).toFixed(4);
  const py = (r, a) => +(-r * Math.sin(a)).toFixed(4);

  let d = '';

  // Helper: emit a tooth segment that starts at the inter-tooth root mid-point before tooth k.
  // Actually we'll trace tooth by tooth and connect root arcs in-between.

  // First tooth's right-flank start angle (on rStart):
  const firstAngStart = 0 - halfPitch - invAlpha + inv(betaStart);
  d += `M ${px(rStart, firstAngStart)} ${py(rStart, firstAngStart)} `;

  for (let k = 0; k < N; k++) {
    const base = (TAU * k) / N;

    // --- Right flank: from base (rStart) outward to tip (raEff) ---
    for (let i = 1; i <= steps; i++) {
      const beta = betaStart + (betaTip - betaStart) * (i / steps);
      const r = rb / Math.cos(beta);
      const a = base - halfPitch - invAlpha + inv(beta);
      d += `L ${px(r, a)} ${py(r, a)} `;
    }

    // --- Tip arc on raEff from right-flank end to left-flank start ---
    const tipLeftA = base + halfPitch + invAlpha - inv(betaTip);
    // y is flipped → counterclockwise math = clockwise on screen → sweep=0
    if (!g.pointedTip) {
      d += `A ${raEff.toFixed(4)} ${raEff.toFixed(4)} 0 0 0 ${px(raEff, tipLeftA)} ${py(raEff, tipLeftA)} `;
    }
    // If pointed, the right flank end and left flank start are the same point — no arc needed.

    // --- Left flank: from tip back down to base/rStart ---
    for (let i = 1; i <= steps; i++) {
      const beta = betaTip - (betaTip - betaStart) * (i / steps);
      const r = rb / Math.cos(beta);
      const a = base + halfPitch + invAlpha - inv(beta);
      d += `L ${px(r, a)} ${py(r, a)} `;
    }

    // --- Root segment to next tooth's right-flank start ---
    const leftEndAng = base + halfPitch + invAlpha - inv(betaStart);
    const nextBase = (TAU * (k + 1)) / N;
    const nextStartAng = nextBase - halfPitch - invAlpha + inv(betaStart);

    if (rStart > rf + 1e-3) {
      // Drop radially to root, arc across, climb back to rStart
      d += `L ${px(rf, leftEndAng)} ${py(rf, leftEndAng)} `;
      d += `A ${rf.toFixed(4)} ${rf.toFixed(4)} 0 0 0 ${px(rf, nextStartAng)} ${py(rf, nextStartAng)} `;
      d += `L ${px(rStart, nextStartAng)} ${py(rStart, nextStartAng)} `;
    } else {
      // Direct arc on rStart (== rf, no gap)
      d += `A ${rStart.toFixed(4)} ${rStart.toFixed(4)} 0 0 0 ${px(rStart, nextStartAng)} ${py(rStart, nextStartAng)} `;
    }
  }

  d += 'Z';
  return d;
}

/**
 * Render the full SVG markup (printable, 1 unit = 1 mm) for a gear.
 */
export function renderGearSVG(N, m, alphaDeg, opts = {}) {
  const g = gearGeometry(N, m, alphaDeg);
  const d = gearPathData(g, opts);

  const boreDiameter = opts.boreDiameter ?? Math.min(8, g.rf * 0.6);
  const showPitch = opts.showPitch ?? true;
  const showCross = opts.showCross ?? true;
  const margin = 4; // mm
  const size = (g.raEff + margin) * 2;
  const half = size / 2;

  const guideStrokeMm = 0.15;
  const teethStrokeMm = 0.3;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.toFixed(2)}mm" height="${size.toFixed(2)}mm" viewBox="${-half.toFixed(2)} ${-half.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}">`;
  svg += `<g fill="none" stroke="#000" stroke-linejoin="round" stroke-linecap="round">`;

  // Outer circle (addendum) — light reference
  if (showPitch) {
    svg += `<circle cx="0" cy="0" r="${g.rp.toFixed(4)}" stroke="#bbb" stroke-dasharray="0.8 0.8" stroke-width="${guideStrokeMm}"/>`;
  }

  // Cross hairs through center
  if (showCross) {
    const cx = g.raEff + 1;
    svg += `<line x1="${-cx.toFixed(3)}" y1="0" x2="${cx.toFixed(3)}" y2="0" stroke="#aaa" stroke-width="${guideStrokeMm}"/>`;
    svg += `<line x1="0" y1="${-cx.toFixed(3)}" x2="0" y2="${cx.toFixed(3)}" stroke="#aaa" stroke-width="${guideStrokeMm}"/>`;
  }

  // Gear teeth outline
  svg += `<path d="${d}" stroke="#000" stroke-width="${teethStrokeMm}"/>`;

  // Center bore
  if (boreDiameter > 0) {
    svg += `<circle cx="0" cy="0" r="${(boreDiameter / 2).toFixed(4)}" stroke="#000" stroke-width="${teethStrokeMm}"/>`;
  }

  svg += `</g></svg>`;
  return { svg, geometry: g };
}
