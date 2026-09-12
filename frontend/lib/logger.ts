/**
 * The only way client code talks to the console.
 *
 * `debug` and `info` are development-only: they vanish from production
 * builds' output so a shipped browser stays quiet. `warn` and `error` always
 * print — a warning that only exists on laptops is not a warning.
 *
 * Import this instead of calling console.* directly; a stray console.log in a
 * hot path is how production consoles fill with noise nobody reads.
 */
const isProduction = process.env.NODE_ENV === 'production';

function formatArgs(args: unknown[]): unknown[] {
  return ['[Edee Apply]', ...args];
}

export const logger = {
  debug(...args: unknown[]): void {
    if (!isProduction) console.debug(...formatArgs(args));
  },
  info(...args: unknown[]): void {
    if (!isProduction) console.info(...formatArgs(args));
  },
  warn(...args: unknown[]): void {
    console.warn(...formatArgs(args));
  },
  error(...args: unknown[]): void {
    console.error(...formatArgs(args));
  },
};
