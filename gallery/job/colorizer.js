const zlib = require("zlib");

const calculateCrcForBuffer = calculateCrcForBufferFactory();

const pngPreambleBuf = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// main function to use which orchestrates the high level actions
function changeColors(imgDataBuf) {
  return new Promise((resolve, reject) => {
    // parse
    let canvas;
    try {
      canvas = pngToCanvas(imgDataBuf);
    } catch (err) {
      reject(err);
      return;
    }
    // modify
    modifyCanvas(canvas);
    // output
    let pngBuf;
    try {
      pngBuf = canvasToPng(canvas);
    } catch (err) {
      reject(err);
      return;
    }
    resolve(pngBuf);
  });
}

function pngToCanvas(pngDataBuf) {
  // parse PNG format
  let ihdr;
  let compressedPixelData = Buffer.alloc(0);
  if (pngPreambleBuf.compare(pngDataBuf, 0, pngPreambleBuf.byteLength) !== 0) {
    throw new Error("no valid PNG preamble");
  }
  let offset = pngPreambleBuf.byteLength; // chunks start after the preamble
  while (offset < pngDataBuf.byteLength) {
    const { chLength, chType, chData } = readChunk(pngDataBuf, offset);
    offset += chLength + 12; // total chunk size is 4 (length) + 4 (type) + chLength + 4 (CRC)
    switch (chType) {
      case "IHDR": {
        ihdr = readIhdrFromChunkData(chData);
        break;
      }
      case "IDAT": {
        compressedPixelData = Buffer.concat([compressedPixelData, chData]);
        break;
      }
    }
  }
  if (offset !== pngDataBuf.byteLength) {
    throw new Error(
      `parsed length (${offset}) does not match buffer length (${pngDataBuf.byteLength})`
    );
  }
  const pixelData = zlib.inflateSync(compressedPixelData);
  const { width, height, colorType } = ihdr;
  const bytesPerPixel = colorType & 4 ? 4 : 3;
  // undo scanline pixel filters and collect canvas data
  const canvasData = [];
  const scanlinePixelBytes = width * bytesPerPixel;
  const scanlineTotalBytes = scanlinePixelBytes + 1; // plus filter type byte at the beginning of each line
  for (let scanlineIdx = 0; scanlineIdx < height; scanlineIdx += 1) {
    const scanlineStart = scanlineIdx * scanlineTotalBytes;
    const pixelStart = scanlineStart + 1;
    const filterType = pixelData[scanlineStart];
    if (filterType === 0) {
      // none, nothing to do
    } else if (filterType === 1) {
      // sub
      for (let i = 0; i < scanlinePixelBytes; i += 1) {
        pixelData[pixelStart + i] =
          i < bytesPerPixel
            ? pixelData[pixelStart + i]
            : pixelData[pixelStart + i] +
              pixelData[pixelStart + i - bytesPerPixel];
      }
      pixelData[scanlineStart] = 0; // filter none
    } else if (filterType === 2) {
      // up
      for (let i = 0; i < scanlinePixelBytes; i += 1) {
        pixelData[pixelStart + i] =
          scanlineIdx === 0
            ? pixelData[pixelStart + i]
            : pixelData[pixelStart + i] +
              pixelData[pixelStart + i - scanlineTotalBytes];
      }
      pixelData[scanlineStart] = 0; // filter none
    } else {
      throw new Error(`unsupported filter type ${filterType}`);
    }
    canvasData.push(
      pixelData.slice(pixelStart, pixelStart + scanlinePixelBytes)
    );
  }
  const canvas = {
    type: "rgbcanvas",
    width,
    height,
    bytesPerPixel,
    data: canvasData,
  };
  return canvas;

  function readIhdrFromChunkData(chunkData) {
    let offset = 0;
    const width = chunkData.readUInt32BE(offset);
    offset += 4;
    const height = chunkData.readUInt32BE(offset);
    offset += 4;
    const bitDepth = chunkData.readUInt8(offset);
    offset += 1;
    const colorType = chunkData.readUInt8(offset);
    offset += 1;
    const compressionMethod = chunkData.readUInt8(offset);
    offset += 1;
    const filterMethod = chunkData.readUInt8(offset);
    offset += 1;
    const interlaceMethod = chunkData.readUInt8(offset);
    offset += 1;
    if (chunkData.byteLength !== offset) {
      throw new Error(
        `parsed length (${offset}) does not match chunk data length (${chunkData.byteLength})`
      );
    }
    return {
      width,
      height,
      bitDepth,
      colorType, //  1 (palette used), 2 (color used), and 4 (alpha channel used). Valid values are 0, 2, 3, 4, and 6.
      compressionMethod,
      filterMethod,
      interlaceMethod,
    };
  }

  function readChunk(buf, offsetArg) {
    let offset = offsetArg;
    // chunk length
    const chLength = buf.readUint32BE(offset);
    if (buf.byteLength < offset + chLength + 12) {
      throw new Error(`invalid chunk length (${chLength}) at byte ${offset}`);
    }
    offset += 4; // uint32
    const crcCalculationStart = offset;
    // chunk type
    const chType = buf.toString("utf8", offset, offset + 4);
    offset += 4;
    // chunk data
    const chData = buf.slice(offset, offset + chLength);
    offset += chLength;
    const crcCalculationEnd = offset;
    // chunk CRC
    const chCrc = buf.readUint32BE(offset);
    const calculatedCrc = new Uint32Array(1);
    calculatedCrc[0] = calculateCrcForBuffer(
      buf.slice(crcCalculationStart, crcCalculationEnd)
    );
    if (chCrc !== calculatedCrc[0]) {
      throw new Error(`CRC mismatch in chunk of type ${chType}`);
    }
    return {
      chLength,
      chType,
      chData,
    };
  }
}

function modifyCanvas(canvas) {
  const { type, width, height, bytesPerPixel, data } = canvas;
  if (type !== "rgbcanvas") {
    return;
  }
  const rMod = Math.random() * 2;
  const gMod = Math.random() * 2;
  const bMod = Math.random() * 2;
  // color modification
  for (let scanlineIdx = 0; scanlineIdx < height; scanlineIdx += 1) {
    const scanline = data[scanlineIdx]; // buffer
    for (
      let i = 0;
      i + bytesPerPixel <= scanline.byteLength;
      i += bytesPerPixel
    ) {
      scanline[i] = rMod * scanline[i]; // red
      scanline[i + 1] = gMod * scanline[i + 1]; // green
      scanline[i + 2] = bMod * scanline[i + 2]; // blue
      if (bytesPerPixel === 4) {
        // scanline[i + 2] = scanline[i + 2]; // alpha
      }
    }
  }
}

function canvasDataToImgDataBuf(canvasData) {
  let imgDataBuf = Buffer.alloc(0);
  canvasData.forEach((line) => {
    imgDataBuf = Buffer.concat([imgDataBuf, Buffer.from([0]), line]); // prepending filter byte
  });
  return imgDataBuf;
}

function canvasDataToImgDataBuf(canvasData) {
  let imgDataBuf = Buffer.alloc(0);
  canvasData.forEach((line) => {
    imgDataBuf = Buffer.concat([imgDataBuf, Buffer.from([0]), line]); // prepending filter byte
  });
  return imgDataBuf;
}

function canvasToPng(canvas) {
  const { type, width, height, bytesPerPixel, data } = canvas;
  if (type !== "rgbcanvas") {
    return;
  }
  const sizeEstimate = width * height * bytesPerPixel + 1000; // at least preamble, IHDR, IDAT overhead, IEND
  const pngDataBuf = Buffer.alloc(sizeEstimate);
  let offset = writePreambleToBuffer(pngDataBuf);
  offset = writeIhdrChunkToBuffer(ihdrForRgbCanvas(canvas), pngDataBuf, offset);
  const compressedDataBuf = zlib.deflateSync(canvasDataToImgDataBuf(data));
  offset = writeIdatChunkToBuffer(compressedDataBuf, pngDataBuf, offset); // TODO: split in chunks of max 2^31 bytes
  offset = writeIendChunkToBuffer(pngDataBuf, offset);
  return pngDataBuf.slice(0, offset);

  function ihdrForRgbCanvas(canvas) {
    const { width, height, bytesPerPixel } = canvas;
    return {
      width,
      height,
      bitDepth: 8,
      colorType: bytesPerPixel === 3 ? 2 : 6, //  1 (palette used), 2 (color used), and 4 (alpha channel used). Valid values are 0, 2, 3, 4, and 6.
      compressionMethod: 0, // deflate-inflate
      filterMethod: 0, // adaptive filtering
      interlaceMethod: 0, // no interlace
    };
  }

  function writePreambleToBuffer(buf) {
    // start offset is 0
    return pngPreambleBuf.copy(buf);
  }

  function writeIhdrChunkToBuffer(ihdr, buf, offsetArg) {
    const {
      width,
      height,
      bitDepth,
      colorType,
      compressionMethod,
      filterMethod,
      interlaceMethod,
    } = ihdr;
    const chLength = 13; // data
    let offset = offsetArg;
    offset = buf.writeUInt32BE(chLength, offset);
    const crcCalculationStart = offset;
    offset += buf.write("IHDR", offset);
    offset = buf.writeUInt32BE(width, offset);
    offset = buf.writeUInt32BE(height, offset);
    offset = buf.writeUInt8(bitDepth, offset);
    offset = buf.writeUInt8(colorType, offset);
    offset = buf.writeUInt8(compressionMethod, offset);
    offset = buf.writeUInt8(filterMethod, offset);
    offset = buf.writeUInt8(interlaceMethod, offset);
    const crcCalculationEnd = offset;
    offset = buf.writeUInt32BE(
      calculateCrcForBuffer(buf.slice(crcCalculationStart, crcCalculationEnd)),
      offset
    );
    return offset;
  }

  function writeIdatChunkToBuffer(imgData, buf, offsetArg) {
    const chLength = imgData.byteLength;
    let offset = offsetArg;
    offset = buf.writeUInt32BE(chLength, offset);
    const crcCalculationStart = offset;
    offset += buf.write("IDAT", offset);
    offset += imgData.copy(buf, offset);
    const crcCalculationEnd = offset;
    offset = buf.writeUInt32BE(
      calculateCrcForBuffer(buf.slice(crcCalculationStart, crcCalculationEnd)),
      offset
    );
    return offset;
  }

  function writeIendChunkToBuffer(buf, offsetArg) {
    const chLength = 0; // no data
    let offset = offsetArg;
    offset = buf.writeUInt32BE(chLength, offset);
    const crcCalculationStart = offset;
    offset += buf.write("IEND", offset);
    const crcCalculationEnd = offset;
    offset = buf.writeUInt32BE(
      calculateCrcForBuffer(buf.slice(crcCalculationStart, crcCalculationEnd)),
      offset
    );
    return offset;
  }
}

function calculateCrcForBufferFactory() {
  // http://www.libpng.org/pub/png/spec/1.2/PNG-CRCAppendix.html
  // https://en.wikipedia.org/wiki/Cyclic_redundancy_check
  const crcTable = (function initTable() {
    const tableSize = 256;
    const result = new Uint32Array(tableSize);
    const c = new Uint32Array(1); // unsigned long
    for (let n = 0; n < tableSize; n += 1) {
      c[0] = n;
      for (let k = 0; k < 8; k += 1) {
        if (c[0] & 1) {
          c[0] = 0xedb88320 ^ (c[0] >>> 1);
        } else {
          c[0] = c[0] >>> 1;
        }
        result[n] = c[0];
      }
    }
    return result;
  })();

  return function calculateCrcForBuffer(buffer) {
    const buf = Uint8Array.from(buffer);
    const result = new Uint32Array(1);
    result[0] = calculateCrc(0xffffffff, buf, buf.byteLength) ^ 0xffffffff; // 1's complement
    return result[0];
  };

  function calculateCrc(startCrc, buf, bufLength) {
    const c = new Uint32Array(1);
    c[0] = startCrc;
    let n;
    for (let n = 0; n < bufLength; n += 1) {
      c[0] = crcTable[(c[0] ^ buf[n]) & 0xff] ^ (c[0] >>> 8);
    }
    return c[0];
  }
}

module.exports = { changeColors }