import {
  renderKitchenTicket,
  renderDeliveryOrder,
  renderOrderCopy,
  renderCashReceipt,
  renderCashMovement,
  renderCashRegisterClosing,
  formatCentsToBRL,
} from '../printers';
import { ProductionTicket, Order, CashMovement, CashRegister } from '../services/storage/types';

async function runEtapa14Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA ETAPA 14 ===\n');
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
    // Mock Base Objects
    const simpleTicket: ProductionTicket = {
      id: 'ticket-1',
      orderId: 'ord-100',
      orderLocalId: 'YML-1001',
      orderOrigin: 'COUNTER',
      station: 'KITCHEN',
      roundNumber: 1,
      roundId: 'R001',
      status: 'PENDING',
      syncStatus: 'SYNCED',
      deviceId: 'dev-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          orderItemId: 'oi-1',
          productId: 'p-1',
          productNameSnapshot: 'X-Burguer Clássico',
          quantity: 1,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // TESTE 01: Kitchen Renderer com produto simples
    const k1 = renderKitchenTicket({ ticket: simpleTicket, paperWidth: 80 });
    assert(k1.content?.includes('X-Burguer Clássico') === true, 'TESTE 01a. Renderiza nome do produto simples');
    assert(k1.content?.includes('#YML-1001') === true, 'TESTE 01b. Renderiza número do pedido');

    // TESTE 02: Kitchen Renderer com acompanhamentos
    const ticketWithAcc: ProductionTicket = {
      ...simpleTicket,
      items: [
        {
          ...simpleTicket.items[0],
          selectedAccompaniments: [
            {
              groupId: 'g-1',
              groupNameSnapshot: 'Turbine',
              itemId: 'ai-1',
              itemNameSnapshot: 'Mussarela Extra',
              priceSnapshot: 350,
              quantity: 1,
              subtotal: 350,
            },
          ],
        },
      ],
    };
    const k2 = renderKitchenTicket({ ticket: ticketWithAcc, paperWidth: 80 });
    assert(k2.content?.includes('+1x Mussarela Extra') === true, 'TESTE 02. Renderiza acompanhamento na cozinha');

    // TESTE 03: Kitchen Renderer com opções e adicionais
    const ticketWithOptAdd: ProductionTicket = {
      ...simpleTicket,
      items: [
        {
          ...simpleTicket.items[0],
          selectedOptions: [
            {
              optionId: 'opt-1',
              optionName: 'Ponto',
              choiceId: 'ch-1',
              choiceName: 'Ao Ponto',
              additionalPrice: 0,
            },
          ],
          selectedAddons: [
            {
              addonId: 'add-1',
              addonName: 'Bacon Crocante',
              price: 400,
              quantity: 1,
            },
          ],
        },
      ],
    };
    const k3 = renderKitchenTicket({ ticket: ticketWithOptAdd });
    assert(k3.content?.includes('Opção: Ponto: Ao Ponto') === true, 'TESTE 03a. Renderiza opção na cozinha');
    assert(k3.content?.includes('+1x Bacon Crocante') === true, 'TESTE 03b. Renderiza adicional na cozinha');

    // TESTE 04: Kitchen Renderer NÃO exibe preços
    assert(!k3.content?.includes('R$') && !k2.content?.includes('R$'), 'TESTE 04. Cozinha NÃO exibe cifrão / preços');

    // Base Order for Delivery / Order
    const deliveryOrder: Order = {
      id: 'ord-200',
      localId: 'YML-2002',
      orderNumber: 2002,
      companyId: 'comp-1',
      deviceId: 'dev-1',
      origin: 'DELIVERY',
      status: 'CONFIRMED',
      syncStatus: 'SYNCED',
      fulfillmentType: 'DELIVERY',
      subtotal: 3500,
      discount: 0,
      serviceFee: 0,
      deliveryFee: 700,
      total: 4200,
      paymentStatus: 'PAID',
      paymentMethod: 'PIX',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerSnapshot: {
        name: 'Jonh Quadros',
        phone: '(91) 99999-8888',
      },
      deliverySnapshot: {
        address: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        complement: 'Apt 101',
        reference: 'Próximo à praça',
        city: 'Belém',
        state: 'PA',
        postalCode: '66000-000',
        deliveryFee: 700,
        status: 'PENDING',
      },
      items: [
        {
          id: 'oi-10',
          orderId: 'ord-200',
          productId: 'prod-10',
          productNameSnapshot: 'Pizza Margherita',
          unitPrice: 3500,
          quantity: 1,
          subtotal: 3500,
          status: 'PREPARING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    // TESTE 05: Delivery Renderer com cliente
    const d5 = renderDeliveryOrder({ order: deliveryOrder });
    assert(d5.content?.includes('Jonh Quadros') === true, 'TESTE 05a. Renderiza nome do cliente');
    assert(d5.content?.includes('(91) 99999-8888') === true, 'TESTE 05b. Renderiza telefone do cliente');

    // TESTE 06: Delivery Renderer com endereço completo
    assert(d5.content?.includes('Rua das Flores, 123') === true, 'TESTE 06a. Renderiza rua e número');
    assert(d5.content?.includes('Centro') === true, 'TESTE 06b. Renderiza bairro');
    assert(d5.content?.includes('Apt 101') === true, 'TESTE 06c. Renderiza complemento');
    assert(d5.content?.includes('Próximo à praça') === true, 'TESTE 06d. Renderiza ponto de referência');

    // TESTE 07: Delivery Renderer com acompanhamentos e preços
    const deliveryOrderWithAcc: Order = {
      ...deliveryOrder,
      items: [
        {
          ...deliveryOrder.items[0],
          selectedAccompaniments: [
            {
              groupId: 'g-1',
              groupNameSnapshot: 'Borda',
              itemId: 'ai-2',
              itemNameSnapshot: 'Borda de Catupiry',
              priceSnapshot: 800,
              quantity: 1,
              subtotal: 800,
            },
          ],
        },
      ],
    };
    const d7 = renderDeliveryOrder({ order: deliveryOrderWithAcc });
    assert(d7.content?.includes('Borda de Catupiry') === true, 'TESTE 07a. Renderiza nome do acompanhamento no Delivery');
    assert(d7.content?.includes('R$ 8,00') === true, 'TESTE 07b. Renderiza preço do acompanhamento em BRL');

    // TESTE 08: Delivery Renderer com taxa de entrega
    assert(d7.content?.includes('Taxa de Entrega:') === true && d7.content?.includes('R$ 7,00') === true, 'TESTE 08. Renderiza taxa de entrega');

    // TESTE 09: Delivery Renderer com pagamento
    assert(d7.content?.includes('Forma: PIX') === true, 'TESTE 09a. Renderiza forma de pagamento PIX');
    assert(d7.content?.includes('Status: PAGO') === true, 'TESTE 09b. Renderiza status de pagamento PAGO');

    // TESTE 10: Order Renderer com pedido de Mesa
    const tableOrder: Order = {
      ...deliveryOrder,
      origin: 'TABLE',
      tableId: 'tbl-5',
      fulfillmentType: undefined,
      deliverySnapshot: undefined,
    };
    const o10 = renderOrderCopy({ order: tableOrder });
    assert(o10.content?.includes('Origem: TABLE') === true, 'TESTE 10a. Renderiza origem TABLE');
    assert(o10.content?.includes('Mesa ID: tbl-5') === true, 'TESTE 10b. Renderiza identificação de Mesa');

    // TESTE 11: Order Renderer com pedido Delivery
    const o11 = renderOrderCopy({ order: deliveryOrder });
    assert(o11.content?.includes('Origem: DELIVERY') === true, 'TESTE 11. Renderiza origem DELIVERY no Order Renderer');

    // TESTE 12: Order Renderer com acompanhamentos
    const o12 = renderOrderCopy({ order: deliveryOrderWithAcc });
    assert(o12.content?.includes('Borda de Catupiry') === true && o12.content?.includes('R$ 8,00') === true, 'TESTE 12. Order Renderer exibe acompanhamentos e valores');

    // TESTE 13: Cash Renderer com valores financeiros
    const c13 = renderCashReceipt({
      orderLocalId: 'YML-2002',
      totalCents: 4200,
      paidAmountCents: 5000,
      paymentMethod: 'CASH',
      changeCents: 800,
    });
    assert(c13.content?.includes('Valor Total:') === true && c13.content?.includes('R$ 42,00') === true, 'TESTE 13a. Cash receipt exibe total em R$ 42,00');
    assert(c13.content?.includes('Troco a devolver:') === true && c13.content?.includes('R$ 8,00') === true, 'TESTE 13b. Cash receipt exibe troco em R$ 8,00');

    // TESTE 14: Formatação correta de centavos
    assert(formatCentsToBRL(2) === 'R$ 0,02', 'TESTE 14a. 2 centavos = R$ 0,02');
    assert(formatCentsToBRL(1699) === 'R$ 16,99', 'TESTE 14b. 1699 centavos = R$ 16,99');
    assert(formatCentsToBRL(3400) === 'R$ 34,00', 'TESTE 14c. 3400 centavos = R$ 34,00');

    // TESTE 15: Produto sem acompanhamentos
    const simpleDelivery = renderDeliveryOrder({ order: deliveryOrder });
    assert(!simpleDelivery.content?.includes('+1x'), 'TESTE 15. Produto sem acompanhamentos não insere linhas extras com +');

    // TESTE 16: Acompanhamento gratuito R$ 0,00
    const freeAccOrder: Order = {
      ...deliveryOrder,
      items: [
        {
          ...deliveryOrder.items[0],
          selectedAccompaniments: [
            {
              groupId: 'g-2',
              groupNameSnapshot: 'Molhos',
              itemId: 'ai-3',
              itemNameSnapshot: 'Molho Verde Especial',
              priceSnapshot: 0,
              quantity: 1,
              subtotal: 0,
            },
          ],
        },
      ],
    };
    const d16 = renderDeliveryOrder({ order: freeAccOrder });
    assert(d16.content?.includes('Molho Verde Especial') === true && d16.content?.includes('R$ 0,00') === true, 'TESTE 16. Acompanhamento gratuito exibe R$ 0,00');

    // TESTE 17: Múltiplos acompanhamentos
    const multiAccOrder: Order = {
      ...deliveryOrder,
      items: [
        {
          ...deliveryOrder.items[0],
          selectedAccompaniments: [
            {
              groupId: 'g-1',
              groupNameSnapshot: 'Ingredientes',
              itemId: 'ai-1',
              itemNameSnapshot: 'Queijo Ralado',
              priceSnapshot: 200,
              quantity: 1,
              subtotal: 200,
            },
            {
              groupId: 'g-1',
              groupNameSnapshot: 'Ingredientes',
              itemId: 'ai-2',
              itemNameSnapshot: 'Azeitona',
              priceSnapshot: 150,
              quantity: 1,
              subtotal: 150,
            },
          ],
        },
      ],
    };
    const d17 = renderDeliveryOrder({ order: multiAccOrder });
    assert(d17.content?.includes('Queijo Ralado') === true && d17.content?.includes('Azeitona') === true, 'TESTE 17. Múltiplos acompanhamentos renderizados individualmente');

    // TESTE 18: Quantidade maior que 1
    const qtyOrder: Order = {
      ...deliveryOrder,
      items: [
        {
          ...deliveryOrder.items[0],
          quantity: 3,
          subtotal: 10500,
        },
      ],
    };
    const d18 = renderDeliveryOrder({ order: qtyOrder });
    assert(d18.content?.includes('3x Pizza Margherita') === true, 'TESTE 18. Quantidade de item 3x exibida com clareza');

    // TESTE 19: Pedido com desconto
    const discountOrder: Order = {
      ...deliveryOrder,
      discount: 500,
      total: 3700,
    };
    const d19 = renderDeliveryOrder({ order: discountOrder });
    assert(d19.content?.includes('Desconto:') === true && d19.content?.includes('R$ 5,00') === true, 'TESTE 19. Desconto de R$ 5,00 exibido');

    // TESTE 20: Pedido com taxa de entrega
    assert(d19.content?.includes('Taxa de Entrega:') === true, 'TESTE 20. Taxa de entrega rotulada corretamente');

    // TESTE 21: Pedido sem endereço
    const noAddressOrder: Order = {
      ...deliveryOrder,
      deliverySnapshot: undefined,
      customerSnapshot: { name: 'Cliente Sem Endereço', phone: '0000' },
    };
    const d21 = renderDeliveryOrder({ order: noAddressOrder });
    assert(d21.content?.includes('Cliente Sem Endereço') === true, 'TESTE 21. Pedido sem endereço processado com segurança');

    // TESTE 22: Pedido sem cliente
    const noCustomerOrder: Order = {
      ...deliveryOrder,
      customerSnapshot: undefined,
    };
    const d22 = renderDeliveryOrder({ order: noCustomerOrder });
    assert(!d22.content?.includes('Cliente:') === true, 'TESTE 22. Pedido sem cliente renderiza sem erros');

    // TESTE 23: Reimpressão
    const reprintDelivery = renderDeliveryOrder({ order: deliveryOrder, isReprint: true });
    assert(reprintDelivery.content?.includes('*** REIMPRESSÃO - 2ª VIA ***') === true, 'TESTE 23a. Reimpressão inclui cabeçalho no Delivery');

    const reprintKitchen = renderKitchenTicket({ ticket: simpleTicket, isReprint: true });
    assert(reprintKitchen.content?.includes('*** REIMPRESSÃO - 2ª VIA ***') === true, 'TESTE 23b. Reimpressão inclui cabeçalho na Cozinha');

    // TESTE 24: Preservação dos snapshots
    const snapshotOrder: Order = {
      ...deliveryOrder,
      items: [
        {
          id: 'item-snap',
          orderId: 'ord-200',
          productId: 'prod-deleted-999',
          productNameSnapshot: 'Prato Histórico Antigo (Removido do Catálogo)',
          unitPrice: 4500,
          quantity: 1,
          subtotal: 4500,
          status: 'PREPARING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const d24 = renderDeliveryOrder({ order: snapshotOrder });
    assert(
      d24.content?.includes('Prato Histórico') === true &&
      d24.content?.includes('Removido') === true &&
      d24.content?.includes('Catálogo') === true,
      'TESTE 24. Preserva e exibe productNameSnapshot do histórico'
    );

    // Bônus: Testar CashMovement e CashRegisterClosing
    const mockMovement: CashMovement = {
      id: 'mov-1',
      cashRegisterId: 'cx-1',
      type: 'WITHDRAWAL',
      amount: 15000,
      paymentMethod: 'CASH',
      description: 'Sangria de segurança',
      userId: 'usr-1',
      userName: 'Operador Carlos',
      createdAt: new Date().toISOString(),
    };
    const cMov = renderCashMovement({ movement: mockMovement });
    assert(cMov.content?.includes('SANGRIA / RETIRADA') === true && cMov.content?.includes('R$ 150,00') === true, 'BÔNUS: CashMovement sangria renderizada');

    const mockRegister: CashRegister = {
      id: 'cx-1',
      localId: 'CX-1001',
      companyId: 'comp-1',
      openedBy: 'usr-1',
      openedByName: 'Operador Carlos',
      closedBy: 'usr-1',
      closedByName: 'Operador Carlos',
      deviceId: 'dev-1',
      openingAmount: 10000,
      expectedAmount: 50000,
      closingAmount: 50000,
      difference: 0,
      status: 'CLOSED',
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closingCounts: { cash: 20000, pix: 30000 },
    };
    const cReg = renderCashRegisterClosing({ register: mockRegister });
    assert(cReg.content?.includes('FECHAMENTO DE CAIXA') === true && cReg.content?.includes('R$ 500,00') === true, 'BÔNUS: CashRegister closing renderizado');

    console.log(`\n=== RESUMO ETAPA 14: PASSOU: ${passed} | FALHOU: ${failed} ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Erro crítico nos testes:', err);
    process.exit(1);
  }
}

runEtapa14Tests();
