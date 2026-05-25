// Involute spur-gear generator - single gear and meshing pair.
// Two output styles:
//   style: 'preview' - colored fills, shadows, annotations (for live UI)
//   style: 'print'   - monochrome outlines only (for printable templates)

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

/* ===== Color palettes ===== */

// Wood-tone palette: maple (warm light) + walnut (deep brown)
const PALETTE = {
  maple:  { fill: '#f0d3a8', edge: '#a07845', light: '#fde6c4', dark: '#8a5a28', mark: '#c53030' },
  walnut: { fill: '#b08968', edge: '#5d3a1a', light: '#cda083', dark: '#3d2410', mark: '#fbbf24' },
  pitch:  '#2563eb',
  base:   '#ea580c',
  contact:'#dc2626',
  grid:   '#e6e0c8',
};

/* ===== Composition ===== */

function svgDefs(idPrefix = '') {
  // Linear gradients to give the gears a subtle "lit" look.
  const gp = idPrefix;
  return `<defs>
    <radialGradient id="${gp}mapleFill" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${PALETTE.maple.light}"/>
      <stop offset="60%" stop-color="${PALETTE.maple.fill}"/>
      <stop offset="100%" stop-color="${PALETTE.maple.dark}"/>
    </radialGradient>
    <radialGradient id="${gp}walnutFill" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${PALETTE.walnut.light}"/>
      <stop offset="60%" stop-color="${PALETTE.walnut.fill}"/>
      <stop offset="100%" stop-color="${PALETTE.walnut.dark}"/>
    </radialGradient>
    <filter id="${gp}softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.8"/>
      <feOffset dx="0.3" dy="0.6" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

function svgGearBody(g, opts) {
  const cx = opts.cx ?? 0;
  const cy = opts.cy ?? 0;
  const rotateDeg = opts.rotateDeg ?? 0;
  const boreDiameter = opts.boreDiameter ?? 0;
  const showPitch = opts.showPitch ?? false;
  const showBase = opts.showBase ?? false;
  const style = opts.style ?? 'preview';
  const id = opts.id ?? '';
  const tone = opts.tone ?? 'maple';   // 'maple' | 'walnut'
  const idPrefix = opts.idPrefix ?? '';

  const pal = PALETTE[tone];
  const fill = style === 'print' ? 'none' : `url(#${idPrefix}${tone}Fill)`;
  const stroke = style === 'print' ? '#000' : pal.edge;
  const strokeMm = style === 'print' ? 0.3 : 0.5;
  const filterAttr = style === 'preview' ? ` filter="url(#${idPrefix}softShadow)"` : '';

  const d = gearPathData(g);
  const idAttr = id ? ` id="${id}"` : '';
  let s = `<g${idAttr} transform="translate(${cx} ${cy}) rotate(${rotateDeg})">`;
  if (showPitch) {
    s += `<circle cx="0" cy="0" r="${g.rp.toFixed(4)}" fill="none" stroke="${PALETTE.pitch}" stroke-dasharray="0.9 0.9" stroke-width="0.18" opacity="0.7"/>`;
  }
  if (showBase) {
    s += `<circle cx="0" cy="0" r="${g.rb.toFixed(4)}" fill="none" stroke="${PALETTE.base}" stroke-dasharray="0.5 0.5" stroke-width="0.14" opacity="0.7"/>`;
  }
  s += `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeMm}" stroke-linejoin="round"${filterAttr}/>`;
  if (boreDiameter > 0) {
    const boreFill = style === 'print' ? 'none' : '#1a1a1a';
    s += `<circle cx="0" cy="0" r="${(boreDiameter / 2).toFixed(4)}" fill="${boreFill}" stroke="${stroke}" stroke-width="${strokeMm}"/>`;
  }
  // Bright radial line so rotation is visible during animation
  if (style === 'preview') {
    s += `<line x1="0" y1="0" x2="${(g.raEff * 0.95).toFixed(3)}" y2="0" stroke="${pal.mark}" stroke-width="0.6" stroke-linecap="round"/>`;
    s += `<circle cx="${(g.raEff * 0.95).toFixed(3)}" cy="0" r="0.6" fill="${pal.mark}"/>`;
  }
  const xh = Math.min(g.raEff * 0.18, 2.5);
  const ccolor = style === 'print' ? '#000' : '#1a1a1a';
  s += `<line x1="${-xh}" y1="0" x2="${xh}" y2="0" stroke="${ccolor}" stroke-width="0.12"/>`;
  s += `<line x1="0" y1="${-xh}" x2="0" y2="${xh}" stroke="${ccolor}" stroke-width="0.12"/>`;
  s += '</g>';
  return s;
}

function svgGearLabel(g, cx, cy, label, color) {
  const yOff = g.raEff + 5;
  const fs = Math.max(3, g.raEff * 0.09);
  return `<text x="${cx}" y="${cy + yOff}" text-anchor="middle" font-size="${fs.toFixed(2)}" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-weight="600" fill="${color}">${label}</text>`;
}

/* ===== Renderers ===== */

export function renderSingleGear(N, m, alphaDeg, opts = {}) {
  const g = gearGeometry(N, m, alphaDeg, opts);
  const style = opts.style ?? 'print';
  const tone = opts.tone ?? 'maple';
  const margin = 4;
  const size = (g.raEff + margin) * 2;
  const half = size / 2;
  const idPrefix = opts.idPrefix ?? 'single_';
  const defs = style === 'preview' ? svgDefs(idPrefix) : '';
  const body = svgGearBody(g, {
    boreDiameter: opts.boreDiameter ?? 0,
    showPitch: opts.showPitch ?? true,
    showBase: opts.showBase ?? false,
    style, tone, idPrefix,
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.toFixed(2)}mm" height="${size.toFixed(2)}mm" viewBox="${(-half).toFixed(2)} ${(-half).toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}">${defs}${body}</svg>`;
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

  const style = opts.style ?? 'preview';
  const showAnnotations = (opts.showAnnotations ?? true) && style === 'preview';
  const showPitch = opts.showPitch ?? true;
  const showBase = opts.showBase ?? false;
  const showLineOfContact = opts.showLineOfContact ?? false;
  const showGrid = opts.showGrid ?? false;
  const tone1 = opts.tone1 ?? 'maple';
  const tone2 = opts.tone2 ?? 'walnut';
  const id1 = opts.id1 ?? 'gear1Group';
  const id2 = opts.id2 ?? 'gear2Group';
  const idPrefix = opts.idPrefix ?? 'pp_';

  const annotMargin = showAnnotations ? 16 : 6;
  const leftX = -g1.raEff;
  const rightX = centerDistance + g2.raEff;
  const width = (rightX - leftX) + 2 * annotMargin;
  const maxR = Math.max(g1.raEff, g2.raEff);
  const topMargin = showAnnotations ? 12 : 6;
  const height = 2 * maxR + topMargin + annotMargin;
  const viewX = leftX - annotMargin;
  const viewY = -maxR - topMargin;

  let body = '';

  // Subtle background panel for preview
  if (style === 'preview') {
    body += `<rect x="${viewX}" y="${viewY}" width="${width}" height="${height}" fill="#fbf8f0" rx="2"/>`;
  }

  if (showGrid) {
    body += `<g stroke="${PALETTE.grid}" stroke-width="0.08" fill="none">`;
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
    body += `<line x1="${(cx - dx).toFixed(2)}" y1="${dy.toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(-dy).toFixed(2)}" stroke="${PALETTE.contact}" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`;
    body += `<circle cx="0" cy="0" r="${g1.rb.toFixed(4)}" fill="none" stroke="${PALETTE.contact}" stroke-dasharray="0.5 0.5" stroke-width="0.14" opacity="0.6"/>`;
    body += `<circle cx="${centerDistance}" cy="0" r="${g2.rb.toFixed(4)}" fill="none" stroke="${PALETTE.contact}" stroke-dasharray="0.5 0.5" stroke-width="0.14" opacity="0.6"/>`;
  }

  if (showAnnotations) {
    const yLine = -Math.max(g1.raEff, g2.raEff) - topMargin * 0.45;
    body += `<g stroke="#7c6048" stroke-width="0.22" fill="none">`;
    body += `<line x1="0" y1="${yLine + 1.8}" x2="0" y2="${yLine - 1.2}"/>`;
    body += `<line x1="${centerDistance}" y1="${yLine + 1.8}" x2="${centerDistance}" y2="${yLine - 1.2}"/>`;
    body += `<line x1="0" y1="${yLine}" x2="${centerDistance}" y2="${yLine}" stroke-dasharray="0.5 0.5"/>`;
    body += `</g>`;
    body += `<text x="${(centerDistance / 2).toFixed(2)}" y="${(yLine - 2).toFixed(2)}" text-anchor="middle" font-size="3.2" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-weight="600" fill="#5c4329">C = ${centerDistance.toFixed(2)} mm</text>`;
    body += `<text x="${((leftX + rightX) / 2).toFixed(2)}" y="${(viewY + 4.5).toFixed(2)}" text-anchor="middle" font-size="4" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif" fill="#3a2814">Ratio ${ratio.toFixed(3)} : 1   -   ${N1}T / ${N2}T</text>`;
  }

  body += svgGearBody(g1, {
    id: id1, cx: 0, cy: 0, rotateDeg: 0,
    boreDiameter: opts.bore1 ?? 0,
    showPitch, showBase: showBase && !showLineOfContact,
    style, tone: tone1, idPrefix,
  });
  body += svgGearBody(g2, {
    id: id2, cx: centerDistance, cy: 0, rotateDeg: gear2RotDeg,
    boreDiameter: opts.bore2 ?? 0,
    showPitch, showBase: showBase && !showLineOfContact,
    style, tone: tone2, idPrefix,
  });

  if (showAnnotations) {
    body += svgGearLabel(g1, 0, 0, `G1 - ${g1.N}T - PD ${(g1.rp*2).toFixed(1)} - OD ${(g1.raEff*2).toFixed(1)} mm`, PALETTE.maple.dark);
    body += svgGearLabel(g2, centerDistance, 0, `G2 - ${g2.N}T - PD ${(g2.rp*2).toFixed(1)} - OD ${(g2.raEff*2).toFixed(1)} mm`, PALETTE.walnut.dark);
  }

  const defs = style === 'preview' ? svgDefs(idPrefix) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="gearPairSvg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="${viewX.toFixed(2)} ${viewY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}" data-cd="${centerDistance.toFixed(4)}" data-n1="${N1}" data-n2="${N2}" data-phase2="${gear2RotDeg.toFixed(4)}">${defs}${body}</svg>`;

  return { svg, g1, g2, centerDistance, ratio, gear2PhaseDeg: gear2RotDeg };
}

export function renderGearSVG(N, m, alphaDeg, opts = {}) {
  return renderSingleGear(N, m, alphaDeg, opts);
}
