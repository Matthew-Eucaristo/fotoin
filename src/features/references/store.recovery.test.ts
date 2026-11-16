import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFiles = new Map<string, string>();

jest.mock('expo-file-system', () => {
  const join = (parts: (string | { uri: string })[]) =>
    parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/\/+/g, '/');

  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts);
    }
    get exists() {
      return true;
    }
    create() {}
  }

  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    textSync() {
      return mockFiles.get(this.uri) ?? '';
    }
    async write(content: string) {
      mockFiles.set(this.uri, content);
    }
    async copy(dest: File) {
      mockFiles.set(dest.uri, mockFiles.get(this.uri) ?? '');
    }
    async move(dest: File) {
      mockFiles.set(dest.uri, mockFiles.get(this.uri) ?? '');
      mockFiles.delete(this.uri);
      this.uri = dest.uri;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }

  return { Directory, File, Paths: { document: { uri: '/document' } } };
});

jest.mock('../pose/native', () => ({
  detectPeopleInImage: jest.fn(async () => ({ people: [], aspect: null })),
  detectFacesInImage: jest.fn(async () => []),
}));

const INDEX = '/document/references/index.json';
const TEMP = '/document/references/index.json.tmp';
const saved = [{ id: 'recovered', file: 'recovered.jpg', aspect: 0.75, createdAt: 1, people: [], faces: [] }];

describe('reference index recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFiles.clear();
  });

  it('loads from the temp index when index.json is missing', async () => {
    mockFiles.set(TEMP, JSON.stringify(saved));
    const { getReference } = jest.requireActual<typeof import('./store')>('./store');
    expect(getReference('recovered')?.file).toBe('recovered.jpg');
  });

  it('loads from the temp index when index.json is corrupt', async () => {
    mockFiles.set(INDEX, '{broken');
    mockFiles.set(TEMP, JSON.stringify(saved));
    const { getReference } = jest.requireActual<typeof import('./store')>('./store');
    expect(getReference('recovered')?.file).toBe('recovered.jpg');
  });
});
