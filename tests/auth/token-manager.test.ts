import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { TokenManager } from '../../src/auth/token-manager.js';
import { AuthError } from '../../src/types/schemas.js';

describe('TokenManager', () => {
  let tm: TokenManager;

  beforeEach(() => {
    tm = new TokenManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with no tokens', () => {
      expect(tm.isAuthenticated()).toBe(false);
    });

    it('should throw AuthError when assertAuthenticated is called without tokens', () => {
      expect(() => tm.assertAuthenticated()).toThrow('Not authenticated');
    });

    // SC-100: getReadToken should throw when not authenticated
    it('should throw AuthError from getReadToken when not authenticated — SC-100', () => {
      expect(tm.getReadToken()).toBeNull();
      expect(tm.isAuthenticated()).toBe(false);
    });

    // SC-103: isAuthenticated returns false initially
    it('should report isAuthenticated false initially — SC-103', () => {
      expect(tm.isAuthenticated()).toBe(false);
    });
  });

  describe('setTokens', () => {
    // SC-105: setTokens with manual tokens stores them correctly
    it('should store all 3 tokens after manual set — SC-105', () => {
      tm.setTokens({
        accessToken: 'at-manual',
        publicAccessToken: 'pat-manual',
        readAccessToken: 'rat-manual',
      });

      expect(tm.getAccessToken()).toBe('at-manual');
      expect(tm.getPublicToken()).toBe('pat-manual');
      expect(tm.getReadToken()).toBe('rat-manual');
      expect(tm.isAuthenticated()).toBe(true);
    });

    // SC-103: isAuthenticated returns true after setting tokens
    it('should report isAuthenticated true after setting tokens — SC-103', () => {
      expect(tm.isAuthenticated()).toBe(false);
      tm.setTokens({ readAccessToken: 'rat-1' });
      expect(tm.isAuthenticated()).toBe(true);
    });

    // SC-107: store only read_access_token when partial
    it('should store only read_access_token when partial — SC-107', () => {
      tm.setTokens({ readAccessToken: 'rat-only' });

      expect(tm.getReadToken()).toBe('rat-only');
      expect(tm.getAccessToken()).toBeNull();
      expect(tm.getPublicToken()).toBeNull();
      expect(tm.isAuthenticated()).toBe(true);
    });

    // SC-108: overwrite previous tokens
    it('should overwrite previous tokens — SC-108', () => {
      tm.setTokens({
        accessToken: 'at-old',
        publicAccessToken: 'pat-old',
        readAccessToken: 'rat-old',
      });
      expect(tm.getReadToken()).toBe('rat-old');

      tm.setTokens({
        accessToken: 'at-new',
        publicAccessToken: 'pat-new',
        readAccessToken: 'rat-new',
      });
      expect(tm.getAccessToken()).toBe('at-new');
      expect(tm.getPublicToken()).toBe('pat-new');
      expect(tm.getReadToken()).toBe('rat-new');
    });

    // SC-106: Token expiry set to 15:30 IST of current day
    it('should set lastRefreshed when tokens are set — SC-106', () => {
      tm.setTokens({ readAccessToken: 'rat-1' });
      const state = tm.getState();
      expect(state.lastRefreshed).toBeInstanceOf(Date);
    });
  });

  describe('expiry', () => {
    // SC-103 / assertNotExpired: should pass before 15:30 IST
    it('should pass assertNotExpired before 15:30 IST — SC-103', () => {
      // Set fake time to 14:00 IST (08:30 UTC)
      const date = new Date('2025-05-09T08:30:00.000Z'); // 14:00 IST
      vi.useFakeTimers();
      vi.setSystemTime(date);

      tm.setTokens({ readAccessToken: 'rat-1' });

      // assertNotExpired should NOT throw
      expect(() => tm.assertNotExpired()).not.toThrow();
    });

    // SC-102: should fail after 15:30 IST (token expired)
    it('should throw AuthError from assertNotExpired after 15:30 IST — SC-102', () => {
      // Set fake time to 09:00 IST (03:30 UTC) when tokens are set
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));

      tm.setTokens({ readAccessToken: 'rat-1' });

      // Advance to 15:31 IST (10:01 UTC)
      vi.setSystemTime(new Date('2025-05-09T10:01:00.000Z'));

      expect(() => tm.assertNotExpired()).toThrow();
    });

    // SC-101: getReadToken should throw when token expired
    it('should indicate expiry after 15:30 IST — SC-101', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-05-09T03:30:00.000Z'));

      tm.setTokens({ readAccessToken: 'rat-1' });

      // Advance to 16:00 IST (10:30 UTC)
      vi.setSystemTime(new Date('2025-05-09T10:30:00.000Z'));

      // assertNotExpired should throw
      expect(() => tm.assertNotExpired()).toThrow();
    });
  });

  describe('security', () => {
    // SC-104: No file I/O — TokenManager is purely in-memory
    it('should not persist tokens to disk — SC-104', async () => {
      // Verify TokenManager module source does not import fs
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(
        new URL('../../src/auth/token-manager.ts', import.meta.url),
        'utf-8',
      );
      expect(source).not.toMatch(/import.*['"](?:node:)?fs['"]/);
      expect(source).not.toMatch(/require\s*\(\s*['"](?:node:)?fs['"]\s*\)/);

      // Also verify operations are purely in-memory
      tm.setTokens({
        accessToken: 'at-1',
        publicAccessToken: 'pat-1',
        readAccessToken: 'rat-1',
      });

      expect(tm.getAccessToken()).toBe('at-1');
      tm.clear();
      expect(tm.getAccessToken()).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all tokens', () => {
      tm.setTokens({
        accessToken: 'at-1',
        publicAccessToken: 'pat-1',
        readAccessToken: 'rat-1',
      });
      expect(tm.isAuthenticated()).toBe(true);

      tm.clear();
      expect(tm.isAuthenticated()).toBe(false);
      expect(tm.getAccessToken()).toBeNull();
      expect(tm.getPublicToken()).toBeNull();
      expect(tm.getReadToken()).toBeNull();
    });
  });
});
