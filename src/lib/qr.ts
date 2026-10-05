import "server-only";
import QRCode from "qrcode";

/** Boolean module matrix for a URL. Medium error correction survives print wear. */
export function qrModules(url: string): boolean[][] {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!qr.modules.get(r, c)));
}
