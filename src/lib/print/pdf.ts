import "server-only";
import {
  PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, pushGraphicsState, popGraphicsState,
  moveTo, lineTo, appendBezierCurve, closePath, clip, endPath, type Color,
} from "pdf-lib";
import { parseDesign, type Branding, type CardElement } from "@/lib/templates/schema";

const K = 72 / 25.4; // mm -> PDF points
const KAPPA = 0.5522847498;

export type PrintCard = {
  key: string;
  widthMm: number;
  heightMm: number;
  frontDesign: unknown;
  backDesign: unknown;
  values: Record<string, string | null | undefined>;
  photo: Uint8Array | null;
  qr: boolean[][];
};
export type Layout = "card" | "a4";

type Ctx = { doc: PDFDocument; regular: PDFFont; bold: PDFFont; brand: Branding; logo: PDFImage | null; photos: Map<string, PDFImage> };

function hex(c: string | undefined, b: Branding): Color | undefined {
  const v = c === "$primary" ? b.primary : c === "$secondary" ? b.secondary : c === "$ink" ? "#0f172a" : c === "$muted" ? "#64748b" : c === "$paper" ? "#ffffff" : c;
  if (!v || !/^#[0-9a-fA-F]{6}$/.test(v)) return undefined;
  return rgb(parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255);
}

/** Standard PDF fonts only cover Latin-1; swap anything else for a close ASCII letter or "?". */
function clean(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      const base = ch.normalize("NFD")[0];
      try {
        font.encodeText(base);
        out += base;
      } catch {
        out += "?";
      }
    }
  }
  return out;
}

function clipRoundRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number) {
  const k = r * (1 - KAPPA);
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y), lineTo(x + w - r, y),
    appendBezierCurve(x + w - k, y, x + w, y + k, x + w, y + r), lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h), lineTo(x + r, y + h),
    appendBezierCurve(x + k, y + h, x, y + h - k, x, y + h - r), lineTo(x, y + r),
    appendBezierCurve(x, y + k, x + k, y, x + r, y),
    closePath(), clip(), endPath(),
  );
}
function clipEllipse(page: PDFPage, x: number, y: number, w: number, h: number) {
  const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry, kx = rx * KAPPA, ky = ry * KAPPA;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(cx + rx, cy),
    appendBezierCurve(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry),
    appendBezierCurve(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy),
    appendBezierCurve(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry),
    appendBezierCurve(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy),
    closePath(), clip(), endPath(),
  );
}
const unclip = (page: PDFPage) => page.pushOperators(popGraphicsState());

function roundedPath(w: number, h: number, r: number) {
  return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

function drawText(page: PDFPage, ctx: Ctx, text: string, x: number, baseline: number, w: number, o: { size: number; bold: boolean; align: string; color?: Color; opacity?: number; fit?: boolean }) {
  const font = o.bold ? ctx.bold : ctx.regular;
  let t = clean(font, text);
  let size = o.size;
  if (o.fit !== false) {
    while (font.widthOfTextAtSize(t, size) > w && size > o.size * 0.65) size -= 0.1;
    if (font.widthOfTextAtSize(t, size) > w) {
      while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > w) t = t.slice(0, -1);
      t = t.trimEnd() + "...";
    }
  }
  const tw = font.widthOfTextAtSize(t, size);
  const px = o.align === "middle" ? x + (w - tw) / 2 : o.align === "end" ? x + w - tw : x;
  page.drawText(t, { x: px, y: baseline, size, font, color: o.color ?? rgb(0, 0, 0), opacity: o.opacity });
}

function drawElement(page: PDFPage, ctx: Ctx, ox: number, oy: number, pageH: number, el: CardElement, p: PrintCard) {
  if (el.hidden) return;
  const X = (mm: number) => (ox + mm) * K;
  const Y = (mm: number) => pageH - (oy + mm) * K; // top-down mm -> PDF y
  const b = ctx.brand;

  if (el.type === "shape") {
    const fill = hex(el.fill, b), stroke = el.stroke ? hex(el.stroke, b) : undefined;
    if (el.kind === "line") {
      page.drawLine({ start: { x: X(el.x), y: Y(el.y) }, end: { x: X(el.x + el.w), y: Y(el.y + el.h) }, thickness: (el.strokeMm ?? 0.3) * K, color: stroke ?? fill ?? rgb(0, 0, 0), opacity: el.opacity });
    } else if (el.kind === "circle") {
      page.drawEllipse({ x: X(el.x + el.w / 2), y: Y(el.y + el.h / 2), xScale: (el.w / 2) * K, yScale: (el.h / 2) * K, color: fill, borderColor: stroke, borderWidth: (el.strokeMm ?? 0) * K, opacity: el.opacity });
    } else if (el.radius) {
      page.drawSvgPath(roundedPath(el.w * K, el.h * K, el.radius * K), { x: X(el.x), y: Y(el.y), color: fill, borderColor: stroke, borderWidth: (el.strokeMm ?? 0) * K, opacity: el.opacity });
    } else {
      page.drawRectangle({ x: X(el.x), y: Y(el.y + el.h), width: el.w * K, height: el.h * K, color: fill, borderColor: stroke, borderWidth: (el.strokeMm ?? 0) * K, opacity: el.opacity });
    }
    return;
  }

  if (el.type === "photo") {
    const x = X(el.x), y = Y(el.y + el.h), w = el.w * K, h = el.h * K;
    const r = el.shape === "rounded" ? Math.min(w, h) * 0.12 : 0;
    if (el.shape === "circle") clipEllipse(page, x, y, w, h);
    else clipRoundRect(page, x, y, w, h, r);
    const img = ctx.photos.get(p.key);
    if (img) {
      const s = Math.max(w / img.width, h / img.height);
      page.drawImage(img, { x: x + (w - img.width * s) / 2, y: y + (h - img.height * s) / 2, width: img.width * s, height: img.height * s });
    } else {
      page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.89, 0.91, 0.94) });
      page.drawEllipse({ x: x + w / 2, y: y + h * 0.62, xScale: w * 0.2, yScale: w * 0.2, color: rgb(0.58, 0.64, 0.72) });
      page.drawEllipse({ x: x + w / 2, y, xScale: w * 0.35, yScale: h * 0.32, color: rgb(0.58, 0.64, 0.72) });
    }
    unclip(page);
    const stroke = el.stroke ? hex(el.stroke, b) : undefined;
    if (stroke && el.strokeMm) {
      if (el.shape === "circle") page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, borderColor: stroke, borderWidth: el.strokeMm * K });
      else if (r) page.drawSvgPath(roundedPath(w, h, r), { x, y: y + h, borderColor: stroke, borderWidth: el.strokeMm * K });
      else page.drawRectangle({ x, y, width: w, height: h, borderColor: stroke, borderWidth: el.strokeMm * K });
    }
    return;
  }

  if (el.type === "qr") {
    const size = el.size * K, x = X(el.x), y = Y(el.y + el.size);
    const n = p.qr.length, cell = size / (n + 2);
    page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!p.qr[r][c]) { c++; continue; }
        let end = c;
        while (end < n && p.qr[r][end]) end++;
        page.drawRectangle({ x: x + (c + 1) * cell, y: y + size - (r + 2) * cell, width: (end - c) * cell + 0.15, height: cell + 0.15, color: rgb(0, 0, 0) });
        c = end;
      }
    }
    return;
  }

  if (el.type === "logo") {
    const x = X(el.x), y = Y(el.y + el.h), w = el.w * K, h = el.h * K;
    if (ctx.logo) {
      const s = Math.min(w / ctx.logo.width, h / ctx.logo.height);
      page.drawImage(ctx.logo, { x: x + (w - ctx.logo.width * s) / 2, y: y + (h - ctx.logo.height * s) / 2, width: ctx.logo.width * s, height: ctx.logo.height * s });
    } else {
      page.drawSvgPath(roundedPath(w, h, Math.min(w, h) * 0.18), { x, y: y + h, color: rgb(1, 1, 1), borderColor: hex("$primary", b), borderWidth: 0.3 * K });
      const letter = clean(ctx.bold, (b.orgName.trim()[0] ?? "•").toUpperCase());
      const size = Math.min(w, h) * 0.5;
      page.drawText(letter, { x: x + (w - ctx.bold.widthOfTextAtSize(letter, size)) / 2, y: y + h / 2 - size * 0.35, size, font: ctx.bold, color: hex("$primary", b) });
    }
    return;
  }

  // text / field
  const color = hex(el.color, b);
  const bold = el.weight >= 600;
  let value = el.type === "text" ? el.text : (p.values[el.binding] ?? "");
  if (el.uppercase && value) value = value.toUpperCase();
  const sizePt = el.fontPt;
  if (el.type === "text" && (el.lines ?? 1) > 1) {
    const font = ctx.regular;
    const words = clean(font, value).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(trial, sizePt) > el.w * K && cur) { lines.push(cur); cur = w; } else cur = trial;
    }
    if (cur) lines.push(cur);
    lines.slice(0, el.lines).forEach((ln, i) => drawText(page, ctx, ln, X(el.x), Y(el.y) - sizePt * 1.0 - i * sizePt * 1.3, el.w * K, { size: sizePt, bold, align: el.align, color, opacity: el.opacity, fit: false }));
    return;
  }
  if (el.type === "field" && el.label) {
    const labelPt = Math.max(4.5, sizePt * 0.55);
    drawText(page, ctx, el.label.toUpperCase(), X(el.x), Y(el.y) - labelPt * 0.95, el.w * K, { size: labelPt, bold: true, align: el.align, color: hex("$muted", b) });
    drawText(page, ctx, value || "-", X(el.x), Y(el.y + el.h) + sizePt * 0.12, el.w * K, { size: sizePt, bold, align: el.align, color, opacity: el.opacity });
    return;
  }
  drawText(page, ctx, value, X(el.x), Y(el.y + Math.min(el.h, (sizePt / K) * 1.1)), el.w * K, { size: sizePt, bold, align: el.align, color, opacity: el.opacity });
}

function drawSide(page: PDFPage, ctx: Ctx, ox: number, oy: number, pageH: number, design: unknown, p: PrintCard) {
  const d = parseDesign(design);
  const x = ox * K, y = pageH - (oy + p.heightMm) * K, w = p.widthMm * K, h = p.heightMm * K;
  clipRoundRect(page, x, y, w, h, 3.2 * K);
  page.drawRectangle({ x, y, width: w, height: h, color: hex(d.background, ctx.brand) ?? rgb(1, 1, 1) });
  for (const el of d.elements) drawElement(page, ctx, ox, oy, pageH, el, p);
  unclip(page);
}

function cropMarks(page: PDFPage, ox: number, oy: number, pageH: number, wMm: number, hMm: number) {
  const len = 2 * K, off = 1 * K, t = 0.25;
  const x0 = ox * K, x1 = (ox + wMm) * K, yTop = pageH - oy * K, yBot = pageH - (oy + hMm) * K;
  const line = (sx: number, sy: number, ex: number, ey: number) => page.drawLine({ start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: t, color: rgb(0, 0, 0) });
  for (const [cx, dx] of [[x0, -1], [x1, 1]] as const) for (const [cy, dy] of [[yTop, 1], [yBot, -1]] as const) {
    line(cx + dx * off, cy, cx + dx * (off + len), cy);
    line(cx, cy + dy * off, cx, cy + dy * (off + len));
  }
}

export async function buildPdf(cards: PrintCard[], opts: { layout: Layout; marks: boolean; brand: Branding; logo: Uint8Array | null }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx: Ctx = { doc, regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold), brand: opts.brand, logo: null, photos: new Map() };
  if (opts.logo) {
    try {
      const isPng = opts.logo[0] === 0x89 && opts.logo[1] === 0x50;
      const isJpg = opts.logo[0] === 0xff && opts.logo[1] === 0xd8;
      ctx.logo = isPng ? await doc.embedPng(opts.logo) : isJpg ? await doc.embedJpg(opts.logo) : null; // WebP is not supported: falls back to the initial tile
    } catch { ctx.logo = null; }
  }
  for (const c of cards) {
    if (c.photo) { try { ctx.photos.set(c.key, await doc.embedJpg(c.photo)); } catch { /* no photo */ } }
  }

  if (opts.layout === "card") {
    for (const c of cards) for (const design of [c.frontDesign, c.backDesign]) {
      const page = doc.addPage([c.widthMm * K, c.heightMm * K]);
      drawSide(page, ctx, 0, 0, c.heightMm * K, design, c);
    }
  } else {
    const A4W = 210, A4H = 297, margin = 10, gap = opts.marks ? 6 : 4;
    const w = cards[0].widthMm, h = cards[0].heightMm;
    const cols = Math.max(1, Math.floor((A4W - 2 * margin + gap) / (w + gap)));
    const rows = Math.max(1, Math.floor((A4H - 2 * margin + gap) / (h + gap)));
    const per = cols * rows;
    const gridW = cols * w + (cols - 1) * gap, left = (A4W - gridW) / 2;
    for (let i = 0; i < cards.length; i += per) {
      const group = cards.slice(i, i + per);
      for (const back of [false, true]) {
        const page = doc.addPage([A4W * K, A4H * K]);
        group.forEach((c, j) => {
          const row = Math.floor(j / cols);
          const col = back ? cols - 1 - (j % cols) : j % cols; // mirrored so duplex printing lines up
          const ox = left + col * (w + gap), oy = margin + row * (h + gap);
          drawSide(page, ctx, ox, oy, A4H * K, back ? c.backDesign : c.frontDesign, c);
          if (opts.marks) cropMarks(page, ox, oy, A4H * K, w, h);
        });
      }
    }
  }
  return doc.save();
}
