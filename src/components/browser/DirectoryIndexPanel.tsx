import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishBrowserIndex,
  getBrowserIndexStats,
  hasReadPermission,
  putPackageBatch,
} from '@root/lib/browser/indexDb';
import type { BrowserPackageRecord, BrowserPackageSourceType } from '@root/lib/browser/packages';
import DirectoryIndexWorker from '@root/workers/packageDirectoryIndex.worker?worker';

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

export function DirectoryIndexPanel({
  sourceType,
  title,
  description,
  buttonLabel,
}: {
  sourceType: Extract<BrowserPackageSourceType, 'bun' | 'node-modules'>;
  title: string;
  description: string;
  buttonLabel: string;
}) {
  const [state, setState] = useState<'idle' | 'indexing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasIndex, setHasIndex] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const stats = await getBrowserIndexStats();
      if (!cancelled) setHasIndex(stats.totalPackages > 0);
    };
    const onUpdated = () => {
      refresh().catch(() => setHasIndex(false));
    };

    refresh().catch(() => setHasIndex(false));
    window.addEventListener('browser-index-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('browser-index-updated', onUpdated);
    };
  }, []);

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
        id: `${sourceType}-cache`,
        mode: 'read',
      });

      if (!(await hasReadPermission(handle))) {
        throw new Error('Read permission was not granted for the selected cache.');
      }

      if (navigator.storage?.persist) {
        await navigator.storage.persist();
      }

      const worker = new DirectoryIndexWorker();
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
              if (data.indexed === 0) {
                throw new Error(
                  `No packages were found in ${handle.name}. Choose the package cache itself, or a parent such as ~/.bun or ~/.bun/install.`,
                );
              }
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
        worker.onerror = () => reject(new Error('Directory index worker failed.'));
        worker.postMessage({
          type: 'start',
          sourceType,
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
  }, [sourceType]);

  return (
    <section className="browser-index-panel" aria-live="polite">
      <div className="browser-index-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="browser-index-actions">
          <button
            className="browser-index-btn browser-index-btn-primary"
            type="button"
            onClick={startIndex}
            disabled={state === 'indexing'}
          >
            {hasIndex ? 'Update index' : buttonLabel}
          </button>
        </div>
      </div>

      {state === 'indexing' && progress && (
        <div className="browser-index-progress">
          <span>{progress.scanned.toLocaleString()} scanned</span>
          <span>{progress.indexed.toLocaleString()} indexed</span>
          {progress.skipped > 0 && <span>{progress.skipped.toLocaleString()} skipped</span>}
          {progress.errors > 0 && <span>{progress.errors.toLocaleString()} errors</span>}
        </div>
      )}

      {state === 'done' && <p className="browser-index-meta">Cache indexed.</p>}
      {state === 'error' && message && <p className="browser-index-error">{message}</p>}
    </section>
  );
}
