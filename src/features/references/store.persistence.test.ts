import { describe, expect, it, jest } from '@jest/globals';

import { addReference } from './store';

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
    get extension() {
      const i = this.uri.lastIndexOf('.');
      return i < 0 ? '' : this.uri.slice(i);
    }
    async write(content: string) {
      mockFiles.set(this.uri, content);
    }
    async copy(dest: File) {
      mockFiles.set(dest.uri, mockFiles.get(this.uri) ?? '');
    }
    async move(dest: File, options?: { overwrite?: boolean }) {
      if (this.uri === dest.uri) {
        mockFiles.delete(dest.uri);
        throw new Error('Cannot move a file onto itself');
      }
      if (mockFiles.has(dest.uri) && !options?.overwrite) throw new Error('Destination exists');
      const content = mockFiles.get(this.uri);
      if (content === undefined) throw new Error('Source missing');
      mockFiles.set(dest.uri, content);
      mockFiles.delete(this.uri);
      this.uri = dest.uri;
    }
    textSync() {
      return mockFiles.get(this.uri) ?? '';
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
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('reference index persistence', () => {
  it('keeps every reference across repeated and rapid saves', async () => {
    await addReference('file://a.jpg', 4, 3);
    await flush();
    await addReference('file://b.jpg', 4, 3);
    await flush();

    let stored = JSON.parse(mockFiles.get(INDEX) ?? '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0].file).toMatch(/\.jpg$/);

    await Promise.all([addReference('file://c.jpg', 4, 3), addReference('file://d.jpg', 4, 3)]);
    await flush();

    stored = JSON.parse(mockFiles.get(INDEX) ?? '[]');
    expect(stored).toHaveLength(4);
    const ids = stored.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
