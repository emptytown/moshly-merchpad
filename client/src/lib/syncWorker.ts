import { getPendingSyncItems, markSyncItemDone, SyncQueueItem } from './db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_BATCH_SIZE = 50;
const SYNC_INTERVAL_MS = 30_000; // 30 seconds when online
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// Callbacks registered by consumers (e.g. MerchPadContext)
const onSyncCompleteCallbacks = new Set<(pendingCount: number) => void>();

export function onSyncComplete(cb: (pendingCount: number) => void): () => void {
  onSyncCompleteCallbacks.add(cb);
  return () => onSyncCompleteCallbacks.delete(cb);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startSyncWorker(projectId: string): void {
  stopSyncWorker();

  const run = () => {
    if (navigator.onLine) {
      flushQueue(projectId).catch(() => {
        // errors are logged inside flushQueue; swallow here to keep interval alive
      });
    }
  };

  run(); // immediate first attempt
  intervalId = setInterval(run, SYNC_INTERVAL_MS);

  window.addEventListener('online', run);
}

export function stopSyncWorker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function flushQueue(projectId: string): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const allPending = await getPendingSyncItems(projectId);
    const eligible = allPending.filter(
      (item) => item.status !== 'failed' || item.attempts < MAX_ATTEMPTS
    );

    if (eligible.length === 0) {
      notifyConsumers(allPending.length);
      return;
    }

    // Process in batches
    for (let offset = 0; offset < eligible.length; offset += SYNC_BATCH_SIZE) {
      const batch = eligible.slice(offset, offset + SYNC_BATCH_SIZE);
      await sendBatch(projectId, batch);
    }

    const remaining = await getPendingSyncItems(projectId);
    notifyConsumers(remaining.length);
  } finally {
    isSyncing = false;
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function sendBatch(projectId: string, items: SyncQueueItem[]): Promise<void> {
  const payload = items.map((item) => ({
    id: item.id,
    projectId,
    type: item.type,
    payload: item.payload,
    createdAt: item.createdAt,
  }));

  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    try {
      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
        credentials: 'include', // sends the mp_session cookie
      });

      if (!res.ok) {
        // 4xx = bad request, not worth retrying
        if (res.status >= 400 && res.status < 500) {
          console.warn('[SyncWorker] Batch rejected by server:', res.status);
          return;
        }
        throw new Error(`Server error ${res.status}`);
      }

      const data = (await res.json()) as { processed: string[]; failed: Array<{ id: string; error: string }> };

      // Mark successfully processed items as done
      await Promise.all(data.processed.map((id) => markSyncItemDone(id)));

      if (data.failed.length > 0) {
        console.warn('[SyncWorker] Some items failed:', data.failed);
      }

      return; // success — exit retry loop

    } catch (err) {
      attempt++;
      if (attempt >= MAX_ATTEMPTS) {
        console.error('[SyncWorker] Batch permanently failed after max attempts:', err);
        return;
      }
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
      await sleep(backoff);
    }
  }
}

function notifyConsumers(pendingCount: number): void {
  onSyncCompleteCallbacks.forEach((cb) => cb(pendingCount));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
