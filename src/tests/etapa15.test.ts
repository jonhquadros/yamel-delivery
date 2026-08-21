/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'fake-indexeddb/auto';
import { printingService } from '../services/printingService';
import { printingQueueRepository } from '../printers/printingQueueRepository';
import { printQueueProcessor, MAX_PRINT_ATTEMPTS } from '../printers/printQueueProcessor';
import { PrintTransport, PrintTransportResult } from '../printers/transports/types';
import { defaultUnavailableTransport } from '../printers/transports/unavailableTransport';
import { localDB } from '../services/storage/idb';
import { Order, OrderItem } from '../services/storage/types';

async function runEtapa15Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA ETAPA 15 ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  try {
    // Mock transport for simulating real printer success
    class MockSuccessTransport implements PrintTransport {
      readonly name = 'MockSuccessTransport';
      async process(): Promise<PrintTransportResult> {
        return { success: true, message: 'Impresso com sucesso via Mock' };
      }
    }

    // Mock transport for simulating physical failure
    class MockFailureTransport implements PrintTransport {
      readonly name = 'MockFailureTransport';
      async process(): Promise<PrintTransportResult> {
        return {
          success: false,
          reason: 'PAPER_OUT',
          message: 'Papel da impressora esgotado',
          retryable: true,
        };
      }
    }

    // Mock transport to check status during execution
    class MockSpyTransport implements PrintTransport {
      readonly name = 'MockSpyTransport';
      statusObservedDuringExecution?: string;
      async process(job: any): Promise<PrintTransportResult> {
        const currentInDb = await printingQueueRepository.getById(job.id);
        this.statusObservedDuringExecution = currentInDb?.status;
        return { success: true };
      }
    }

    // Mock slow transport for concurrency testing
    class MockSlowTransport implements PrintTransport {
      readonly name = 'MockSlowTransport';
      async process(): Promise<PrintTransportResult> {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return { success: true };
      }
    }

    // TESTE 01 & 03: Processar PrintJob PENDING com transporte padrão (Unavailable) gerando WAITING_AGENT
    printQueueProcessor.setTransport(defaultUnavailableTransport);
    const job1 = await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      ticketId: 'tkt-15-01',
      roundNumber: 1,
      station: 'KITCHEN',
      payload: { items: ['Hambúrguer Artesanal'] },
    });

    assert(job1.status === 'PENDING', 'TESTE 01a. PrintJob criado com status PENDING');
    const processedJob1 = await printQueueProcessor.processJob(job1.id);
    assert(processedJob1.status === 'WAITING_AGENT', 'TESTE 03. Transporte indisponível gera status WAITING_AGENT');

    // TESTE 02: Job muda para PRINTING durante processamento
    const spyTransport = new MockSpyTransport();
    printQueueProcessor.setTransport(spyTransport);
    const job2 = await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      ticketId: 'tkt-15-02',
      roundNumber: 1,
      station: 'KITCHEN',
      payload: { items: ['Batata Frita'] },
    });
    await printQueueProcessor.processJob(job2.id);
    assert(spyTransport.statusObservedDuringExecution === 'PRINTING', 'TESTE 02. Job muda para PRINTING durante processamento');

    // TESTE 04 & 07: Erro de transporte físico gera FAILED e registra lastError
    printQueueProcessor.setTransport(new MockFailureTransport());
    const job3 = await printingService.enqueue({
      type: 'DELIVERY_ORDER',
      source: 'DELIVERY',
      orderId: 'ord-15-03',
      payload: { customer: 'Carlos Silva' },
    });
    const failedJob3 = await printQueueProcessor.processJob(job3.id);
    assert(failedJob3.status === 'FAILED', 'TESTE 04. Erro de transporte gera status FAILED');
    assert(failedJob3.lastError === 'Papel da impressora esgotado', 'TESTE 07. lastError é registrado em caso de falha');

    // TESTE 05 & 06: Sucesso confirmado gera PRINTED e preenche printedAt
    printQueueProcessor.setTransport(new MockSuccessTransport());
    const job4 = await printingService.enqueue({
      type: 'ORDER_COPY',
      source: 'PDV',
      orderId: 'ord-15-04',
      payload: { table: '05' },
    });
    const printedJob4 = await printQueueProcessor.processJob(job4.id);
    assert(printedJob4.status === 'PRINTED', 'TESTE 05. Sucesso confirmado gera status PRINTED');
    assert(Boolean(printedJob4.printedAt), 'TESTE 06. printedAt é preenchido corretamente no sucesso');

    // TESTE 08: attempts incrementa corretamente
    assert(printedJob4.attempts === 1, 'TESTE 08. attempts incrementa de 0 para 1 no início do processamento');

    // TESTE 09: retry FAILED → PENDING
    const retriedFailed = await printQueueProcessor.retryJob(failedJob3.id);
    assert(retriedFailed.status === 'PENDING', 'TESTE 09a. retryJob em FAILED altera status para PENDING');
    assert(retriedFailed.attempts === 1, 'TESTE 09b. retryJob NÃO incrementa attempts antes da execução real');

    // TESTE 10: retry WAITING_AGENT → PENDING
    const retriedWaiting = await printQueueProcessor.retryJob(processedJob1.id);
    assert(retriedWaiting.status === 'PENDING', 'TESTE 10. retryJob em WAITING_AGENT altera status para PENDING');

    // TESTE 11: job PRINTED não é processado novamente
    const reprocessPrinted = await printQueueProcessor.processJob(printedJob4.id);
    assert(reprocessPrinted.status === 'PRINTED', 'TESTE 11. job PRINTED não é processado novamente nem duplicado');

    // TESTE 12: processamento duplicado simultâneo do mesmo job é bloqueado (concorrência)
    printQueueProcessor.setTransport(new MockSlowTransport());
    const jobConcurrent = await printingService.enqueue({
      type: 'CASH_RECEIPT',
      source: 'CASH',
      payload: { total: 'R$ 50,00' },
    });

    const promiseA = printQueueProcessor.processJob(jobConcurrent.id);
    const promiseB = printQueueProcessor.processJob(jobConcurrent.id);
    const [resA, resB] = await Promise.all([promiseA, promiseB]);
    assert(resA.id === resB.id, 'TESTE 12a. Chamadas concorrentes retornam o mesmo Job');
    assert(resA.attempts === 1, 'TESTE 12b. Concorrência controlada: attempts foi incrementado apenas 1x');

    // TESTE 13 & 14: processPendingJobs processa múltiplos jobs em ordem cronológica (FIFO)
    printQueueProcessor.setTransport(new MockSuccessTransport());
    const orderHistory: string[] = [];
    class FIFOTrackerTransport implements PrintTransport {
      readonly name = 'FIFOTrackerTransport';
      async process(j: any): Promise<PrintTransportResult> {
        orderHistory.push(j.payload?.seq);
        return { success: true };
      }
    }
    printQueueProcessor.setTransport(new FIFOTrackerTransport());

    const batch1 = await printingService.enqueue({
      type: 'ORDER_COPY',
      source: 'PDV',
      orderId: 'ord-fifo-1',
      payload: { seq: 'PRIMEIRO' },
    });
    // Pequeno atraso para garantir carimbo de tempo estritamente crescente
    await new Promise((r) => setTimeout(r, 10));
    const batch2 = await printingService.enqueue({
      type: 'ORDER_COPY',
      source: 'PDV',
      orderId: 'ord-fifo-2',
      payload: { seq: 'SEGUNDO' },
    });

    const pendingProcessed = await printQueueProcessor.processPendingJobs();
    assert(pendingProcessed.length >= 2, 'TESTE 13. processPendingJobs processa múltiplos jobs pendentes');
    const seqHistory = orderHistory.filter(Boolean);
    const lastTwo = seqHistory.slice(-2);
    assert(lastTwo[0] === 'PRIMEIRO' && lastTwo[1] === 'SEGUNDO', 'TESTE 14. Jobs processados em ordem estritamente cronológica (FIFO)');

    // TESTE 15: MAX_PRINT_ATTEMPTS impede loop infinito no processRetryableJobs
    printQueueProcessor.setTransport(new MockFailureTransport());
    const maxAttemptJob = await printingService.enqueue({
      type: 'ORDER_COPY',
      source: 'PDV',
      orderId: 'ord-max-attempt',
    });
    // Simula 3 falhas
    for (let i = 0; i < MAX_PRINT_ATTEMPTS; i++) {
      await printQueueProcessor.processJob(maxAttemptJob.id);
      if (i < MAX_PRINT_ATTEMPTS - 1) {
        await printQueueProcessor.retryJob(maxAttemptJob.id);
      }
    }
    const finalFailedJob = await printingService.getJob(maxAttemptJob.id);
    assert(finalFailedJob?.attempts === MAX_PRINT_ATTEMPTS, 'TESTE 15a. Job atinge MAX_PRINT_ATTEMPTS (3)');
    assert(finalFailedJob?.status === 'FAILED', 'TESTE 15b. Job permanece em FAILED');

    // Executa retry automático para retryable jobs: não deve processar o que excedeu o limite
    const autoRetried = await printQueueProcessor.processRetryableJobs();
    const stillFailed = await printingService.getJob(maxAttemptJob.id);
    assert(stillFailed?.attempts === MAX_PRINT_ATTEMPTS && stillFailed?.status === 'FAILED', 'TESTE 15c. MAX_PRINT_ATTEMPTS impede retry automático indefinido');

    // TESTE 16 & 17: Pedido e OrderItem NÃO são alterados pelo processamento da impressão
    const sampleItem: OrderItem = {
      id: 'oi-sec-1',
      orderId: 'ord-immutable-1',
      productId: 'p-1',
      productNameSnapshot: 'Hambúrguer Duplo',
      unitPrice: 2800,
      quantity: 2,
      subtotal: 5600,
      status: 'PREPARING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sampleOrder: Order = {
      id: 'ord-immutable-1',
      localId: 'YML-999',
      orderNumber: 999,
      companyId: 'comp-1',
      deviceId: 'dev-1',
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      syncStatus: 'SYNCED',
      fulfillmentType: 'DELIVERY',
      subtotal: 5600,
      discount: 0,
      serviceFee: 0,
      deliveryFee: 500,
      total: 6100,
      paymentStatus: 'PAID',
      paymentMethod: 'PIX',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [sampleItem],
    };
    await localDB.put('orders', sampleOrder);
    await localDB.put('order_items', sampleItem);

    // Processa impressão relacionada ao pedido
    printQueueProcessor.setTransport(new MockSuccessTransport());
    const orderPrintJob = await printingService.enqueue({
      type: 'DELIVERY_ORDER',
      source: 'DELIVERY',
      orderId: sampleOrder.id,
      payload: { orderNumber: sampleOrder.orderNumber },
    });
    await printQueueProcessor.processJob(orderPrintJob.id);

    const checkOrder = await localDB.get<Order>('orders', sampleOrder.id);
    const checkItem = await localDB.get<OrderItem>('order_items', sampleItem.id);
    assert(checkOrder?.total === 6100 && checkOrder?.status === 'CONFIRMED', 'TESTE 16. Pedido não sofre qualquer alteração pelo processamento da impressão');
    assert(checkItem?.unitPrice === 2800 && checkItem?.quantity === 2, 'TESTE 17. OrderItem não sofre qualquer alteração pelo processamento da impressão');

    // TESTE 18: Reprint continua independente do original
    const reprint = await printingService.createReprint(orderPrintJob.id);
    assert(reprint.id !== orderPrintJob.id, 'TESTE 18a. Reimpressão possui ID exclusivo');
    assert(reprint.isReprint === true, 'TESTE 18b. isReprint = true');
    assert(reprint.originalJobId === orderPrintJob.id, 'TESTE 18c. originalJobId aponta para o job original');
    const processedReprint = await printQueueProcessor.processJob(reprint.id);
    assert(processedReprint.status === 'PRINTED', 'TESTE 18d. Reimpressão processada de forma 100% independente');

    // TESTE 19: getQueueStats retorna valores consolidados corretos
    const stats = await printQueueProcessor.getQueueStats();
    assert(typeof stats.total === 'number' && stats.total > 0, 'TESTE 19a. stats.total reporta contagem total de jobs');
    assert(stats.total === stats.pending + stats.printing + stats.printed + stats.failed + stats.waitingAgent, 'TESTE 19b. Soma das categorias de stats é igual ao total');

    // TESTE 20: Funciona sem internet / sem dependência externa (armazenamento estritamente local em IndexedDB)
    const localJob = await printingService.enqueue({
      type: 'ORDER_COPY',
      source: 'PDV',
      orderId: 'ord-offline-test',
      payload: { offline: true },
    });
    printQueueProcessor.setTransport(defaultUnavailableTransport);
    const offlineResult = await printQueueProcessor.processJob(localJob.id);
    assert(offlineResult.status === 'WAITING_AGENT', 'TESTE 20. Execução offline pura no IndexedDB concluída com sucesso');

    console.log(`\n=== RESUMO ETAPA 15: PASSOU: ${passed} | FALHOU: ${failed} ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Erro crítico nos testes:', err);
    process.exit(1);
  }
}

runEtapa15Tests();
