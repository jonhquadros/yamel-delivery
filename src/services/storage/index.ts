/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { localDB, generateLocalId } from './idb';
export { generateLocalId };
import {
  SyncStatus,
  SyncQueueItem,
  Role,
  Company,
  User,
  Category,
  Product,
  ProductOption,
  ProductAddon,
  Table,
  Customer,
  Order,
  OrderItem,
  OrderItemOption,
  OrderItemAddon,
  CashRegister,
  CashRegisterClosingCounts,
  CashMovement,
  Delivery,
  Device,
  SyncEntityName,
  SyncOperationType,
  DeviceConfig,
  LocalCategory,
  LocalProduct,
  LocalTable,
  LocalCashRegister,
  OrderTotals,
  OrderCustomer,
  CashMovementType,
  PaymentMethod,
  ProductionStationType,
  ProductionStatus,
  ProductionItem,
  ProductionTicket
} from './types';

// --- SEED INITIAL DATA WITH CENTS-BASED MONETARY VALUES ---
export async function seedInitialDataIfNeeded(): Promise<void> {
  const existingCompanies = await localDB.getAll<Company>('companies');
  if (existingCompanies.length > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();
  const devId = await getOrRegisterDeviceId();

  // 1. Seed Company
  const company: Company = {
    id: 'comp-1',
    name: 'Yamel Alimentos S/A',
    tradeName: 'Yamel Hamburgueria Gourmet',
    document: '12.345.678/0001-90',
    phone: '+55 11 99999-8888',
    whatsapp: '+55 11 99999-8888',
    email: 'contato@yamel.com.br',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    logo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=128&h=128&fit=crop&q=80',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await localDB.put('companies', company);

  // 2. Seed Users
  const users: User[] = [
    {
      id: 'usr-1',
      name: 'João Silva (Gerente)',
      email: 'joao@yamel.com.br',
      phone: '+55 11 98888-7777',
      roleId: 'MANAGER',
      status: 'ACTIVE',
      deviceId: devId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr-2',
      name: 'Carlos Garçom',
      email: 'carlos@yamel.com.br',
      roleId: 'WAITER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const usr of users) {
    await localDB.put('users', usr);
  }

  // 3. Seed Categories
  const categories: Category[] = [
    { id: 'cat-1', name: '🔥 Mais Vendidos', description: 'Os favoritos do público', sortOrder: 1, active: true, createdAt: now, updatedAt: now },
    { id: 'cat-2', name: '🍔 Hambúrgueres', description: 'Hambúrgueres artesanais premium', sortOrder: 2, active: true, createdAt: now, updatedAt: now },
    { id: 'cat-3', name: '🍟 Acompanhamentos', description: 'Batatas e porções', sortOrder: 3, active: true, createdAt: now, updatedAt: now },
    { id: 'cat-4', name: '🥤 Bebidas', description: 'Refrigerantes e sucos trincando', sortOrder: 4, active: true, createdAt: now, updatedAt: now },
    { id: 'cat-5', name: '🍰 Sobremesas', description: 'Sua dose diária de felicidade', sortOrder: 5, active: true, createdAt: now, updatedAt: now },
  ];
  for (const cat of categories) {
    await localDB.put('categories', cat);
  }

  // 4. Seed Products (PRICES STORED AS INTEGERS REPRESENTING CENTS)
  const products: Product[] = [
    {
      id: 'prod-1',
      categoryId: 'cat-2',
      name: 'Burger Clássico',
      description: 'Blend bovino artesanal de 150g, fatias de queijo cheddar derretido, alface, tomate e molho especial Yamel.',
      price: 2490, // R$ 24,90 in Cents
      cost: 1120, // R$ 11,20 in Cents
      active: true,
      available: true,
      featured: true,
      sortOrder: 1,
      preparationTime: 12,
      sku: 'YML-BURGER-001',
      productionStation: 'KITCHEN',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-101',
      deviceId: devId,
    },
    {
      id: 'prod-2',
      categoryId: 'cat-2',
      name: 'Yamel Especial',
      description: 'Dois blends bovinos de 150g, queijo cheddar duplo, bacon crocante, cebola caramelizada e molho da casa.',
      price: 3290, // R$ 32,90 in Cents
      cost: 1650,
      active: true,
      available: true,
      featured: true,
      sortOrder: 2,
      preparationTime: 15,
      sku: 'YML-BURGER-002',
      productionStation: 'KITCHEN',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-102',
      deviceId: devId,
    },
    {
      id: 'prod-3',
      categoryId: 'cat-3',
      name: 'Batata Frita G',
      description: 'Porção grande de batatas fritas super crocantes, temperadas com sal fino e alecrim fresco.',
      price: 1400, // R$ 14,00 in Cents
      cost: 450,
      active: true,
      available: true,
      featured: false,
      sortOrder: 3,
      preparationTime: 7,
      sku: 'YML-SIDE-001',
      productionStation: 'KITCHEN',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-103',
      deviceId: devId,
    },
    {
      id: 'prod-4',
      categoryId: 'cat-4',
      name: 'Coca-Cola Lata',
      description: 'Refrigerante Coca-Cola original lata de 350ml trincando de gelada.',
      price: 600, // R$ 6,00 in Cents
      cost: 210,
      active: true,
      available: true,
      featured: false,
      sortOrder: 4,
      sku: 'YML-DRINK-001',
      productionStation: 'BAR',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-104',
      deviceId: devId,
    },
    {
      id: 'prod-5',
      categoryId: 'cat-1',
      name: 'Café Expresso Especial',
      description: 'Café de grãos selecionados da Região Mogiana, extração perfeita.',
      price: 650, // R$ 6,50 in Cents
      cost: 180,
      active: true,
      available: true,
      featured: true,
      sortOrder: 5,
      sku: 'YML-COFFEE-001',
      productionStation: 'BAR',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-105',
      deviceId: devId,
    },
    {
      id: 'prod-6',
      categoryId: 'cat-1',
      name: 'Taça de Sorvete Artesanal',
      description: 'Duas bolas de sorvete de baunilha com calda de chocolate e chantilly fresco.',
      price: 1850, // R$ 18,50 in Cents
      cost: 620,
      active: true,
      available: true,
      featured: true,
      sortOrder: 6,
      sku: 'YML-ICE-001',
      productionStation: 'ICE_CREAM',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      localId: 'L-106',
      deviceId: devId,
    }
  ];
  for (const prod of products) {
    await localDB.put('products', prod);
  }

  // 5. Seed Product Options & Addons
  const options: ProductOption[] = [
    {
      id: 'opt-1',
      productId: 'prod-1',
      name: 'Ponto da Carne',
      required: true,
      minSelections: 1,
      maxSelections: 1,
      choices: [
        { id: 'ch-1', name: 'Mal Passado', additionalPrice: 0 },
        { id: 'ch-2', name: 'Ao Ponto', additionalPrice: 0 },
        { id: 'ch-3', name: 'Bem Passado', additionalPrice: 0 },
      ]
    }
  ];
  for (const opt of options) {
    await localDB.put('product_options', opt);
  }

  const addons: ProductAddon[] = [
    { id: 'add-1', productId: 'prod-1', name: 'Queijo Extra', price: 300, active: true }, // R$ 3,00
    { id: 'add-2', productId: 'prod-1', name: 'Bacon Duplo', price: 450, active: true }, // R$ 4,50
  ];
  for (const add of addons) {
    await localDB.put('product_addons', add);
  }

  // 6. Seed Tables
  const tables: Table[] = [
    { id: 'table-1', number: 1, name: 'Mesa 01', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-2', number: 2, name: 'Mesa 02', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-3', number: 3, name: 'Mesa 03', capacity: 4, status: 'OCCUPIED', active: true, currentOrderId: 'order-seed-1', createdAt: now, updatedAt: now },
    { id: 'table-4', number: 4, name: 'Mesa 04', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-5', number: 5, name: 'Mesa 05', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-6', number: 6, name: 'Mesa 06', capacity: 4, status: 'WAITING_PAYMENT', active: true, currentOrderId: 'order-seed-2', createdAt: now, updatedAt: now },
    { id: 'table-7', number: 7, name: 'Mesa 07', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-8', number: 8, name: 'Mesa 08', capacity: 4, status: 'BLOCKED', active: true, createdAt: now, updatedAt: now },
    { id: 'table-9', number: 9, name: 'Mesa 09', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
    { id: 'table-10', number: 10, name: 'Mesa 10', capacity: 4, status: 'FREE', active: true, createdAt: now, updatedAt: now },
  ];
  for (const tab of tables) {
    await localDB.put('tables', tab);
  }

  // 7. Seed Cash Register & Seed Cash Movements
  const register: CashRegister = {
    id: 'cash-1',
    localId: 'CX-1001',
    companyId: 'comp-1',
    openedBy: 'usr-1',
    openedByName: 'João Silva (Gerente)',
    deviceId: devId,
    openingAmount: 15000, // R$ 150,00 in Cents (fundo de troco)
    expectedAmount: 15000,
    status: 'OPEN',
    openedAt: now,
    notes: 'Abertura de turno matutino - Terminal 01',
    createdAt: now,
    updatedAt: now,
  };
  await localDB.put('cash_registers', register);

  const initialMovements: CashMovement[] = [
    {
      id: 'mov-seed-1',
      cashRegisterId: 'cash-1',
      type: 'DEPOSIT',
      amount: 5000, // R$ 50,00
      paymentMethod: 'CASH',
      description: 'Reforço de troco (Moedas e notas pequenas)',
      userId: 'usr-1',
      userName: 'João Silva (Gerente)',
      deviceId: devId,
      createdAt: now,
      updatedAt: now,
    }
  ];
  for (const mov of initialMovements) {
    await localDB.put('cash_movements', mov);
  }

  // 8. Seed Orders and Items
  const seedOrders: Order[] = [
    {
      id: 'order-seed-1',
      localId: 'YML-1001',
      serverId: undefined,
      orderNumber: 1001,
      companyId: 'comp-1',
      tableId: 'table-3',
      waiterId: 'usr-2',
      deviceId: devId,
      origin: 'TABLE',
      status: 'PREPARING',
      syncStatus: 'SYNCED',
      items: [
        {
          id: 'item-1',
          orderId: 'order-seed-1',
          productId: 'prod-1',
          productNameSnapshot: 'Burger Clássico',
          unitPrice: 2490, // cents
          quantity: 2,
          subtotal: 4980, // cents
          status: 'PREPARING',
          createdAt: now,
          updatedAt: now,
        }
      ],
      subtotal: 4980,
      discount: 0,
      serviceFee: 0,
      deliveryFee: 0,
      total: 4980,
      paymentStatus: 'PENDING',
      notes: 'Ponto bem passado.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'order-seed-2',
      localId: 'YML-1002',
      serverId: undefined,
      orderNumber: 1002,
      companyId: 'comp-1',
      tableId: 'table-6',
      waiterId: 'usr-2',
      deviceId: devId,
      origin: 'TABLE',
      status: 'READY',
      syncStatus: 'PENDING', // Operação local pendente de futura sincronia
      items: [
        {
          id: 'item-2',
          orderId: 'order-seed-2',
          productId: 'prod-2',
          productNameSnapshot: 'Yamel Especial',
          unitPrice: 3290,
          quantity: 1,
          subtotal: 3290,
          status: 'READY',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'item-3',
          orderId: 'order-seed-2',
          productId: 'prod-4',
          productNameSnapshot: 'Coca-Cola Lata',
          unitPrice: 600,
          quantity: 1,
          subtotal: 600,
          status: 'READY',
          createdAt: now,
          updatedAt: now,
        }
      ],
      subtotal: 3890,
      discount: 0,
      serviceFee: 389, // 10% de taxa de serviço (R$ 3,89)
      deliveryFee: 0,
      total: 4279, // subtotal (3890) + serviceFee (389) = 4279 cents
      paymentStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    }
  ];
  for (const ord of seedOrders) {
    await localDB.put('orders', ord);
    for (const item of ord.items) {
      await localDB.put('order_items', item);
    }
  }

  // 9. Seed Registered Device config
  const device: Device = {
    id: devId,
    name: 'Terminal Central PDV',
    type: 'CASHIER',
    userId: 'usr-1',
    lastSeen: now,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await localDB.put('devices', device);

  // Sync tickets for initial seed orders
  try {
    await productionRepository.syncTicketsFromOrders();
  } catch (e) {
    console.warn('Erro ao gerar tickets de produção iniciais:', e);
  }
}

// --- DEVICE COMPATIBILITY FUNCTIONS ---
export async function getOrRegisterDeviceId(): Promise<string> {
  const configs = await localDB.getAll<DeviceConfig>('device_config');
  if (configs.length > 0) {
    return configs[0].deviceId;
  }

  const newId = generateLocalId();
  const config: DeviceConfig = {
    deviceId: newId,
    deviceName: 'Terminal ' + newId.substring(0, 5).toUpperCase(),
    deviceType: 'CAIXA',
    lastSeen: new Date().toISOString(),
  };

  await localDB.put('device_config', config);
  return newId;
}

export async function getDeviceConfig(): Promise<DeviceConfig | null> {
  const configs = await localDB.getAll<DeviceConfig>('device_config');
  return configs[0] || null;
}

// --- 1. REPOSITÓRIO DE PRODUTOS ---
export const productsRepository = {
  async getAll(): Promise<Product[]> {
    const list = await localDB.getAll<Product>('products');
    // Filtro de Soft Delete
    return list.filter(item => !item.deletedAt);
  },

  async getById(id: string): Promise<Product | null> {
    const item = await localDB.get<Product>('products', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async save(product: Product): Promise<void> {
    const now = new Date().toISOString();
    const isNew = !(await localDB.get('products', product.id));
    
    product.updatedAt = now;
    if (isNew) {
      product.createdAt = now;
    }

    await localDB.put('products', product);

    // Enfileirar no outbox para sincronização futura
    await syncQueueRepository.enqueue(
      'product',
      product.id,
      isNew ? 'CREATE' : 'UPDATE',
      product,
      product.deviceId
    );
  },

  async delete(id: string, deviceId: string): Promise<void> {
    const product = await this.getById(id);
    if (product) {
      const now = new Date().toISOString();
      product.deletedAt = now;
      product.updatedAt = now;
      await localDB.put('products', product);

      await syncQueueRepository.enqueue(
        'product',
        id,
        'DELETE',
        { id, deletedAt: now },
        deviceId
      );
    }
  },

  async getOptions(productId: string): Promise<ProductOption[]> {
    return localDB.getByIndex<ProductOption>('product_options', 'productId', productId);
  },

  async getAddons(productId: string): Promise<ProductAddon[]> {
    return localDB.getByIndex<ProductAddon>('product_addons', 'productId', productId);
  }
};

// --- 2. REPOSITÓRIO DE CATEGORIAS ---
export const categoriesRepository = {
  async getAll(): Promise<Category[]> {
    const list = await localDB.getAll<Category>('categories');
    return list.filter(item => !item.deletedAt);
  },

  async getById(id: string): Promise<Category | null> {
    const item = await localDB.get<Category>('categories', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async save(category: Category): Promise<void> {
    const now = new Date().toISOString();
    const isNew = !(await localDB.get('categories', category.id));

    category.updatedAt = now;
    if (isNew) {
      category.createdAt = now;
    }

    await localDB.put('categories', category);

    await syncQueueRepository.enqueue(
      'category',
      category.id,
      isNew ? 'CREATE' : 'UPDATE',
      category,
      'device-local'
    );
  },

  async delete(id: string): Promise<void> {
    const category = await this.getById(id);
    if (category) {
      const now = new Date().toISOString();
      category.deletedAt = now;
      category.updatedAt = now;
      await localDB.put('categories', category);

      await syncQueueRepository.enqueue(
        'category',
        id,
        'DELETE',
        { id, deletedAt: now },
        'device-local'
      );
    }
  }
};

// --- 3. REPOSITÓRIO DE PEDIDOS ---
export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    const list = await localDB.getAll<Order>('orders');
    return list.filter(item => !item.deletedAt);
  },

  async getById(id: string): Promise<Order | null> {
    const item = await localDB.get<Order>('orders', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async create(orderData: Omit<Order, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'>): Promise<Order> {
    const id = generateLocalId();
    const all = await this.getAll();
    const sequential = all.length + 1001;
    const localId = `YML-${sequential}`;
    const now = new Date().toISOString();

    const order: Order = {
      ...orderData,
      id,
      localId,
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    // Salva o pedido localmente (Local-First)
    await localDB.put('orders', order);

    // Salva os itens vinculados ao pedido garantindo roundNumber e roundId
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        item.orderId = id;
        item.roundNumber = item.roundNumber || 1;
        item.roundId = item.roundId || `R${String(item.roundNumber).padStart(3, '0')}`;
        item.createdAt = item.createdAt || now;
        item.updatedAt = now;
        await localDB.put('order_items', item);
      }
    }

    // Registra na outbox para futuras sincronizações
    await syncQueueRepository.enqueue(
      'order',
      id,
      'CREATE',
      order,
      order.deviceId
    );

    // Gerar automaticamente os tickets de produção do KDS
    try {
      await productionRepository.syncTicketsFromOrders();
    } catch (err) {
      console.warn('Erro ao gerar tickets de produção:', err);
    }

    // Sincronizar pagamento com o fluxo de caixa aberto
    try {
      await cashRepository.syncOrderCashMovement(order);
    } catch (err) {
      console.warn('Erro ao sincronizar movimento de caixa inicial do pedido:', err);
    }

    return order;
  },

  async update(order: Order): Promise<void> {
    const now = new Date().toISOString();
    order.updatedAt = now;
    await localDB.put('orders', order);

    // Atualiza os itens vinculados ao pedido no IndexedDB
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        item.updatedAt = now;
        await localDB.put('order_items', item);
      }
    }

    // Sincroniza as alterações no outbox
    await syncQueueRepository.enqueue(
      'order',
      order.id,
      'UPDATE',
      order,
      order.deviceId
    );

    // Atualiza/sincroniza tickets no KDS
    try {
      await productionRepository.syncTicketsFromOrders();
    } catch (err) {
      console.warn('Erro ao sincronizar tickets de produção:', err);
    }

    // Sincronizar movimentação de pagamento/estorno com o caixa aberto
    try {
      await cashRepository.syncOrderCashMovement(order);
    } catch (err) {
      console.warn('Erro ao sincronizar movimento de caixa do pedido:', err);
    }
  }
};

// --- HELPER DE SETOR DE PRODUÇÃO ---
export function getStationForProduct(
  product?: Product | null,
  productNameSnapshot?: string
): ProductionStationType {
  if (product?.productionStation) {
    return product.productionStation;
  }
  const name = (productNameSnapshot || product?.name || '').toLowerCase();
  if (
    name.includes('coca') ||
    name.includes('café') ||
    name.includes('cafe') ||
    name.includes('bebida') ||
    name.includes('suco') ||
    name.includes('refrigerante') ||
    name.includes('lata') ||
    name.includes('cappuccino') ||
    name.includes('chopp') ||
    name.includes('cerveja')
  ) {
    return 'BAR';
  }
  if (
    name.includes('sorvete') ||
    name.includes('açaí') ||
    name.includes('acai') ||
    name.includes('taça') ||
    name.includes('picolé') ||
    name.includes('gelato')
  ) {
    return 'ICE_CREAM';
  }
  return 'KITCHEN';
}

// --- REPOSITÓRIO DE PRODUÇÃO (KDS) ---
export const productionRepository = {
  async getAllTickets(): Promise<ProductionTicket[]> {
    const list = await localDB.getAll<ProductionTicket>('production_tickets');
    return list.filter(t => !t.deletedAt);
  },

  async getTicketsByStation(station: ProductionStationType | 'ALL'): Promise<ProductionTicket[]> {
    const all = await this.getAllTickets();
    if (station === 'ALL') return all;
    return all.filter(t => t.station === station);
  },

  /**
   * Realiza o cancelamento operacional (soft-delete) imediato de todos os tickets vinculados a um pedido.
   */
  async cancelTicketsForOrder(orderId: string): Promise<void> {
    const allTickets = await localDB.getAll<ProductionTicket>('production_tickets');
    const orderTickets = allTickets.filter(t => t.orderId === orderId && !t.deletedAt);
    
    if (orderTickets.length === 0) return;

    const now = new Date().toISOString();
    const devId = await getOrRegisterDeviceId();

    for (const ticket of orderTickets) {
      ticket.deletedAt = now;
      ticket.updatedAt = now;
      ticket.items = ticket.items.map(item => ({
        ...item,
        status: 'READY', // ou mantém histórico com updatedAt
        updatedAt: now
      }));

      await localDB.put('production_tickets', ticket);
      await syncQueueRepository.enqueue(
        'production_ticket',
        ticket.id,
        'UPDATE',
        ticket,
        devId
      );
    }
  },

  async updateTicketStatus(
    ticketId: string,
    newStatus: ProductionStatus
  ): Promise<ProductionTicket> {
    const ticket = await localDB.get<ProductionTicket>('production_tickets', ticketId);
    if (!ticket) throw new Error('Ticket de produção não encontrado');

    // Idempotência: Se já estiver no status desejado, retorna sem duplicar operações
    if (ticket.status === newStatus) {
      return ticket;
    }

    // Regras de Concorrência e integridade do KDS:
    // 1. Ticket cancelado não pode ser reaberto por esta rota
    if (ticket.status === 'CANCELLED') {
      return ticket;
    }
    // 2. Ticket que já está READY não pode regredir para PENDING ou PREPARING (evita ação atrasada de outro operador)
    if (ticket.status === 'READY' && (newStatus === 'PENDING' || newStatus === 'PREPARING')) {
      return ticket;
    }
    // 3. Ticket que já está PREPARING não pode regredir para PENDING
    if (ticket.status === 'PREPARING' && newStatus === 'PENDING') {
      return ticket;
    }

    const now = new Date().toISOString();
    ticket.status = newStatus;
    ticket.updatedAt = now;

    ticket.items = ticket.items.map(item => {
      if (item.status === 'CANCELLED') return item;
      if (newStatus === 'PREPARING' && item.status === 'PENDING') {
        return { ...item, status: 'PREPARING', updatedAt: now };
      }
      if (newStatus === 'READY' && (item.status === 'PENDING' || item.status === 'PREPARING')) {
        return { ...item, status: 'READY', updatedAt: now };
      }
      if (newStatus === 'CANCELLED') {
        return { ...item, status: 'CANCELLED', updatedAt: now };
      }
      return item;
    });

    await localDB.put('production_tickets', ticket);

    const devId = await getOrRegisterDeviceId();
    await syncQueueRepository.enqueue(
      'production_ticket',
      ticket.id,
      'UPDATE',
      ticket,
      devId
    );

    // Propaga a atualização do ticket para o Pedido correspondente quando pertinente
    if (ticket.orderId) {
      try {
        const order = await ordersRepository.getById(ticket.orderId);
        if (order && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && order.status !== 'DELIVERED' && order.status !== 'OUT_FOR_DELIVERY') {
          // Atualiza o status dos itens no pedido
          const ticketItemMap = new Map(ticket.items.map(i => [i.orderItemId, i.status]));
          if (order.items) {
            order.items = order.items.map(it => {
              const matched = ticketItemMap.get(it.id);
              if (matched && matched !== it.status) {
                return { ...it, status: matched, updatedAt: now };
              }
              return it;
            });
          }

          const allTickets = (await this.getAllTickets()).filter(t => t.orderId === order.id && !t.deletedAt);
          if (allTickets.length > 0) {
            if (allTickets.every(t => t.status === 'READY')) {
              if (order.status !== 'READY') {
                order.status = 'READY';
                order.updatedAt = now;
                await localDB.put('orders', order);
                await syncQueueRepository.enqueue('order', order.id, 'UPDATE', order, order.deviceId);
              }
            } else if (allTickets.some(t => t.status === 'PREPARING' || t.status === 'READY')) {
              if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
                order.status = 'PREPARING';
                order.updatedAt = now;
                await localDB.put('orders', order);
                await syncQueueRepository.enqueue('order', order.id, 'UPDATE', order, order.deviceId);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao propagar status do ticket para o pedido:', err);
      }
    }

    return ticket;
  },

  /**
   * Gerador Idempotente de Tickets de Produção a partir de Pedidos ativos no IndexedDB.
   * Identifica pedidos cancelados e desativa tickets órfãos preservando o histórico.
   */
  async syncTicketsFromOrders(): Promise<ProductionTicket[]> {
    const orders = await ordersRepository.getAll();
    const existingTickets = await localDB.getAll<ProductionTicket>('production_tickets');
    const allProducts = await productsRepository.getAll();
    const productMap = new Map<string, Product>(allProducts.map(p => [p.id, p]));
    const allTables = await tablesRepository.getAll();
    const tableMap = new Map<string, Table>(allTables.map(t => [t.id, t]));

    const devId = await getOrRegisterDeviceId();
    const now = new Date().toISOString();

    const orderMap = new Map<string, Order>(orders.map(o => [o.id, o]));

    // 1. Processar tickets de pedidos que foram cancelados ou deletados
    for (const ticket of existingTickets) {
      if (ticket.deletedAt) continue;
      const parentOrder = orderMap.get(ticket.orderId);
      if (!parentOrder || parentOrder.status === 'CANCELLED' || parentOrder.deletedAt) {
        ticket.deletedAt = now;
        ticket.updatedAt = now;
        await localDB.put('production_tickets', ticket);
        await syncQueueRepository.enqueue(
          'production_ticket',
          ticket.id,
          'UPDATE',
          ticket,
          devId
        );
      }
    }

    // 2. Mapear tickets ativos considerando orderId + roundId + station
    const activeTickets = existingTickets.filter(t => !t.deletedAt);
    const ticketMap = new Map<string, ProductionTicket>();
    for (const t of activeTickets) {
      const rId = t.roundId || 'R001';
      ticketMap.set(`${t.orderId}-${rId}-${t.station}`, t);
    }

    const activeOrders = orders.filter(
      o => o.status !== 'CANCELLED' && !o.deletedAt && o.items && o.items.length > 0
    );

    for (const order of activeOrders) {
      // Agrupar itens por rodada (roundId) e por estação de produção (station)
      const groups = new Map<
        string,
        {
          roundNumber: number;
          roundId: string;
          station: ProductionStationType;
          items: OrderItem[];
        }
      >();

      for (const item of order.items) {
        if (item.status === 'CANCELLED') continue;

        const roundNumber = item.roundNumber || 1;
        const roundId = item.roundId || `R${String(roundNumber).padStart(3, '0')}`;
        const prod = productMap.get(item.productId);
        const station = getStationForProduct(prod, item.productNameSnapshot);
        const groupKey = `${roundId}:::${station}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            roundNumber,
            roundId,
            station,
            items: [],
          });
        }
        groups.get(groupKey)!.items.push(item);
      }

      for (const group of groups.values()) {
        const { roundNumber, roundId, station, items } = group;
        const ticketKey = `${order.id}-${roundId}-${station}`;
        const existing = ticketMap.get(ticketKey);

        if (!existing) {
          const table = order.tableId ? tableMap.get(order.tableId) : undefined;

          const prodItems: ProductionItem[] = items.map(item => {
            let itemStatus: ProductionStatus = 'PENDING';
            if (item.status === 'READY' || item.status === 'DELIVERED') {
              itemStatus = 'READY';
            } else if (item.status === 'PREPARING') {
              itemStatus = 'PREPARING';
            } else if (item.status === 'CANCELLED') {
              itemStatus = 'CANCELLED';
            }

            return {
              id: item.id || generateLocalId(),
              orderItemId: item.id,
              productId: item.productId,
              productNameSnapshot: item.productNameSnapshot,
              quantity: item.quantity,
              notes: item.notes,
              status: itemStatus,
              roundNumber,
              roundId,
              createdAt: item.createdAt || order.createdAt || now,
              updatedAt: now,
            };
          });

          let ticketStatus: ProductionStatus = 'PENDING';
          const activeNewProdItems = prodItems.filter(i => i.status !== 'CANCELLED');
          if (activeNewProdItems.length > 0 && activeNewProdItems.every(i => i.status === 'READY')) {
            ticketStatus = 'READY';
          } else if (activeNewProdItems.some(i => i.status === 'PREPARING' || i.status === 'READY')) {
            ticketStatus = 'PREPARING';
          } else {
            ticketStatus = 'PENDING';
          }

          const newTicket: ProductionTicket = {
            id: `ticket-${order.id}-${roundId}-${station}`,
            orderId: order.id,
            orderLocalId: order.localId || `YML-${order.orderNumber}`,
            orderOrigin: order.origin,
            station,
            roundNumber,
            roundId,
            tableNumber: table?.number,
            tableName: table?.name,
            customerName: order.customerSnapshot?.name,
            customerPhone: order.customerSnapshot?.phone,
            deliveryType: order.fulfillmentType,
            status: ticketStatus,
            items: prodItems,
            notes: order.notes,
            syncStatus: 'PENDING',
            deviceId: order.deviceId || devId,
            createdAt: items[0]?.createdAt || order.createdAt || now,
            updatedAt: now,
          };

          await localDB.put('production_tickets', newTicket);
          await syncQueueRepository.enqueue(
            'production_ticket',
            newTicket.id,
            'CREATE',
            newTicket,
            devId
          );
          ticketMap.set(ticketKey, newTicket);
        } else {
          // Ticket já existe para essa ordem + rodada + estação: verificar alterações
          let hasChanges = false;
          const table = order.tableId ? tableMap.get(order.tableId) : undefined;

          // 1. Sincroniza metadados do cabeçalho do Ticket
          if (existing.roundNumber !== roundNumber) {
            existing.roundNumber = roundNumber;
            hasChanges = true;
          }
          if (existing.roundId !== roundId) {
            existing.roundId = roundId;
            hasChanges = true;
          }
          if (existing.customerName !== order.customerSnapshot?.name) {
            existing.customerName = order.customerSnapshot?.name;
            hasChanges = true;
          }
          if (existing.customerPhone !== order.customerSnapshot?.phone) {
            existing.customerPhone = order.customerSnapshot?.phone;
            hasChanges = true;
          }
          if (existing.deliveryType !== order.fulfillmentType) {
            existing.deliveryType = order.fulfillmentType;
            hasChanges = true;
          }
          if (existing.notes !== order.notes) {
            existing.notes = order.notes;
            hasChanges = true;
          }
          if (table && (existing.tableNumber !== table.number || existing.tableName !== table.name)) {
            existing.tableNumber = table.number;
            existing.tableName = table.name;
            hasChanges = true;
          }

          const currentOrderItemsMap = new Map(order.items.map(i => [i.id, i]));

          // 2. Adicionar novos itens ou atualizar quantidades/status dos existentes na rodada
          for (const item of items) {
            const prodItemsForOrderItem = existing.items.filter(pi => pi.orderItemId === item.id);
            const totalExistingQty = prodItemsForOrderItem.reduce((sum, pi) => sum + pi.quantity, 0);

            if (prodItemsForOrderItem.length === 0) {
              // Item novo nesta rodada
              let itemStatus: ProductionStatus = 'PENDING';
              if (item.status === 'READY' || item.status === 'DELIVERED') {
                itemStatus = 'READY';
              } else if (item.status === 'PREPARING') {
                itemStatus = 'PREPARING';
              } else if (item.status === 'CANCELLED') {
                itemStatus = 'CANCELLED';
              }

              const newItem: ProductionItem = {
                id: item.id || generateLocalId(),
                orderItemId: item.id,
                productId: item.productId,
                productNameSnapshot: item.productNameSnapshot,
                quantity: item.quantity,
                notes: item.notes,
                status: itemStatus,
                roundNumber,
                roundId,
                createdAt: item.createdAt || order.createdAt || now,
                updatedAt: now,
              };
              existing.items.push(newItem);
              hasChanges = true;
            } else {
              // Item já existe nesta rodada: verificar excedente
              if (item.quantity > totalExistingQty) {
                const excessQty = item.quantity - totalExistingQty;
                const supplementalItem: ProductionItem = {
                  id: generateLocalId(),
                  orderItemId: item.id,
                  productId: item.productId,
                  productNameSnapshot: item.productNameSnapshot,
                  quantity: excessQty,
                  notes: item.notes ? `${item.notes} (Adicional)` : undefined,
                  status: 'PENDING',
                  roundNumber,
                  roundId,
                  createdAt: now,
                  updatedAt: now,
                };
                existing.items.push(supplementalItem);
                hasChanges = true;
              } else if (item.quantity < totalExistingQty) {
                let qtyToReduce = totalExistingQty - item.quantity;
                for (let i = prodItemsForOrderItem.length - 1; i >= 0 && qtyToReduce > 0; i--) {
                  const pi = prodItemsForOrderItem[i];
                  if (pi.status === 'PENDING') {
                    if (pi.quantity <= qtyToReduce) {
                      qtyToReduce -= pi.quantity;
                      pi.quantity = 0;
                      hasChanges = true;
                    } else {
                      pi.quantity -= qtyToReduce;
                      qtyToReduce = 0;
                      pi.updatedAt = now;
                      hasChanges = true;
                    }
                  }
                }
                existing.items = existing.items.filter(pi => pi.quantity > 0 || pi.status !== 'PENDING');
              }

              // Verificar se o status do item avançou
              for (const existingItem of prodItemsForOrderItem) {
                if (item.status === 'PREPARING' && existingItem.status === 'PENDING') {
                  existingItem.status = 'PREPARING';
                  existingItem.updatedAt = now;
                  hasChanges = true;
                } else if (item.status === 'READY' && (existingItem.status === 'PENDING' || existingItem.status === 'PREPARING')) {
                  existingItem.status = 'READY';
                  existingItem.updatedAt = now;
                  hasChanges = true;
                }
              }
            }
          }

          // 3. Tratar itens que foram cancelados
          for (const prodItem of existing.items) {
            const orderItem = currentOrderItemsMap.get(prodItem.orderItemId);
            if (orderItem && orderItem.status === 'CANCELLED') {
              prodItem.status = 'CANCELLED';
              prodItem.updatedAt = now;
              hasChanges = true;
            }
          }

          // 4. Cada rodada tem lifecycle próprio e independente.
          // O status do pedido NÃO sobresscreve o status individual da rodada.

          // 5. Recalcula o status consolidado do ticket com base nos itens ativos da rodada
          const activeItems = existing.items.filter(i => {
            const oi = currentOrderItemsMap.get(i.orderItemId);
            return oi ? oi.status !== 'CANCELLED' : i.status !== 'CANCELLED';
          });

          if (activeItems.length === 0) {
            if (!existing.deletedAt) {
              existing.deletedAt = now;
              hasChanges = true;
            }
          } else {
            if (existing.deletedAt) {
              existing.deletedAt = undefined;
              hasChanges = true;
            }

            let calculatedStatus: ProductionStatus = 'PENDING';
            if (activeItems.every(i => i.status === 'READY')) {
              calculatedStatus = 'READY';
            } else if (activeItems.some(i => i.status === 'PREPARING' || i.status === 'READY')) {
              calculatedStatus = 'PREPARING';
            } else {
              calculatedStatus = 'PENDING';
            }

            if (existing.status !== calculatedStatus) {
              existing.status = calculatedStatus;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            existing.updatedAt = now;
            await localDB.put('production_tickets', existing);
            await syncQueueRepository.enqueue(
              'production_ticket',
              existing.id,
              'UPDATE',
              existing,
              devId
            );
          }
        }
      }
    }

    return Array.from(ticketMap.values());
  }
};

// --- 4. REPOSITÓRIO DE MESAS ---
export const tablesRepository = {
  async getAll(includeInactive: boolean = false): Promise<Table[]> {
    let list = await localDB.getAll<Table>('tables');
    list = list.filter(item => !item.deletedAt);
    if (list.length === 0) {
      const now = new Date().toISOString();
      const defaultTables: Table[] = Array.from({ length: 10 }, (_, i) => ({
        id: `table-${i + 1}`,
        number: i + 1,
        name: `Mesa ${String(i + 1).padStart(2, '0')}`,
        capacity: 4,
        status: 'FREE',
        active: true,
        createdAt: now,
        updatedAt: now,
      }));
      for (const t of defaultTables) {
        await localDB.put('tables', t);
      }
      return defaultTables;
    }
    if (!includeInactive) {
      list = list.filter(item => item.active !== false);
    }
    return list.sort((a, b) => a.number - b.number);
  },

  async getById(id: string): Promise<Table | null> {
    const item = await localDB.get<Table>('tables', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async getByNumber(number: number): Promise<Table | null> {
    const all = await this.getAll(true);
    return all.find(t => t.number === number && !t.deletedAt) || null;
  },

  async create(data: {
    number: number;
    name?: string;
    capacity: number;
    active?: boolean;
  }): Promise<Table> {
    const tableNumber = Math.round(data.number);
    if (isNaN(tableNumber) || tableNumber <= 0) {
      throw new Error('O número da mesa deve ser um número positivo.');
    }

    const capacity = Math.round(data.capacity);
    if (isNaN(capacity) || capacity <= 0) {
      throw new Error('A capacidade da mesa deve ser de pelo menos 1 pessoa.');
    }

    // Verificar se já existe mesa ativa com o mesmo número
    const allTables = await localDB.getAll<Table>('tables');
    const existingActive = allTables.find(
      t => !t.deletedAt && t.active !== false && t.number === tableNumber
    );

    if (existingActive) {
      throw new Error(`Já existe uma mesa ativa com o número ${tableNumber}.`);
    }

    const now = new Date().toISOString();
    const id = generateLocalId();
    const name = data.name?.trim() || `Mesa ${String(tableNumber).padStart(2, '0')}`;

    const newTable: Table = {
      id,
      number: tableNumber,
      name,
      capacity,
      status: 'FREE',
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await localDB.put('tables', newTable);

    await syncQueueRepository.enqueue(
      'table',
      newTable.id,
      'CREATE',
      newTable,
      'device-local'
    );

    return newTable;
  },

  async update(table: Table): Promise<Table> {
    const fresh = await this.getById(table.id);
    if (!fresh) {
      throw new Error('Mesa não encontrada no IndexedDB.');
    }

    const tableNumber = Math.round(table.number);
    if (isNaN(tableNumber) || tableNumber <= 0) {
      throw new Error('O número da mesa deve ser um número positivo.');
    }

    const capacity = Math.round(table.capacity);
    if (isNaN(capacity) || capacity <= 0) {
      throw new Error('A capacidade da mesa deve ser de pelo menos 1 pessoa.');
    }

    // Se o número mudou, verificar se não colide com outra mesa ativa
    if (fresh.number !== tableNumber) {
      const allTables = await localDB.getAll<Table>('tables');
      const collision = allTables.find(
        t => t.id !== table.id && !t.deletedAt && t.active !== false && t.number === tableNumber
      );
      if (collision) {
        throw new Error(`Já existe uma mesa ativa com o número ${tableNumber}.`);
      }
    }

    const now = new Date().toISOString();
    const updated: Table = {
      ...fresh,
      number: tableNumber,
      name: table.name.trim() || `Mesa ${String(tableNumber).padStart(2, '0')}`,
      capacity,
      status: table.status || fresh.status,
      active: table.active ?? fresh.active ?? true,
      currentOrderId: table.currentOrderId !== undefined ? table.currentOrderId : fresh.currentOrderId,
      updatedAt: now,
    };

    await localDB.put('tables', updated);

    await syncQueueRepository.enqueue(
      'table',
      updated.id,
      'UPDATE',
      updated,
      'device-local'
    );

    return updated;
  },

  async deactivate(id: string): Promise<Table> {
    const fresh = await this.getById(id);
    if (!fresh) {
      throw new Error('Mesa não encontrada no IndexedDB.');
    }

    if (fresh.status === 'OCCUPIED') {
      throw new Error('Não é possível excluir uma mesa ocupada. Finalize ou cancele a comanda primeiro.');
    }

    if (fresh.status === 'WAITING_PAYMENT') {
      throw new Error('Não é possível excluir uma mesa aguardando pagamento. Finalize o pagamento ou cancele a comanda.');
    }

    const now = new Date().toISOString();
    fresh.active = false;
    fresh.updatedAt = now;

    await localDB.put('tables', fresh);

    await syncQueueRepository.enqueue(
      'table',
      fresh.id,
      'UPDATE',
      fresh,
      'device-local'
    );

    return fresh;
  },

  async delete(id: string): Promise<void> {
    await this.deactivate(id);
  },

  async reactivate(id: string): Promise<Table> {
    const fresh = await localDB.get<Table>('tables', id);
    if (!fresh) {
      throw new Error('Mesa não encontrada no IndexedDB.');
    }

    // Verificar colisão de número com outra mesa ativa
    const allTables = await localDB.getAll<Table>('tables');
    const collision = allTables.find(
      t => t.id !== id && !t.deletedAt && t.active !== false && t.number === fresh.number
    );
    if (collision) {
      throw new Error(`Já existe outra mesa ativa com o número ${fresh.number}. Altere o número antes de reativar.`);
    }

    const now = new Date().toISOString();
    fresh.active = true;
    fresh.deletedAt = undefined;
    fresh.updatedAt = now;

    await localDB.put('tables', fresh);

    await syncQueueRepository.enqueue(
      'table',
      fresh.id,
      'UPDATE',
      fresh,
      'device-local'
    );

    return fresh;
  },

  async toggleBlock(id: string, blocked: boolean): Promise<Table> {
    const fresh = await this.getById(id);
    if (!fresh) {
      throw new Error('Mesa não encontrada no IndexedDB.');
    }

    if (blocked) {
      if (fresh.status === 'OCCUPIED' || fresh.status === 'WAITING_PAYMENT') {
        throw new Error('Não é possível bloquear uma mesa com atendimento ativo. Conclua ou cancele a comanda antes.');
      }
      fresh.status = 'BLOCKED';
    } else {
      if (fresh.status === 'BLOCKED') {
        fresh.status = 'FREE';
      }
    }

    const now = new Date().toISOString();
    fresh.updatedAt = now;

    await localDB.put('tables', fresh);

    await syncQueueRepository.enqueue(
      'table',
      fresh.id,
      'UPDATE',
      fresh,
      'device-local'
    );

    return fresh;
  },

  async save(table: Table): Promise<void> {
    const now = new Date().toISOString();
    const isNew = !(await localDB.get('tables', table.id));
    
    table.updatedAt = now;
    if (isNew) {
      table.createdAt = now;
    }

    await localDB.put('tables', table);

    await syncQueueRepository.enqueue(
      'table',
      table.id,
      isNew ? 'CREATE' : 'UPDATE',
      table,
      'device-local'
    );
  }
};

// --- 5. REPOSITÓRIO DE CLIENTES ---
export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    const list = await localDB.getAll<Customer>('customers');
    return list.filter(item => !item.deletedAt);
  },

  async getById(id: string): Promise<Customer | null> {
    const item = await localDB.get<Customer>('customers', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async save(customer: Customer): Promise<void> {
    const now = new Date().toISOString();
    const isNew = !(await localDB.get('customers', customer.id));

    customer.updatedAt = now;
    if (isNew) {
      customer.createdAt = now;
    }

    await localDB.put('customers', customer);

    await syncQueueRepository.enqueue(
      'customer',
      customer.id,
      isNew ? 'CREATE' : 'UPDATE',
      customer,
      'device-local'
    );
  }
};

// --- 6. REPOSITÓRIO DE FLUXO DE CAIXA ---
export const cashRepository = {
  async getAll(): Promise<CashRegister[]> {
    const list = await localDB.getAll<CashRegister>('cash_registers');
    const filtered = list.filter(r => !r.deletedAt);
    return filtered.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  },

  async getById(id: string): Promise<CashRegister | null> {
    const item = await localDB.get<CashRegister>('cash_registers', id);
    if (item && item.deletedAt) return null;
    return item;
  },

  async getOpenRegister(): Promise<CashRegister | null> {
    const registers = await localDB.getAll<CashRegister>('cash_registers');
    const open = registers.find(r => r.status === 'OPEN' && !r.deletedAt);
    return open || null;
  },

  async open(
    openingAmount: number,
    userId: string,
    deviceId: string,
    options?: { userName?: string; notes?: string }
  ): Promise<CashRegister> {
    const open = await this.getOpenRegister();
    if (open) {
      throw new Error('Já existe um caixa aberto para este terminal');
    }

    const id = generateLocalId();
    const all = await this.getAll();
    const sequential = all.length + 1001;
    const localId = `CX-${sequential}`;
    const now = new Date().toISOString();

    const register: CashRegister = {
      id,
      localId,
      companyId: 'comp-1',
      openedBy: userId,
      openedByName: options?.userName || (userId === 'usr-1' ? 'João Silva (Gerente)' : 'Operador'),
      deviceId,
      openingAmount: Math.max(0, Math.round(openingAmount)),
      expectedAmount: Math.max(0, Math.round(openingAmount)),
      status: 'OPEN',
      openedAt: now,
      notes: options?.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await localDB.put('cash_registers', register);

    await syncQueueRepository.enqueue(
      'cash_register',
      id,
      'CREATE',
      register,
      deviceId
    );

    return register;
  },

  async close(
    registerId: string,
    closingAmount: number,
    userId: string,
    options?: { userName?: string; notes?: string; closingCounts?: CashRegisterClosingCounts }
  ): Promise<CashRegister> {
    const register = await localDB.get<CashRegister>('cash_registers', registerId);
    if (!register) {
      throw new Error('Registro de caixa não encontrado');
    }

    if (register.status === 'CLOSED') {
      throw new Error('Este caixa já foi fechado anteriormente.');
    }

    const movements = await this.getMovements(registerId);
    // Calcular o saldo esperado com base em centavos inteiros
    let expected = register.openingAmount;
    for (const mov of movements) {
      if (mov.type === 'SALE' || mov.type === 'DEPOSIT') {
        expected += mov.amount;
      } else if (mov.type === 'REFUND' || mov.type === 'WITHDRAWAL') {
        expected -= mov.amount;
      } else if (mov.type === 'ADJUSTMENT') {
        expected += mov.amount;
      }
    }

    const now = new Date().toISOString();
    register.status = 'CLOSED';
    register.closedBy = userId;
    register.closedByName = options?.userName || (userId === 'usr-1' ? 'João Silva (Gerente)' : 'Operador');
    register.closedAt = now;
    register.closingAmount = Math.max(0, Math.round(closingAmount));
    register.expectedAmount = expected;
    register.difference = register.closingAmount - expected;
    register.closingNotes = options?.notes?.trim() || undefined;
    register.closingCounts = options?.closingCounts;
    register.updatedAt = now;

    await localDB.put('cash_registers', register);

    await syncQueueRepository.enqueue(
      'cash_register',
      registerId,
      'UPDATE',
      register,
      register.deviceId
    );

    return register;
  },

  async addMovement(data: {
    cashRegisterId: string;
    type: CashMovementType;
    amount: number;
    paymentMethod: PaymentMethod;
    description: string;
    userId: string;
    userName?: string;
    orderId?: string;
    orderLocalId?: string;
    deviceId?: string;
  }): Promise<CashMovement> {
    const parsedAmount = Math.round(data.amount);

    // Validação estrita de sangria em dinheiro: não permitir retirada maior que o saldo em gaveta
    if (data.type === 'WITHDRAWAL' && (data.paymentMethod === 'CASH' || !data.paymentMethod)) {
      const reg = await this.getById(data.cashRegisterId);
      if (reg) {
        const movs = await this.getMovements(data.cashRegisterId);
        let cashInDrawer = reg.openingAmount || 0;
        for (const m of movs) {
          if (m.paymentMethod === 'CASH' || !m.paymentMethod) {
            if (m.type === 'SALE' || m.type === 'DEPOSIT') cashInDrawer += m.amount;
            else if (m.type === 'WITHDRAWAL' || m.type === 'REFUND') cashInDrawer -= m.amount;
            else if (m.type === 'ADJUSTMENT') cashInDrawer += m.amount;
          }
        }
        if (parsedAmount > cashInDrawer) {
          throw new Error(`Saldo em dinheiro insuficiente na gaveta para realizar esta sangria (Disponível: R$ ${(cashInDrawer / 100).toFixed(2).replace('.', ',')})`);
        }
      }
    }

    const id = generateLocalId();
    const now = new Date().toISOString();
    const devId = data.deviceId || (await getOrRegisterDeviceId());

    const movement: CashMovement = {
      id,
      cashRegisterId: data.cashRegisterId,
      orderId: data.orderId,
      orderLocalId: data.orderLocalId,
      type: data.type,
      amount: parsedAmount,
      paymentMethod: data.paymentMethod,
      description: data.description,
      userId: data.userId,
      userName: data.userName,
      deviceId: devId,
      createdAt: now,
      updatedAt: now,
    };

    await localDB.put('cash_movements', movement);

    await syncQueueRepository.enqueue(
      'cash_movement',
      id,
      'CREATE',
      movement,
      devId
    );

    return movement;
  },

  async getMovements(cashRegisterId: string): Promise<CashMovement[]> {
    const list = await localDB.getByIndex<CashMovement>('cash_movements', 'cashRegisterId', cashRegisterId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getAllMovements(): Promise<CashMovement[]> {
    const list = await localDB.getAll<CashMovement>('cash_movements');
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async syncOrderCashMovement(order: Order, userId?: string, userName?: string): Promise<void> {
    const openRegister = await this.getOpenRegister();
    if (!openRegister) return; // Nenhum caixa aberto no momento

    const movements = await this.getMovements(openRegister.id);
    const existingSale = movements.find(m => m.orderId === order.id && m.type === 'SALE');
    const existingRefund = movements.find(m => m.orderId === order.id && m.type === 'REFUND');

    const devId = order.deviceId || (await getOrRegisterDeviceId());
    const operatorId = userId || order.cashierId || order.waiterId || openRegister.openedBy || 'usr-1';
    const operatorName = userName || openRegister.openedByName || (operatorId === 'usr-1' ? 'João Silva' : 'Operador');
    const pMethod = order.paymentMethod || 'CASH';

    // 1. Se o pedido foi pago e não está cancelado
    if (order.paymentStatus === 'PAID' && order.status !== 'CANCELLED' && order.total > 0) {
      if (!existingSale) {
        await this.addMovement({
          cashRegisterId: openRegister.id,
          orderId: order.id,
          orderLocalId: order.localId || `YML-${order.orderNumber}`,
          type: 'SALE',
          amount: order.total,
          paymentMethod: pMethod,
          description: `Venda Pedido #${order.localId || order.orderNumber}`,
          userId: operatorId,
          userName: operatorName,
          deviceId: devId,
        });
      } else {
        // Venda já registrada: atualizar se houve alteração no valor ou na forma de pagamento (edição de pedido)
        if (existingSale.amount !== order.total || existingSale.paymentMethod !== pMethod) {
          existingSale.amount = order.total;
          existingSale.paymentMethod = pMethod;
          existingSale.description = `Venda Pedido #${order.localId || order.orderNumber} (Atualizado)`;
          existingSale.updatedAt = new Date().toISOString();
          await localDB.put('cash_movements', existingSale);
          await syncQueueRepository.enqueue('cash_movement', existingSale.id, 'UPDATE', existingSale, devId);
        }
      }
      return;
    }

    // 2. Se o pedido foi cancelado e havia uma venda registrada neste caixa
    if (order.status === 'CANCELLED' && existingSale && !existingRefund) {
      await this.addMovement({
        cashRegisterId: openRegister.id,
        orderId: order.id,
        orderLocalId: order.localId || `YML-${order.orderNumber}`,
        type: 'REFUND',
        amount: existingSale.amount,
        paymentMethod: existingSale.paymentMethod,
        description: `Estorno Pedido Cancelado #${order.localId || order.orderNumber}`,
        userId: operatorId,
        userName: operatorName,
        deviceId: devId,
      });
      return;
    }

    // 3. Se o status de pagamento foi revertido para PENDING e havia venda registrada
    if (order.paymentStatus === 'PENDING' && existingSale && !existingRefund) {
      await this.addMovement({
        cashRegisterId: openRegister.id,
        orderId: order.id,
        orderLocalId: order.localId || `YML-${order.orderNumber}`,
        type: 'REFUND',
        amount: existingSale.amount,
        paymentMethod: existingSale.paymentMethod,
        description: `Estorno Pagamento Pendente #${order.localId || order.orderNumber}`,
        userId: operatorId,
        userName: operatorName,
        deviceId: devId,
      });
      return;
    }
  }
};

// --- 7. TRANSACTIONAL OUTBOX REPOSITORY ---
export const syncQueueRepository = {
  async getPending(): Promise<SyncQueueItem[]> {
    const list = await localDB.getAll<SyncQueueItem>('sync_queue');
    return list.filter(item => item.status === 'PENDING');
  },

  async enqueue(
    entity: SyncEntityName,
    entityId: string,
    operation: SyncOperationType,
    payload: any,
    deviceId: string
  ): Promise<SyncQueueItem> {
    const id = generateLocalId();
    const now = new Date().toISOString();

    const item: SyncQueueItem = {
      id,
      entity,
      entityId,
      operation,
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      deviceId,
    };

    await localDB.put('sync_queue', item);
    return item;
  },

  async updateStatus(id: string, status: SyncStatus, error?: string): Promise<void> {
    const item = await localDB.get<SyncQueueItem>('sync_queue', id);
    if (item) {
      item.status = status;
      item.attempts += 1;
      item.updatedAt = new Date().toISOString();
      item.lastAttemptAt = new Date().toISOString();
      if (error) item.error = error;
      await localDB.put('sync_queue', item);
    }
  },

  async delete(id: string): Promise<void> {
    await localDB.delete('sync_queue', id);
  }
};

// --- LEGACY BACKWARD COMPATIBLE EXPORTS ---
export async function addToSyncQueue(operation: string, payload: any): Promise<any> {
  const devId = await getOrRegisterDeviceId();
  return syncQueueRepository.enqueue('order', 'legacy-id', 'CREATE', payload, devId);
}

export async function getSyncQueue(): Promise<any[]> {
  return localDB.getAll('sync_queue');
}

export async function updateSyncQueueStatus(id: string, status: SyncStatus, error?: string): Promise<void> {
  await syncQueueRepository.updateStatus(id, status, error);
}

export async function deleteFromSyncQueue(id: string): Promise<void> {
  await syncQueueRepository.delete(id);
}

export async function getLocalProducts(): Promise<LocalProduct[]> {
  // Convert our strict cents back to decimal representation ONLY for backward-compatible rendering if needed,
  // but let's return standard object to let views display them nicely.
  return productsRepository.getAll();
}

export async function getLocalCategories(): Promise<LocalCategory[]> {
  return categoriesRepository.getAll();
}

export async function getLocalOrders(): Promise<Order[]> {
  return ordersRepository.getAll();
}

export async function createLocalOrder(orderData: any): Promise<Order> {
  // Map fields of incoming orderData to strict Order entity (using cents or converting as appropriate)
  const items: OrderItem[] = (orderData.items || []).map((item: any, index: number) => ({
    id: generateLocalId(),
    orderId: '',
    productId: item.productId,
    productNameSnapshot: item.name,
    unitPrice: typeof item.price === 'number' ? Math.round(item.price * 100) : 0, // safe conversion to cents if decimal
    quantity: item.quantity,
    subtotal: typeof item.subtotal === 'number' ? Math.round(item.subtotal * 100) : 0,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  const subtotalCents = items.reduce((acc, curr) => acc + curr.subtotal, 0);
  const discountCents = typeof orderData.totals?.discount === 'number' ? Math.round(orderData.totals.discount * 100) : 0;
  const feeCents = typeof orderData.totals?.fee === 'number' ? Math.round(orderData.totals.fee * 100) : 0;
  const deliveryFeeCents = typeof orderData.deliveryFee === 'number' ? Math.round(orderData.deliveryFee * 100) : 0;
  const totalCents = subtotalCents + feeCents + deliveryFeeCents - discountCents;

  const devId = await getOrRegisterDeviceId();

  const data: Omit<Order, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'> = {
    orderNumber: Date.now() % 10000,
    companyId: 'comp-1',
    customerId: orderData.customerId,
    tableId: orderData.tableId,
    deviceId: devId,
    origin: orderData.origin || 'COUNTER',
    status: 'DRAFT',
    items,
    subtotal: subtotalCents,
    discount: discountCents,
    serviceFee: feeCents,
    deliveryFee: deliveryFeeCents,
    total: totalCents,
    paymentStatus: 'PENDING',
    notes: orderData.notes,
  };

  return ordersRepository.create(data);
}

export async function getLocalTables(): Promise<LocalTable[]> {
  return tablesRepository.getAll();
}

export async function updateTableStatus(tableId: string, status: any, activeOrderId?: string): Promise<void> {
  const table = await tablesRepository.getById(tableId);
  if (table) {
    table.status = status;
    table.currentOrderId = activeOrderId;
    await tablesRepository.save(table);
  }
}
