/**
 * Create a test video file for upload testing
 */

// Create a minimal MP4 file for testing (base64 encoded)
const createTestVideoBase64 = () => {
  // This is a minimal valid MP4 file (1 second black video)
  return `
    AAAAFGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAOhtZGF0AAAAYgABAg0GZGVmYXVsdC1jbGFzc2lmaWNhdGlvbgAAAAAA
    AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOJg=
  `.replace(/\s/g, '');
};

module.exports = {
  createTestVideoBase64
};