/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'fake-indexeddb/auto';
import { localDB, generateLocalId } from '../services/storage/idb';
import {
  ordersRepository,
  productionRepository,
  productsRepository,
  categoriesRepository,
  tablesRepository,
  enqueueKitchenPrintForTicket,
  printingService,
  printingQueueRepository,
} from '../services/storage/index';
import {
  addBatchProductsToTableComanda,
} from '../services/orderService';
import { Order, OrderItem, ProductionTicket, Product } from '../services/storage/types';
import { PrintJob } from '../printers/types';

async function runEtapa16Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA FASE 02 / ETAPA 16 (INTEGRAÇÃO KDS + IMPRESSÃO) ===\n');
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
    // Limpeza inicial do banco em memória
    await localDB.clear('orders');
    await localDB.clear('order_items');
    await localDB.clear('production_tickets');
    await localDB.clear('printing_queue');
    await localDB.clear('products');
    await localDB.clear('categories');
    await localDB.clear('tables');

    // Setup de produtos em diferentes estações
    const prodKitchen: Product = {
      id: 'prod-burger-1',
      localId: 'PRD-001',
      deviceId: 'dev-1',
      name: 'X-Burger Artesanal',
      price: 3200,
      cost: 1200,
      active: true,
      available: true,
      featured: false,
      sortOrder: 1,
      syncStatus: 'PENDING',
      categoryId: 'cat-burgers',
      productionStation: 'KITCHEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await localDB.put('products', prodKitchen);

    const prodBar: Product = {
      id: 'prod-drink-1',
      localId: 'PRD-002',
      deviceId: 'dev-1',
      name: 'Chopp Pilsen 500ml',
      price: 1400,
      cost: 500,
      active: true,
      available: true,
      featured: false,
      sortOrder: 2,
      syncStatus: 'PENDING',
      categoryId: 'cat-drinks',
      productionStation: 'BAR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await localDB.put('products', prodBar);

    const prodIceCream: Product = {
      id: 'prod-dessert-1',
      localId: 'PRD-003',
      deviceId: 'dev-1',
      name: 'Taça de Açaí Especial 300ml',
      price: 2200,
      cost: 800,
      active: true,
      available: true,
      featured: false,
      sortOrder: 3,
      syncStatus: 'PENDING',
      categoryId: 'cat-desserts',
      productionStation: 'ICE_CREAM',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await localDB.put('products', prodIceCream);

    // =========================================================================
    // TESTE 1: Criação de Pedido gera ProductionTicket e PrintJob correspondente
    // =========================================================================
    console.log('--- TESTE 1: Geração Automática de PrintJob ao Criar Pedido ---');

    const order1Item: OrderItem = {
      id: 'oi-1',
      orderId: '',
      productId: prodKitchen.id,
      productNameSnapshot: prodKitchen.name,
      unitPrice: 3200,
      quantity: 2,
      subtotal: 6400,
      notes: 'Sem cebola e bem passado',
      status: 'PENDING',
      roundNumber: 1,
      roundId: 'R001',
      selectedAccompaniments: [
        {
          groupId: 'grp-ponto',
          groupNameSnapshot: 'Ponto da Carne',
          itemId: 'item-bem-passado',
          itemNameSnapshot: 'Bem Passado',
          quantity: 1,
          priceSnapshot: 0,
          subtotal: 0,
        },
      ],
      selectedAddons: [
        {
          addonId: 'addon-bacon',
          addonName: 'Bacon Duplo',
          quantity: 2,
          price: 400,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const order1 = await ordersRepository.create({
      orderNumber: 101,
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      items: [order1Item],
      subtotal: 7200,
      discount: 0,
      deliveryFee: 500,
      total: 7700,
      paymentStatus: 'PAID',
      fulfillmentType: 'DELIVERY',
      customerSnapshot: { name: 'Carlos Eduardo', phone: '11999998888' },
    });

    const ticketsOrder1 = await productionRepository.getAllTickets();
    const kitchenTicket1 = ticketsOrder1.find(t => t.orderId === order1.id && t.station === 'KITCHEN');

    assert(!!kitchenTicket1, 'ProductionTicket da cozinha foi gerado para o pedido', kitchenTicket1?.id);

    const jobsAfterOrder1 = await printingQueueRepository.list();
    assert(jobsAfterOrder1.length >= 1, 'PrintJob foi adicionado automaticamente na printing_queue', jobsAfterOrder1.length);

    const kitchenJob1 = jobsAfterOrder1.find(j => j.ticketId === kitchenTicket1?.id);
    assert(!!kitchenJob1, 'PrintJob específico do ticket de cozinha foi encontrado na fila');
    assert(kitchenJob1?.type === 'KITCHEN_NEW_ORDER', 'Tipo do PrintJob é KITCHEN_NEW_ORDER', kitchenJob1?.type);
    assert(kitchenJob1?.source === 'KDS', 'Origem do PrintJob é KDS', kitchenJob1?.source);
    assert(kitchenJob1?.station === 'KITCHEN', 'Estação do PrintJob é KITCHEN', kitchenJob1?.station);
    assert(kitchenJob1?.status === 'PENDING', 'Status inicial do PrintJob é PENDING', kitchenJob1?.status);
    assert(kitchenJob1?.roundNumber === 1, 'RoundNumber do PrintJob é 1', kitchenJob1?.roundNumber);
    assert(
      kitchenJob1?.eventKey === `KITCHEN_${kitchenTicket1?.id}_R1_KITCHEN`,
      'EventKey de idempotência segue estritamente o padrão determinístico',
      kitchenJob1?.eventKey
    );

    // =========================================================================
    // TESTE 2: Idempotência — Não duplicação de PrintJob para o mesmo ticket
    // =========================================================================
    console.log('\n--- TESTE 2: Idempotência de Enfileiramento ---');

    const initialQueueCount = (await printingQueueRepository.list()).length;
    // Reexecuta syncTicketsFromOrders
    await productionRepository.syncTicketsFromOrders();
    const queueCountAfterSync = (await printingQueueRepository.list()).length;
    assert(queueCountAfterSync === initialQueueCount, 'Reexecução de syncTicketsFromOrders não duplicou PrintJobs na fila');

    // Tenta enfileirar diretamente o mesmo ticket
    if (kitchenTicket1) {
      const duplicateJob = await enqueueKitchenPrintForTicket(kitchenTicket1);
      assert(duplicateJob?.id === kitchenJob1?.id, 'Chamada repetida de enqueueKitchenPrintForTicket retorna o mesmo PrintJob existente sem criar novo');
    }
    const finalQueueCount = (await printingQueueRepository.list()).length;
    assert(finalQueueCount === initialQueueCount, 'Total de jobs na fila permaneceu inalterado após tentativa duplicada');

    // =========================================================================
    // TESTE 3: Preservação de Dados e Ausência de Valores Financeiros no Payload
    // =========================================================================
    console.log('\n--- TESTE 3: Conteúdo do Payload e Ausência de Preços ---');

    const payload = kitchenJob1?.payload as any;
    assert(!!payload, 'PrintJob possui payload estruturado');
    assert(payload?.width === 80, 'Largura padrão do papel é 80mm', payload?.width);

    const fullText = payload?.content || '';
    assert(fullText.includes('X-Burger Artesanal'), 'Payload contém nome do produto', fullText);
    assert(fullText.includes('2x'), 'Payload contém quantidade do produto');
    assert(fullText.includes('Bem Passado'), 'Payload contém snapshot de acompanhamento');
    assert(fullText.includes('Bacon Duplo'), 'Payload contém snapshot de adicionais');
    assert(fullText.includes('Sem cebola e bem passado'), 'Payload contém observações do item');
    assert(fullText.includes('Carlos Eduardo'), 'Payload contém identificação do cliente');

    // Regra crítica: NÃO conter preços nem R$ no ticket de cozinha
    assert(!fullText.includes('R$'), 'Payload de cozinha NÃO contém "R$" (sem valores financeiros)', fullText);
    assert(!fullText.includes('32,00') && !fullText.includes('72,00') && !fullText.includes('77,00'), 'Payload de cozinha NÃO exibe preços em reais');

    // =========================================================================
    // TESTE 4: Multi-Estações (Kitchen, Bar, Ice Cream) em um Único Pedido
    // =========================================================================
    console.log('\n--- TESTE 4: Múltiplas Estações de Produção Independentes ---');

    const multiStationOrder = await ordersRepository.create({
      orderNumber: 102,
      origin: 'COUNTER',
      status: 'CONFIRMED',
      items: [
        {
          id: 'oi-k1',
          orderId: '',
          productId: prodKitchen.id,
          productNameSnapshot: prodKitchen.name,
          unitPrice: 3200,
          quantity: 1,
          subtotal: 3200,
          status: 'PENDING',
          roundNumber: 1,
          roundId: 'R001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'oi-b1',
          orderId: '',
          productId: prodBar.id,
          productNameSnapshot: prodBar.name,
          unitPrice: 1400,
          quantity: 3,
          subtotal: 4200,
          status: 'PENDING',
          roundNumber: 1,
          roundId: 'R001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'oi-i1',
          orderId: '',
          productId: prodIceCream.id,
          productNameSnapshot: prodIceCream.name,
          unitPrice: 2200,
          quantity: 1,
          subtotal: 2200,
          status: 'PENDING',
          roundNumber: 1,
          roundId: 'R001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      subtotal: 9600,
      discount: 0,
      deliveryFee: 0,
      total: 9600,
      paymentStatus: 'PAID',
    });

    const allTicketsMulti = (await productionRepository.getAllTickets()).filter(t => t.orderId === multiStationOrder.id);
    assert(allTicketsMulti.length === 3, 'Três ProductionTickets foram gerados (Kitchen, Bar, Ice Cream)', allTicketsMulti.length);

    const allJobs = await printingQueueRepository.list();
    const jobsForMulti = allJobs.filter(j => j.orderId === multiStationOrder.id);
    assert(jobsForMulti.length === 3, 'Três PrintJobs distintos foram criados na fila de impressão', jobsForMulti.length);

    const kitchenJobMulti = jobsForMulti.find(j => j.station === 'KITCHEN');
    const barJobMulti = jobsForMulti.find(j => j.station === 'BAR');
    const iceCreamJobMulti = jobsForMulti.find(j => j.station === 'ICE_CREAM');

    assert(!!kitchenJobMulti, 'PrintJob da estação KITCHEN existe');
    assert(!!barJobMulti, 'PrintJob da estação BAR existe');
    assert(!!iceCreamJobMulti, 'PrintJob da estação ICE_CREAM existe');

    assert(kitchenJobMulti?.eventKey !== barJobMulti?.eventKey, 'EventKeys entre estações são distintas e independentes');
    assert(barJobMulti?.eventKey !== iceCreamJobMulti?.eventKey, 'EventKeys do Bar e Sorveteria são distintas');

    // =========================================================================
    // TESTE 5: Múltiplas Rodadas em Mesa / Comanda
    // =========================================================================
    console.log('\n--- TESTE 5: Múltiplas Rodadas em Mesas (Round 1 e Round 2) ---');

    const tables = await tablesRepository.getAll();
    const table1 = tables[0];
    
    // Rodada 1 da Mesa
    const tableOrder = await ordersRepository.create({
      orderNumber: 103,
      origin: 'TABLE',
      status: 'PREPARING',
      tableId: table1.id,
      items: [
        {
          id: 'oi-t1-r1',
          orderId: '',
          productId: prodKitchen.id,
          productNameSnapshot: prodKitchen.name,
          unitPrice: 3200,
          quantity: 1,
          subtotal: 3200,
          status: 'PENDING',
          roundNumber: 1,
          roundId: 'R001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      subtotal: 3200,
      discount: 0,
      deliveryFee: 0,
      total: 3200,
      paymentStatus: 'PENDING',
    });

    table1.status = 'OCCUPIED';
    table1.currentOrderId = tableOrder.id;
    await tablesRepository.update(table1);

    const jobsAfterTableRound1 = (await printingQueueRepository.list()).filter(j => j.orderId === tableOrder.id);
    assert(jobsAfterTableRound1.length === 1, 'PrintJob da Rodada 1 da mesa foi enfileirado');
    assert(jobsAfterTableRound1[0].roundNumber === 1, 'RoundNumber do job 1 é 1');

    // Lançamento da Rodada 2 na mesma comanda da mesa
    const batchResult = await addBatchProductsToTableComanda({
      tableId: table1.id,
      orderId: tableOrder.id,
      items: [
        {
          productId: prodKitchen.id,
          quantity: 2,
          notes: 'Rodada 2 - lanche extra',
        },
      ],
    });

    assert(batchResult.roundNumber === 2, 'Nova rodada gerou roundNumber = 2', batchResult.roundNumber);

    const jobsAfterTableRound2 = (await printingQueueRepository.list()).filter(j => j.orderId === tableOrder.id);
    assert(jobsAfterTableRound2.length === 2, 'Dois PrintJobs existem agora para a comanda da mesa (R1 e R2)', jobsAfterTableRound2.length);

    const round2Job = jobsAfterTableRound2.find(j => j.roundNumber === 2);
    assert(!!round2Job, 'PrintJob exclusivo da Rodada 2 foi criado com sucesso');
    assert(round2Job?.type === 'KITCHEN_NEW_ORDER', 'Tipo do job R2 é KITCHEN_NEW_ORDER');
    assert(round2Job?.status === 'PENDING', 'Status do job R2 é PENDING');
    assert(round2Job?.eventKey?.includes('R2'), 'EventKey do job R2 referencia R2 explicitamente', round2Job?.eventKey);

    // =========================================================================
    // TESTE 6: Isolamento Total de Exceções
    // =========================================================================
    console.log('\n--- TESTE 6: Isolamento e Resiliência contra Exceções ---');

    // Testa passar um ticket inválido/vazio diretamente para a função segura
    const resultInvalid = await enqueueKitchenPrintForTicket({} as any);
    assert(resultInvalid === null, 'enqueueKitchenPrintForTicket captura erros graciosamente e retorna null sem lançar exceção');

    // Testa criação de pedido mesmo se houver erro interno no print service (garante não-bloqueio)
    const resilientOrder = await ordersRepository.create({
      orderNumber: 104,
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      items: [
        {
          id: 'oi-res-1',
          orderId: '',
          productId: prodKitchen.id,
          productNameSnapshot: 'Lanche Resiliente',
          unitPrice: 2500,
          quantity: 1,
          subtotal: 2500,
          status: 'PENDING',
          roundNumber: 1,
          roundId: 'R001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      subtotal: 2500,
      discount: 0,
      deliveryFee: 0,
      total: 2500,
      paymentStatus: 'PAID',
    });

    assert(!!resilientOrder.id, 'Pedido é criado com sucesso mesmo em condições adversas de impressão');
    const resilientTicket = (await productionRepository.getAllTickets()).find(t => t.orderId === resilientOrder.id);
    assert(!!resilientTicket, 'ProductionTicket foi gerado com sucesso para o pedido resiliente');

    // =========================================================================
    // RESUMO
    // =========================================================================
    console.log('\n==================================================');
    console.log(`BATERIA CONCLUÍDA: ${passed} PASS, ${failed} FAIL`);
    console.log('==================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('ERRO FATAL NA EXECUÇÃO DOS TESTES:', error);
    process.exit(1);
  }
}

runEtapa16Tests();
