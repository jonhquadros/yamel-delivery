/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getSyncQueue } from './index';
import { SyncQueueItem } from './types';

export type RealConnectionStatus = 'ONLINE' | 'OFFLINE';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingQueue, setPendingQueue] = useState<SyncQueueItem[]>([]);

  const updateNetworkState = () => {
    setIsOnline(navigator.onLine);
  };

  const refreshPendingQueue = async () => {
    try {
      const queue = await getSyncQueue();
      const pending = queue.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
      setPendingQueue(pending);
    } catch (e) {
      console.warn('Could not read sync queue from IDB:', e);
    }
  };

  useEffect(() => {
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    
    refreshPendingQueue();
    const interval = setInterval(refreshPendingQueue, 4000);

    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
      clearInterval(interval);
    };
  }, []);

  const currentStatus: RealConnectionStatus = isOnline ? 'ONLINE' : 'OFFLINE';

  return {
    isOnline,
    pendingCount: pendingQueue.length,
    status: currentStatus,
    refreshQueue: refreshPendingQueue,
  };
}

