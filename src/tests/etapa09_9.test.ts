import 'fake-indexeddb/auto';
import { ordersRepository, cashRepository, syncQueueRepository, seedInitialDataIfNeeded } from '../services/storage';
import { confirmCatalogDeliveryPayment } from '../services/orderService';
import { calculateRegisterSummary } from '../services/cashService';
import { Order } from '../services/storage/types';

async function runTests() {
  console.log('=== INICIANDO BATERIA DE TESTES ETAPA 09.9 ===\n');
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

  // Inicializar DB com seed inicial
  await seedInitialDataIfNeeded();

  // Test 1: Rejeitar se pedido não existir
  try {
    await confirmCatalogDeliveryPayment({ orderId: 'non-existent-id', paymentMethod: 'CREDIT_CARD' });
    assert(false, '1. Rejeição de pedido inexistente');
  } catch (err: any) {
    assert(err.message.includes('não encontrado'), '1. Rejeição de pedido inexistente');
  }

  // Fechar qualquer caixa que veio do seed para testar bloqueio com caixa fechado
  const seedReg = await cashRepository.getOpenRegister();
  if (seedReg) {
    await cashRepository.close(seedReg.id, seedReg.openingAmount, 'usr-1');
  }

  // Test 2: Bloquear se caixa estiver fechado
  const order1Created = await ordersRepository.create({
    orderNumber: 101,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'OUT_FOR_DELIVERY',
    paymentStatus: 'PENDING',
    paymentMethod: 'CASH',
    subtotal: 5000,
    deliveryFee: 500,
    discount: 0,
    total: 5500,
    items: [],
    customerSnapshot: { name: 'Cliente 1', phone: '11999999999' }
  });

  try {
    await confirmCatalogDeliveryPayment({ orderId: order1Created.id, paymentMethod: 'CASH' });
    assert(false, '2. Bloqueio com caixa fechado');
  } catch (err: any) {
    assert(err.message.includes('Caixa aberto') || err.message.includes('não existe um Caixa aberto'), '2. Bloqueio com caixa fechado: ' + err.message);
  }

  // Test 3: Abrir Caixa
  const openedReg = await cashRepository.open(10000, 'usr-1', 'dev-1', { userName: 'Operador Teste' });
  const openReg = await cashRepository.getOpenRegister();
  assert(openReg?.id === openedReg.id, '3. Abertura do Caixa com sucesso');

  // Test 4: Confirmação com sucesso de pedido DELIVERY CATALOG
  const result1 = await confirmCatalogDeliveryPayment({
    orderId: order1Created.id,
    paymentMethod: 'CASH',
    receivedAmountCents: 6000
  });
  assert(result1.order.paymentStatus === 'PAID', '4. Status de pagamento atualizado para PAID');
  assert(result1.order.paymentMethod === 'CASH', '5. Método de pagamento registrado como CASH');
  assert(result1.order.changeFor === 6000, '6. Troco solicitado preservado (6000 centavos)');
  assert(result1.changeDueCents === 500, '7. Troco a devolver calculado com precisão (500 centavos / R$ 5,00)');
  assert(result1.order.status === 'OUT_FOR_DELIVERY', '8. Status operacional PRESERVADO (OUT_FOR_DELIVERY)');

  // Test 9: Movimentação de caixa registrada
  const updatedReg = await cashRepository.getOpenRegister();
  const movements = await cashRepository.getMovements(updatedReg!.id);
  const movement1 = movements.find(m => m.orderId === order1Created.id);
  assert(movement1 !== undefined, '9. Movimentação SALE registrada no caixa');
  assert(movement1?.amount === 5500, '10. Valor da movimentação em centavos exatos (5500)');
  assert(movement1?.type === 'SALE', '11. Tipo de movimentação é SALE');
  assert(movement1?.paymentMethod === 'CASH', '12. Método da movimentação no caixa é CASH');

  // Test 13: Idempotência - Chamar novamente não duplica movimentação
  const resultIdempotent = await confirmCatalogDeliveryPayment({
    orderId: order1Created.id,
    paymentMethod: 'CASH'
  });
  assert(resultIdempotent.order.paymentStatus === 'PAID', '13. Idempotência: Retorno seguro para pedido já pago');
  assert(resultIdempotent.cashMovementCreated === false, '14. Idempotência: cashMovementCreated é false');
  const movementsAfterIdempotent = await cashRepository.getMovements(updatedReg!.id);
  const matchingMovements = movementsAfterIdempotent.filter(m => m.orderId === order1Created.id);
  assert(matchingMovements.length === 1, '15. Idempotência: Nenhuma movimentação duplicada criada no caixa');

  // Test 16: Rejeição de pedido cancelado
  const cancelledOrderCreated = await ordersRepository.create({
    orderNumber: 102,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'CANCELLED',
    paymentStatus: 'PENDING',
    paymentMethod: 'PIX',
    subtotal: 3000,
    deliveryFee: 0,
    discount: 0,
    total: 3000,
    items: []
  });
  try {
    await confirmCatalogDeliveryPayment({ orderId: cancelledOrderCreated.id, paymentMethod: 'PIX' });
    assert(false, '16. Rejeição de pedido cancelado');
  } catch (err: any) {
    assert(err.message.includes('cancelado'), '16. Rejeição de pedido cancelado: ' + err.message);
  }

  // Test 17: Pagamento via PIX
  const pixOrderCreated = await ordersRepository.create({
    orderNumber: 103,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'DELIVERED',
    paymentStatus: 'PENDING',
    paymentMethod: 'PIX',
    subtotal: 4500,
    deliveryFee: 500,
    discount: 0,
    total: 5000,
    items: []
  });
  const pixResult = await confirmCatalogDeliveryPayment({ orderId: pixOrderCreated.id, paymentMethod: 'PIX' });
  assert(pixResult.order.paymentStatus === 'PAID', '17. Pagamento PIX confirmado com sucesso');
  assert(pixResult.order.paymentMethod === 'PIX', '18. Método PIX registrado');

  // Test 19: Pagamento via Cartão de Débito
  const debitOrderCreated = await ordersRepository.create({
    orderNumber: 104,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'PREPARING',
    paymentStatus: 'PENDING',
    paymentMethod: 'DEBIT_CARD',
    subtotal: 8000,
    deliveryFee: 1000,
    discount: 500,
    total: 8500,
    items: []
  });
  const debitResult = await confirmCatalogDeliveryPayment({ orderId: debitOrderCreated.id, paymentMethod: 'DEBIT_CARD' });
  assert(debitResult.order.paymentStatus === 'PAID', '19. Pagamento Débito confirmado');
  assert(debitResult.order.status === 'PREPARING', '20. Status operacional PREPARING mantido intacto');

  // Test 21: Pagamento via Cartão de Crédito
  const creditOrderCreated = await ordersRepository.create({
    orderNumber: 105,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'READY',
    paymentStatus: 'PENDING',
    paymentMethod: 'CREDIT_CARD',
    subtotal: 12000,
    deliveryFee: 0,
    discount: 0,
    total: 12000,
    items: []
  });
  const creditResult = await confirmCatalogDeliveryPayment({ orderId: creditOrderCreated.id, paymentMethod: 'CREDIT_CARD' });
  assert(creditResult.order.paymentStatus === 'PAID', '21. Pagamento Crédito confirmado');
  assert(creditResult.order.status === 'READY', '22. Status operacional READY mantido');

  // Test 23: Rejeição de valor recebido menor que o total do pedido em CASH
  const invalidChangeOrderCreated = await ordersRepository.create({
    orderNumber: 106,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'OUT_FOR_DELIVERY',
    paymentStatus: 'PENDING',
    paymentMethod: 'CASH',
    subtotal: 5000,
    deliveryFee: 0,
    discount: 0,
    total: 5000,
    items: []
  });
  try {
    await confirmCatalogDeliveryPayment({
      orderId: invalidChangeOrderCreated.id,
      paymentMethod: 'CASH',
      receivedAmountCents: 4000 // 4000 < 5000
    });
    assert(false, '23. Rejeição de troco menor que o valor total');
  } catch (err: any) {
    assert(err.message.includes('inferior ao total'), '23. Rejeição de troco menor que o valor total: ' + err.message);
  }

  // Test 24: Cálculo correto do Resumo do Caixa (calculateRegisterSummary)
  const currentReg = await cashRepository.getOpenRegister();
  if (currentReg) {
    const movements = await cashRepository.getMovements(currentReg.id);
    const summary = calculateRegisterSummary(currentReg, movements);
    // Vendas: ord-test-1 (5500 CASH) + ord-test-pix (5000 PIX) + ord-test-debit (8500 DEBIT) + ord-test-credit (12000 CREDIT) = 31000
    assert(summary.salesTotal === 31000, '24. Total de vendas no resumo do Caixa = R$ 310,00 (31000 centavos)', summary.salesTotal);
    assert(summary.salesByMethod.CASH.amount === 5500, '25. Vendas em Dinheiro = 5500 centavos', summary.salesByMethod.CASH.amount);
    assert(summary.salesByMethod.PIX.amount === 5000, '26. Vendas em PIX = 5000 centavos', summary.salesByMethod.PIX.amount);
    assert(summary.salesByMethod.DEBIT_CARD.amount === 8500, '27. Vendas em Débito = 8500 centavos', summary.salesByMethod.DEBIT_CARD.amount);
    assert(summary.salesByMethod.CREDIT_CARD.amount === 12000, '28. Vendas em Crédito = 12000 centavos', summary.salesByMethod.CREDIT_CARD.amount);
    // Saldo esperado em dinheiro = openingAmount (10000) + cashSales (5500) = 15500
    assert(summary.expectedPhysicalCash === 15500, '29. Saldo esperado em dinheiro = R$ 155,00 (15500 centavos)', summary.expectedPhysicalCash);
  } else {
    assert(false, '24-29. Falha ao obter caixa para resumo');
  }

  // Test 30: Validação do Transactional Outbox (sync_queue)
  const pendingQueue = await syncQueueRepository.getPending();
  const orderSyncItems = pendingQueue.filter(q => q.entity === 'order');
  const cashSyncItems = pendingQueue.filter(q => q.entity === 'cash_movement' || q.entity === 'cash_register');
  assert(orderSyncItems.length > 0, '30. Eventos de pedidos no outbox (sync_queue)');
  assert(cashSyncItems.length > 0, '31. Eventos de caixa no outbox (sync_queue)');

  // Test 32: Conclusão opcional do pedido junto com o pagamento (completeOrderAfterPayment)
  const completeWithPayOrderCreated = await ordersRepository.create({
    orderNumber: 107,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'DELIVERED',
    paymentStatus: 'PENDING',
    paymentMethod: 'PIX',
    subtotal: 4000,
    deliveryFee: 0,
    discount: 0,
    total: 4000,
    items: []
  });
  const completeResult = await confirmCatalogDeliveryPayment({
    orderId: completeWithPayOrderCreated.id,
    paymentMethod: 'PIX',
    completeOrderAfterPayment: true
  });
  assert(completeResult.order.paymentStatus === 'PAID', '32. Pagamento confirmado com sucesso');
  assert(completeResult.order.status === 'COMPLETED', '33. Pedido concluído (COMPLETED) com completeOrderAfterPayment');
  assert(completeResult.order.completedAt !== undefined, '34. completedAt preenchido');

  // Test 35: Pedido já COMPLETED recebe pagamento confirmado sem quebrar
  const completedUnpaidOrderCreated = await ordersRepository.create({
    orderNumber: 108,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'COMPLETED',
    paymentStatus: 'PENDING',
    paymentMethod: 'CREDIT_CARD',
    subtotal: 9000,
    deliveryFee: 0,
    discount: 0,
    total: 9000,
    items: []
  });
  const completedPaidResult = await confirmCatalogDeliveryPayment({
    orderId: completedUnpaidOrderCreated.id,
    paymentMethod: 'CREDIT_CARD'
  });
  assert(completedPaidResult.order.paymentStatus === 'PAID', '35. Pedido COMPLETED recebe pagamento confirmado');
  assert(completedPaidResult.order.status === 'COMPLETED', '36. Status COMPLETED mantido');

  // Test 37: Inclusão de observação financeira
  const obsOrderCreated = await ordersRepository.create({
    orderNumber: 109,
    origin: 'CATALOG',
    fulfillmentType: 'DELIVERY',
    status: 'OUT_FOR_DELIVERY',
    paymentStatus: 'PENDING',
    paymentMethod: 'PIX',
    notes: 'Entregar na portaria',
    subtotal: 3500,
    deliveryFee: 0,
    discount: 0,
    total: 3500,
    items: []
  });
  const obsResult = await confirmCatalogDeliveryPayment({
    orderId: obsOrderCreated.id,
    paymentMethod: 'PIX',
    notes: 'Comprovante 89412'
  });
  assert(obsResult.order.notes?.includes('Comprovante 89412'), '37. Observação de pagamento anexada com segurança ao pedido');

  console.log(`\n========================================`);
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('ERRO FATAL NOS TESTES:', err);
  process.exit(1);
});
