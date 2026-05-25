// Geargen - involute spur gear chain (2-4 gears) with optional 3D thickness.
// Public API:
//   gearGeometry(N, m, alphaDeg, opts)           -> { N, rp, rb, ra, raEff, rf, ... }
//   renderSingleGear(N, m, alphaDeg, opts)       -> { svg, geometry }
//   renderGearPair(N1, N2, m, alphaDeg, opts)    -> { svg, g1, g2, centerDistance, ratio, ... }
//   renderGearChain(specs, opts)                 -> { svg, geoms, positions, phasesDeg, ratios, ... }

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
  let betaTip = betaTipMax, raEff = ra, pointedTip = false;
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
  return { N, m, alpha, alphaDeg, backlash, rp, rb, ra, raEff, rf, betaTip, halfPitchAngle, invAlpha, pointedTip, circularPitch: Math.PI * m };
}

export function gearPathData(g, opts = {}) {
  const steps = opts.steps ?? 18;
  const { N, rb, rf, raEff, betaTip, invAlpha, halfPitchAngle } = g;
  const rStart = Math.max(rb, rf);
  const betaStart = rStart > rb ? Math.acos(rb / rStart) : 0;
  const px = (r, a) => +(r * Math.cos(a)).toFixed(4);
  const py = (r, a) => +(-r * Math.sin(a)).toFixed(4);
  let d = '';
  const firstAngStart = -halfPitchAngle - invAlpha + inv(betaStart);
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

/* ===== Phasing ===== */

// Compute phase (radians, math-CCW) for each gear in a chain so consecutive teeth mesh.
// chainAnglesRadMath[i] = math angle from gear i to gear i+1 (length = Ns.length - 1).
// Gear 1 stays unrotated; each later gear gets a phase that puts its mesh-in opposite
// of the previous gear's mesh-out in tooth/gap parity.
function computeChainPhases(Ns, chainAnglesRadMath) {
  const phases = [0];
  for (let k = 1; k < Ns.length; k++) {
    const prevK = k - 1;
    const prevMeshOut = chainAnglesRadMath[prevK];           // in prev gear local frame
    const prevPhase = phases[prevK];
    const prevCycle = ((((prevMeshOut - prevPhase) * Ns[prevK] / TAU) % 1) + 1) % 1;
    const meshIn = chainAnglesRadMath[prevK] + Math.PI;       // in current gear local frame
    const target = (prevCycle + 0.5) % 1;                     // opposite of prev (tooth<->gap)
    let phaseK = meshIn - target * TAU / Ns[k];
    const period = TAU / Ns[k];
    phaseK = ((phaseK % period) + period) % period;
    if (phaseK > period / 2) phaseK -= period;                // canonical small phase
    phases.push(phaseK);
  }
  return phases;
}

// Auto-compact chain angles (in MATH radians, CCW positive). SVG-flip happens at render.
function autoChainAngles(numGears) {
  // Each entry is the math angle from gear i to gear i+1.
  // 2 gears: straight right.
  // 3 gears: right, then up-right (60deg above).
  // 4 gears: right, up-right, right.
  if (numGears === 2) return [0];
  if (numGears === 3) return [0, Math.PI / 3];
  if (numGears === 4) return [0, Math.PI / 3, 0];
  return [0];
}

/* ===== Palette + defs ===== */

const TONES = {
  maple:  { fill: '#f0d3a8', edge: '#a07845', light: '#fde6c4', dark: '#8a5a28', side: '#7a4d20', mark: '#c53030' },
  walnut: { fill: '#b08968', edge: '#5d3a1a', light: '#cda083', dark: '#3d2410', side: '#2a1808', mark: '#fbbf24' },
  cherry: { fill: '#d18768', edge: '#7a3a23', light: '#ecb09a', dark: '#5e2e1c', side: '#42200f', mark: '#3b82f6' },
  oak:    { fill: '#c9a87a', edge: '#7a5b30', light: '#e3c89a', dark: '#5d4520', side: '#3e2f14', mark: '#16a34a' },
};
const TONE_ORDER = ['maple', 'walnut', 'cherry', 'oak'];
const PALETTE = { pitch: '#2563eb', base: '#ea580c', contact: '#dc2626', grid: '#e6e0c8' };

function svgDefs(p = '') {
  let s = '<defs>';
  for (const t of TONE_ORDER) {
    const pal = TONES[t];
    s += `<radialGradient id="${p}${t}Fill" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="${pal.light}"/><stop offset="60%" stop-color="${pal.fill}"/><stop offset="100%" stop-color="${pal.dark}"/></radialGradient>`;
    s += `<linearGradient id="${p}${t}Side" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${pal.dark}"/><stop offset="100%" stop-color="${pal.side}"/></linearGradient>`;
  }
  s += `<filter id="${p}softShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.9"/><feOffset dx="0.5" dy="1.0"/><feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  s += '</defs>';
  return s;
}

function svgGearFace(g, o) {
  const { id = '', cx = 0, cy = 0, rotateDeg = 0, tone = 'maple', variant = 'front', style = 'preview', idPrefix = '', boreDiameter = 0, showPitch = false, showBase = false, showMark = true } = o;
  const pal = TONES[tone];
  const d = gearPathData(g);
  const idAttr = id ? ` id="${id}"` : '';
  let s = `<g${idAttr} transform="translate(${cx.toFixed(4)} ${cy.toFixed(4)}) rotate(${rotateDeg})">`;

  if (style === 'print') {
    if (variant !== 'front') return '';
    s += `<path d="${d}" fill="none" stroke="#000" stroke-width="0.3" stroke-linejoin="round"/>`;
    if (boreDiameter > 0) s += `<circle cx="0" cy="0" r="${(boreDiameter/2).toFixed(4)}" fill="none" stroke="#000" stroke-width="0.3"/>`;
    const xh = Math.min(g.raEff * 0.18, 2.5);
    s += `<line x1="${-xh}" y1="0" x2="${xh}" y2="0" stroke="#000" stroke-width="0.12"/>`;
    s += `<line x1="0" y1="${-xh}" x2="0" y2="${xh}" stroke="#000" stroke-width="0.12"/>`;
    return s + '</g>';
  }

  if (variant === 'back') {
    s += `<path d="${d}" fill="url(#${idPrefix}${tone}Side)" stroke="${pal.side}" stroke-width="0.4" stroke-linejoin="round"/>`;
    if (boreDiameter > 0) s += `<circle cx="0" cy="0" r="${(boreDiameter/2).toFixed(4)}" fill="#0a0604" stroke="${pal.side}" stroke-width="0.3"/>`;
    return s + '</g>';
  }

  if (showPitch) s += `<circle cx="0" cy="0" r="${g.rp.toFixed(4)}" fill="none" stroke="${PALETTE.pitch}" stroke-dasharray="0.9 0.9" stroke-width="0.18" opacity="0.75"/>`;
  if (showBase)  s += `<circle cx="0" cy="0" r="${g.rb.toFixed(4)}" fill="none" stroke="${PALETTE.base}"  stroke-dasharray="0.5 0.5" stroke-width="0.14" opacity="0.7"/>`;
  s += `<path d="${d}" fill="url(#${idPrefix}${tone}Fill)" stroke="${pal.edge}" stroke-width="0.5" stroke-linejoin="round" filter="url(#${idPrefix}softShadow)"/>`;
  if (boreDiameter > 0) s += `<circle cx="0" cy="0" r="${(boreDiameter/2).toFixed(4)}" fill="#1a1a1a" stroke="${pal.edge}" stroke-width="0.5"/>`;
  if (showMark) {
    s += `<line x1="0" y1="0" x2="${(g.raEff*0.92).toFixed(3)}" y2="0" stroke="${pal.mark}" stroke-width="0.7" stroke-linecap="round"/>`;
    s += `<circle cx="${(g.raEff*0.92).toFixed(3)}" cy="0" r="0.7" fill="${pal.mark}"/>`;
  }
  const xh = Math.min(g.raEff * 0.18, 2.5);
  s += `<line x1="${-xh}" y1="0" x2="${xh}" y2="0" stroke="#1a1a1a" stroke-width="0.12"/>`;
  s += `<line x1="0" y1="${-xh}" x2="0" y2="${xh}" stroke="#1a1a1a" stroke-width="0.12"/>`;
  return s + '</g>';
}

/* ===== Single gear ===== */

export function renderSingleGear(N, m, alphaDeg, opts = {}) {
  const g = gearGeometry(N, m, alphaDeg, opts);
  const style = opts.style ?? 'print';
  const tone = opts.tone ?? 'maple';
  const idPrefix = opts.idPrefix ?? 'single_';
  const margin = 4;
  const size = (g.raEff + margin) * 2;
  const half = size / 2;
  const defs = style === 'preview' ? svgDefs(idPrefix) : '';
  const body = svgGearFace(g, { variant: 'front', boreDiameter: opts.boreDiameter ?? 0, showPitch: opts.showPitch ?? (style !== 'print'), style, tone, idPrefix, showMark: false });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.toFixed(2)}mm" height="${size.toFixed(2)}mm" viewBox="${(-half).toFixed(2)} ${(-half).toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}">${defs}${body}</svg>`;
  return { svg, geometry: g };
}

/* ===== Chain (2-4 gears) ===== */

export function renderGearChain(specs, opts = {}) {
  // specs: [{ N, bore?, tone? }] length 2..4
  const m = opts.m;
  const alphaDeg = opts.alphaDeg;
  const backlash = opts.backlash ?? 0;
  const depth = (opts.depth ?? 0) > 0 ? opts.depth : 0;
  const style = opts.style ?? 'preview';
  const showAnnotations = (opts.showAnnotations ?? true) && style === 'preview';
  const showPitch = opts.showPitch ?? true;
  const showBase = opts.showBase ?? false;
  const showLineOfContact = opts.showLineOfContact ?? false;
  const showGrid = opts.showGrid ?? false;
  const idPrefix = opts.idPrefix ?? 'pp_';

  const Ns = specs.map(s => s.N);
  const tones = specs.map((s, i) => s.tone ?? TONE_ORDER[i] ?? 'maple');
  const bores = specs.map(s => s.bore ?? 0);

  const geoms = Ns.map(N => gearGeometry(N, m, alphaDeg, { backlash }));
  const chainAnglesMath = opts.chainAnglesMath ?? autoChainAngles(specs.length);

  // Positions: math y up; SVG render flips y by negating cy in transform.
  const positions = [{ cx: 0, cy: 0 }];
  for (let i = 1; i < geoms.length; i++) {
    const cd = (Ns[i-1] + Ns[i]) * m / 2;
    const ang = chainAnglesMath[i-1];
    positions.push({
      cx: positions[i-1].cx + cd * Math.cos(ang),
      cy: positions[i-1].cy + cd * Math.sin(ang),
    });
  }

  const phasesMath = computeChainPhases(Ns, chainAnglesMath);
  const phasesSvgDeg = phasesMath.map(p => -p * 180 / Math.PI);

  // Per-segment center distances (mm) for stats
  const centerDistances = [];
  for (let i = 0; i < geoms.length - 1; i++) {
    centerDistances.push((Ns[i] + Ns[i+1]) * m / 2);
  }

  // Total ratio: |omega_last / omega_first| = N1 / N_last for chain; sign alternates.
  const ratio = Ns[Ns.length - 1] / Ns[0];

  // 3D depth offsets
  const depthDX = depth * 0.55 * 0.7;
  const depthDY = depth * 0.55 * 0.85;

  // ----- Compute viewBox covering all gears (with SVG y = -math y for positions) -----
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < geoms.length; i++) {
    const r = geoms[i].raEff;
    const cxSvg = positions[i].cx;
    const cySvg = -positions[i].cy;            // flip math y to SVG y
    minX = Math.min(minX, cxSvg - r);
    maxX = Math.max(maxX, cxSvg + r + depthDX);
    minY = Math.min(minY, cySvg - r);
    maxY = Math.max(maxY, cySvg + r + depthDY);
  }
  const topMargin   = showAnnotations ? 22 : 6;
  const sideMargin  = showAnnotations ? 16 : 6;
  const bottomMargin = showAnnotations ? 16 : 6;
  const viewX = minX - sideMargin;
  const viewY = minY - topMargin;
  const width = (maxX - minX) + 2 * sideMargin;
  const height = (maxY - minY) + topMargin + bottomMargin;

  let body = '';
  if (style === 'preview') {
    body += `<rect x="${viewX.toFixed(2)}" y="${viewY.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="#fbf8f0" rx="2"/>`;
  }

  if (showGrid) {
    body += `<g stroke="${PALETTE.grid}" stroke-width="0.08" fill="none">`;
    const gx0 = Math.floor(viewX/10)*10, gx1 = Math.ceil((viewX+width)/10)*10;
    const gy0 = Math.floor(viewY/10)*10, gy1 = Math.ceil((viewY+height)/10)*10;
    for (let x=gx0; x<=gx1; x+=10) body += `<line x1="${x}" y1="${viewY}" x2="${x}" y2="${(viewY+height).toFixed(2)}"/>`;
    for (let y=gy0; y<=gy1; y+=10) body += `<line x1="${viewX}" y1="${y}" x2="${(viewX+width).toFixed(2)}" y2="${y}"/>`;
    body += '</g>';
  }

  // Title bar
  if (showAnnotations) {
    const labelParts = [`Gears ${Ns.length}`, `Total ratio ${ratio.toFixed(3)} : 1`, Ns.map(n=>`${n}T`).join(' / '), `t = ${(opts.depth ?? 0).toFixed(1)} mm`];
    body += `<text x="${(viewX + width/2).toFixed(2)}" y="${(viewY + 8).toFixed(2)}" text-anchor="middle" font-size="4.5" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif" fill="#3a2814">${labelParts.join('   -   ')}</text>`;
  }

  // Center-distance brackets between consecutive gears
  if (showAnnotations) {
    for (let i = 0; i < geoms.length - 1; i++) {
      const a = positions[i], b = positions[i+1];
      const ax = a.cx, ay = -a.cy, bx = b.cx, by = -b.cy;
      const midx = (ax + bx) / 2, midy = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy);
      const nx = -dy/len, ny = dx/len; // perpendicular (left side of direction)
      const off = 0;
      body += `<g stroke="#7c6048" stroke-width="0.22" fill="none" opacity="0.85">`;
      body += `<line x1="${ax.toFixed(2)}" y1="${ay.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" stroke-dasharray="0.8 0.5"/>`;
      body += `</g>`;
      body += `<text x="${midx.toFixed(2)}" y="${(midy - 1.5).toFixed(2)}" text-anchor="middle" font-size="2.8" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-weight="600" fill="#5c4329">C${i+1}${i+2}=${centerDistances[i].toFixed(1)}</text>`;
    }
  }

  if (showLineOfContact && geoms.length >= 2) {
    const cx = geoms[0].rp;
    const a = geoms[0].alpha;
    const L = Math.min(geoms[0].rb, geoms[1].rb);
    const dx = Math.sin(a) * L, dy = Math.cos(a) * L;
    body += `<line x1="${(cx - dx).toFixed(2)}" y1="${dy.toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(-dy).toFixed(2)}" stroke="${PALETTE.contact}" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`;
  }

  // Back faces first (if 3D)
  if (depth > 0 && style === 'preview') {
    for (let i = 0; i < geoms.length; i++) {
      body += svgGearFace(geoms[i], {
        id: `gear${i+1}GroupBack`,
        cx: positions[i].cx + depthDX, cy: -positions[i].cy + depthDY,
        rotateDeg: phasesSvgDeg[i], variant: 'back',
        boreDiameter: bores[i], style, tone: tones[i], idPrefix,
      });
    }
  }
  // Front faces on top
  for (let i = 0; i < geoms.length; i++) {
    body += svgGearFace(geoms[i], {
      id: `gear${i+1}Group`,
      cx: positions[i].cx, cy: -positions[i].cy,
      rotateDeg: phasesSvgDeg[i], variant: 'front',
      boreDiameter: bores[i], showPitch, showBase: showBase && !showLineOfContact,
      style, tone: tones[i], idPrefix,
    });
  }

  // Per-gear labels (compact, in colored badges above the title would crowd; place below each gear)
  if (showAnnotations) {
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i];
      const pal = TONES[tones[i]];
      const cxSvg = positions[i].cx;
      const cySvg = -positions[i].cy;
      const lx = cxSvg, ly = cySvg + g.raEff + depthDY + 5;
      body += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" font-size="3" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-weight="700" fill="${pal.dark}">G${i+1}: ${g.N}T - PD ${(g.rp*2).toFixed(1)} - OD ${(g.raEff*2).toFixed(1)}</text>`;
    }
  }

  const defs = style === 'preview' ? svgDefs(idPrefix) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="gearChainSvg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="${viewX.toFixed(2)} ${viewY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}" data-num="${geoms.length}" data-depth-dx="${depthDX.toFixed(4)}" data-depth-dy="${depthDY.toFixed(4)}">${defs}${body}</svg>`;

  return { svg, geoms, positions, phasesMath, phasesSvgDeg, centerDistances, ratio, depthDX, depthDY };
}

/* ===== 2-gear wrapper (back-compat) ===== */

export function renderGearPair(N1, N2, m, alphaDeg, opts = {}) {
  const specs = [
    { N: N1, bore: opts.bore1, tone: opts.tone1 ?? 'maple' },
    { N: N2, bore: opts.bore2, tone: opts.tone2 ?? 'walnut' },
  ];
  const result = renderGearChain(specs, { ...opts, m, alphaDeg });
  // Maintain old return shape
  return {
    svg: result.svg,
    g1: result.geoms[0],
    g2: result.geoms[1],
    centerDistance: result.centerDistances[0],
    ratio: result.ratio,
    gear2PhaseDeg: result.phasesSvgDeg[1],
    depthDX: result.depthDX,
    depthDY: result.depthDY,
    positions: result.positions,
    phasesSvgDeg: result.phasesSvgDeg,
  };
}

export function renderGearSVG(N, m, alphaDeg, opts = {}) {
  return renderSingleGear(N, m, alphaDeg, opts);
}
