import { parseDesign, type Branding, type CardElement } from "@/lib/templates/schema";

export type CardData = {
  /** Values keyed by field binding (`full_name`, `custom:blood_group`, ...). */
  values: Record<string, string | null | undefined>;
  photoUrl?: string | null;
  /** QR module matrix. When absent a clearly-marked placeholder is drawn instead. */
  qrModules?: boolean[][] | null;
};

const PT_TO_MM = 0.3528;
const FONT = "Helvetica, Arial, 'Segoe UI', sans-serif";

function resolveColor(c: string | undefined, b: Branding): string {
  switch (c) {
    case "$primary":
      return b.primary;
    case "$secondary":
      return b.secondary;
    case "$ink":
      return "#0f172a";
    case "$muted":
      return "#64748b";
    case "$paper":
      return "#ffffff";
    default:
      return c ?? "none";
  }
}

/** Shrink then truncate so text never leaves its box (average glyph width ~0.56em). */
function fit(text: string, boxW: number, fontMm: number, weight: number) {
  const em = weight >= 700 ? 0.6 : 0.54;
  let size = fontMm;
  const needed = text.length * em * size;
  if (needed > boxW) size = Math.max(fontMm * 0.65, (boxW / (text.length * em)));
  const maxChars = Math.max(1, Math.floor(boxW / (em * size)));
  return { size, text: text.length > maxChars ? text.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…" : text };
}

function anchorX(align: "start" | "middle" | "end", x: number, w: number) {
  return align === "start" ? x : align === "middle" ? x + w / 2 : x + w;
}

/** A recognisable-but-fake QR used only in previews. It is NOT scannable and says so. */
function QrPlaceholder({ x, y, size }: { x: number; y: number; size: number }) {
  const n = 21;
  const cell = size / n;
  const cells: React.ReactNode[] = [];
  const finder = (fx: number, fy: number) => (
    <g key={`f${fx}${fy}`}>
      <rect x={x + fx * cell} y={y + fy * cell} width={7 * cell} height={7 * cell} fill="#94a3b8" />
      <rect x={x + (fx + 1) * cell} y={y + (fy + 1) * cell} width={5 * cell} height={5 * cell} fill="#fff" />
      <rect x={x + (fx + 2) * cell} y={y + (fy + 2) * cell} width={3 * cell} height={3 * cell} fill="#94a3b8" />
    </g>
  );
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8);
      if (inFinder) continue;
      if ((r * 7 + c * 13 + r * c) % 3 === 0) {
        cells.push(<rect key={`${r}-${c}`} x={x + c * cell} y={y + r * cell} width={cell} height={cell} fill="#cbd5e1" />);
      }
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} fill="#fff" />
      {cells}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
      <text x={x + size / 2} y={y + size / 2 + size * 0.04} textAnchor="middle" fontSize={size * 0.13} fontWeight={700} fill="#475569" fontFamily={FONT}>
        QR PREVIEW
      </text>
    </g>
  );
}

function QrReal({ x, y, size, modules }: { x: number; y: number; size: number; modules: boolean[][] }) {
  const n = modules.length;
  const cell = size / (n + 2); // 1-module quiet zone each side
  const path: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) path.push(`M${(x + (c + 1) * cell).toFixed(3)} ${(y + (r + 1) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`);
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} fill="#fff" />
      <path d={path.join("")} fill="#000" />
    </g>
  );
}

function Silhouette({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#e2e8f0" />
      <circle cx={x + w / 2} cy={y + h * 0.38} r={w * 0.2} fill="#94a3b8" />
      <path d={`M${x + w * 0.15} ${y + h} q0 ${-h * 0.32} ${w * 0.35} ${-h * 0.32} q${w * 0.35} 0 ${w * 0.35} ${h * 0.32}z`} fill="#94a3b8" />
    </g>
  );
}

function Element({ el, data, brand, uid }: { el: CardElement; data: CardData; brand: Branding; uid: string }) {
  if (el.hidden) return null;

  if (el.type === "shape") {
    const fill = resolveColor(el.fill, brand);
    const stroke = el.stroke ? resolveColor(el.stroke, brand) : "none";
    if (el.kind === "line") {
      return <line x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y + el.h} stroke={stroke === "none" ? fill : stroke} strokeWidth={el.strokeMm ?? 0.3} opacity={el.opacity} />;
    }
    if (el.kind === "circle") {
      return <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={fill} stroke={stroke} strokeWidth={el.strokeMm ?? 0} opacity={el.opacity} />;
    }
    return <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius ?? 0} fill={fill} stroke={stroke} strokeWidth={el.strokeMm ?? 0} opacity={el.opacity} />;
  }

  if (el.type === "photo") {
    const clipId = `${uid}-${el.id}`;
    const r = el.shape === "rounded" ? Math.min(el.w, el.h) * 0.12 : 0;
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            {el.shape === "circle" ? <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} /> : <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} />}
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {data.photoUrl ? (
            <image href={data.photoUrl} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <Silhouette x={el.x} y={el.y} w={el.w} h={el.h} />
          )}
        </g>
        {el.stroke && el.strokeMm ? (
          el.shape === "circle" ? (
            <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill="none" stroke={resolveColor(el.stroke, brand)} strokeWidth={el.strokeMm} />
          ) : (
            <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={r} fill="none" stroke={resolveColor(el.stroke, brand)} strokeWidth={el.strokeMm} />
          )
        ) : null}
      </g>
    );
  }

  if (el.type === "qr") {
    return data.qrModules ? <QrReal x={el.x} y={el.y} size={el.size} modules={data.qrModules} /> : <QrPlaceholder x={el.x} y={el.y} size={el.size} />;
  }

  if (el.type === "logo") {
    return brand.logoUrl ? (
      <image href={brand.logoUrl} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="xMidYMid meet" />
    ) : (
      <g opacity={0.9}>
        <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={Math.min(el.w, el.h) * 0.18} fill="#ffffff" stroke={brand.primary} strokeWidth={0.3} />
        <text x={el.x + el.w / 2} y={el.y + el.h / 2 + Math.min(el.w, el.h) * 0.14} textAnchor="middle" fontSize={Math.min(el.w, el.h) * 0.42} fontWeight={700} fill={brand.primary} fontFamily={FONT}>
          {(brand.orgName.trim()[0] ?? "•").toUpperCase()}
        </text>
      </g>
    );
  }

  // text and field
  const fontMm = el.fontPt * PT_TO_MM;
  const fill = resolveColor(el.color, brand);
  let value = el.type === "text" ? el.text : (data.values[el.binding] ?? "");
  if (el.type === "field" && !value) value = "";
  if (el.uppercase && value) value = value.toUpperCase();
  const common = { fontFamily: FONT, fontWeight: el.weight, fill, opacity: el.opacity, textAnchor: el.align, letterSpacing: el.letterSpacing ? `${el.letterSpacing * fontMm}` : undefined } as const;
  const ax = anchorX(el.align, el.x, el.w);

  if (el.type === "text" && (el.lines ?? 1) > 1) {
    // Simple word wrap for multi-line wording (back-of-card text).
    const perLine = Math.max(8, Math.floor(el.w / (0.54 * fontMm)));
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > perLine) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return (
      <text {...common}>
        {lines.slice(0, el.lines).map((ln, i) => (
          <tspan key={i} x={ax} y={el.y + fontMm * 1.05 + i * fontMm * 1.3} fontSize={fontMm}>
            {ln}
          </tspan>
        ))}
      </text>
    );
  }

  if (el.type === "field" && el.label) {
    const labelMm = Math.max(1.6, fontMm * 0.55);
    const fitted = fit(value || "—", el.w, fontMm, el.weight);
    return (
      <g>
        <text x={ax} y={el.y + labelMm * 0.95} fontSize={labelMm} fontFamily={FONT} fontWeight={600} fill={resolveColor("$muted", brand)} textAnchor={el.align} letterSpacing={labelMm * 0.06}>
          {el.label.toUpperCase()}
        </text>
        <text {...common} x={ax} y={el.y + el.h - fontMm * 0.12} fontSize={fitted.size}>
          {fitted.text}
        </text>
      </g>
    );
  }

  const fitted = fit(value, el.w, fontMm, el.weight);
  return (
    <text {...common} x={ax} y={el.y + Math.min(el.h, fontMm * 1.1)} fontSize={fitted.size}>
      {fitted.text}
    </text>
  );
}

/**
 * One side of a card as inline SVG in true millimetres (viewBox = card size), so on-screen preview
 * and print output share the exact same geometry.
 */
export function CardSide({
  design,
  widthMm,
  heightMm,
  data,
  brand,
  uid,
  className,
  showSafeZone = false,
  safeMm = 3,
}: {
  design: unknown;
  widthMm: number;
  heightMm: number;
  data: CardData;
  brand: Branding;
  /** Unique per card on the page (SVG clip-path ids must not collide). */
  uid: string;
  className?: string;
  showSafeZone?: boolean;
  safeMm?: number;
}) {
  const d = parseDesign(design);
  const radius = 3.2; // CR80 corner radius
  const clip = `${uid}-card`;
  return (
    <svg viewBox={`0 0 ${widthMm} ${heightMm}`} className={className} role="img" aria-label="ID card preview" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={widthMm} height={heightMm} rx={radius} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={0} width={widthMm} height={heightMm} fill={resolveColor(d.background, brand)} />
        {d.elements.map((el) => (
          <Element key={el.id} el={el} data={data} brand={brand} uid={uid} />
        ))}
      </g>
      <rect x={0.1} y={0.1} width={widthMm - 0.2} height={heightMm - 0.2} rx={radius} fill="none" stroke="#cbd5e1" strokeWidth={0.2} />
      {showSafeZone ? <rect x={safeMm} y={safeMm} width={widthMm - safeMm * 2} height={heightMm - safeMm * 2} fill="none" stroke="#ef4444" strokeWidth={0.2} strokeDasharray="1 1" /> : null}
    </svg>
  );
}
