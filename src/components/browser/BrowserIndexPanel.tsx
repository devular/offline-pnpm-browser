import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearBrowserIndex,
  finishBrowserIndex,
  getBrowserIndexStats,
  hasReadPermission,
  loadPnpmStoreHandle,
  putPackageBatch,
  savePnpmStoreHandle,
} from '@root/lib/browser/indexDb';
import type { BrowserIndexStats, BrowserPackageRecord } from '@root/lib/browser/packages';
import PnpmIndexWorker from '@root/workers/pnpmIndex.worker?worker';
import { IndexErrorModal } from './IndexErrorModal';
import { StoreSetupModal } from './StoreSetupModal';
import { isProtectedFolderError } from './browserIndexErrors';

interface IndexProgress {
  scanned: number;
  indexed: number;
  skipped: number;
  errors: number;
  unchanged: number;
}

type IndexState = 'idle' | 'indexing' | 'done' | 'error' | 'unsupported';

type WorkerResponse =
  | { type: 'batch'; packages: BrowserPackageRecord[] }
  | ({ type: 'progress' } & IndexProgress)
  | ({ type: 'done' } & IndexProgress)
  | { type: 'error'; message: string };

export function BrowserIndexPanel() {
  const [stats, setStats] = useState<BrowserIndexStats | null>(null);
  const [state, setState] = useState<IndexState>('idle');
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<'setup' | 'error' | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const refreshStats = useCallback(async () => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return;
    const nextStats = await getBrowserIndexStats();
    setStats(nextStats);
    window.dispatchEvent(new CustomEvent('browser-index-updated', { detail: nextStats }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('showDirectoryPicker' in window) || !navigator.storage?.getDirectory) {
      setState('unsupported');
      return;
    }
    refreshStats().catch(() => setState('error'));
  }, [refreshStats]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const startIndex = useCallback(
    async (options: { pickDirectory: boolean; full: boolean }) => {
      try {
        setState('indexing');
        setMessage(null);
        setProgress({ scanned: 0, indexed: 0, skipped: 0, errors: 0, unchanged: 0 });

        let handle = options.pickDirectory ? null : await loadPnpmStoreHandle();
        if (!handle) {
          if (!window.showDirectoryPicker) {
            throw new Error('Directory picking is not available in this browser.');
          }
          handle = await window.showDirectoryPicker({
            id: 'pnpm-store',
            mode: 'read',
          });
          await savePnpmStoreHandle(handle);
        }

        const selectedHandle = handle;

        if (!(await hasReadPermission(selectedHandle))) {
          throw new Error('Read permission was not granted for the selected pnpm store.');
        }

        if (navigator.storage?.persist) {
          await navigator.storage.persist();
        }

        if (options.full) {
          await clearBrowserIndex();
        }

        const lastIndexedAt = options.full ? 0 : (stats?.lastIndexedAt ?? 0);
        const worker = new PnpmIndexWorker();
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
                await finishBrowserIndex(selectedHandle.name, Date.now());
                resolve();
              } catch (error) {
                reject(error);
              }
              return;
            }
            reject(new Error(data.message));
          };
          worker.onerror = () => reject(new Error('Browser index worker failed.'));
          worker.postMessage({
            type: 'start',
            handle: selectedHandle,
            full: options.full,
            lastIndexedAt,
          });
        });

        worker.terminate();
        workerRef.current = null;
        setState('done');
        await refreshStats();
      } catch (error) {
        workerRef.current?.terminate();
        workerRef.current = null;
        setState('error');
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [refreshStats, stats?.lastIndexedAt],
  );

  if (state === 'unsupported') {
    return (
      <section className="browser-index-panel">
        <h3>Browser index</h3>
        <p>
          This browser does not expose directory access and OPFS together. Use Chrome or another
          Chromium browser to index a local pnpm store without a server.
        </p>
      </section>
    );
  }

  const hasIndex = Boolean(stats?.totalPackages);

  return (
    <section className="browser-index-panel" aria-live="polite">
      <div className="browser-index-head">
        <div>
          <h3>Browser index</h3>
          <p>
            Select your pnpm store once. Package metadata is processed locally and stored in this
            browser.
          </p>
          <p className="browser-index-hint">
            Chrome may block pnpm stores under macOS Library. If that happens, choose a copied store
            folder outside Library.
          </p>
          <button className="browser-index-link" type="button" onClick={() => setModal('setup')}>
            Store setup help
          </button>
        </div>
        <div className="browser-index-actions">
          <button
            className="browser-index-btn browser-index-btn-primary"
            type="button"
            onClick={() => startIndex({ pickDirectory: !hasIndex, full: !hasIndex })}
            disabled={state === 'indexing'}
          >
            {hasIndex ? 'Update index' : 'Choose pnpm store'}
          </button>
          {hasIndex && (
            <button
              className="browser-index-btn"
              type="button"
              onClick={() => startIndex({ pickDirectory: true, full: true })}
              disabled={state === 'indexing'}
            >
              Rebuild
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="browser-index-stats">
          <span>{stats.totalPackages.toLocaleString()} versions</span>
          <span>{stats.uniquePackages.toLocaleString()} packages</span>
          <span>{formatBytes(stats.totalSize)} indexed package contents</span>
          <span>{stats.persisted ? 'persistent storage' : 'best-effort storage'}</span>
        </div>
      )}

      {stats?.storeName && (
        <p className="browser-index-meta">
          Store: {stats.storeName}
          {stats.lastIndexedAt ? ` · indexed ${formatDate(stats.lastIndexedAt)}` : ''}
        </p>
      )}

      {state === 'indexing' && progress && (
        <div className="browser-index-progress">
          <span>{progress.scanned.toLocaleString()} scanned</span>
          <span>{progress.indexed.toLocaleString()} indexed</span>
          {progress.unchanged > 0 && <span>{progress.unchanged.toLocaleString()} unchanged</span>}
          {progress.errors > 0 && <span>{progress.errors.toLocaleString()} errors</span>}
        </div>
      )}

      {state === 'done' && <p className="browser-index-meta">Browser index is ready.</p>}
      {state === 'error' && message && (
        <>
          <p className="browser-index-error">{message}</p>
          {isProtectedFolderError(message) && (
            <p className="browser-index-hint">
              Mirror the store to a folder such as ~/pnpm-store-browser/v10, then choose that copy.
            </p>
          )}
          <button className="browser-index-link" type="button" onClick={() => setModal('error')}>
            Open error details
          </button>
        </>
      )}
      {modal === 'setup' && <StoreSetupModal onClose={() => setModal(null)} />}
      {modal === 'error' && message && (
        <IndexErrorModal message={message} onClose={() => setModal(null)} />
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}
