/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { printingQueueRepository } from '../printers/printingQueueRepository';
import {
  PrintJob,
  PrintJobStatus,
  PrintJobType,
  PrintJobSource,
  PrintPayload,
  PrinterPaperWidth,
} from '../printers/types';
import { ProductionStationType, ProductionTicket, Order } from './storage/types';
import { generateLocalId } from './storage/idb';
import { renderKitchenTicket } from '../printers/renderers/kitchenRenderer';
import { renderDeliveryOrder } from '../printers/renderers/deliveryRenderer';

export interface EnqueuePrintJobParams {
  type: PrintJobType;
  source: PrintJobSource;
  orderId?: string;
  ticketId?: string;
  roundNumber?: number;
  station?: ProductionStationType;
  printerId?: string;
  payload?: PrintPayload | string | Record<string, any>;
  eventKey?: string;
}

export interface EnqueueManualPrintJobParams {
  type: PrintJobType;
  source: PrintJobSource;
  orderId?: string;
  ticketId?: string;
  roundNumber?: number;
  station?: ProductionStationType;
  printerId?: string;
  payload?: PrintPayload | string | Record<string, any>;
  isReprint?: boolean;
  originalJobId?: string;
}

/**
 * Validates minimum required fields for a PrintJob based on its type.
 */
export function validatePrintJobParams(params: EnqueuePrintJobParams): void {
  if (!params.type) {
    throw new Error('Tipo de trabalho de impressão (type) é obrigatório.');
  }

  if (!params.source) {
    throw new Error('Origem do trabalho de impressão (source) é obrigatória.');
  }

  switch (params.type) {
    case 'KITCHEN_NEW_ORDER':
      if (!params.station) {
        throw new Error('Trabalhos KITCHEN_NEW_ORDER exigem uma estação de produção (station).');
      }
      if (!params.ticketId && !params.orderId) {
        throw new Error('Trabalhos KITCHEN_NEW_ORDER exigem ticketId ou orderId.');
      }
      break;

    case 'KITCHEN_READY':
      if (!params.ticketId && !params.orderId) {
        throw new Error('Trabalhos KITCHEN_READY exigem ticketId ou orderId.');
      }
      break;

    case 'DELIVERY_ORDER':
      if (!params.orderId) {
        throw new Error('Trabalhos DELIVERY_ORDER exigem orderId.');
      }
      break;

    case 'ORDER_COPY':
      if (!params.orderId) {
        throw new Error('Trabalhos ORDER_COPY exigem orderId.');
      }
      break;

    case 'CASH_RECEIPT':
      // Exige apenas type e source
      break;

    default:
      break;
  }
}

/**
 * Generates an automatic deterministic eventKey for automatic print job types if not explicitly provided.
 */
export function generateEventKey(params: EnqueuePrintJobParams): string | undefined {
  if (params.eventKey) {
    return params.eventKey;
  }

  switch (params.type) {
    case 'KITCHEN_NEW_ORDER':
      if (params.ticketId && params.station) {
        const round = params.roundNumber ?? 1;
        return `KITCHEN_${params.ticketId}_R${round}_${params.station}`;
      }
      break;

    case 'KITCHEN_READY':
      if (params.ticketId) {
        return `KITCHEN_READY_${params.ticketId}`;
      }
      break;

    default:
      // Ações manuais/sob demanda (DELIVERY_ORDER, ORDER_COPY, CASH_RECEIPT) não geram eventKey bloqueante automático
      return undefined;
  }

  return undefined;
}

/**
 * Serviço Central de Impressão (printingService)
 * Gerencia validação, idempotência e enfileiramento na store printing_queue.
 */
export const printingService = {
  /**
   * Valida e enfileira um trabalho de impressão na printing_queue com status PENDING.
   * Suporta idempotência via eventKey.
   */
  async enqueue(params: EnqueuePrintJobParams): Promise<PrintJob> {
    // 1. Validar dados mínimos
    validatePrintJobParams(params);

    // 2. Determinar eventKey de idempotência
    const eventKey = generateEventKey(params);

    // 3. Verificação de Idempotência
    if (eventKey) {
      const existingJob = await printingQueueRepository.findByEventKey(eventKey);
      if (existingJob) {
        // Se o evento já está pendente, em impressão ou foi concluído, não duplicar
        if (
          existingJob.status === 'PENDING' ||
          existingJob.status === 'PRINTING' ||
          existingJob.status === 'PRINTED'
        ) {
          return existingJob;
        }
      }
    }

    // 4. Criar o novo PrintJob com status PENDING
    const now = new Date().toISOString();
    const newJob: PrintJob = {
      id: generateLocalId(),
      type: params.type,
      source: params.source,
      status: 'PENDING',
      orderId: params.orderId,
      ticketId: params.ticketId,
      roundNumber: params.roundNumber,
      station: params.station,
      printerId: params.printerId,
      payload: params.payload,
      eventKey: eventKey,
      attempts: 0,
      isReprint: false,
      createdAt: now,
      updatedAt: now,
    };

    return printingQueueRepository.create(newJob);
  },

  /**
   * Busca um trabalho de impressão pelo ID.
   */
  async getJob(id: string): Promise<PrintJob | null> {
    return printingQueueRepository.getById(id);
  },

  /**
   * Lista todos os trabalhos de impressão.
   */
  async getJobs(): Promise<PrintJob[]> {
    return printingQueueRepository.list();
  },

  /**
   * Lista trabalhos de impressão por status.
   */
  async getJobsByStatus(status: PrintJobStatus): Promise<PrintJob[]> {
    return printingQueueRepository.listByStatus(status);
  },

  /**
   * Busca um trabalho pela chave determinística de evento (eventKey).
   */
  async findByEventKey(eventKey: string): Promise<PrintJob | null> {
    return printingQueueRepository.findByEventKey(eventKey);
  },

  /**
   * Atualiza o status de um trabalho de impressão.
   */
  async updateStatus(jobId: string, status: PrintJobStatus, lastError?: string): Promise<PrintJob> {
    const job = await printingQueueRepository.getById(jobId);
    if (!job) {
      throw new Error(`Trabalho de impressão com ID '${jobId}' não encontrado.`);
    }

    const now = new Date().toISOString();
    job.status = status;
    job.updatedAt = now;

    if (status === 'PRINTED') {
      job.printedAt = now;
    }

    if (status === 'FAILED' && lastError !== undefined) {
      job.lastError = lastError;
    }

    return printingQueueRepository.update(job);
  },

  /**
   * Marca um trabalho de impressão como concluído (PRINTED).
   */
  async markPrinted(jobId: string): Promise<PrintJob> {
    return this.updateStatus(jobId, 'PRINTED');
  },

  /**
   * Marca um trabalho de impressão como aguardando agente (WAITING_AGENT).
   */
  async markWaitingAgent(jobId: string, message?: string): Promise<PrintJob> {
    return this.updateStatus(jobId, 'WAITING_AGENT', message);
  },

  /**
   * Marca um trabalho de impressão como falho (FAILED) e registra a mensagem de erro.
   */
  async markFailed(jobId: string, error: string): Promise<PrintJob> {
    return this.updateStatus(jobId, 'FAILED', error);
  },

  /**
   * Incrementa o contador de tentativas (attempts) de envio.
   */
  async incrementAttempts(jobId: string): Promise<PrintJob> {
    const job = await printingQueueRepository.getById(jobId);
    if (!job) {
      throw new Error(`Trabalho de impressão com ID '${jobId}' não encontrado.`);
    }

    job.attempts = (job.attempts || 0) + 1;
    job.updatedAt = new Date().toISOString();

    return printingQueueRepository.update(job);
  },

  /**
   * Solcita a reimpressão consciente de um trabalho de impressão existente.
   * Cria um novo PrintJob com novo ID, status PENDING, isReprint = true e originalJobId preenchido.
   */
  async createReprint(
    originalJobId: string,
    overrideParams?: Partial<EnqueuePrintJobParams>
  ): Promise<PrintJob> {
    const originalJob = await printingQueueRepository.getById(originalJobId);
    if (!originalJob) {
      throw new Error(`Trabalho de impressão original com ID '${originalJobId}' não encontrado.`);
    }

    const now = new Date().toISOString();
    const newReprintJob: PrintJob = {
      id: generateLocalId(),
      type: overrideParams?.type ?? originalJob.type,
      source: overrideParams?.source ?? originalJob.source,
      status: 'PENDING',
      orderId: overrideParams?.orderId ?? originalJob.orderId,
      ticketId: overrideParams?.ticketId ?? originalJob.ticketId,
      roundNumber: overrideParams?.roundNumber ?? originalJob.roundNumber,
      station: overrideParams?.station ?? originalJob.station,
      printerId: overrideParams?.printerId ?? originalJob.printerId,
      payload: overrideParams?.payload ?? originalJob.payload,
      // Reimpressões não usam o mesmo eventKey bloqueante por padrão, a menos que especificado
      eventKey: overrideParams?.eventKey,
      attempts: 0,
      isReprint: true,
      originalJobId: originalJobId,
      createdAt: now,
      updatedAt: now,
    };

    return printingQueueRepository.create(newReprintJob);
  },

  /**
   * Enfileira conscientemente um trabalho de impressão manual (ex: operador clica "Imprimir Entrega").
   * Não é bloqueado por eventKey automático de idempotência.
   * Cria sempre um novo PrintJob com novo ID e status PENDING.
   * Se já existia um job anterior e isReprint não foi definido, detecta automaticamente como reimpressão (2ª via).
   */
  async enqueueManual(params: EnqueueManualPrintJobParams): Promise<PrintJob> {
    // 1. Validar campos mínimos
    validatePrintJobParams({
      type: params.type,
      source: params.source,
      orderId: params.orderId,
      ticketId: params.ticketId,
      roundNumber: params.roundNumber,
      station: params.station,
      printerId: params.printerId,
      payload: params.payload,
    });

    let isReprint = params.isReprint;
    let originalJobId = params.originalJobId;

    // Se isReprint não foi explicitamente fornecido, verificar histórico para identificar se é 2ª via / reimpressão
    if (isReprint === undefined && params.orderId) {
      const existingJobs = await printingQueueRepository.list();
      const priorJobs = existingJobs.filter(
        j => j.orderId === params.orderId && j.type === params.type
      );
      if (priorJobs.length > 0) {
        isReprint = true;
        originalJobId = originalJobId || priorJobs[priorJobs.length - 1].id;
      } else {
        isReprint = false;
      }
    }

    const now = new Date().toISOString();
    const newJob: PrintJob = {
      id: generateLocalId(),
      type: params.type,
      source: params.source,
      status: 'PENDING',
      orderId: params.orderId,
      ticketId: params.ticketId,
      roundNumber: params.roundNumber,
      station: params.station,
      printerId: params.printerId,
      payload: params.payload,
      eventKey: undefined, // Impressões manuais NUNCA são bloqueadas por eventKey
      attempts: 0,
      isReprint: Boolean(isReprint),
      originalJobId: originalJobId,
      createdAt: now,
      updatedAt: now,
    };

    return printingQueueRepository.create(newJob);
  },

  /**
   * Enfileira a impressão de um ProductionTicket no KDS.
   */
  async enqueueKitchenTicket(
    ticket: ProductionTicket,
    options?: { paperWidth?: PrinterPaperWidth; isReprint?: boolean }
  ): Promise<PrintJob | null> {
    return enqueueKitchenPrintForTicket(ticket, options);
  },

  /**
   * Enfileira a impressão manual de um pedido de Delivery.
   */
  async enqueueDeliveryOrder(
    order: Order,
    options?: { paperWidth?: PrinterPaperWidth; isReprint?: boolean; originalJobId?: string }
  ): Promise<PrintJob | null> {
    return enqueueDeliveryOrder(order, options);
  },
};

/**
 * Enfileira a impressão manual de uma via de Delivery para um pedido.
 * Utiliza deliveryRenderer com os snapshots reais do pedido (preços, itens, acompanhamentos, cliente, endereço).
 * Cria sempre um novo PrintJob sem ser bloqueado por idempotência automática.
 */
export async function enqueueDeliveryOrder(
  order: Order,
  options?: { paperWidth?: PrinterPaperWidth; isReprint?: boolean; originalJobId?: string }
): Promise<PrintJob | null> {
  try {
    if (!order || !order.id) {
      throw new Error('Pedido inválido para impressão de delivery.');
    }

    // 1. Identificar se é reimpressão se não especificado
    let isReprint = options?.isReprint;
    let originalJobId = options?.originalJobId;

    if (isReprint === undefined) {
      const existingJobs = await printingQueueRepository.list();
      const priorJobs = existingJobs.filter(
        j => j.orderId === order.id && j.type === 'DELIVERY_ORDER'
      );
      if (priorJobs.length > 0) {
        isReprint = true;
        originalJobId = originalJobId || priorJobs[priorJobs.length - 1].id;
      } else {
        isReprint = false;
      }
    }

    // 2. Renderizar payload com deliveryRenderer
    const payload = renderDeliveryOrder({
      order,
      paperWidth: options?.paperWidth || 80,
      isReprint: Boolean(isReprint),
    });

    // 3. Enfileirar via manual
    return await printingService.enqueueManual({
      type: 'DELIVERY_ORDER',
      source: 'DELIVERY',
      orderId: order.id,
      payload,
      isReprint: Boolean(isReprint),
      originalJobId,
    });
  } catch (err) {
    console.warn('[Delivery Print] Erro ao enfileirar impressão de delivery:', order?.id, err);
    return null;
  }
}

/**
 * Enfileira automaticamente um trabalho de impressão no KDS quando um ProductionTicket é gerado.
 * Assíncrono, desacoplado, não bloqueante e com tratamento total de exceções para garantir
 * que falhas de impressão não quebrem o fluxo do pedido ou do KDS.
 */
export async function enqueueKitchenPrintForTicket(
  ticket: ProductionTicket,
  options?: { paperWidth?: PrinterPaperWidth; isReprint?: boolean }
): Promise<PrintJob | null> {
  try {
    const payload = renderKitchenTicket({
      ticket,
      paperWidth: options?.paperWidth || 80,
      isReprint: options?.isReprint || false,
    });

    return await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      station: ticket.station,
      ticketId: ticket.id,
      orderId: ticket.orderId,
      roundNumber: ticket.roundNumber || 1,
      payload,
    });
  } catch (err) {
    console.warn('[KDS Print] Erro ao enfileirar impressão do ticket de cozinha:', ticket.id, err);
    return null;
  }
}

