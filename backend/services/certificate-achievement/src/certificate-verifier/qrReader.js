const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function decodeQr(imagePath) {
  const urls = [];
  const ext = path.extname(imagePath).toLowerCase();

  let images = [];
  if (ext === '.pdf') {
    try {
      const buf = fs.readFileSync(imagePath);
      const imgBuf = await sharp(buf, { density: 200 }).png().toBuffer();
      images.push(imgBuf);
    } catch { return urls; }
  } else {
    try {
      const buf = fs.readFileSync(imagePath);
      const imgBuf = await sharp(buf).png().toBuffer();
      images.push(imgBuf);
    } catch { return urls; }
  }

  let jsQR;
  try { jsQR = require('jsqr'); } catch { return urls; }

  for (const imgBuf of images) {
    try {
      const { data, info } = await sharp(imgBuf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (code && code.data && code.data.trim() && !urls.includes(code.data.trim())) {
        urls.push(code.data.trim());
      }
    } catch { /* skip */ }
  }

  return urls;
}

module.exports = { decodeQr };
