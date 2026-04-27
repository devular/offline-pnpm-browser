import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishBrowserIndex,
  getBrowserIndexStats,
  hasReadPermission,
  putPackageBatch,
} from '@root/lib/browser/indexDb';
import type { BrowserPackageRecord } from '@root/lib/browser/packages';
import YarnIndexWorker from '@root/workers/yarnZipIndex.worker?worker';

interface IndexProgress {
  scanned: number;
  indexed: number;
  skipped: number;
  errors: number;
  unchanged: number;
}

type WorkerResponse =
  | { type: 'batch'; packages: BrowserPackageRecord[] }
  | ({ type: 'progress' } & IndexProgress)
  | ({ type: 'done' } & IndexProgress)
  | { type: 'error'; message: string };

export function YarnIndexPanel() {
  const [state, setState] = useState<'idle' | 'indexing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const startIndex = useCallback(async () => {
    try {
      if (!window.showDirectoryPicker) {
        throw new Error('Directory picking is not available in this browser.');
      }

      setState('indexing');
      setMessage(null);
      setProgress({ scanned: 0, indexed: 0, skipped: 0, errors: 0, unchanged: 0 });

      const handle = await window.showDirectoryPicker({
        id: 'yarn-cache',
        mode: 'read',
      });

      if (!(await hasReadPermission(handle))) {
        throw new Error('Read permission was not granted for the selected Yarn cache.');
      }

      if (navigator.storage?.persist) {
        await navigator.storage.persist();
      }

      const worker = new YarnIndexWorker();
      workerRef.current?.terminate();
      workerRef.current = worker;
      writeChainRef.current = Promise.resolve();

      await new Promise<void>((resolve, reject) => {
        worker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
          const data = event.data;
          if (data.type === 'batch') {
            writeChainRef.current = writeChainRef.current.then(() =>
              putPackageBatch(data.packages),
            );
            return;
          }
          if (data.type === 'progress') {
            setProgress(data);
            return;
          }
          if (data.type === 'done') {
            try {
              setProgress(data);
              await writeChainRef.current;
              await finishBrowserIndex(handle.name, Date.now());
              window.dispatchEvent(
                new CustomEvent('browser-index-updated', {
                  detail: await getBrowserIndexStats(),
                }),
              );
              resolve();
            } catch (error) {
              reject(error);
            }
            return;
          }
          reject(new Error(data.message));
        };
        worker.onerror = () => reject(new Error('Yarn zip index worker failed.'));
        worker.postMessage({
          type: 'start',
          handle,
          full: true,
          lastIndexedAt: 0,
        });
      });

      worker.terminate();
      workerRef.current = null;
      setState('done');
    } catch (error) {
      workerRef.current?.terminate();
      workerRef.current = null;
      setState('error');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  return (
    <section className="browser-index-panel" aria-live="polite">
      <div className="browser-index-head">
        <div>
          <h3>Yarn cache</h3>
          <p>
            Choose a Yarn Berry cache folder containing package zip archives, usually .yarn/cache.
            Archives are read locally and merged into the same browser index.
          </p>
        </div>
        <div className="browser-index-actions">
          <button
            className="browser-index-btn browser-index-btn-primary"
            type="button"
            onClick={startIndex}
            disabled={state === 'indexing'}
          >
            Choose Yarn cache
          </button>
        </div>
      </div>

      {state === 'indexing' && progress && (
        <div className="browser-index-progress">
          <span>{progress.scanned.toLocaleString()} archives scanned</span>
          <span>{progress.indexed.toLocaleString()} indexed</span>
          {progress.skipped > 0 && <span>{progress.skipped.toLocaleString()} skipped</span>}
          {progress.errors > 0 && <span>{progress.errors.toLocaleString()} errors</span>}
        </div>
      )}

      {state === 'done' && <p className="browser-index-meta">Yarn cache indexed.</p>}
      {state === 'error' && message && <p className="browser-index-error">{message}</p>}
    </section>
  );
}
