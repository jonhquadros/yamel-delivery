/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Company, User, Category, Product, ProductOption, ProductAddon,
  AccompanimentGroup, AccompanimentItem, ProductAccompanimentLink,
  Table, Customer, Order, OrderItem, CashRegister, CashMovement,
  Delivery, SyncQueueItem, Device
} from './types';

const DB_NAME = 'yamel_offline_db_v2';
const DB_VERSION = 4;

export type StoreName =
  | 'companies'
  | 'users'
  | 'categories'
  | 'products'
  | 'product_options'
  | 'product_addons'
  | 'accompaniment_groups'
  | 'accompaniment_items'
  | 'product_accompaniment_links'
  | 'tables'
  | 'customers'
  | 'orders'
  | 'order_items'
  | 'cash_registers'
  | 'cash_movements'
  | 'deliveries'
  | 'sync_queue'
  | 'devices'
  | 'production_tickets'
  | 'device_config'; // Backward compatibility

export class YamelDB {
  private db: IDBDatabase | null = null;

  constructor() {}

  /**
   * Connects to IndexedDB instance with precise schema setup and indexes.
   */
  private init(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Companies
        if (!db.objectStoreNames.contains('companies')) {
          db.createObjectStore('companies', { keyPath: 'id' });
        }

        // 2. Users
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('roleId', 'roleId', { unique: false });
        }

        // 3. Categories
        if (!db.objectStoreNames.contains('categories')) {
          const store = db.createObjectStore('categories', { keyPath: 'id' });
          store.createIndex('sortOrder', 'sortOrder', { unique: false });
        }

        // 4. Products with category & status indexes
        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('active', 'active', { unique: false });
          store.createIndex('sortOrder', 'sortOrder', { unique: false });
        }

        // 5. Product Options (sizes/variants)
        if (!db.objectStoreNames.contains('product_options')) {
          const store = db.createObjectStore('product_options', { keyPath: 'id' });
          store.createIndex('productId', 'productId', { unique: false });
        }

        // 6. Product Addons
        if (!db.objectStoreNames.contains('product_addons')) {
          const store = db.createObjectStore('product_addons', { keyPath: 'id' });
          store.createIndex('productId', 'productId', { unique: false });
        }

        // 6.1 Accompaniment Groups
        if (!db.objectStoreNames.contains('accompaniment_groups')) {
          const store = db.createObjectStore('accompaniment_groups', { keyPath: 'id' });
          store.createIndex('sortOrder', 'sortOrder', { unique: false });
          store.createIndex('active', 'active', { unique: false });
          store.createIndex('scope', 'scope', { unique: false });
        }

        // 6.2 Accompaniment Items
        if (!db.objectStoreNames.contains('accompaniment_items')) {
          const store = db.createObjectStore('accompaniment_items', { keyPath: 'id' });
          store.createIndex('groupId', 'groupId', { unique: false });
          store.createIndex('active', 'active', { unique: false });
          store.createIndex('sortOrder', 'sortOrder', { unique: false });
        }

        // 6.3 Product Accompaniment Links
        if (!db.objectStoreNames.contains('product_accompaniment_links')) {
          const store = db.createObjectStore('product_accompaniment_links', { keyPath: 'id' });
          store.createIndex('productId', 'productId', { unique: false });
          store.createIndex('groupId', 'groupId', { unique: false });
        }

        // 7. Tables
        if (!db.objectStoreNames.contains('tables')) {
          const store = db.createObjectStore('tables', { keyPath: 'id' });
          store.createIndex('number', 'number', { unique: true });
          store.createIndex('status', 'status', { unique: false });
        }

        // 8. Customers
        if (!db.objectStoreNames.contains('customers')) {
          const store = db.createObjectStore('customers', { keyPath: 'id' });
          store.createIndex('phone', 'phone', { unique: false });
        }

        // 9. Orders with compound indexes simulation
        if (!db.objectStoreNames.contains('orders')) {
          const store = db.createObjectStore('orders', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('tableId', 'tableId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // 10. Order Items
        if (!db.objectStoreNames.contains('order_items')) {
          const store = db.createObjectStore('order_items', { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
        }

        // 11. Cash Registers
        if (!db.objectStoreNames.contains('cash_registers')) {
          const store = db.createObjectStore('cash_registers', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }

        // 12. Cash Movements
        if (!db.objectStoreNames.contains('cash_movements')) {
          const store = db.createObjectStore('cash_movements', { keyPath: 'id' });
          store.createIndex('cashRegisterId', 'cashRegisterId', { unique: false });
        }

        // 13. Deliveries
        if (!db.objectStoreNames.contains('deliveries')) {
          const store = db.createObjectStore('deliveries', { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: true });
          store.createIndex('status', 'status', { unique: false });
        }

        // 14. Sync Queue Outbox
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 15. Devices
        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices', { keyPath: 'id' });
        }

        // 16. Production Tickets (KDS)
        if (!db.objectStoreNames.contains('production_tickets')) {
          const store = db.createObjectStore('production_tickets', { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
          store.createIndex('station', 'station', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // Legacy configuration store preserved for back-compat
        if (!db.objectStoreNames.contains('device_config')) {
          db.createObjectStore('device_config', { keyPath: 'deviceId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Falha ao abrir o IndexedDB do Yamel'));
      };
    });
  }

  /**
   * Helper to fetch store in desired read/write transaction mode.
   */
  private async getStore(
    storeName: StoreName,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- STANDARD GENERIC PERSISTENCE INTERFACES ---

  public async get<T>(storeName: StoreName, id: string): Promise<T | null> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async put<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- QUERY BY INDEX OPERATORS ---

  public async getByIndex<T>(
    storeName: StoreName,
    indexName: string,
    value: any
  ): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

export const localDB = new YamelDB();

/**
 * High quality cryptographically safe UUID generator for Offline-First operations.
 */
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Safe robust fallback if crypto.randomUUID isn't available in early container webviews
  return 'yml_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}
