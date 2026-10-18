// Minimal dependency-free PNG reader for the SEO asset pipeline.
// Supports exactly what Chromium headless screenshots produce: 8-bit RGBA,
// non-interlaced PNG. Used to verify dimensions and (for rounded icons)
// that the corners are actually transparent rather than painted white.
import { inflateSync } from 'node:zlib';

/**
 * @param {Buffer} buf raw PNG file contents
 * @returns {{width:number, height:number, channels:number, data:Uint8Array}}
 */
export function readPng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.subarray(0, 8).equals(sig) === false) throw new Error('not a PNG file');
  if (buf.readUInt32BE(8) !== 13 || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('missing IHDR chunk');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25]; // 6 = truecolor + alpha, 2 = truecolor
  const compression = buf[26];
  const filter = buf[27];
  const interlace = buf[28];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error(`unsupported PNG variant (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;

  // Concatenate every IDAT chunk in stream order.
  const idats = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idats.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len; // length + type + data + crc
  }
  if (idats.length === 0) throw new Error('no IDAT chunks');
  const raw = inflateSync(Buffer.concat(idats));

  // Undo the per-scanline filters (types 0..4) as specified by RFC 2083.
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const ftype = raw[p];
    p += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? data[rowStart + x - channels] : 0;
      const up = y > 0 ? data[rowStart - stride + x] : 0;
      const upleft = y > 0 && x >= channels ? data[rowStart - stride + x - channels] : 0;
      const v = raw[p + x];
      let out;
      if (ftype === 0) out = v;
      else if (ftype === 1) out = (v + left) & 0xff;
      else if (ftype === 2) out = (v + up) & 0xff;
      else if (ftype === 3) out = (v + ((left + up) >> 1)) & 0xff;
      else if (ftype === 4) {
        const pa = Math.abs(up - upleft);
        const pb = Math.abs(left - upleft);
        const pc = Math.abs(left + up - 2 * upleft);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upleft;
        out = (v + pred) & 0xff;
      } else throw new Error(`unknown filter type ${ftype}`);
      data[rowStart + x] = out;
    }
    p += stride;
  }
  return { width, height, channels, data };
}

/** Alpha of one pixel (0..255); RGBA images only. */
export function pixelAlpha(png, x, y) {
  if (png.channels !== 4) throw new Error('pixelAlpha needs an RGBA image');
  return png.data[(y * png.width + x) * 4 + 3];
}

/** Reads just the IHDR dimensions without decoding pixels. */
export function pngSize(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.subarray(0, 8).equals(sig) === false) throw new Error('not a PNG file');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
