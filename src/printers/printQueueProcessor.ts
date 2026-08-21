/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { printingQueueRepository } from './printingQueueRepository';
import { PrintJob, PrintJobStatus } from './types';
import { PrintTransport, PrintTransportResult } from './transports/types';
import { defaultUnavailableTransport } from './transports/unavailableTransport';

export const MAX_PRINT_ATTEMPTS = 3;

export interface PrintQueueStats {
  pending: number;
  printing: number;
  printed: number;
  failed: number;
  waitingAgent: number;
  total: number;
}

export interface PrintProcessLogEntry {
  jobId: string;
  type: string;
  previousStatus: PrintJobStatus;
  newStatus: PrintJobStatus;
  attempts: number;
  error?: string;
  timestamp: string;
}

/**
 * Motor de Processamento da Fila de Impressão (Offline-First).
 *
 * Gerencia a execução assíncrona dos trabalhos de impressão, controle de concorrência em memória,
 * ciclo de vida dos estados (PENDING -> PRINTING -> PRINTED / FAILED / WAITING_AGENT), tentativas,
 * retries manuais/automáticos e estatísticas.
 */
export class PrintQueueProcessor {
  private transport: PrintTransport = defaultUnavailableTransport;
  private readonly processingJobIds = new Set<string>();
  private readonly logs: PrintProcessLogEntry[] = [];
  private readonly maxLogs = 100;

  /**
   * Configura o transporte a ser utilizado pelo processador (ex: teste ou futuro Print Agent).
   */
  setTransport(transport: PrintTransport): void {
    this.transport = transport;
  }

  /**
   * Retorna o transporte atual configurado.
   */
  getTransport(): PrintTransport {
    return this.transport;
  }

  /**
   * Restaura o transporte padrão (UnavailablePrintTransport).
   */
  resetTransport(): void {
    this.transport = defaultUnavailableTransport;
  }

  /**
   * Verifica se um trabalho está sendo processado ativamente no momento.
   */
  isJobProcessing(jobId: string): boolean {
    return this.processingJobIds.has(jobId);
  }

  /**
   * Processa individualmente um trabalho de impressão pelo ID.
   *
   * Garante:
   * 1. Proteção de concorrência (impede que o mesmo job seja processado 2x simultaneamente).
   * 2. Transição segura PENDING -> PRINTING -> PRINTED / WAITING_AGENT / FAILED.
   * 3. Incremento correto de attempts no início da tentativa.
   * 4. Registro de printedAt em sucesso ou lastError em falha.
   * 5. Não bloqueia a execução nem lança exceções que interrompam o fluxo do chamador.
   */
  async processJob(jobId: string): Promise<PrintJob> {
    // 1. Proteção contra concorrência simultânea em memória
    if (this.processingJobIds.has(jobId)) {
      const existing = await printingQueueRepository.getById(jobId);
      if (existing) {
        return existing;
      }
      throw new Error(`Trabalho com ID '${jobId}' já está em processamento concorrente.`);
    }

    // 2. Registra o job no conjunto de processamento ativo
    this.processingJobIds.add(jobId);

    try {
      // 3. Busca o PrintJob no repositório
      const job = await printingQueueRepository.getById(jobId);
      if (!job) {
        throw new Error(`Trabalho de impressão com ID '${jobId}' não encontrado na fila.`);
      }

      // 4. Se o job já foi impresso com sucesso, não reprocessar
      if (job.status === 'PRINTED') {
        return job;
      }

      const previousStatus = job.status;

      // 5. Transição para PRINTING e incremento do contador de tentativas
      job.status = 'PRINTING';
      job.attempts = (job.attempts || 0) + 1;
      job.updatedAt = new Date().toISOString();
      await printingQueueRepository.update(job);

      this.recordLog({
        jobId: job.id,
        type: job.type,
        previousStatus,
        newStatus: 'PRINTING',
        attempts: job.attempts,
        timestamp: job.updatedAt,
      });

      // 6. Envio para a camada abstrata de transporte
      let transportResult: PrintTransportResult;
      try {
        transportResult = await this.transport.process(job);
      } catch (err: any) {
        transportResult = {
          success: false,
          reason: 'COMMUNICATION_ERROR',
          message: err?.message || 'Erro inesperado no transporte de impressão.',
          retryable: true,
        };
      }

      const now = new Date().toISOString();
      job.updatedAt = now;

      // 7. Atualização do estado com base no resultado real do transporte
      if (transportResult.success === true) {
        job.status = 'PRINTED';
        job.printedAt = now;
        job.lastError = undefined;

        this.recordLog({
          jobId: job.id,
          type: job.type,
          previousStatus: 'PRINTING',
          newStatus: 'PRINTED',
          attempts: job.attempts,
          timestamp: now,
        });
      } else {
        const failureResult = transportResult;
        if (failureResult.reason === 'AGENT_UNAVAILABLE') {
          job.status = 'WAITING_AGENT';
          job.lastError = failureResult.message || 'Yamel Print Agent não disponível.';

          this.recordLog({
            jobId: job.id,
            type: job.type,
            previousStatus: 'PRINTING',
            newStatus: 'WAITING_AGENT',
            attempts: job.attempts,
            error: job.lastError,
            timestamp: now,
          });
        } else {
          job.status = 'FAILED';
          job.lastError = failureResult.message || `Falha de impressão: ${failureResult.reason}`;

          this.recordLog({
            jobId: job.id,
            type: job.type,
            previousStatus: 'PRINTING',
            newStatus: 'FAILED',
            attempts: job.attempts,
            error: job.lastError,
            timestamp: now,
          });
        }
      }

      await printingQueueRepository.update(job);
      return job;
    } finally {
      // 8. Libera o lock de concorrência em memória
      this.processingJobIds.delete(jobId);
    }
  }

  /**
   * Processa todos os trabalhos em estado PENDING na ordem cronológica de criação (FIFO).
   * O processamento é sequencial para garantir previsibilidade e evitar conflitos.
   */
  async processPendingJobs(): Promise<PrintJob[]> {
    const pendingJobs = await printingQueueRepository.listByStatus('PENDING');

    // Ordenação estritamente cronológica (FIFO)
    pendingJobs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const processed: PrintJob[] = [];

    for (const job of pendingJobs) {
      if (!this.processingJobIds.has(job.id)) {
        try {
          const result = await this.processJob(job.id);
          processed.push(result);
        } catch (error) {
          // Registra falha sem travar o processamento dos demais itens da fila
          console.error(`[PrintQueueProcessor] Erro ao processar job pendente '${job.id}':`, error);
        }
      }
    }

    return processed;
  }

  /**
   * Reinicia um trabalho que esteja em FAILED ou WAITING_AGENT colocando-o novamente em PENDING.
   * Não incrementa attempts no momento do retry (o incremento ocorre somente quando processJob iniciar).
   */
  async retryJob(jobId: string): Promise<PrintJob> {
    const job = await printingQueueRepository.getById(jobId);
    if (!job) {
      throw new Error(`Trabalho de impressão com ID '${jobId}' não encontrado para retry.`);
    }

    if (job.status === 'PRINTED') {
      throw new Error(`Trabalho com ID '${jobId}' já foi impresso (PRINTED) e não pode ser reprocessado. Use createReprint para 2ª via.`);
    }

    if (job.status === 'PRINTING') {
      throw new Error(`Trabalho com ID '${jobId}' já está em impressão no momento.`);
    }

    const previousStatus = job.status;
    job.status = 'PENDING';
    job.updatedAt = new Date().toISOString();

    await printingQueueRepository.update(job);

    this.recordLog({
      jobId: job.id,
      type: job.type,
      previousStatus,
      newStatus: 'PENDING',
      attempts: job.attempts,
      timestamp: job.updatedAt,
    });

    return job;
  }

  /**
   * Localiza trabalhos com FAILED ou WAITING_AGENT que não excederam o limite de tentativas,
   * coloca-os em PENDING e aciona o processamento da fila.
   */
  async processRetryableJobs(maxAttempts: number = MAX_PRINT_ATTEMPTS): Promise<PrintJob[]> {
    const [failedJobs, waitingJobs] = await Promise.all([
      printingQueueRepository.listByStatus('FAILED'),
      printingQueueRepository.listByStatus('WAITING_AGENT'),
    ]);

    const retryable = [...failedJobs, ...waitingJobs].filter(
      (j) => (j.attempts || 0) < maxAttempts && !this.processingJobIds.has(j.id)
    );

    // Ordenação cronológica
    retryable.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const job of retryable) {
      await this.retryJob(job.id);
    }

    return this.processPendingJobs();
  }

  /**
   * Retorna estatísticas consolidadas da fila de impressão.
   */
  async getQueueStats(): Promise<PrintQueueStats> {
    const allJobs = await printingQueueRepository.list();

    const stats: PrintQueueStats = {
      pending: 0,
      printing: 0,
      printed: 0,
      failed: 0,
      waitingAgent: 0,
      total: allJobs.length,
    };

    for (const job of allJobs) {
      switch (job.status) {
        case 'PENDING':
          stats.pending++;
          break;
        case 'PRINTING':
          stats.printing++;
          break;
        case 'PRINTED':
          stats.printed++;
          break;
        case 'FAILED':
          stats.failed++;
          break;
        case 'WAITING_AGENT':
          stats.waitingAgent++;
          break;
      }
    }

    return stats;
  }

  /**
   * Retorna os últimos registros de diagnóstico do processamento da fila.
   */
  getRecentLogs(): PrintProcessLogEntry[] {
    return [...this.logs];
  }

  /**
   * Limpa o histórico de diagnósticos em memória.
   */
  clearLogs(): void {
    this.logs.length = 0;
  }

  private recordLog(entry: PrintProcessLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }
}

export const printQueueProcessor = new PrintQueueProcessor();
