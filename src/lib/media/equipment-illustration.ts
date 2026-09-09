/**
 * EQUIPMENT ILLUSTRATIONS.
 *
 * Generated technical silhouettes, one per equipment category, rendered as SVG.
 *
 * WHY GENERATED RATHER THAN PHOTOGRAPHS:
 *
 *  1. Licensing. Images pulled from a search engine are almost always
 *     copyrighted. Committing them to a repository that will be deployed
 *     publicly by a Saudi company is a real legal exposure, not a theoretical
 *     one, and it is not a risk worth taking for placeholder art.
 *  2. The brief prohibits it. "Generic stock imagery everywhere" is on the
 *     explicit do-not list, and trust signals must not be fabricated. A stock
 *     photo of somebody else's crane sitting on an equipment page implies
 *     "this is our machine", which is exactly the kind of quiet dishonesty the
 *     rest of this codebase avoids.
 *  3. It is better design. A technical drawing reads as a SPECIFICATION, which
 *     is what this audience responds to, and it is unmistakably a placeholder
 *     rather than a claim.
 *
 * These are placeholders with a purpose. The moment the business supplies real
 * photography, `class_image` rows take precedence and these disappear — see
 * `illustrationFallback` usage in the equipment card and detail page.
 */

export type IllustrationTone = "light" | "dark";

interface Palette {
  background: string;
  grid: string;
  body: string;
  bodyDark: string;
  accent: string;
  ground: string;
  detail: string;
}

const PALETTES: Record<IllustrationTone, Palette> = {
  light: {
    background: "#eef0f3",
    grid: "#dcdfe5",
    body: "#5b6371",
    bodyDark: "#3d434e",
    accent: "#e8a219",
    ground: "#c3c8d1",
    detail: "#8b929e",
  },
  dark: {
    background: "#1b1f26",
    grid: "#272c35",
    body: "#79818f",
    bodyDark: "#5a616d",
    accent: "#f0ae2b",
    ground: "#333944",
    detail: "#5c6472",
  },
};

/** Every drawing shares this viewBox so cards crop consistently. */
const WIDTH = 800;
const HEIGHT = 600;
const GROUND_Y = 470;

/**
 * Machine artwork, drawn against a common ground line.
 *
 * Each entry returns SVG markup for one recognisable profile. Proportions are
 * approximated for legibility at card size rather than drawn to scale — these
 * identify a category at a glance, they are not engineering drawings.
 */
const MACHINES: Record<string, (p: Palette) => string> = {
  "mobile-cranes": (p) => `
    <!-- carrier -->
    <path d="M120 ${GROUND_Y - 40} h300 l18 -34 h96 l14 34 h40 v40 H120 z" fill="${p.body}"/>
    <rect x="440" y="${GROUND_Y - 76}" width="70" height="34" rx="5" fill="${p.bodyDark}"/>
    <!-- outriggers -->
    <path d="M110 ${GROUND_Y - 12} h30 v22 h-30 z M520 ${GROUND_Y - 12} h30 v22 h-30 z" fill="${p.detail}"/>
    <!-- telescopic boom, sectioned -->
    <g stroke="${p.accent}" stroke-linecap="round" fill="none">
      <path d="M250 ${GROUND_Y - 92} L620 190" stroke-width="26"/>
      <path d="M250 ${GROUND_Y - 92} L620 190" stroke-width="10" stroke="${p.bodyDark}" stroke-dasharray="4 96"/>
    </g>
    <!-- hoist line and block -->
    <path d="M624 196 v104" stroke="${p.bodyDark}" stroke-width="3"/>
    <path d="M612 300 h24 v26 h-24 z" fill="${p.bodyDark}"/>
    <!-- wheels -->
    ${wheels(p, [175, 250, 400, 470], GROUND_Y, 34)}
  `,

  "crawler-cranes": (p) => `
    <!-- crawler tracks -->
    <path d="M150 ${GROUND_Y - 46} h300 a24 24 0 0 1 0 48 H150 a24 24 0 0 1 0 -48 z" fill="${p.bodyDark}"/>
    <g fill="${p.detail}">
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${168 + i * 32}" y="${GROUND_Y - 38}" width="14" height="32" rx="2"/>`).join("")}
    </g>
    <!-- superstructure -->
    <path d="M215 ${GROUND_Y - 118} h190 v72 H215 z" fill="${p.body}"/>
    <rect x="360" y="${GROUND_Y - 108}" width="46" height="40" rx="4" fill="${p.bodyDark}"/>
    <!-- lattice boom: triangulated chords -->
    <g stroke="${p.accent}" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M250 ${GROUND_Y - 126} L560 120"/>
      <path d="M282 ${GROUND_Y - 126} L594 122"/>
    </g>
    <g stroke="${p.accent}" stroke-width="3.5" opacity="0.85">
      ${latticeWebbing(250, GROUND_Y - 126, 560, 120, 282, GROUND_Y - 126, 594, 122, 11)}
    </g>
    <!-- back stay + counterweight -->
    <path d="M232 ${GROUND_Y - 126} L196 ${GROUND_Y - 118}" stroke="${p.detail}" stroke-width="5"/>
    <rect x="176" y="${GROUND_Y - 116}" width="44" height="58" fill="${p.bodyDark}"/>
    <!-- hoist -->
    <path d="M577 126 v150" stroke="${p.bodyDark}" stroke-width="3"/>
    <path d="M565 276 h24 v28 h-24 z" fill="${p.bodyDark}"/>
  `,

  "boom-trucks": (p) => `
    <!-- cab + flatbed -->
    <path d="M140 ${GROUND_Y - 96} h110 l26 46 h44 v50 H140 z" fill="${p.body}"/>
    <rect x="158" y="${GROUND_Y - 86} " width="72" height="36" rx="4" fill="${p.bodyDark}"/>
    <path d="M320 ${GROUND_Y - 44} h300 v44 H320 z" fill="${p.bodyDark}"/>
    <path d="M320 ${GROUND_Y - 52} h300 v10 H320 z" fill="${p.detail}"/>
    <!-- knuckle boom: two articulated sections -->
    <g stroke="${p.accent}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M352 ${GROUND_Y - 60} L392 264 L586 214"/>
    </g>
    <circle cx="392" cy="264" r="15" fill="${p.bodyDark}"/>
    <path d="M586 220 v70" stroke="${p.bodyDark}" stroke-width="3"/>
    <path d="M574 290 h24 v22 h-24 z" fill="${p.bodyDark}"/>
    <!-- stabilisers -->
    <path d="M330 ${GROUND_Y - 6} h26 v20 h-26 z" fill="${p.detail}"/>
    ${wheels(p, [200, 400, 470], GROUND_Y, 32)}
  `,

  forklifts: (p) => `
    <!-- counterbalance body -->
    <path d="M300 ${GROUND_Y - 96} h190 a16 16 0 0 1 16 16 v80 H300 z" fill="${p.body}"/>
    <!-- overhead guard -->
    <path d="M330 ${GROUND_Y - 96} v-96 h150 v96" fill="none" stroke="${p.bodyDark}" stroke-width="11"/>
    <rect x="330" y="${GROUND_Y - 198}" width="152" height="12" rx="3" fill="${p.bodyDark}"/>
    <!-- seat -->
    <path d="M396 ${GROUND_Y - 132} h54 v36 h-54 z" fill="${p.bodyDark}"/>
    <!-- mast -->
    <g fill="${p.accent}">
      <rect x="270" y="200" width="16" height="${GROUND_Y - 200}" rx="3"/>
      <rect x="294" y="200" width="16" height="${GROUND_Y - 200}" rx="3"/>
    </g>
    <!-- carriage + forks -->
    <rect x="262" y="${GROUND_Y - 130}" width="56" height="16" fill="${p.bodyDark}"/>
    <path d="M270 ${GROUND_Y - 114} v92 h-92 v-14 h78 v-78 z" fill="${p.bodyDark}"/>
    ${wheels(p, [340, 470], GROUND_Y, 30)}
  `,

  telehandlers: (p) => `
    <path d="M250 ${GROUND_Y - 104} h250 a18 18 0 0 1 18 18 v66 H250 z" fill="${p.body}"/>
    <rect x="392" y="${GROUND_Y - 168}" width="112" height="66" rx="8" fill="${p.bodyDark}"/>
    <rect x="404" y="${GROUND_Y - 158}" width="88" height="42" rx="4" fill="${p.detail}"/>
    <!-- telescopic boom reaching forward and up -->
    <g stroke="${p.accent}" stroke-linecap="round" fill="none">
      <path d="M470 ${GROUND_Y - 128} L206 208" stroke-width="30"/>
      <path d="M470 ${GROUND_Y - 128} L206 208" stroke-width="11" stroke="${p.bodyDark}" stroke-dasharray="4 88"/>
    </g>
    <!-- carriage + forks -->
    <rect x="176" y="196" width="18" height="58" rx="3" fill="${p.bodyDark}"/>
    <path d="M176 246 h-74 v13 h74 z M176 214 h-74 v13 h74 z" fill="${p.bodyDark}"/>
    ${wheels(p, [310, 470], GROUND_Y, 38)}
  `,

  excavators: (p) => `
    <!-- tracks -->
    <path d="M210 ${GROUND_Y - 44} h250 a22 22 0 0 1 0 46 H210 a22 22 0 0 1 0 -46 z" fill="${p.bodyDark}"/>
    <g fill="${p.detail}">
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${230 + i * 32}" y="${GROUND_Y - 36}" width="14" height="30" rx="2"/>`).join("")}
    </g>
    <!-- house + cab -->
    <path d="M250 ${GROUND_Y - 118} h200 a12 12 0 0 1 12 12 v60 H250 z" fill="${p.body}"/>
    <rect x="262" y="${GROUND_Y - 176}" width="76" height="60" rx="6" fill="${p.bodyDark}"/>
    <rect x="272" y="${GROUND_Y - 166}" width="56" height="38" rx="3" fill="${p.detail}"/>
    <!-- boom, dipper, bucket -->
    <g stroke="${p.accent}" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M440 ${GROUND_Y - 108} L556 236 L604 352"/>
    </g>
    <circle cx="556" cy="236" r="13" fill="${p.bodyDark}"/>
    <path d="M596 350 q34 26 6 58 q-40 12 -56 -22 z" fill="${p.bodyDark}"/>
  `,

  "wheel-loaders": (p) => `
    <!-- rear body + cab -->
    <path d="M380 ${GROUND_Y - 96} h150 a16 16 0 0 1 16 16 v80 H380 z" fill="${p.body}"/>
    <rect x="330" y="${GROUND_Y - 168}" width="108" height="72" rx="8" fill="${p.bodyDark}"/>
    <rect x="342" y="${GROUND_Y - 158}" width="84" height="46" rx="4" fill="${p.detail}"/>
    <!-- articulation joint -->
    <path d="M300 ${GROUND_Y - 84} h84 v48 h-84 z" fill="${p.body}"/>
    <circle cx="326" cy="${GROUND_Y - 60}" r="10" fill="${p.detail}"/>
    <!-- lift arms + bucket -->
    <g stroke="${p.accent}" stroke-width="22" fill="none" stroke-linecap="round">
      <path d="M330 ${GROUND_Y - 92} L196 ${GROUND_Y - 40}"/>
    </g>
    <path d="M196 ${GROUND_Y - 74} h-72 v70 h96 l-24 -34 z" fill="${p.bodyDark}"/>
    ${wheels(p, [268, 470], GROUND_Y, 46)}
  `,

  "backhoe-loaders": (p) => `
    <path d="M300 ${GROUND_Y - 92} h180 v76 H300 z" fill="${p.body}"/>
    <rect x="330" y="${GROUND_Y - 164}" width="118" height="74" rx="8" fill="${p.bodyDark}"/>
    <rect x="342" y="${GROUND_Y - 154}" width="94" height="48" rx="4" fill="${p.detail}"/>
    <!-- front loader arm + bucket -->
    <g stroke="${p.accent}" stroke-width="18" fill="none" stroke-linecap="round">
      <path d="M320 ${GROUND_Y - 86} L190 ${GROUND_Y - 44}"/>
    </g>
    <path d="M190 ${GROUND_Y - 72} h-64 v64 h84 l-20 -30 z" fill="${p.bodyDark}"/>
    <!-- rear backhoe arm -->
    <g stroke="${p.accent}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M470 ${GROUND_Y - 96} L556 ${GROUND_Y - 168} L610 ${GROUND_Y - 74}"/>
    </g>
    <circle cx="556" cy="${GROUND_Y - 168}" r="10" fill="${p.bodyDark}"/>
    <path d="M602 ${GROUND_Y - 76} q26 18 6 42 q-30 8 -40 -16 z" fill="${p.bodyDark}"/>
    ${wheels(p, [278, 480], GROUND_Y, [30, 46])}
  `,

  manlifts: (p) => `
    <!-- chassis -->
    <path d="M180 ${GROUND_Y - 56} h250 a12 12 0 0 1 12 12 v44 H180 z" fill="${p.body}"/>
    <!-- turntable -->
    <rect x="250" y="${GROUND_Y - 78}" width="96" height="24" rx="5" fill="${p.bodyDark}"/>
    <!-- articulating boom: riser, elbow, upper -->
    <g stroke="${p.accent}" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M298 ${GROUND_Y - 84} L340 236 L520 176"/>
    </g>
    <circle cx="340" cy="236" r="12" fill="${p.bodyDark}"/>
    <!-- platform basket -->
    <path d="M516 150 h84 v52 h-84 z" fill="none" stroke="${p.bodyDark}" stroke-width="7"/>
    <path d="M516 202 h84" stroke="${p.bodyDark}" stroke-width="9"/>
    ${wheels(p, [225, 400], GROUND_Y, 28)}
  `,

  "scissor-lifts": (p) => `
    <!-- chassis -->
    <path d="M230 ${GROUND_Y - 48} h340 a12 12 0 0 1 12 12 v36 H230 z" fill="${p.body}"/>
    <!-- scissor stack -->
    <g stroke="${p.accent}" stroke-width="11" stroke-linecap="round">
      ${scissorStack(300, 500, GROUND_Y - 56, 210, 5)}
    </g>
    <!-- platform + guardrail -->
    <rect x="266" y="196" width="268" height="18" rx="4" fill="${p.bodyDark}"/>
    <path d="M272 196 v-58 h256 v58" fill="none" stroke="${p.bodyDark}" stroke-width="7"/>
    <path d="M272 166 h256" stroke="${p.bodyDark}" stroke-width="5"/>
    ${wheels(p, [280, 520], GROUND_Y, 26)}
  `,

  generators: (p) => `
    <!-- skid base -->
    <path d="M170 ${GROUND_Y - 26} h460 v30 H170 z" fill="${p.bodyDark}"/>
    <!-- acoustic canopy -->
    <path d="M190 ${GROUND_Y - 216} h420 a14 14 0 0 1 14 14 v176 H190 z" fill="${p.body}"/>
    <path d="M190 ${GROUND_Y - 216} h434 v18 H190 z" fill="${p.bodyDark}"/>
    <!-- louvres -->
    <g fill="${p.detail}">
      ${Array.from({ length: 6 }, (_, i) => `<rect x="216" y="${GROUND_Y - 186 + i * 20}" width="120" height="9" rx="3"/>`).join("")}
    </g>
    <!-- control panel -->
    <rect x="396" y="${GROUND_Y - 186}" width="180" height="112" rx="6" fill="${p.bodyDark}"/>
    <circle cx="440" cy="${GROUND_Y - 150}" r="16" fill="${p.accent}"/>
    <g fill="${p.detail}">
      <rect x="472" y="${GROUND_Y - 162}" width="86" height="10" rx="3"/>
      <rect x="472" y="${GROUND_Y - 142}" width="86" height="10" rx="3"/>
      <rect x="472" y="${GROUND_Y - 122}" width="56" height="10" rx="3"/>
    </g>
    <!-- lifting eye -->
    <path d="M382 ${GROUND_Y - 216} v-26 h36 v26" fill="none" stroke="${p.detail}" stroke-width="8"/>
  `,

  "air-compressors": (p) => `
    <!-- towable canopy -->
    <path d="M240 ${GROUND_Y - 168} h330 a16 16 0 0 1 16 16 v122 H240 z" fill="${p.body}"/>
    <path d="M240 ${GROUND_Y - 168} h346 v16 H240 z" fill="${p.bodyDark}"/>
    <g fill="${p.detail}">
      ${Array.from({ length: 5 }, (_, i) => `<rect x="266" y="${GROUND_Y - 138 + i * 18}" width="110" height="8" rx="3"/>`).join("")}
    </g>
    <!-- outlet valves -->
    <g fill="${p.accent}">
      <circle cx="540" cy="${GROUND_Y - 96}" r="13"/>
      <circle cx="540" cy="${GROUND_Y - 60}" r="13"/>
    </g>
    <!-- drawbar + jockey wheel -->
    <path d="M240 ${GROUND_Y - 42} L120 ${GROUND_Y - 20}" stroke="${p.bodyDark}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="120" cy="${GROUND_Y - 14}" r="11" fill="${p.detail}"/>
    ${wheels(p, [330, 470], GROUND_Y, 30)}
  `,

  "dewatering-pumps": (p) => `
    <!-- frame -->
    <path d="M220 ${GROUND_Y - 150} h360 v150 H220 z" fill="none" stroke="${p.bodyDark}" stroke-width="12"/>
    <path d="M220 ${GROUND_Y - 150} h360" stroke="${p.detail}" stroke-width="12"/>
    <!-- engine block -->
    <rect x="262" y="${GROUND_Y - 122}" width="150" height="92" rx="8" fill="${p.body}"/>
    <g fill="${p.detail}">
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${282 + i * 32}" y="${GROUND_Y - 112}" width="18" height="42" rx="3"/>`).join("")}
    </g>
    <!-- volute casing -->
    <circle cx="480" cy="${GROUND_Y - 74}" r="52" fill="${p.body}"/>
    <circle cx="480" cy="${GROUND_Y - 74}" r="26" fill="${p.bodyDark}"/>
    <!-- suction and discharge -->
    <path d="M480 ${GROUND_Y - 126} v-46 h44" fill="none" stroke="${p.accent}" stroke-width="20" stroke-linecap="round"/>
    <path d="M532 ${GROUND_Y - 74} h60" stroke="${p.accent}" stroke-width="20" stroke-linecap="round"/>
  `,

  "low-bed-trailers": (p) => `
    <!-- gooseneck -->
    <path d="M150 ${GROUND_Y - 104} h120 l38 46 h-158 z" fill="${p.body}"/>
    <!-- low deck -->
    <path d="M262 ${GROUND_Y - 58} h360 v30 H262 z" fill="${p.bodyDark}"/>
    <path d="M262 ${GROUND_Y - 64} h360 v8 H262 z" fill="${p.accent}"/>
    <!-- rear axle bogie deck -->
    <path d="M560 ${GROUND_Y - 96} h100 v40 h-100 z" fill="${p.body}"/>
    <!-- deck ribs -->
    <g fill="${p.detail}">
      ${Array.from({ length: 8 }, (_, i) => `<rect x="${286 + i * 40}" y="${GROUND_Y - 56}" width="8" height="26"/>`).join("")}
    </g>
    <!-- kingpin -->
    <circle cx="200" cy="${GROUND_Y - 52}" r="9" fill="${p.detail}"/>
    ${wheels(p, [590, 640, 690], GROUND_Y, 26)}
  `,
};

/** Wheels sitting on the ground line. `radius` may differ per position. */
function wheels(p: Palette, xs: number[], groundY: number, radius: number | number[]): string {
  return xs
    .map((x, i) => {
      const r = Array.isArray(radius) ? (radius[i] ?? radius[0]!) : radius;
      return `
        <circle cx="${x}" cy="${groundY - r + 4}" r="${r}" fill="${p.bodyDark}"/>
        <circle cx="${x}" cy="${groundY - r + 4}" r="${r * 0.45}" fill="${p.detail}"/>`;
    })
    .join("");
}

/** Zig-zag webbing between two lattice chords. */
function latticeWebbing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
  segments: number,
): string {
  const points: string[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const ax = x1 + (x2 - x1) * t;
    const ay = y1 + (y2 - y1) * t;
    const bx = x3 + (x4 - x3) * t;
    const by = y3 + (y4 - y3) * t;
    points.push(i % 2 === 0 ? `M${ax} ${ay} L${bx} ${by}` : `M${bx} ${by} L${ax} ${ay}`);
  }
  return `<path d="${points.join(" ")}" />`;
}

/** Cross-braced scissor stack between a base and a raised platform. */
function scissorStack(
  left: number,
  right: number,
  bottomY: number,
  height: number,
  levels: number,
): string {
  const step = height / levels;
  const segments: string[] = [];
  for (let i = 0; i < levels; i += 1) {
    const yTop = bottomY - step * (i + 1);
    const yBottom = bottomY - step * i;
    segments.push(`M${left} ${yBottom} L${right} ${yTop}`);
    segments.push(`M${right} ${yBottom} L${left} ${yTop}`);
  }
  return `<path d="${segments.join(" ")}" fill="none"/>`;
}

/** Fallback for a category with no bespoke drawing. */
function genericMachine(p: Palette): string {
  return `
    <path d="M220 ${GROUND_Y - 120} h240 a16 16 0 0 1 16 16 v104 H220 z" fill="${p.body}"/>
    <rect x="250" y="${GROUND_Y - 190}" width="110" height="70" rx="8" fill="${p.bodyDark}"/>
    <g stroke="${p.accent}" stroke-width="22" fill="none" stroke-linecap="round">
      <path d="M450 ${GROUND_Y - 110} L604 250"/>
    </g>
    ${wheels(p, [280, 420], GROUND_Y, 36)}
  `;
}

/**
 * Render the illustration for a category.
 *
 * `label` is used for the accessible title, so a screen reader hears the
 * category rather than "image".
 */
export function renderEquipmentIllustration(
  categorySlug: string,
  label: string,
  tone: IllustrationTone = "light",
): string {
  const p = PALETTES[tone];
  const draw = MACHINES[categorySlug] ?? genericMachine;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="t">
  <title id="t">${escapeXml(label)}</title>
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0 H0 V40" fill="none" stroke="${p.grid}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${p.background}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <!-- ground line -->
  <path d="M0 ${GROUND_Y + 8} H${WIDTH}" stroke="${p.ground}" stroke-width="4"/>
  <path d="M0 ${GROUND_Y + 22} H${WIDTH}" stroke="${p.ground}" stroke-width="2" stroke-dasharray="12 10" opacity="0.6"/>
  ${draw(p)}
  <!-- Marked as an illustration so it can never be mistaken for a photograph
       of an actual machine in the fleet. -->
  <text x="${WIDTH - 24}" y="${HEIGHT - 22}" text-anchor="end"
        font-family="system-ui, sans-serif" font-size="19" fill="${p.detail}">
    ${escapeXml(label)} · illustration
  </text>
</svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );
}

/** Stable URL for a category's illustration, captioned in the given locale. */
export function illustrationUrl(categorySlug: string, locale: "en" | "ar" = "en"): string {
  return `/api/media/illustration/${encodeURIComponent(categorySlug)}?locale=${locale}`;
}

