import { describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

function silence() {
  return {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

describe('logger', () => {
  it('tags every line so console output is attributable', () => {
    const spies = silence();
    logger.debug('hello');
    logger.warn('careful');
    expect(spies.debug).toHaveBeenCalledWith('[Edee Apply]', 'hello');
    expect(spies.warn).toHaveBeenCalledWith('[Edee Apply]', 'careful');
  });

  it('stays quiet in production except for warnings and errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    try {
      const { logger: prodLogger } = await import('@/lib/logger');
      const spies = silence();
      prodLogger.debug('dev only');
      prodLogger.info('dev only');
      prodLogger.warn('real problem');
      prodLogger.error('broke');
      expect(spies.debug).not.toHaveBeenCalled();
      expect(spies.info).not.toHaveBeenCalled();
      expect(spies.warn).toHaveBeenCalledTimes(1);
      expect(spies.error).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
