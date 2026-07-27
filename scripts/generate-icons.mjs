import fs from "fs";
import path from "path";
import zlib from "zlib";

function createPng(width, height) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits bit depth
  ihdr.writeUInt8(2, 9); // Color type 2 (Truecolor RGB)
  ihdr.writeUInt8(0, 10); // Compression 0
  ihdr.writeUInt8(0, 11); // Filter 0
  ihdr.writeUInt8(0, 12); // Interlace 0

  const ihdrChunk = makeChunk("IHDR", ihdr);

  // Raw pixel data: RGB (0x0a, 0x0d, 0x14)
  const scanlineLength = 1 + width * 3;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      rawData[pxOffset] = 0x0a;     // R
      rawData[pxOffset + 1] = 0x0d; // G
      rawData[pxOffset + 2] = 0x14; // B
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressedData);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);

  const crcVal = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crcVal, 8 + len);
  return buf;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, "icon-192.png"), createPng(192, 192));
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), createPng(512, 512));
console.log("PNG icons generated successfully.");
