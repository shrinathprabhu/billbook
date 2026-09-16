import type { ImportRow } from './import';
import type { ImportResult } from './import.worker';

/** Decode spreadsheets and JSON away from input, animation and paint. */
export function readImportOffThread(
  file: File,
  signal: AbortSignal,
): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Import cancelled', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), {
      type: 'module',
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Import cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<ImportResult>) => {
      cleanup();
      if ('error' in data) reject(new Error(data.error));
      else resolve(data.rows);
    };
    const fail = () => {
      cleanup();
      reject(new Error('Could not read this file. Try importing it again.'));
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    try {
      worker.postMessage(file);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
