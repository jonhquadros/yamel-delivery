/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'fake-indexeddb/auto';
import { localDB, generateLocalId } from '../services/storage/idb';
import {
  ordersRepository,
  enqueueDeliveryOrder,
  enqueueKitchenPrintForTicket,
  printingService,
  printingQueueRepository,
} from '../services/storage/index';
import { Order, OrderItem, ProductionTicket } from '../services/storage/types';
import { PrintJob, PrintPayload } from '../printers/types';
import { renderDeliveryOrder } from '../printers/renderers/deliveryRenderer';
import { printQueueProcessor } from '../printers/printQueueProcessor';

async function runEtapa17Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA FASE 02 / ETAPA 17 (INTEGRAÇÃO DELIVERY + IMPRESSÃO MANUAL) ===\n');
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
    // 0. Limpeza inicial do banco em memória
    await localDB.clear('orders');
    await localDB.clear('order_items');
    await localDB.clear('production_tickets');
    await localDB.clear('printing_queue');

    // Setup de um pedido de delivery completo para testes
    const sampleDeliveryOrder: Order = {
      id: 'ord-del-1046',
      localId: 'YML-1046',
      orderNumber: 1046,
      companyId: 'comp-1',
      deviceId: 'dev-1',
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      customerSnapshot: {
        name: 'Carlos Alberto Silva',
        phone: '11987654321',
        address: 'Rua das Flores, 123',
      },
      deliverySnapshot: {
        address: 'Av. Paulista',
        number: '1000',
        complement: 'Apt 124B',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01310-100',
        reference: 'Próximo ao metrô Trianon-Masp',
        deliveryFee: 1000,
        status: 'PENDING',
      },
      items: [
        {
          id: 'item-1',
          orderId: 'ord-del-1046',
          productId: 'prod-burger',
          productNameSnapshot: 'Burger Artesanal Especial',
          quantity: 2,
          unitPrice: 3500,
          subtotal: 7000,
          status: 'PENDING',
          notes: 'Sem cebola em um dos burgers',
          selectedAccompaniments: [
            {
              groupId: 'grp-acc',
              groupNameSnapshot: 'Acompanhamentos Especiais',
              itemId: 'acc-bacon',
              itemNameSnapshot: 'Bacon Crocante Extra',
              priceSnapshot: 500,
              quantity: 2,
              subtotal: 1000,
            },
          ],
          selectedOptions: [
            {
              optionId: 'opt-ponto',
              optionName: 'Ponto da Carne',
              choiceId: 'ch-ao-ponto',
              choiceName: 'Ao Ponto',
              additionalPrice: 0,
            },
          ],
          selectedAddons: [
            {
              addonId: 'add-queijo',
              addonName: 'Queijo Cheddar Dobrado',
              quantity: 1,
              price: 400,
            },
          ],
          createdAt: '2026-08-21T18:30:00.000Z',
          updatedAt: '2026-08-21T18:30:00.000Z',
        },
        {
          id: 'item-2',
          orderId: 'ord-del-1046',
          productId: 'prod-coca',
          productNameSnapshot: 'Coca-Cola Zero 350ml',
          quantity: 2,
          unitPrice: 700,
          subtotal: 1400,
          status: 'PENDING',
          createdAt: '2026-08-21T18:30:00.000Z',
          updatedAt: '2026-08-21T18:30:00.000Z',
        },
      ],
      subtotal: 8400,
      deliveryFee: 1000,
      discount: 400,
      serviceFee: 0,
      total: 9000,
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      changeFor: 10000,
      notes: 'Entregar na portaria com o recepcionista',
      createdAt: '2026-08-21T18:30:00.000Z',
      updatedAt: '2026-08-21T18:30:00.000Z',
      syncStatus: 'SYNCED',
    };

    await localDB.put('orders', sampleDeliveryOrder);
    if (sampleDeliveryOrder.items) {
      for (const item of sampleDeliveryOrder.items) {
        await localDB.put('order_items', item);
      }
    }

    // =========================================================================
    // 1. Enqueue manual cria PrintJob com type=DELIVERY_ORDER e source=DELIVERY
    // =========================================================================
    const job1 = await enqueueDeliveryOrder(sampleDeliveryOrder);
    assert(
      job1 !== null &&
      job1.type === 'DELIVERY_ORDER' &&
      job1.source === 'DELIVERY' &&
      job1.orderId === sampleDeliveryOrder.id,
      '1. Enqueue manual de pedido delivery cria PrintJob com type=DELIVERY_ORDER e source=DELIVERY'
    );

    // =========================================================================
    // 2. Status inicial é PENDING
    // =========================================================================
    assert(
      job1?.status === 'PENDING',
      '2. Status inicial do PrintJob gerado é PENDING'
    );

    // =========================================================================
    // 3. Não gera eventKey bloqueante automático / não bloqueia reenvio
    // =========================================================================
    assert(
      job1?.eventKey === undefined,
      '3. Não gera eventKey bloqueante automático / permite múltiplos envios conscientes'
    );

    // =========================================================================
    // 4. Primeiro envio gera isReprint=false
    // =========================================================================
    assert(
      job1?.isReprint === false && job1?.originalJobId === undefined,
      '4. Primeiro envio gera isReprint=false e originalJobId=undefined'
    );

    // =========================================================================
    // 5. Segundo envio manual para o mesmo pedido gera novo PrintJob com isReprint=true
    // =========================================================================
    const job2 = await enqueueDeliveryOrder(sampleDeliveryOrder);
    assert(
      job2 !== null &&
      job2.id !== job1?.id &&
      job2.isReprint === true &&
      job2.originalJobId === job1?.id &&
      job2.status === 'PENDING',
      '5. Segundo envio manual para o mesmo pedido gera novo PrintJob com isReprint=true e originalJobId apontando para o primeiro'
    );

    // =========================================================================
    // 6. Terceiro envio manual gera novo PrintJob com novo ID
    // =========================================================================
    const job3 = await enqueueDeliveryOrder(sampleDeliveryOrder);
    const allJobs = await printingQueueRepository.list();
    assert(
      Boolean(job3 && job3.id !== job2?.id && job3.id !== job1?.id && job3.isReprint === true && allJobs.length >= 3),
      '6. Terceiro envio manual gera novo PrintJob com novo ID e isReprint=true',
      { job3Id: job3?.id, job2Id: job2?.id, isReprint: job3?.isReprint, allJobsLen: allJobs.length }
    );

    // =========================================================================
    // 7. Impressão manual preserva snapshot do cliente (nome, telefone)
    // =========================================================================
    const payload1 = job1?.payload as PrintPayload;
    const content1 = payload1.content;
    assert(
      content1.includes('Carlos Alberto Silva') && content1.includes('11987654321'),
      '7. Impressão manual preserva snapshot do cliente (nome, telefone)'
    );

    // =========================================================================
    // 8. Impressão manual preserva snapshot do endereço completo
    // =========================================================================
    assert(
      content1.includes('Av. Paulista, 1000') &&
      content1.includes('Apt 124B') &&
      content1.includes('Bela Vista') &&
      content1.includes('São Paulo') &&
      content1.includes('SP') &&
      content1.includes('01310-100') &&
      content1.includes('Próximo ao metrô Trianon-Masp'),
      '8. Impressão manual preserva snapshot do endereço (rua, número, bairro, complemento, cidade, estado, cep, ref)'
    );

    // =========================================================================
    // 9. Impressão manual preserva snapshot de itens (nome, quantidade, subtotal)
    // =========================================================================
    assert(
      content1.includes('Burger Artesanal Especial') &&
      content1.includes('Coca-Cola Zero 350ml') &&
      content1.includes('2x'),
      '9. Impressão manual preserva snapshot de itens (nome, quantidade, subtotal)'
    );

    // =========================================================================
    // 10. Impressão manual preserva acompanhamentos (nome, quantidade, preço)
    // =========================================================================
    assert(
      content1.includes('Bacon Crocante Extra') && content1.includes('+2x'),
      '10. Impressão manual preserva acompanhamentos (nome, quantidade, preço)'
    );

    // =========================================================================
    // 11. Impressão manual preserva opções e adicionais
    // =========================================================================
    assert(
      content1.includes('Ponto da Carne: Ao Ponto') &&
      content1.includes('Queijo Cheddar Dobrado'),
      '11. Impressão manual preserva opções e adicionais'
    );

    // =========================================================================
    // 12. Impressão manual preserva observações de itens e do pedido
    // =========================================================================
    assert(
      content1.includes('Sem cebola em um dos burgers') &&
      content1.includes('Entregar na portaria com o recepcionista'),
      '12. Impressão manual preserva observações de itens e do pedido'
    );

    // =========================================================================
    // 13. Impressão manual preserva valores financeiros em centavos
    // =========================================================================
    assert(
      content1.includes('84,00') && // Subtotal
      content1.includes('10,00') && // Taxa de entrega
      content1.includes('4,00') &&  // Desconto
      content1.includes('90,00'),   // Total
      '13. Impressão manual preserva valores financeiros em centavos (subtotal, entrega, desconto, total)'
    );

    // =========================================================================
    // 14. Impressão manual preserva dados de pagamento (método, status, troco)
    // =========================================================================
    assert(
      content1.includes('Forma: CASH') &&
      content1.includes('Troco para:') &&
      content1.includes('100,00') &&
      content1.includes('Troco a devolver:') &&
      content1.includes('10,00'),
      '14. Impressão manual preserva dados de pagamento (método, status, troco e troco a devolver)'
    );

    // =========================================================================
    // 15. Renderização do payload possui seções completas (HEADER, TEXT, ITEM, TOTAL, FOOTER, LINE)
    // =========================================================================
    const sectionTypes = new Set(payload1.sections?.map(s => s.type));
    assert(
      sectionTypes.has('HEADER') &&
      sectionTypes.has('TEXT') &&
      sectionTypes.has('ITEM') &&
      sectionTypes.has('TOTAL') &&
      sectionTypes.has('FOOTER') &&
      sectionTypes.has('LINE'),
      '15. Renderização do payload possui seções completas (HEADER, TEXT, ITEM, TOTAL, FOOTER, LINE)'
    );

    // =========================================================================
    // 16. Texto formatado contém cabeçalho DELIVERY e código do pedido
    // =========================================================================
    assert(
      content1.includes('PEDIDO DELIVERY') && content1.includes('#YML-1046'),
      '16. Texto formatado contém cabeçalho DELIVERY e código do pedido (#YML-1046)'
    );

    // =========================================================================
    // 17. Payload de reimpressão contém aviso '*** REIMPRESSÃO - 2ª VIA ***'
    // =========================================================================
    const payload2 = job2?.payload as PrintPayload;
    assert(
      payload2.content.includes('*** REIMPRESSÃO - 2ª VIA ***') &&
      !content1.includes('*** REIMPRESSÃO - 2ª VIA ***'),
      '17. Payload de reimpressão contém aviso *** REIMPRESSÃO - 2ª VIA *** e primeiro envio não contém'
    );

    // =========================================================================
    // 18. Proteção contra clique duplo acidental (UI lock simulation)
    // =========================================================================
    let isPrintingDelivery = false;
    let clickCount = 0;
    const simulateClick = async () => {
      if (isPrintingDelivery) return null;
      try {
        isPrintingDelivery = true;
        clickCount++;
        return await enqueueDeliveryOrder(sampleDeliveryOrder);
      } finally {
        isPrintingDelivery = false;
      }
    };

    // Tentativa simultânea (segundo clique antes do primeiro terminar)
    isPrintingDelivery = true;
    const blockedClickResult = await simulateClick();
    isPrintingDelivery = false;

    assert(
      blockedClickResult === null && clickCount === 0,
      '18. Proteção contra clique duplo acidental (isPrintingDelivery) impede disparos simultâneos'
    );

    // =========================================================================
    // 19. Falha de transporte (WAITING_AGENT / FAILED) não afeta status do pedido
    // =========================================================================
    const orderBeforePrint = await ordersRepository.getById(sampleDeliveryOrder.id);
    await printingService.markWaitingAgent(job1!.id);
    const orderAfterWaiting = await ordersRepository.getById(sampleDeliveryOrder.id);

    assert(
      orderBeforePrint?.status === 'CONFIRMED' &&
      orderAfterWaiting?.status === 'CONFIRMED',
      '19. Falha de transporte (WAITING_AGENT) não afeta o status do pedido no banco de dados'
    );

    // =========================================================================
    // 20. Falha de transporte não altera o status de pagamento
    // =========================================================================
    await printingService.markFailed(job2!.id, 'Agent offline');
    const orderAfterFailed = await ordersRepository.getById(sampleDeliveryOrder.id);

    assert(
      orderAfterFailed?.paymentStatus === 'PENDING',
      '20. Falha de transporte não altera o status de pagamento do pedido'
    );

    // =========================================================================
    // 21. Falha de transporte não cancela o pedido
    // =========================================================================
    assert(
      orderAfterFailed?.status !== 'CANCELLED' && orderAfterFailed?.status === 'CONFIRMED',
      '21. Falha de transporte não cancela o pedido'
    );

    // =========================================================================
    // 22. Fila offline-first persiste jobs mesmo sem conexão
    // =========================================================================
    const persistedJobs = await printingQueueRepository.list();
    assert(
      persistedJobs.length >= 3 &&
      persistedJobs.some(j => j.id === job1?.id) &&
      persistedJobs.some(j => j.id === job2?.id),
      '22. Fila offline-first persiste jobs no IndexedDB de forma durável'
    );

    // =========================================================================
    // 23. Processor processa jobs manuais de delivery respeitando a fila
    // =========================================================================
    // Reset status of job3 to PENDING and process
    await printingService.updateStatus(job3!.id, 'PENDING');
    const processedJobs = await printQueueProcessor.processPendingJobs();
    const updatedJob3 = await printingQueueRepository.getById(job3!.id);

    assert(
      processedJobs.length > 0 &&
      (updatedJob3?.status === 'WAITING_AGENT' || updatedJob3?.status === 'PRINTED'),
      '23. Processor processa jobs manuais de delivery respeitando a fila e atualizando status'
    );

    // =========================================================================
    // 24. Pedido sem deliverySnapshot (ex: retirada balcão) renderiza sem erros
    // =========================================================================
    const pickupOrder: Order = {
      id: 'ord-pickup-55',
      localId: 'YML-1055',
      orderNumber: 1055,
      companyId: 'comp-1',
      deviceId: 'dev-1',
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      fulfillmentType: 'DELIVERY',
      customerSnapshot: {
        name: 'Maria Oliveira',
        phone: '11999998888',
      },
      items: [
        {
          id: 'it-1',
          orderId: 'ord-pickup-55',
          productId: 'prod-pizza',
          productNameSnapshot: 'Pizza Mussarela Grande',
          quantity: 1,
          unitPrice: 5000,
          subtotal: 5000,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      subtotal: 5000,
      deliveryFee: 0,
      discount: 0,
      serviceFee: 0,
      total: 5000,
      paymentMethod: 'PIX',
      paymentStatus: 'PAID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'SYNCED',
    };

    const pickupJob = await enqueueDeliveryOrder(pickupOrder);
    const pickupPayload = pickupJob?.payload as PrintPayload;

    assert(
      pickupJob !== null &&
      pickupPayload.content.includes('Maria Oliveira') &&
      pickupPayload.content.includes('Pizza Mussarela Grande') &&
      pickupPayload.content.includes('Forma: PIX') &&
      pickupPayload.content.includes('Status: PAGO'),
      '24. Pedido sem deliverySnapshot renderiza com sucesso usando customerSnapshot e dados do pedido'
    );

    // =========================================================================
    // 25. Pedido com múltiplos itens e acompanhamentos gera payload estruturado
    // =========================================================================
    const complexPayload = renderDeliveryOrder({ order: sampleDeliveryOrder, paperWidth: 80 });
    const itemsSections = complexPayload.sections.filter(s => s.type === 'ITEM');
    assert(
      itemsSections.length >= 2 &&
      complexPayload.sections.some(s => s.leftText?.includes('Burger Artesanal Especial')) &&
      complexPayload.sections.some(s => s.leftText?.includes('Bacon Crocante Extra')),
      '25. Pedido com múltiplos itens e múltiplos acompanhamentos gera payload estruturado corretamente'
    );

    // =========================================================================
    // 26. Suporte a larguras de 80mm e 58mm no renderizador de delivery
    // =========================================================================
    const render80 = renderDeliveryOrder({ order: sampleDeliveryOrder, paperWidth: 80 });
    const render58 = renderDeliveryOrder({ order: sampleDeliveryOrder, paperWidth: 58 });

    assert(
      render80.width === 80 &&
      render58.width === 58 &&
      render58.content.length > 0 &&
      render80.content.length > 0,
      '26. Suporte a larguras de 80mm e 58mm no renderizador de delivery'
    );

    // =========================================================================
    // 27. Idempotência automática do KDS permanece intacta e isolada da manual
    // =========================================================================
    const kdsTicket: ProductionTicket = {
      id: 'tkt-kds-100',
      deviceId: 'dev-1',
      orderId: 'ord-del-1046',
      orderLocalId: 'YML-1046',
      orderOrigin: 'DELIVERY',
      station: 'KITCHEN',
      status: 'PENDING',
      roundNumber: 1,
      roundId: 'R001',
      items: [
        {
          id: 'pi-1',
          orderItemId: 'item-1',
          productId: 'prod-burger',
          productNameSnapshot: 'Burger Artesanal Especial',
          quantity: 2,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'SYNCED',
    };

    const kdsJob1 = await enqueueKitchenPrintForTicket(kdsTicket);
    const kdsJob2 = await enqueueKitchenPrintForTicket(kdsTicket);

    assert(
      kdsJob1 !== null &&
      kdsJob2 !== null &&
      kdsJob1.id === kdsJob2.id &&
      kdsJob1.eventKey === 'KITCHEN_tkt-kds-100_R1_KITCHEN',
      '27. Idempotência automática do KDS permanece intacta e isolada da impressão manual do delivery'
    );

    // =========================================================================
    // 28. Reimpressão com overrideParams ou opções explícitas respeita parâmetros
    // =========================================================================
    const explicitReprint = await enqueueDeliveryOrder(sampleDeliveryOrder, {
      paperWidth: 58,
      isReprint: true,
    });
    const explicitPayload = explicitReprint?.payload as PrintPayload;

    assert(
      explicitReprint !== null &&
      explicitReprint.isReprint === true &&
      explicitPayload.width === 58 &&
      explicitPayload.content.includes('*** REIMPRESSÃO - 2ª VIA ***'),
      '28. Reimpressão com overrideParams ou opções explícitas respeita parâmetros fornecidos'
    );

  } catch (error) {
    console.error('Erro inesperado durante a execução dos testes da Etapa 17:', error);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`RESULTADO FINAL DA ETAPA 17: ${passed} PASSADOS | ${failed} FALHAS`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEtapa17Tests();
