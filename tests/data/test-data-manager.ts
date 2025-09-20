/**
 * Test Data Manager for ApexShare
 * Manages test data creation, cleanup, and lifecycle for testing scenarios
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface TestUpload {
  fileId: string;
  studentEmail: string;
  studentName?: string;
  trainerName?: string;
  sessionDate: string;
  notes?: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;
  s3Key: string;
  s3Bucket: string;
  uploadDate: string;
  status: 'pending' | 'completed' | 'failed';
  downloadCount: number;
  ttl: number;
}

export interface TestSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  uploads: TestUpload[];
  users: TestUser[];
  cleanup: (() => Promise<void>)[];
}

export interface TestUser {
  userId: string;
  email: string;
  name: string;
  role: 'student' | 'trainer' | 'admin';
  isActive: boolean;
}

export interface TestFile {
  fileName: string;
  filePath: string;
  size: number;
  contentType: string;
  checksum: string;
}

export class TestDataManager {
  private sessions: Map<string, TestSession> = new Map();
  private testDataDir: string;
  private tempFiles: Set<string> = new Set();

  constructor(testDataDir: string = './test-data') {
    this.testDataDir = testDataDir;
  }

  /**
   * Initialize test data manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.testDataDir, { recursive: true });
      await fs.mkdir(path.join(this.testDataDir, 'files'), { recursive: true });
      await fs.mkdir(path.join(this.testDataDir, 'temp'), { recursive: true });
    } catch (error) {
      console.warn('Test data directory already exists or could not be created');
    }
  }

  /**
   * Create a new test session
   */
  createSession(sessionId?: string): string {
    const id = sessionId || randomUUID();
    const session: TestSession = {
      sessionId: id,
      startTime: new Date().toISOString(),
      uploads: [],
      users: [],
      cleanup: []
    };

    this.sessions.set(id, session);
    return id;
  }

  /**
   * Get test session
   */
  getSession(sessionId: string): TestSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End test session and run cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date().toISOString();

    // Run all cleanup functions
    for (const cleanup of session.cleanup) {
      try {
        await cleanup();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Create test upload data
   */
  createTestUpload(sessionId: string, overrides: Partial<TestUpload> = {}): TestUpload {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const fileId = overrides.fileId || randomUUID();
    const timestamp = new Date().toISOString();
    const sessionDate = overrides.sessionDate || timestamp.split('T')[0];

    const upload: TestUpload = {
      fileId,
      studentEmail: overrides.studentEmail || `student-${randomUUID().slice(0, 8)}@test.apexshare.be`,
      studentName: overrides.studentName || `Test Student ${Math.floor(Math.random() * 1000)}`,
      trainerName: overrides.trainerName || `Test Trainer ${Math.floor(Math.random() * 100)}`,
      sessionDate,
      notes: overrides.notes || `Test session notes for ${fileId}`,
      fileName: overrides.fileName || `test-video-${fileId.slice(0, 8)}.mp4`,
      originalFileName: overrides.originalFileName || overrides.fileName || `test-video-${fileId.slice(0, 8)}.mp4`,
      fileSize: overrides.fileSize || Math.floor(Math.random() * 100 * 1024 * 1024) + 1024 * 1024, // 1MB to 100MB
      contentType: overrides.contentType || 'video/mp4',
      s3Key: overrides.s3Key || `videos/${sessionDate}/${fileId}-${overrides.fileName || `test-video-${fileId.slice(0, 8)}.mp4`}`,
      s3Bucket: overrides.s3Bucket || 'test-apexshare-bucket',
      uploadDate: overrides.uploadDate || timestamp,
      status: overrides.status || 'completed',
      downloadCount: overrides.downloadCount || 0,
      ttl: overrides.ttl || Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
      ...overrides
    };

    session.uploads.push(upload);
    return upload;
  }

  /**
   * Create test user data
   */
  createTestUser(sessionId: string, overrides: Partial<TestUser> = {}): TestUser {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const userId = overrides.userId || randomUUID();
    const user: TestUser = {
      userId,
      email: overrides.email || `user-${userId.slice(0, 8)}@test.apexshare.be`,
      name: overrides.name || `Test User ${Math.floor(Math.random() * 1000)}`,
      role: overrides.role || 'student',
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      ...overrides
    };

    session.users.push(user);
    return user;
  }

  /**
   * Create temporary test file
   */
  async createTestFile(
    fileName: string,
    content?: Buffer | string,
    options: { size?: number; contentType?: string } = {}
  ): Promise<TestFile> {
    const filePath = path.join(this.testDataDir, 'temp', fileName);
    let fileContent: Buffer;

    if (content) {
      fileContent = Buffer.isBuffer(content) ? content : Buffer.from(content);
    } else {
      // Generate random content if size is specified
      const size = options.size || 1024; // Default 1KB
      fileContent = Buffer.alloc(size);

      // Fill with random data that looks like a video file header
      if (fileName.endsWith('.mp4')) {
        // MP4 file signature
        const mp4Header = Buffer.from([
          0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
          0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
          0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x6D, 0x64, 0x61, 0x74
        ]);
        mp4Header.copy(fileContent, 0, 0, Math.min(mp4Header.length, size));

        // Fill rest with random data
        if (size > mp4Header.length) {
          for (let i = mp4Header.length; i < size; i++) {
            fileContent[i] = Math.floor(Math.random() * 256);
          }
        }
      } else {
        // Fill with random data
        for (let i = 0; i < size; i++) {
          fileContent[i] = Math.floor(Math.random() * 256);
        }
      }
    }

    await fs.writeFile(filePath, fileContent);
    this.tempFiles.add(filePath);

    // Calculate checksum
    const crypto = await import('crypto');
    const checksum = crypto.createHash('md5').update(fileContent).digest('hex');

    return {
      fileName,
      filePath,
      size: fileContent.length,
      contentType: options.contentType || this.guessContentType(fileName),
      checksum
    };
  }

  /**
   * Create test video file with specific characteristics
   */
  async createTestVideoFile(
    fileName: string,
    sizeInMB: number = 10,
    includeMetadata: boolean = true
  ): Promise<TestFile> {
    const size = sizeInMB * 1024 * 1024;
    const content = Buffer.alloc(size);

    // MP4 file structure with basic atoms
    let offset = 0;

    // ftyp atom (file type)
    const ftypAtom = Buffer.from([
      0x00, 0x00, 0x00, 0x20, // size
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6F, 0x6D, // major brand 'isom'
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6F, 0x6D, // compatible brands
      0x69, 0x73, 0x6F, 0x32,
      0x6D, 0x70, 0x34, 0x31,
      0x00, 0x00, 0x00, 0x08
    ]);
    ftypAtom.copy(content, offset);
    offset += ftypAtom.length;

    if (includeMetadata) {
      // Add metadata atoms (mvhd, trak, etc.)
      const metadataSize = Math.min(1024, size - offset - 8);
      content.writeUInt32BE(metadataSize, offset);
      content.write('meta', offset + 4);
      offset += metadataSize;
    }

    // mdat atom (media data) - rest of the file
    const mdatSize = size - offset;
    content.writeUInt32BE(mdatSize, offset);
    content.write('mdat', offset + 4);

    // Fill with random media data
    for (let i = offset + 8; i < size; i++) {
      content[i] = Math.floor(Math.random() * 256);
    }

    return this.createTestFile(fileName, content, { contentType: 'video/mp4' });
  }

  /**
   * Create malicious test file for security testing
   */
  async createMaliciousTestFile(
    fileName: string,
    maliciousType: 'script' | 'executable' | 'oversized' | 'path-traversal'
  ): Promise<TestFile> {
    let content: Buffer;
    let contentType: string;

    switch (maliciousType) {
      case 'script':
        content = Buffer.from('<script>alert("XSS")</script>');
        contentType = 'text/html';
        break;

      case 'executable':
        // PE header for Windows executable
        content = Buffer.from([
          0x4D, 0x5A, 0x90, 0x00, // MZ header
          0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
          0xFF, 0xFF, 0x00, 0x00, 0xB8, 0x00, 0x00, 0x00
        ]);
        contentType = 'application/x-msdownload';
        break;

      case 'oversized':
        // Create 6GB file (too large for the system)
        content = Buffer.alloc(100 * 1024 * 1024); // 100MB actual content
        contentType = 'video/mp4';
        break;

      case 'path-traversal':
        content = Buffer.from('malicious content');
        contentType = 'text/plain';
        break;

      default:
        content = Buffer.from('unknown malicious content');
        contentType = 'application/octet-stream';
    }

    return this.createTestFile(fileName, content, { contentType });
  }

  /**
   * Generate bulk test data for load testing
   */
  async generateBulkTestData(
    sessionId: string,
    count: number,
    options: {
      userCount?: number;
      fileVariations?: boolean;
      includeFiles?: boolean;
    } = {}
  ): Promise<{ uploads: TestUpload[]; users: TestUser[]; files: TestFile[] }> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const results = {
      uploads: [] as TestUpload[],
      users: [] as TestUser[],
      files: [] as TestFile[]
    };

    // Create users
    const userCount = options.userCount || Math.max(1, Math.floor(count / 10));
    for (let i = 0; i < userCount; i++) {
      const user = this.createTestUser(sessionId, {
        role: i % 5 === 0 ? 'trainer' : 'student'
      });
      results.users.push(user);
    }

    // Create uploads
    for (let i = 0; i < count; i++) {
      const user = results.users[i % results.users.length];
      const variations = options.fileVariations ? {
        fileSize: this.getRandomFileSize(),
        contentType: this.getRandomVideoType(),
        status: this.getRandomStatus()
      } : {};

      const upload = this.createTestUpload(sessionId, {
        studentEmail: user.email,
        studentName: user.name,
        ...variations
      });
      results.uploads.push(upload);

      // Create actual files if requested
      if (options.includeFiles) {
        const file = await this.createTestVideoFile(
          upload.fileName,
          Math.floor(upload.fileSize / (1024 * 1024))
        );
        results.files.push(file);
      }
    }

    return results;
  }

  /**
   * Export test data for external tools
   */
  async exportTestData(
    sessionId: string,
    format: 'json' | 'csv' | 'yaml' = 'json'
  ): Promise<string> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const data = {
      session: {
        sessionId: session.sessionId,
        startTime: session.startTime,
        endTime: session.endTime
      },
      uploads: session.uploads,
      users: session.users
    };

    let content: string;
    let fileName: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        fileName = `test-data-${sessionId}.json`;
        break;

      case 'csv':
        content = this.convertToCSV(data.uploads);
        fileName = `test-data-${sessionId}.csv`;
        break;

      case 'yaml':
        // Simple YAML conversion (without external dependency)
        content = this.convertToYAML(data);
        fileName = `test-data-${sessionId}.yaml`;
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const filePath = path.join(this.testDataDir, fileName);
    await fs.writeFile(filePath, content);

    return filePath;
  }

  /**
   * Clean up all temporary files and data
   */
  async cleanup(): Promise<void> {
    // Clean up temporary files
    for (const filePath of this.tempFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`Failed to delete temp file ${filePath}:`, error);
      }
    }
    this.tempFiles.clear();

    // End all active sessions
    for (const sessionId of this.sessions.keys()) {
      await this.endSession(sessionId);
    }

    // Clean up test data directory
    try {
      await fs.rmdir(path.join(this.testDataDir, 'temp'), { recursive: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  }

  /**
   * Register cleanup function for a session
   */
  registerCleanup(sessionId: string, cleanupFn: () => Promise<void>): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.cleanup.push(cleanupFn);
    }
  }

  // Private helper methods

  private guessContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.js': 'application/javascript',
      '.exe': 'application/x-msdownload',
      '.php': 'application/x-php'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  private getRandomFileSize(): number {
    const sizes = [
      1 * 1024 * 1024,      // 1MB
      10 * 1024 * 1024,     // 10MB
      50 * 1024 * 1024,     // 50MB
      100 * 1024 * 1024,    // 100MB
      500 * 1024 * 1024,    // 500MB
      1024 * 1024 * 1024    // 1GB
    ];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }

  private getRandomVideoType(): string {
    const types = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomStatus(): 'pending' | 'completed' | 'failed' {
    const statuses: ('pending' | 'completed' | 'failed')[] = ['pending', 'completed', 'failed'];
    const weights = [0.1, 0.8, 0.1]; // 80% completed, 10% pending, 10% failed
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return statuses[i];
      }
    }

    return 'completed';
  }

  private convertToCSV(uploads: TestUpload[]): string {
    if (uploads.length === 0) return '';

    const headers = Object.keys(uploads[0]).join(',');
    const rows = uploads.map(upload =>
      Object.values(upload).map(value =>
        typeof value === 'string' && value.includes(',')
          ? `"${value.replace(/"/g, '""')}"`
          : String(value)
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  private convertToYAML(data: any, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${this.convertToYAML(value, indent + 2)}`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            yaml += `${spaces}- \n${this.convertToYAML(item, indent + 4)}`;
          } else {
            yaml += `${spaces}- ${item}\n`;
          }
        }
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }
}

// Global test data manager instance
let globalTestDataManager: TestDataManager | null = null;

/**
 * Get global test data manager instance
 */
export function getTestDataManager(): TestDataManager {
  if (!globalTestDataManager) {
    globalTestDataManager = new TestDataManager();
  }
  return globalTestDataManager;
}

/**
 * Initialize global test data manager
 */
export async function initializeTestData(): Promise<void> {
  const manager = getTestDataManager();
  await manager.initialize();
}

/**
 * Cleanup global test data manager
 */
export async function cleanupTestData(): Promise<void> {
  if (globalTestDataManager) {
    await globalTestDataManager.cleanup();
    globalTestDataManager = null;
  }
}