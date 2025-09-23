/**
 * Create a larger, more realistic test video file for E2E testing
 */

const fs = require('fs');
const path = require('path');

function createLargeTestVideo() {
  const outputPath = path.join(__dirname, 'large-test-video.mp4');

  // Create a more substantial MP4 file (approximately 50MB)
  // This creates a minimal but valid MP4 structure with expanded data

  const ftyp = Buffer.from([
    // ftyp box
    0x00, 0x00, 0x00, 0x20, // box size (32 bytes)
    0x66, 0x74, 0x79, 0x70, // box type 'ftyp'
    0x69, 0x73, 0x6F, 0x6D, // major brand 'isom'
    0x00, 0x00, 0x02, 0x00, // minor version
    0x69, 0x73, 0x6F, 0x6D, // compatible brand 'isom'
    0x69, 0x73, 0x6F, 0x32, // compatible brand 'iso2'
    0x6D, 0x70, 0x34, 0x31, // compatible brand 'mp41'
  ]);

  const moov = Buffer.from([
    // moov box header
    0x00, 0x00, 0x00, 0x6C, // box size (108 bytes)
    0x6D, 0x6F, 0x6F, 0x76, // box type 'moov'

    // mvhd box
    0x00, 0x00, 0x00, 0x64, // box size (100 bytes)
    0x6D, 0x76, 0x68, 0x64, // box type 'mvhd'
    0x00, 0x00, 0x00, 0x00, // version and flags
    0x00, 0x00, 0x00, 0x00, // creation time
    0x00, 0x00, 0x00, 0x00, // modification time
    0x00, 0x00, 0x03, 0xE8, // timescale (1000)
    0x00, 0x00, 0x27, 0x10, // duration (10000)
    0x00, 0x01, 0x00, 0x00, // rate (1.0)
    0x01, 0x00, 0x00, 0x00, // volume (1.0)
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x00, 0x00, 0x00, // reserved
    0x00, 0x01, 0x00, 0x00, // transformation matrix
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x40, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // pre-defined
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x02, // next track ID
  ]);

  // Create large data chunk to simulate video content (~50MB)
  const chunkSize = 1024 * 1024; // 1MB chunks
  const numChunks = 50; // 50MB total

  // Create pattern data for chunks
  const patternData = Buffer.alloc(chunkSize);
  for (let i = 0; i < chunkSize; i++) {
    patternData[i] = (i % 256); // Simple pattern to avoid compression
  }

  // Write the file
  const writeStream = fs.createWriteStream(outputPath);

  // Write MP4 headers
  writeStream.write(ftyp);
  writeStream.write(moov);

  // Write mdat header (for the large data section)
  const mdatHeaderSize = numChunks * chunkSize + 8;
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(mdatHeaderSize, 0); // size
  mdatHeader.write('mdat', 4); // type
  writeStream.write(mdatHeader);

  // Write large data chunks
  for (let i = 0; i < numChunks; i++) {
    // Vary the pattern slightly for each chunk
    const chunkData = Buffer.from(patternData);
    for (let j = 0; j < 1000; j += 100) {
      chunkData[j] = (i + j) % 256;
    }
    writeStream.write(chunkData);
  }

  writeStream.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      console.log(`Created test video file: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(outputPath);
    });

    writeStream.on('error', reject);
  });
}

module.exports = { createLargeTestVideo };

// Run directly if called from command line
if (require.main === module) {
  createLargeTestVideo()
    .then(() => console.log('Test video created successfully'))
    .catch(console.error);
}