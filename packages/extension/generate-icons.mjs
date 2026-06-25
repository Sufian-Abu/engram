// Generates Engram's PNG icons with no image deps — a rounded brand-color
// square with a white spark (the "memory trace"). Deterministic; re-run to
// regenerate icons/icon-{16,32,48,128}.png.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BRAND = [107, 76, 255]; // #6b4cff
const WHITE = [255, 255, 255];
const SIZES = [16, 32, 48, 128];

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
};

const encodePng = (size, rgba) => {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
};

/** Rounded-rectangle signed-distance test. */
const insideRounded = (x, y, size, r) => {
  const qx = Math.max(r, Math.min(x, size - r));
  const qy = Math.max(r, Math.min(y, size - r));
  return Math.hypot(x - qx, y - qy) <= r;
};

const drawIcon = (size) => {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const dot = size * 0.24;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      if (!insideRounded(px, py, size, radius)) {
        rgba[i + 3] = 0; // transparent corners
        continue;
      }
      const isSpark = Math.hypot(px - cx, py - cy) < dot;
      const c = isSpark ? WHITE : BRAND;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
  return rgba;
};

mkdirSync("icons", { recursive: true });
for (const size of SIZES) {
  writeFileSync(`icons/icon-${size}.png`, encodePng(size, drawIcon(size)));
  console.log(`icons/icon-${size}.png`);
}
