// Involute spur-gear generator - single gear and meshing pair.
// Units: millimetres for all linear dimensions, radians internally for angles.
// Math conventions: x right, y up. SVG output flips y for the screen.

const TAU = Math.PI * 2;
const inv = (b) => Math.tan(b) - b;

/* ===== Geometry ===== */

export function gearGeometry(N, m, alphaDeg, opts = {}) {
  const alpha = (alphaDeg * Math.PI) / 180;
  const backlash = opts.backlash ?? 0;
  const rp = (N * m) / 2;
  const rb = rp * Math.cos(alpha);
  const ra = rp + m;
  const rf = Math.max(rp - 1.25 * m, m * 0.2);
  const halfPitchAngle = (Math.PI - backlash / m) / (2 * N);
  const invAlpha = inv(alpha);
  const betaTipMax = Math.acos(Math.min(1, rb / ra));
  const tipGap = 2 * halfPitchAngle + 2 * invAlpha - 2 * inv(betaTipMax);

  let betaTip = betaTipMax;
  let raEff = ra;
  let pointedTip = false;
  if (tipGap <= 0) {
    pointedTip = true;
    const targetInv = invAlpha + halfPitchAngle;
    let lo = 0, hi = Math.PI / 2 - 1e-4;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (inv(mid) < targetInv) lo = mid; else hi = mid;
    }
    betaTip = (lo + hi) / 2;
    raEff = rb / Math.cos(betaTip);
  }
  return {
    N, m, alpha, alphaDeg, backlash,
    rp, rb, ra, raEff, rf,
    betaTip, halfPitchAngle, invAlpha,
    pointedTip, circularPitch: Math.PI * m,
  };
}

export function gearPathData(g, opts = {}) {
  const steps = opts.steps ?? 18;
  const { N, rb, rf, raEff, betaTip, invAlpha, halfPitchAngle } = g;
  const rStart = Math.max(rb, rf);
  const betaStart = rStart > rb ? Math.acos(rb / rStart) : 0;
  const px = (r, a) => +(r * Math.cos(a)).toFixed(4);
  const py = (r, a) => +(-r * Math.sin(a)).toFixed(4);
  let d = '';
  const firstAngStart = 0 - halfPitchAngle - invAlpha + inv(betaStart);
  d += `M ${px(rStart, firstAngStart)} ${py(rStart, firstAngStart)} `;
  for (let k = 0; k < N; k++) {
    const base = (TAU * k) / N;
    for (let i = 1; i <= steps; i++) {
      const beta = betaStart + (betaTip - betaStart) * (i / steps);
      const r = rb / Math.cos(beta);
      const a = base - halfPitchAngle - invAlpha + inv(beta);
      d += `L ${px(r, a)} ${py(r, a)} `;
    }
    const tipLeftA = base + halfPitchAngle + invAlpha - inv(betaTip);
    if (!g.pointedTip) {
      d += `A ${raEff.toFixed(4)} ${raEff.toFixed(4)} 0 0 0 ${px(raEff, tipLeftA)} ${py(raEff, tipLeftA)} `;
    }
    for (let i = 1; i <= steps; i++) {
      const beta = betaTip - (betaTip - betaStart) * (i / steps);
      const r = rb / Math.cos(beta);
      const a = base + halfPitchAngle + invAlpha - inv(beta);
      d += `L ${px(r, a)} ${py(r, a)} `;
    }
    const leftEndAng = base + halfPitchAngle + invAlpha - inv(betaStart);
    const nextBase = (TAU * (k + 1)) / N;
    const nextStartAng = nextBase - halfPitchAngle - invAlpha + inv(betaStart);
    if (rStart > rf + 1e-3) {
      d += `L ${px(rf, leftEndAng)} ${py(rf, leftEndAng)} `;
      d += `A ${rf.toFixed(4)} ${rf.toFixed(4)} 0 0 0 ${px(rf, nextStartAng)} ${py(rf, nextStartAng)} `;
      d += `L ${px(rStart, nextStartAng)} ${py(rStart, nextStartAng)} `;
    } else {
      d += `A ${rStart.toFixed(4)} ${rStart.toFixed(4)} 0 0 0 ${px(rStart, nextStartAng)} ${py(rStart, nextStartAng)} `;
    }
  }
  d += 'Z';
  return d;
}

/* ===== Composition ===== */

function svgGearGroup(g, opts) {
  const cx = opts.cx ?? 0;
  const cy = opts.cy ?? 0;
  const rotateDeg = opts.rotateDeg ?? 0;
  const boreDiameter = opts.boreDiameter ?? 0;
  const showPitch = opts.showPitch ?? false;
  const showBase = opts.showBase ?? false;
  const strokeMm = opts.strokeMm ?? 0.3;
  const color = opts.color ?? '#000';

  const d = gearPathData(g);
  let s = `<g transform="translate(${cx} ${cy}) rotate(${rotateDeg})">`;
  if (showPitch) {
    s += `<circle cx="0" cy="0" r="${g.rp.toFixed(4)}" fill="none" stroke="#3a8fde" stroke-dasharray="0.8 0.8" stroke-width="0.15"/>`;
  }
  if (showBase) {
    s += `<circle cx="0" cy="0" r="${g.rb.toFixed(4)}" fill="none" stroke="#e58f3a" stroke-dasharray="0.5 0.5" stroke-width="0.12"/>`;
  }
  s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeMm}" stroke-linejoin="round"/>`;
  if (boreDiameter > 0) {
    s += `<circle cx="0" cy="0" r="${(boreDiameter / 2).toFixed(4)}" fill="none" stroke="${color}" stroke-width="${strokeMm}"/>`;
  }
  const xh = Math.min(g.raEff * 0.25, 4);
  s += `<line x1="${-xh}" y1="0" x2="${xh}" y2="0" stroke="#888" stroke-width="0.1"/>`;
  s += `<line x1="0" y1="${-xh}" x2="0" y2="${xh}" stroke="#888" stroke-width="0.1"/>`;
  s += '</g>';
  return s;
}

/* ===== Renderers ===== */

export function renderSingleGear(N, m, alphaDeg, opts = {}) {
  const g = gearGeometry(N, m, alphaDeg, opts);
  const margin = 4;
  const size = (g.raEff + margin) * 2;
  const half = size / 2;
  const body = svgGearGroup(g, {
    boreDiameter: opts.boreDiameter ?? 0,
    showPitch: opts.showPitch ?? true,
    showBase: opts.showBase ?? false,
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.toFixed(2)}mm" height="${size.toFixed(2)}mm" viewBox="${(-half).toFixed(2)} ${(-half).toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}">${body}</svg>`;
  return { svg, geometry: g };
}

export function renderGearPair(N1, N2, m, alphaDeg, opts = {}) {
  const backlash = opts.backlash ?? 0;
  const g1 = gearGeometry(N1, m, alphaDeg, { backlash });
  const g2 = gearGeometry(N2, m, alphaDeg, { backlash });
  const centerDistance = (N1 + N2) * m / 2;
  const ratio = N2 / N1;

  const gear2PhaseRad = (N2 % 2 === 0) ? Math.PI / N2 : 0;
  const gear2RotDeg = -(gear2PhaseRad * 180 / Math.PI);

  const margin = 6;
  const leftX = -g1.raEff;
  const rightX = centerDistance + g2.raEff;
  const width = (rightX - leftX) + 2 * margin;
  const maxR = Math.max(g1.raEff, g2.raEff);
  const height = 2 * maxR + 2 * margin;
  const viewX = leftX - margin;
  const viewY = -maxR - margin;

  const showPitch = opts.showPitch ?? true;
  const showBase = opts.showBase ?? false;
  const showLineOfContact = opts.showLineOfContact ?? false;
  const showGrid = opts.showGrid ?? false;

  let body = '';

  if (showGrid) {
    body += '<g stroke="#e6e0c8" stroke-width="0.08" fill="none">';
    const gx0 = Math.floor(viewX / 10) * 10;
    const gx1 = Math.ceil((viewX + width) / 10) * 10;
    const gy0 = Math.floor(viewY / 10) * 10;
    const gy1 = Math.ceil((viewY + height) / 10) * 10;
    for (let x = gx0; x <= gx1; x += 10) body += `<line x1="${x}" y1="${viewY}" x2="${x}" y2="${viewY + height}"/>`;
    for (let y = gy0; y <= gy1; y += 10) body += `<line x1="${viewX}" y1="${y}" x2="${viewX + width}" y2="${y}"/>`;
    body += '</g>';
  }

  if (showLineOfContact) {
    const cx = g1.rp;
    const a = g1.alpha;
    const L = Math.min(g1.rb, g2.rb);
    const dx = Math.sin(a) * L;
    const dy = Math.cos(a) * L;
    body += `<line x1="${(cx - dx).toFixed(2)}" y1="${dy.toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(-dy).toFixed(2)}" stroke="#d33" stroke-width="0.25" stroke-dasharray="1 1"/>`;
    body += `<circle cx="0" cy="0" r="${g1.rb.toFixed(4)}" fill="none" stroke="#d33" stroke-dasharray="0.5 0.5" stroke-width="0.12"/>`;
    body += `<circle cx="${centerDistance}" cy="0" r="${g2.rb.toFixed(4)}" fill="none" stroke="#d33" stroke-dasharray="0.5 0.5" stroke-width="0.12"/>`;
  }

  body += svgGearGroup(g1, {
    cx: 0, cy: 0, rotateDeg: 0,
    boreDiameter: opts.bore1 ?? 0,
    showPitch, showBase: showBase && !showLineOfContact,
  });
  body += svgGearGroup(g2, {
    cx: centerDistance, cy: 0, rotateDeg: gear2RotDeg,
    boreDiameter: opts.bore2 ?? 0,
    showPitch, showBase: showBase && !showLineOfContact,
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}mm" height="${height.toFixed(2)}mm" viewBox="${viewX.toFixed(2)} ${viewY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}">${body}</svg>`;
  return { svg, g1, g2, centerDistance, ratio };
}

export function renderGearSVG(N, m, alphaDeg, opts = {}) {
  return renderSingleGear(N, m, alphaDeg, opts);
}
