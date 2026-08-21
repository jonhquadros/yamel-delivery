/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { localDB, generateLocalId } from '../services/storage/idb';
import {
  PrintJob,
  PrintJobStatus,
  PrinterConfig,
} from './types';
import { ProductionStationType } from '../services/storage/types';

/**
 * Repositório de Fila de Impressão (IndexedDB store: printing_queue)
 */
export const printingQueueRepository = {
  /**
   * Registra um novo trabalho de impressão na fila local.
   */
  async create(jobData: Omit<PrintJob, 'id' | 'createdAt' | 'updatedAt'> | PrintJob): Promise<PrintJob> {
    const now = new Date().toISOString();
    const job: PrintJob = {
      ...jobData,
      id: 'id' in jobData && jobData.id ? jobData.id : generateLocalId(),
      attempts: jobData.attempts ?? 0,
      isReprint: jobData.isReprint ?? false,
      createdAt: 'createdAt' in jobData && jobData.createdAt ? jobData.createdAt : now,
      updatedAt: 'updatedAt' in jobData && jobData.updatedAt ? jobData.updatedAt : now,
    };
    await localDB.put('printing_queue', job);
    return job;
  },

  /**
   * Busca um trabalho de impressão pelo ID único.
   */
  async getById(id: string): Promise<PrintJob | null> {
    return localDB.get<PrintJob>('printing_queue', id);
  },

  /**
   * Atualiza o estado ou campos de um trabalho de impressão existente.
   */
  async update(job: PrintJob): Promise<PrintJob> {
    const updatedJob: PrintJob = {
      ...job,
      updatedAt: new Date().toISOString(),
    };
    await localDB.put('printing_queue', updatedJob);
    return updatedJob;
  },

  /**
   * Remove um trabalho da fila de impressão pelo ID.
   */
  async delete(id: string): Promise<void> {
    await localDB.delete('printing_queue', id);
  },

  /**
   * Lista todos os trabalhos de impressão na fila.
   */
  async list(): Promise<PrintJob[]> {
    return localDB.getAll<PrintJob>('printing_queue');
  },

  /**
   * Lista trabalhos de impressão filtrados por status (PENDING, PRINTING, PRINTED, FAILED, WAITING_AGENT).
   */
  async listByStatus(status: PrintJobStatus): Promise<PrintJob[]> {
    return localDB.getByIndex<PrintJob>('printing_queue', 'status', status);
  },

  /**
   * Busca um trabalho de impressão pela chave determinística de evento (eventKey) para prevenção de duplicidade.
   */
  async findByEventKey(eventKey: string): Promise<PrintJob | null> {
    if (!eventKey) return null;
    const results = await localDB.getByIndex<PrintJob>('printing_queue', 'eventKey', eventKey);
    return results.length > 0 ? results[0] : null;
  }
};

/**
 * Repositório de Configurações de Impressoras (IndexedDB store: printer_configs)
 */
export const printerConfigRepository = {
  /**
   * Cadastra uma nova configuração de impressora.
   */
  async create(configData: Omit<PrinterConfig, 'id' | 'createdAt' | 'updatedAt'> | PrinterConfig): Promise<PrinterConfig> {
    const now = new Date().toISOString();
    const config: PrinterConfig = {
      ...configData,
      id: 'id' in configData && configData.id ? configData.id : generateLocalId(),
      createdAt: 'createdAt' in configData && configData.createdAt ? configData.createdAt : now,
      updatedAt: 'updatedAt' in configData && configData.updatedAt ? configData.updatedAt : now,
    };
    await localDB.put('printer_configs', config);
    return config;
  },

  /**
   * Busca configuração de impressora por ID.
   */
  async getById(id: string): Promise<PrinterConfig | null> {
    return localDB.get<PrinterConfig>('printer_configs', id);
  },

  /**
   * Atualiza uma configuração de impressora.
   */
  async update(config: PrinterConfig): Promise<PrinterConfig> {
    const updatedConfig: PrinterConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    await localDB.put('printer_configs', updatedConfig);
    return updatedConfig;
  },

  /**
   * Remove uma configuração de impressora.
   */
  async delete(id: string): Promise<void> {
    await localDB.delete('printer_configs', id);
  },

  /**
   * Lista todas as configurações de impressoras.
   */
  async list(): Promise<PrinterConfig[]> {
    return localDB.getAll<PrinterConfig>('printer_configs');
  },

  /**
   * Lista impressoras atribuídas a uma estação de produção específica.
   */
  async listByStation(station: ProductionStationType): Promise<PrinterConfig[]> {
    return localDB.getByIndex<PrinterConfig>('printer_configs', 'station', station);
  }
};
