/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, OrderStatus, OrderOrigin, PaymentStatus, OrderItem, OrderItemOption, OrderItemAddon, OrderItemAccompaniment, OrderCustomerSnapshot, OrderDeliverySnapshot, PaymentMethod, Table, ProductionTicket } from './storage/types';
import { ordersRepository, productionRepository, tablesRepository, cashRepository, productsRepository, syncQueueRepository, getOrRegisterDeviceId, generateLocalId } from './storage';
import { localDB } from './storage/idb';
import { formatCentsToBRL } from '../utils/currency';

/**
 * Validates if a transition from currentStatus to nextStatus is allowed according to business logic.
 */
export function canTransitionOrderStatus(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
  if (currentStatus === nextStatus) return false;

  switch (currentStatus) {
    case 'DRAFT':
      return nextStatus === 'PENDING' || nextStatus === 'CANCELLED';
    case 'PENDING':
      return nextStatus === 'CONFIRMED' || nextStatus === 'PREPARING' || nextStatus === 'CANCELLED';
    case 'CONFIRMED':
      return nextStatus === 'PREPARING' || nextStatus === 'CANCELLED';
    case 'PREPARING':
      return nextStatus === 'READY' || nextStatus === 'CANCELLED';
    case 'READY':
      return (
        nextStatus === 'PREPARING' ||
        nextStatus === 'OUT_FOR_DELIVERY' ||
        nextStatus === 'DELIVERED' ||
        nextStatus === 'COMPLETED' ||
        nextStatus === 'CANCELLED'
      );
    case 'OUT_FOR_DELIVERY':
      return nextStatus === 'DELIVERED' || nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED';
    case 'DELIVERED':
      return nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED';
    case 'COMPLETED':
    case 'CANCELLED':
      return false; // Terminal states
    default:
      return false;
  }
}

export interface TransitionAction {
  nextStatus: OrderStatus;
  label: string;
  buttonClass: string;
}

/**
 * Retrieves available status transition actions for a given order.
 */
export function getAvailableTransitions(order: Order): TransitionAction[] {
  const actions: TransitionAction[] = [];
  const status = order.status;

  if (status === 'PENDING') {
    actions.push({
      nextStatus: 'CONFIRMED',
      label: 'Confirmar Pedido',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold',
    });
    actions.push({
      nextStatus: 'PREPARING',
      label: 'Enviar Direto p/ Preparo',
      buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold',
    });
    actions.push({
      nextStatus: 'CANCELLED',
      label: 'Cancelar Pedido',
      buttonClass: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium',
    });
  } else if (status === 'CONFIRMED') {
    actions.push({
      nextStatus: 'PREPARING',
      label: 'Enviar p/ Preparo',
      buttonClass: 'bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold',
    });
    actions.push({
      nextStatus: 'CANCELLED',
      label: 'Cancelar Pedido',
      buttonClass: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium',
    });
  } else if (status === 'PREPARING') {
    actions.push({
      nextStatus: 'READY',
      label: 'Marcar como Pronto',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white font-extrabold',
    });
    actions.push({
      nextStatus: 'CANCELLED',
      label: 'Cancelar Pedido',
      buttonClass: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium',
    });
  } else if (status === 'READY') {
    if (order.origin === 'DELIVERY' || order.fulfillmentType === 'DELIVERY') {
      actions.push({
        nextStatus: 'OUT_FOR_DELIVERY',
        label: 'Saiu para Entrega',
        buttonClass: 'bg-purple-600 hover:bg-purple-700 text-white font-extrabold',
      });
      actions.push({
        nextStatus: 'COMPLETED',
        label: 'Concluir Pedido',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
      });
    } else {
      actions.push({
        nextStatus: 'COMPLETED',
        label: 'Concluir Pedido',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
      });
    }
    actions.push({
      nextStatus: 'CANCELLED',
      label: 'Cancelar Pedido',
      buttonClass: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium',
    });
  } else if (status === 'OUT_FOR_DELIVERY') {
    actions.push({
      nextStatus: 'DELIVERED',
      label: 'Marcar como Entregue',
      buttonClass: 'bg-teal-600 hover:bg-teal-700 text-white font-extrabold',
    });
    actions.push({
      nextStatus: 'COMPLETED',
      label: 'Concluir Pedido',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
    });
    actions.push({
      nextStatus: 'CANCELLED',
      label: 'Cancelar Pedido',
      buttonClass: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium',
    });
  } else if (status === 'DELIVERED') {
    actions.push({
      nextStatus: 'COMPLETED',
      label: 'Concluir Pedido',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold',
    });
  }

  return actions;
}

/**
 * Returns label, color styling and info for OrderOrigin.
 */
export function getOrderOriginConfig(origin: OrderOrigin): { label: string; colorClass: string } {
  switch (origin) {
    case 'CATALOG':
      return { label: 'Catálogo', colorClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'TABLE':
      return { label: 'Mesa', colorClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'COUNTER':
      return { label: 'Balcão', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'DELIVERY':
      return { label: 'Delivery', colorClass: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'WHATSAPP':
      return { label: 'WhatsApp', colorClass: 'bg-green-50 text-green-700 border-green-200' };
    case 'INTERNAL':
      return { label: 'Interno', colorClass: 'bg-slate-100 text-slate-700 border-slate-300' };
    default:
      return { label: origin, colorClass: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

/**
 * Returns label and color styling for OrderStatus.
 */
export function getOrderStatusConfig(status: OrderStatus): { label: string; colorClass: string } {
  switch (status) {
    case 'DRAFT':
      return { label: 'Rascunho', colorClass: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'PENDING':
      return { label: 'Pendente', colorClass: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'CONFIRMED':
      return { label: 'Confirmado', colorClass: 'bg-blue-100 text-blue-900 border-blue-300' };
    case 'PREPARING':
      return { label: 'Em Preparo', colorClass: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'READY':
      return { label: 'Pronto', colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Saiu p/ Entrega', colorClass: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'DELIVERED':
      return { label: 'Entregue', colorClass: 'bg-teal-100 text-teal-900 border-teal-300' };
    case 'COMPLETED':
      return { label: 'Concluído', colorClass: 'bg-green-100 text-green-900 border-green-300' };
    case 'CANCELLED':
      return { label: 'Cancelado', colorClass: 'bg-red-100 text-red-900 border-red-300' };
    default:
      return { label: status, colorClass: 'bg-slate-100 text-slate-800 border-slate-200' };
  }
}

/**
 * Returns label and color styling for PaymentStatus.
 */
export function getPaymentStatusConfig(paymentStatus: PaymentStatus): { label: string; colorClass: string } {
  switch (paymentStatus) {
    case 'PENDING':
      return { label: 'Pend. Pagamento', colorClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'PARTIAL':
      return { label: 'Pag. Parcial', colorClass: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'PAID':
      return { label: 'Pago', colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'REFUNDED':
      return { label: 'Reembolsado', colorClass: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'CANCELLED':
      return { label: 'Cancelado', colorClass: 'bg-red-50 text-red-800 border-red-200' };
    default:
      return { label: paymentStatus, colorClass: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

/**
 * Safely executes order status changes with re-fetching and concurrency checks.
 */
export async function changeOrderStatusSafely(orderId: string, nextStatus: OrderStatus): Promise<Order> {
  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Pedido não encontrado no IndexedDB.');
  }

  if (!canTransitionOrderStatus(freshOrder.status, nextStatus)) {
    throw new Error(`Transição inválida de status: ${freshOrder.status} -> ${nextStatus}`);
  }

  const now = new Date().toISOString();
  freshOrder.status = nextStatus;
  freshOrder.updatedAt = now;

  if (nextStatus === 'COMPLETED') {
    freshOrder.completedAt = now;
  } else if (nextStatus === 'CANCELLED') {
    freshOrder.cancelledAt = now;
  }

  // Cascata de status para os itens do pedido quando o status do pedido avança ou é cancelado
  if (freshOrder.items && freshOrder.items.length > 0) {
    if (nextStatus === 'CANCELLED') {
      freshOrder.items = freshOrder.items.map(item => ({
        ...item,
        status: 'CANCELLED',
        updatedAt: now
      }));
    } else if (nextStatus === 'PREPARING') {
      freshOrder.items = freshOrder.items.map(item => ({
        ...item,
        status: item.status === 'PENDING' ? 'PREPARING' : item.status,
        updatedAt: now
      }));
    } else if (nextStatus === 'READY') {
      freshOrder.items = freshOrder.items.map(item => ({
        ...item,
        status: item.status === 'CANCELLED' ? 'CANCELLED' : 'READY',
        updatedAt: now
      }));
    }
  }

  // Se cancelado, aciona cancelamento explícito dos tickets no KDS imediatamente
  if (nextStatus === 'CANCELLED') {
    try {
      await productionRepository.cancelTicketsForOrder(orderId);
    } catch (err) {
      console.warn('Erro ao cancelar tickets do KDS:', err);
    }
  }

  // Se o pedido possui mesa associada e foi cancelado, libera a mesa imediatamente.
  // Se o pedido foi concluído (COMPLETED), a mesa SOMENTE deve ser liberada se o
  // status financeiro for PAID (efetivamente pago). Caso contrário, a mesa continua
  // ocupada para cobrança/recebimento posterior.
  if (freshOrder.tableId) {
    if (nextStatus === 'CANCELLED') {
      try {
        const table = await tablesRepository.getById(freshOrder.tableId);
        if (table && (table.currentOrderId === freshOrder.id || table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT')) {
          table.status = 'FREE';
          table.currentOrderId = undefined;
          table.updatedAt = now;
          await tablesRepository.save(table);
        }
      } catch (err) {
        console.warn('Erro ao liberar mesa no IndexedDB após cancelamento:', err);
      }
    } else if (nextStatus === 'COMPLETED' && freshOrder.paymentStatus === 'PAID') {
      try {
        const table = await tablesRepository.getById(freshOrder.tableId);
        if (table && (table.currentOrderId === freshOrder.id || table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT')) {
          table.status = 'FREE';
          table.currentOrderId = undefined;
          table.updatedAt = now;
          await tablesRepository.save(table);
        }
      } catch (err) {
        console.warn('Erro ao liberar mesa no IndexedDB após conclusão e pagamento:', err);
      }
    }
  }

  // Update order in IndexedDB (automatically handles outbox + KDS ticket synchronization)
  await ordersRepository.update(freshOrder);

  return freshOrder;
}

// =========================================================================
// NÚCLEO DE DOMÍNIO — REGRAS DE EDIÇÃO DE PEDIDOS
// =========================================================================

export interface EditOrderPermission {
  allowed: boolean;
  canEditCustomer: boolean;
  canEditAddress: boolean;
  canEditFulfillmentType: boolean;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditQuantity: boolean;
  canEditNotes: boolean;
  reason?: string;
}

/**
 * Avalia de forma centralizada as permissões de edição de um pedido de acordo com o status atual do domínio.
 */
export function getOrderEditPermissions(order: Order): EditOrderPermission {
  switch (order.status) {
    case 'DRAFT':
    case 'PENDING':
    case 'CONFIRMED':
      return {
        allowed: true,
        canEditCustomer: true,
        canEditAddress: true,
        canEditFulfillmentType: true,
        canAddItems: true,
        canRemoveItems: true,
        canEditQuantity: true,
        canEditNotes: true,
      };

    case 'PREPARING':
      return {
        allowed: true,
        canEditCustomer: true,
        canEditAddress: true,
        canEditFulfillmentType: true,
        canAddItems: true,
        canRemoveItems: true, // Itens removidos são marcados como CANCELLED
        canEditQuantity: true,
        canEditNotes: true,
        reason: 'Pedido em preparo na cozinha. Novos itens entrarão como pendentes e itens removidos serão cancelados.',
      };

    case 'READY': {
      const isTableOrder = order.origin === 'TABLE' || Boolean(order.tableId);
      return {
        allowed: true,
        canEditCustomer: true,
        canEditAddress: true,
        canEditFulfillmentType: true,
        canAddItems: true,
        canRemoveItems: true,
        canEditQuantity: true,
        canEditNotes: true,
        reason: isTableOrder
          ? 'Comanda de salão ativa. Novos itens entrarão na fila de produção da cozinha.'
          : 'Pedido pronto. Novos itens adicionados serão enviados para a cozinha.',
      };
    }

    case 'OUT_FOR_DELIVERY':
      return {
        allowed: false,
        canEditCustomer: false,
        canEditAddress: false,
        canEditFulfillmentType: false,
        canAddItems: false,
        canRemoveItems: false,
        canEditQuantity: false,
        canEditNotes: false,
        reason: 'Pedido em rota de entrega com o entregador. Edição bloqueada.',
      };

    case 'DELIVERED':
    case 'COMPLETED':
      return {
        allowed: false,
        canEditCustomer: false,
        canEditAddress: false,
        canEditFulfillmentType: false,
        canAddItems: false,
        canRemoveItems: false,
        canEditQuantity: false,
        canEditNotes: false,
        reason: 'Pedido já finalizado.',
      };

    case 'CANCELLED':
    default:
      return {
        allowed: false,
        canEditCustomer: false,
        canEditAddress: false,
        canEditFulfillmentType: false,
        canAddItems: false,
        canRemoveItems: false,
        canEditQuantity: false,
        canEditNotes: false,
        reason: 'Pedido cancelado. Edição não permitida.',
      };
  }
}

export interface RecalculateTotalsParams {
  items: OrderItem[];
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
  deliveryFee?: number; // Integer in CENTS
  discount?: number; // Integer in CENTS
  serviceFee?: number; // Integer in CENTS
  changeFor?: number; // Integer in CENTS
}

export interface FinancialCalculationResult {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  serviceFee: number;
  total: number;
  changeFor?: number;
  changeDue?: number;
}

/**
 * Recalcula com precisão matemática em centavos inteiros os totais financeiros do pedido.
 */
export function calculateOrderFinancials(params: RecalculateTotalsParams): FinancialCalculationResult {
  const activeItems = (params.items || []).filter(item => item.status !== 'CANCELLED');
  
  const subtotal = activeItems.reduce((sum, item) => sum + (Math.round(item.subtotal) || 0), 0);
  
  // Taxa de entrega se aplica somente na modalidade DELIVERY
  const deliveryFee = params.fulfillmentType === 'DELIVERY' ? Math.max(0, Math.round(params.deliveryFee || 0)) : 0;
  const discount = Math.max(0, Math.round(params.discount || 0));
  const serviceFee = Math.max(0, Math.round(params.serviceFee || 0));

  const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);

  let changeFor = params.changeFor ? Math.max(0, Math.round(params.changeFor)) : undefined;
  let changeDue: number | undefined = undefined;

  if (changeFor !== undefined && changeFor > 0) {
    if (changeFor >= total) {
      changeDue = changeFor - total;
    } else {
      // Troco informado menor que o total
      changeDue = 0;
    }
  }

  return {
    subtotal,
    deliveryFee,
    discount,
    serviceFee,
    total,
    changeFor,
    changeDue,
  };
}

export interface EditOrderPayload {
  customerSnapshot?: Partial<OrderCustomerSnapshot>;
  deliverySnapshot?: Partial<OrderDeliverySnapshot>;
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
  notes?: string;
  items?: OrderItem[];
  discount?: number; // In CENTS
  deliveryFee?: number; // In CENTS
  paymentMethod?: PaymentMethod;
  changeFor?: number; // In CENTS
}

/**
 * Atualiza com segurança os dados de um pedido existente, garantindo consistência com o KDS e a Outbox.
 */
export async function updateOrderDetailsSafely(orderId: string, payload: EditOrderPayload): Promise<Order> {
  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Pedido não encontrado para edição.');
  }

  const permissions = getOrderEditPermissions(freshOrder);
  if (!permissions.allowed) {
    throw new Error(permissions.reason || 'Edição não permitida para este pedido.');
  }

  const now = new Date().toISOString();

  // 1. Atualização do Cliente
  if (payload.customerSnapshot && permissions.canEditCustomer) {
    freshOrder.customerSnapshot = {
      name: payload.customerSnapshot.name ?? freshOrder.customerSnapshot?.name ?? '',
      phone: payload.customerSnapshot.phone ?? freshOrder.customerSnapshot?.phone ?? '',
      address: payload.customerSnapshot.address ?? freshOrder.customerSnapshot?.address,
    };
  }

  // 2. Atualização da Modalidade (DELIVERY ↔ RETIRADA / BALCÃO)
  if (payload.fulfillmentType && permissions.canEditFulfillmentType) {
    freshOrder.fulfillmentType = payload.fulfillmentType;
  }

  // 3. Atualização de Endereço de Entrega
  if (payload.deliverySnapshot && permissions.canEditAddress) {
    freshOrder.deliverySnapshot = {
      address: payload.deliverySnapshot.address ?? freshOrder.deliverySnapshot?.address ?? '',
      number: payload.deliverySnapshot.number ?? freshOrder.deliverySnapshot?.number ?? '',
      complement: payload.deliverySnapshot.complement ?? freshOrder.deliverySnapshot?.complement,
      neighborhood: payload.deliverySnapshot.neighborhood ?? freshOrder.deliverySnapshot?.neighborhood ?? '',
      reference: payload.deliverySnapshot.reference ?? freshOrder.deliverySnapshot?.reference,
      city: payload.deliverySnapshot.city ?? freshOrder.deliverySnapshot?.city ?? '',
      state: payload.deliverySnapshot.state ?? freshOrder.deliverySnapshot?.state ?? '',
      postalCode: payload.deliverySnapshot.postalCode ?? freshOrder.deliverySnapshot?.postalCode ?? '',
      deliveryFee: freshOrder.fulfillmentType === 'DELIVERY' 
        ? (payload.deliveryFee ?? payload.deliverySnapshot.deliveryFee ?? freshOrder.deliveryFee ?? 0)
        : 0,
      driverId: payload.deliverySnapshot.driverId ?? freshOrder.deliverySnapshot?.driverId,
      status: payload.deliverySnapshot.status ?? freshOrder.deliverySnapshot?.status ?? 'PENDING',
    };
  }

  // 4. Atualização de Itens (se permitido)
  if (payload.items && (permissions.canAddItems || permissions.canRemoveItems || permissions.canEditQuantity)) {
    const existingItemsMap = new Map((freshOrder.items || []).map(i => [i.id, i]));
    const payloadItemsMap = new Map(payload.items.map(i => [i.id, i]));
    const mergedItems: OrderItem[] = [];

    // Preservar itens antigos que não constam no payload marcando-os como CANCELLED
    for (const oldItem of freshOrder.items || []) {
      if (!payloadItemsMap.has(oldItem.id)) {
        mergedItems.push({
          ...oldItem,
          status: 'CANCELLED',
          updatedAt: now,
        });
      }
    }

    // Processar itens do payload (atualizados ou novos)
    for (const item of payload.items) {
      const existing = existingItemsMap.get(item.id);
      if (existing) {
        mergedItems.push({
          ...existing,
          ...item,
          orderId: freshOrder.id,
          createdAt: existing.createdAt || now,
          updatedAt: now,
        });
      } else {
        mergedItems.push({
          ...item,
          id: item.id || generateLocalId(),
          orderId: freshOrder.id,
          status: item.status || 'PENDING',
          createdAt: item.createdAt || now,
          updatedAt: now,
        });
      }
    }

    freshOrder.items = mergedItems;
  }

  // 5. Atualização de Observações
  if (payload.notes !== undefined && permissions.canEditNotes) {
    freshOrder.notes = payload.notes;
  }

  // 6. Atualização de Pagamento
  if (payload.paymentMethod) {
    freshOrder.paymentMethod = payload.paymentMethod;
  }
  if (payload.changeFor !== undefined) {
    freshOrder.changeFor = payload.changeFor;
  }

  // 7. Recálculo Financeiro
  const effectiveDeliveryFee = freshOrder.fulfillmentType === 'DELIVERY' 
    ? (payload.deliveryFee !== undefined ? payload.deliveryFee : (freshOrder.deliveryFee || 0))
    : 0;

  const effectiveDiscount = payload.discount !== undefined ? payload.discount : (freshOrder.discount || 0);

  const previousTotal = freshOrder.total;

  const financials = calculateOrderFinancials({
    items: freshOrder.items,
    fulfillmentType: freshOrder.fulfillmentType,
    deliveryFee: effectiveDeliveryFee,
    discount: effectiveDiscount,
    serviceFee: freshOrder.serviceFee || 0,
    changeFor: freshOrder.changeFor,
  });

  freshOrder.subtotal = financials.subtotal;
  freshOrder.deliveryFee = financials.deliveryFee;
  freshOrder.discount = financials.discount;
  freshOrder.total = financials.total;
  freshOrder.changeFor = financials.changeFor;

  // Se o pedido estava marcado como PAGO e o total aumentou, ajusta para PARTIAL para evitar inconsistência
  if (freshOrder.paymentStatus === 'PAID' && financials.total > previousTotal) {
    freshOrder.paymentStatus = 'PARTIAL';
  }

  // Se o pedido estava 'READY' e novos itens pendentes/em preparo existem, volta para 'PREPARING'
  const hasUnfinishedItems = (freshOrder.items || []).some(
    item => item.status === 'PENDING' || item.status === 'PREPARING'
  );
  if (freshOrder.status === 'READY' && hasUnfinishedItems) {
    freshOrder.status = 'PREPARING';
  }

  freshOrder.updatedAt = now;

  // 8. Persistência e Sincronização
  await ordersRepository.update(freshOrder);

  return freshOrder;
}

// =========================================================================
// NÚCLEO DE DOMÍNIO — FECHAMENTO, PAGAMENTO E LIBERAÇÃO DE MESA (ETAPA 09.8.1)
// =========================================================================

export interface ProcessTablePaymentParams {
  tableId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  receivedAmountCents?: number;
  discountCents?: number;
  serviceFeeCents?: number;
  notes?: string;
  cashierId?: string;
  cashierName?: string;
}

export interface ProcessTablePaymentResult {
  order: Order;
  table: Table;
  changeDueCents: number;
}

/**
 * Solicita o fechamento da conta de uma mesa, alterando o status para WAITING_PAYMENT.
 * Revalida o estado no IndexedDB para concorrência e integridade.
 */
export async function requestTableAccountClosure(
  tableId: string,
  orderId?: string
): Promise<{ table: Table; order: Order }> {
  const freshTable = await tablesRepository.getById(tableId);
  if (!freshTable) {
    throw new Error('Mesa não encontrada no IndexedDB.');
  }

  if (freshTable.status !== 'OCCUPIED' && freshTable.status !== 'WAITING_PAYMENT') {
    throw new Error(`Apenas mesas ocupadas podem ter a conta fechada (status atual: ${freshTable.status}).`);
  }

  const targetOrderId = orderId || freshTable.currentOrderId;
  if (!targetOrderId) {
    throw new Error('Mesa não possui comanda vinculada no momento.');
  }

  const freshOrder = await ordersRepository.getById(targetOrderId);
  if (!freshOrder) {
    throw new Error('Comanda da mesa não encontrada no IndexedDB.');
  }

  const activeItems = (freshOrder.items || []).filter(i => i.status !== 'CANCELLED');
  if (activeItems.length === 0) {
    throw new Error('A comanda não possui itens válidos para fechamento.');
  }

  const now = new Date().toISOString();

  // Recalcular financeiros do pedido
  const financials = calculateOrderFinancials({
    items: freshOrder.items,
    discount: freshOrder.discount || 0,
    serviceFee: freshOrder.serviceFee || 0,
  });

  freshOrder.subtotal = financials.subtotal;
  freshOrder.total = financials.total;
  freshOrder.updatedAt = now;
  await ordersRepository.update(freshOrder);

  // Transicionar mesa para WAITING_PAYMENT
  freshTable.status = 'WAITING_PAYMENT';
  freshTable.currentOrderId = freshOrder.id;
  freshTable.updatedAt = now;
  await tablesRepository.save(freshTable);

  return { table: freshTable, order: freshOrder };
}

/**
 * Reabre a comanda de uma mesa que estava aguardando pagamento para permitir novos lançamentos.
 */
export async function reopenTableComanda(tableId: string): Promise<{ table: Table; order: Order | null }> {
  const freshTable = await tablesRepository.getById(tableId);
  if (!freshTable) {
    throw new Error('Mesa não encontrada no IndexedDB.');
  }

  if (freshTable.status === 'WAITING_PAYMENT') {
    freshTable.status = 'OCCUPIED';
    freshTable.updatedAt = new Date().toISOString();
    await tablesRepository.save(freshTable);
  }

  const freshOrder = freshTable.currentOrderId ? await ordersRepository.getById(freshTable.currentOrderId) : null;
  return { table: freshTable, order: freshOrder };
}

/**
 * Processa o pagamento de uma comanda/mesa com validação de caixa, idempotência e liberação imediata da mesa.
 */
export async function processTablePayment(
  params: ProcessTablePaymentParams
): Promise<ProcessTablePaymentResult> {
  const { tableId, orderId, paymentMethod, receivedAmountCents, discountCents, serviceFeeCents, notes, cashierId, cashierName } = params;

  // 1. Reconsulta no IndexedDB para concorrência
  const freshTable = await tablesRepository.getById(tableId);
  const freshOrder = await ordersRepository.getById(orderId);

  if (!freshTable || !freshOrder) {
    throw new Error('Mesa ou comanda não encontrada no banco de dados local.');
  }

  // 2. Proteção de Idempotência: Se o pedido já estiver PAGO e COMPLETED
  if (freshOrder.paymentStatus === 'PAID' && freshOrder.status === 'COMPLETED') {
    if (freshTable.status !== 'FREE') {
      freshTable.status = 'FREE';
      freshTable.currentOrderId = undefined;
      freshTable.updatedAt = new Date().toISOString();
      await tablesRepository.save(freshTable);
    }
    return { order: freshOrder, table: freshTable, changeDueCents: 0 };
  }

  // 3. Validação de Caixa Aberto
  const openRegister = await cashRepository.getOpenRegister();
  if (!openRegister) {
    throw new Error('Não existe caixa aberto para registrar este recebimento. É obrigatório abrir o caixa antes de receber.');
  }

  // 4. Validação de Itens
  const activeItems = (freshOrder.items || []).filter(i => i.status !== 'CANCELLED');
  if (activeItems.length === 0) {
    throw new Error('A comanda não possui itens ativos para cobrança.');
  }

  // 5. Recálculo Financeiro Seguro
  const effectiveDiscount = discountCents !== undefined ? Math.max(0, discountCents) : (freshOrder.discount || 0);
  const effectiveServiceFee = serviceFeeCents !== undefined ? Math.max(0, serviceFeeCents) : (freshOrder.serviceFee || 0);
  const effectiveReceived = paymentMethod === 'CASH' ? receivedAmountCents : undefined;

  const financials = calculateOrderFinancials({
    items: freshOrder.items,
    discount: effectiveDiscount,
    serviceFee: effectiveServiceFee,
    changeFor: effectiveReceived,
  });

  if (paymentMethod === 'CASH') {
    const received = receivedAmountCents || 0;
    if (received < financials.total) {
      throw new Error(`Valor recebido em dinheiro (${(received / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) é inferior ao total da conta (${(financials.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`);
    }
  }

  const now = new Date().toISOString();

  // 6. Atualizar Pedido
  freshOrder.subtotal = financials.subtotal;
  freshOrder.discount = financials.discount;
  freshOrder.serviceFee = financials.serviceFee;
  freshOrder.total = financials.total;
  freshOrder.paymentMethod = paymentMethod;
  freshOrder.paymentStatus = 'PAID';
  freshOrder.status = 'COMPLETED';
  freshOrder.completedAt = now;
  if (cashierId) freshOrder.cashierId = cashierId;
  if (notes !== undefined) freshOrder.notes = notes;
  if (paymentMethod === 'CASH') {
    freshOrder.changeFor = receivedAmountCents;
  }
  freshOrder.updatedAt = now;

  // Garantir que itens ativos estejam prontos/entregues
  freshOrder.items = freshOrder.items.map(item => {
    if (item.status === 'CANCELLED') return item;
    return {
      ...item,
      status: item.status === 'PENDING' ? 'READY' : item.status,
      updatedAt: now,
    };
  });

  // Atualizar pedido no IndexedDB (sincroniza KDS + Outbox + registra SALE no Caixa)
  await ordersRepository.update(freshOrder);

  // 7. Liberar Mesa no IndexedDB
  freshTable.status = 'FREE';
  freshTable.currentOrderId = undefined;
  freshTable.updatedAt = now;
  await tablesRepository.save(freshTable);

  return {
    order: freshOrder,
    table: freshTable,
    changeDueCents: financials.changeDue || 0,
  };
}

/**
 * Cancela comanda e libera a mesa imediatamente, cancelando tickets de produção.
 */
export async function cancelTableComanda(
  tableId: string,
  orderId: string,
  reason?: string
): Promise<{ table: Table; order: Order }> {
  const freshTable = await tablesRepository.getById(tableId);
  const freshOrder = await ordersRepository.getById(orderId);

  if (!freshTable || !freshOrder) {
    throw new Error('Mesa ou comanda não encontrada no IndexedDB.');
  }

  if (freshOrder.paymentStatus === 'PAID') {
    throw new Error('Não é possível cancelar uma comanda já paga. Para cancelamento pós-pagamento, realize o estorno no Caixa.');
  }

  const now = new Date().toISOString();

  // Cancelar pedido
  freshOrder.status = 'CANCELLED';
  freshOrder.cancelledAt = now;
  freshOrder.updatedAt = now;
  if (reason) {
    freshOrder.notes = freshOrder.notes ? `${freshOrder.notes} (Cancelado: ${reason})` : `Cancelado: ${reason}`;
  }
  freshOrder.items = (freshOrder.items || []).map(i => ({
    ...i,
    status: 'CANCELLED',
    updatedAt: now,
  }));

  try {
    await productionRepository.cancelTicketsForOrder(freshOrder.id);
  } catch (err) {
    console.warn('Erro ao cancelar tickets do KDS:', err);
  }

  await ordersRepository.update(freshOrder);

  // Liberar mesa
  freshTable.status = 'FREE';
  freshTable.currentOrderId = undefined;
  freshTable.updatedAt = now;
  await tablesRepository.save(freshTable);

  return { table: freshTable, order: freshOrder };
}

// =========================================================================
// NÚCLEO DE DOMÍNIO — GESTÃO OPERACIONAL DE ITENS DE COMANDA (ETAPA 09.8.2)
// =========================================================================

export interface AddProductToComandaParams {
  tableId: string;
  orderId?: string;
  productId: string;
  quantity: number;
  notes?: string;
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: OrderItemOption[];
  selectedAddons?: OrderItemAddon[];
  unitPriceOverride?: number;
}

export interface BatchProductInput {
  productId: string;
  quantity: number;
  notes?: string;
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: OrderItemOption[];
  selectedAddons?: OrderItemAddon[];
  unitPriceOverride?: number;
}

export interface AddBatchProductsToComandaParams {
  tableId: string;
  orderId?: string;
  items: BatchProductInput[];
}

/**
 * Adiciona múltiplos produtos de uma só vez (Rodada/Lote de Produção) diretamente à comanda ativa no IndexedDB.
 * Todos os itens desta operação recebem o mesmo roundNumber sequencial e roundId (ex: R001, R002),
 * garantindo independência nos tickets de KDS e rastreabilidade total no histórico da mesa.
 */
export async function addBatchProductsToTableComanda(
  params: AddBatchProductsToComandaParams
): Promise<{ order: Order; items: OrderItem[]; roundNumber: number; roundId: string }> {
  const { tableId, orderId, items } = params;

  if (!items || items.length === 0) {
    throw new Error('Nenhum produto fornecido para lançamento.');
  }

  const validItems = items.filter(it => it.productId && it.quantity > 0);
  if (validItems.length === 0) {
    throw new Error('Todos os produtos do lançamento devem ter quantidade maior que zero.');
  }

  // 1. Reconsulta no IndexedDB para concorrência
  const freshTable = await tablesRepository.getById(tableId);
  if (!freshTable) {
    throw new Error('Mesa não encontrada no IndexedDB.');
  }

  if (freshTable.status === 'WAITING_PAYMENT') {
    throw new Error('Não é possível adicionar produtos a uma mesa com conta fechada. Reabra a comanda primeiro para continuar o consumo.');
  }

  if (freshTable.status !== 'OCCUPIED') {
    throw new Error(`Apenas mesas ocupadas podem receber lançamentos (status atual: ${freshTable.status}).`);
  }

  const targetOrderId = orderId || freshTable.currentOrderId;
  if (!targetOrderId) {
    throw new Error('Mesa não possui comanda vinculada no momento.');
  }

  const freshOrder = await ordersRepository.getById(targetOrderId);
  if (!freshOrder) {
    throw new Error('Comanda da mesa não encontrada no IndexedDB.');
  }

  const permissions = getOrderEditPermissions(freshOrder);
  if (!permissions.canAddItems) {
    throw new Error(permissions.reason || 'Não é permitido adicionar itens a este pedido no momento.');
  }

  const now = new Date().toISOString();

  // Calcular número da próxima rodada
  const currentItems = freshOrder.items || [];
  const maxRound = currentItems.reduce((max, i) => Math.max(max, i.roundNumber || 1), 0);
  const nextRoundNumber = currentItems.length > 0 ? maxRound + 1 : 1;
  const nextRoundId = `R${String(nextRoundNumber).padStart(3, '0')}`;

  const createdOrderItems: OrderItem[] = [];

  for (const itemInput of validItems) {
    const product = await productsRepository.getById(itemInput.productId);
    if (!product) {
      throw new Error(`Produto não encontrado no catálogo (ID: ${itemInput.productId}).`);
    }

    if (!product.active) {
      throw new Error(`O produto "${product.name}" está inativo.`);
    }

    // Calcula unitPrice incluindo adicionais e acompanhamentos
    const accTotal = (itemInput.selectedAccompaniments || []).reduce(
      (acc, a) => acc + (a.subtotal !== undefined ? a.subtotal : a.priceSnapshot * a.quantity),
      0
    );
    const optTotal = (itemInput.selectedOptions || []).reduce(
      (acc, o) => acc + (o.additionalPrice || 0),
      0
    );
    const addTotal = (itemInput.selectedAddons || []).reduce(
      (acc, a) => acc + (a.price * a.quantity),
      0
    );

    const unitPrice = itemInput.unitPriceOverride !== undefined
      ? Math.round(itemInput.unitPriceOverride)
      : Math.round(product.price) + optTotal + addTotal + accTotal;

    const qty = Math.max(1, Math.round(itemInput.quantity));
    const subtotal = unitPrice * qty;

    const newItem: OrderItem = {
      id: generateLocalId(),
      orderId: freshOrder.id,
      productId: product.id,
      productNameSnapshot: product.name,
      unitPrice,
      quantity: qty,
      subtotal,
      notes: itemInput.notes?.trim() || undefined,
      status: 'PENDING',
      selectedAccompaniments: itemInput.selectedAccompaniments,
      selectedOptions: itemInput.selectedOptions,
      selectedAddons: itemInput.selectedAddons,
      roundNumber: nextRoundNumber,
      roundId: nextRoundId,
      createdAt: now,
      updatedAt: now,
    };

    createdOrderItems.push(newItem);
  }

  const updatedItems = [...currentItems, ...createdOrderItems];

  // Recalcular financeiros
  const financials = calculateOrderFinancials({
    items: updatedItems,
    discount: freshOrder.discount || 0,
    serviceFee: freshOrder.serviceFee || 0,
  });

  freshOrder.items = updatedItems;
  freshOrder.subtotal = financials.subtotal;
  freshOrder.total = financials.total;

  // Se o pedido de mesa estava como READY, ajusta de volta para PREPARING porque há novos itens PENDING a produzir
  if (freshOrder.status === 'READY') {
    freshOrder.status = 'PREPARING';
  }

  freshOrder.updatedAt = now;

  // Se o pedido estava marcado como PAGO anteriormente, reajusta status financeiro
  if (freshOrder.paymentStatus === 'PAID') {
    freshOrder.paymentStatus = 'PARTIAL';
  }

  await ordersRepository.update(freshOrder);

  return {
    order: freshOrder,
    items: createdOrderItems,
    roundNumber: nextRoundNumber,
    roundId: nextRoundId,
  };
}

/**
 * Adiciona produto diretamente à comanda ativa da mesa no IndexedDB,
 * com snapshot congelado de valores em centavos, recálculo financeiro seguro
 * e sincronização automática com KDS e Transactional Outbox.
 */
export async function addProductToTableComanda(
  params: AddProductToComandaParams
): Promise<{ order: Order; item: OrderItem }> {
  const { tableId, orderId, productId, quantity, notes, selectedAccompaniments, selectedOptions, selectedAddons, unitPriceOverride } = params;

  const result = await addBatchProductsToTableComanda({
    tableId,
    orderId,
    items: [
      {
        productId,
        quantity,
        notes,
        selectedAccompaniments,
        selectedOptions,
        selectedAddons,
        unitPriceOverride
      },
    ],
  });

  return {
    order: result.order,
    item: result.items[0],
  };
}

/**
 * Altera a quantidade de um item na comanda ativa.
 */
export async function updateComandaItemQuantity(params: {
  tableId: string;
  orderId: string;
  itemId: string;
  newQuantity: number;
}): Promise<Order> {
  const { tableId, orderId, itemId, newQuantity } = params;

  const freshTable = await tablesRepository.getById(tableId);
  if (!freshTable) {
    throw new Error('Mesa não encontrada no IndexedDB.');
  }

  if (freshTable.status === 'WAITING_PAYMENT') {
    throw new Error('Não é possível alterar itens de uma mesa com conta fechada. Reabra a comanda primeiro.');
  }

  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Comanda não encontrada no IndexedDB.');
  }

  const permissions = getOrderEditPermissions(freshOrder);
  if (!permissions.canEditQuantity) {
    throw new Error(permissions.reason || 'Não é permitido alterar quantidade de itens neste pedido.');
  }

  const itemIndex = (freshOrder.items || []).findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    throw new Error('Item não encontrado na comanda.');
  }

  const item = freshOrder.items[itemIndex];
  if (item.status === 'CANCELLED') {
    throw new Error('Não é possível alterar a quantidade de um item cancelado.');
  }

  const now = new Date().toISOString();

  if (newQuantity <= 0) {
    item.status = 'CANCELLED';
    item.updatedAt = now;
  } else {
    item.quantity = Math.round(newQuantity);
    item.subtotal = Math.round(item.unitPrice * item.quantity);
    item.updatedAt = now;
  }

  const financials = calculateOrderFinancials({
    items: freshOrder.items,
    discount: freshOrder.discount || 0,
    serviceFee: freshOrder.serviceFee || 0,
  });

  freshOrder.subtotal = financials.subtotal;
  freshOrder.total = financials.total;
  freshOrder.updatedAt = now;

  await ordersRepository.update(freshOrder);

  return freshOrder;
}

/**
 * Cancela um item individual da comanda preservando o histórico e atualizando o KDS.
 */
export async function cancelComandaItem(params: {
  tableId: string;
  orderId: string;
  itemId: string;
  reason?: string;
}): Promise<Order> {
  const { tableId, orderId, itemId, reason } = params;

  const freshTable = await tablesRepository.getById(tableId);
  if (!freshTable) {
    throw new Error('Mesa não encontrada no IndexedDB.');
  }

  if (freshTable.status === 'WAITING_PAYMENT') {
    throw new Error('Não é possível cancelar itens de uma mesa com conta fechada. Reabra a comanda primeiro.');
  }

  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Comanda não encontrada no IndexedDB.');
  }

  const permissions = getOrderEditPermissions(freshOrder);
  if (!permissions.canRemoveItems) {
    throw new Error(permissions.reason || 'Não é permitido remover/cancelar itens deste pedido.');
  }

  const item = (freshOrder.items || []).find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item não encontrado na comanda.');
  }

  if (item.status === 'CANCELLED') {
    return freshOrder;
  }

  const now = new Date().toISOString();
  item.status = 'CANCELLED';
  if (reason) {
    item.notes = item.notes ? `${item.notes} (Cancelado: ${reason})` : `Cancelado: ${reason}`;
  }
  item.updatedAt = now;

  const financials = calculateOrderFinancials({
    items: freshOrder.items,
    discount: freshOrder.discount || 0,
    serviceFee: freshOrder.serviceFee || 0,
  });

  freshOrder.subtotal = financials.subtotal;
  freshOrder.total = financials.total;
  freshOrder.updatedAt = now;

  await ordersRepository.update(freshOrder);

  return freshOrder;
}

/**
 * Envia uma rodada específica de um pedido/comanda para preparo na cozinha/bar.
 * Altera apenas os itens PENDING daquela rodada para PREPARING e atualiza o KDS.
 */
export async function sendRoundToPreparation(
  orderId: string,
  roundIdOrNumber: string | number
): Promise<{ order: Order; tickets: ProductionTicket[] }> {
  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Pedido não encontrado no IndexedDB.');
  }

  const now = new Date().toISOString();

  const targetRoundId = typeof roundIdOrNumber === 'string'
    ? roundIdOrNumber
    : `R${String(roundIdOrNumber).padStart(3, '0')}`;

  const targetRoundNum = typeof roundIdOrNumber === 'number'
    ? roundIdOrNumber
    : parseInt(String(roundIdOrNumber).replace(/\D/g, ''), 10) || 1;

  let itemsUpdated = 0;
  if (freshOrder.items && freshOrder.items.length > 0) {
    freshOrder.items = freshOrder.items.map(item => {
      const itemRoundNum = item.roundNumber || 1;
      const itemRoundId = item.roundId || `R${String(itemRoundNum).padStart(3, '0')}`;

      const isMatch =
        itemRoundId === targetRoundId ||
        itemRoundNum === targetRoundNum ||
        (targetRoundId === 'R001' && !item.roundId && itemRoundNum === 1);

      if (isMatch && item.status === 'PENDING') {
        itemsUpdated++;
        return {
          ...item,
          status: 'PREPARING',
          updatedAt: now,
        };
      }
      return item;
    });
  }

  if (itemsUpdated > 0) {
    if (freshOrder.status === 'PENDING' || freshOrder.status === 'CONFIRMED') {
      freshOrder.status = 'PREPARING';
    }
    freshOrder.updatedAt = now;
    await ordersRepository.update(freshOrder);
  }

  // Atualizar tickets do KDS especificamente
  const tickets = await productionRepository.getAllTickets();
  const targetTickets = tickets.filter(
    t =>
      t.orderId === freshOrder.id &&
      !t.deletedAt &&
      (t.roundId === targetRoundId || t.roundNumber === targetRoundNum)
  );

  const devId = await getOrRegisterDeviceId();
  for (const ticket of targetTickets) {
    let ticketModified = false;
    if (ticket.status === 'PENDING') {
      ticket.status = 'PREPARING';
      ticketModified = true;
    }
    ticket.items = ticket.items.map(pi => {
      if (pi.status === 'PENDING') {
        ticketModified = true;
        return { ...pi, status: 'PREPARING', updatedAt: now };
      }
      return pi;
    });

    if (ticketModified) {
      ticket.updatedAt = now;
      await localDB.put('production_tickets', ticket);
      await syncQueueRepository.enqueue('production_ticket', ticket.id, 'UPDATE', ticket, devId);
    }
  }

  // Re-sincronizar tickets do KDS para garantir idempotência
  await productionRepository.syncTicketsFromOrders();

  return {
    order: freshOrder,
    tickets: targetTickets,
  };
}

// =========================================================================
// NÚCLEO DE DOMÍNIO — CONFIRMAÇÃO DE PAGAMENTO NA ENTREGA (ETAPA 09.9)
// =========================================================================

export interface ConfirmCatalogDeliveryPaymentParams {
  orderId: string;
  paymentMethod?: PaymentMethod;
  receivedAmountCents?: number;
  cashierId?: string;
  cashierName?: string;
  notes?: string;
  completeOrderAfterPayment?: boolean;
}

export interface ConfirmCatalogDeliveryPaymentResult {
  order: Order;
  changeDueCents: number;
  cashMovementCreated: boolean;
  registeredCashRegisterId?: string;
}

/**
 * Confirma o recebimento financeiro de pedidos de Catálogo / Delivery com pagamento pendente,
 * garantindo integração estrita com o Caixa Operacional (gerando SALE no caixa aberto),
 * concorrência via reconsulta IndexedDB, cálculo matemático de troco em centavos inteiros,
 * idempotência absoluta e preservação total do fluxo de produção no KDS.
 */
export async function confirmCatalogDeliveryPayment(
  params: ConfirmCatalogDeliveryPaymentParams
): Promise<ConfirmCatalogDeliveryPaymentResult> {
  const {
    orderId,
    paymentMethod,
    receivedAmountCents,
    cashierId,
    cashierName,
    notes,
    completeOrderAfterPayment,
  } = params;

  if (!orderId) {
    throw new Error('ID do pedido não informado para confirmação de pagamento.');
  }

  // 1. Reconsulta fresca no IndexedDB para concorrência e integridade
  const freshOrder = await ordersRepository.getById(orderId);
  if (!freshOrder) {
    throw new Error('Pedido não encontrado no IndexedDB.');
  }

  // 2. Validações de integridade de estado
  if (freshOrder.status === 'CANCELLED') {
    throw new Error('Não é possível confirmar o pagamento de um pedido cancelado.');
  }

  if (freshOrder.total < 0 || isNaN(freshOrder.total)) {
    throw new Error('O valor total do pedido é inválido para cobrança.');
  }

  // 3. Idempotência estrita: se já estiver PAGO, retorna o estado sem duplicar movimentação de caixa
  if (freshOrder.paymentStatus === 'PAID') {
    return {
      order: freshOrder,
      changeDueCents: 0,
      cashMovementCreated: false,
    };
  }

  // 4. Validação obrigatória de Caixa Operacional Aberto
  const openRegister = await cashRepository.getOpenRegister();
  if (!openRegister) {
    throw new Error('Não é possível confirmar o pagamento porque não existe um Caixa aberto.');
  }

  // 5. Determinação da Forma de Pagamento Efetiva
  const effectivePaymentMethod = paymentMethod || freshOrder.paymentMethod;
  if (!effectivePaymentMethod) {
    throw new Error('Forma de pagamento não informada. Selecione o meio de pagamento utilizado.');
  }

  // 6. Tratamento de Dinheiro (CASH) e Troco em centavos inteiros
  let changeDueCents = 0;
  if (effectivePaymentMethod === 'CASH') {
    const totalToPay = freshOrder.total;
    const received = receivedAmountCents !== undefined && receivedAmountCents > 0
      ? Math.round(receivedAmountCents)
      : (freshOrder.changeFor && freshOrder.changeFor >= totalToPay ? freshOrder.changeFor : totalToPay);

    if (received < totalToPay) {
      throw new Error(`Valor recebido em dinheiro (${formatCentsToBRL(received)}) é inferior ao total do pedido (${formatCentsToBRL(totalToPay)}).`);
    }

    changeDueCents = Math.max(0, received - totalToPay);
    freshOrder.changeFor = received;
  }

  const now = new Date().toISOString();

  // 7. Atualização do Pedido
  freshOrder.paymentMethod = effectivePaymentMethod;
  freshOrder.paymentStatus = 'PAID';
  freshOrder.updatedAt = now;

  if (cashierId) {
    freshOrder.cashierId = cashierId;
  }

  if (notes && notes.trim()) {
    freshOrder.notes = freshOrder.notes
      ? `${freshOrder.notes} (Pgto: ${notes.trim()})`
      : `Pgto: ${notes.trim()}`;
  }

  if (completeOrderAfterPayment) {
    freshOrder.status = 'COMPLETED';
    freshOrder.completedAt = now;
  }

  // 8. Persistência no IndexedDB e Outbox (atualiza dados e sincroniza tickets)
  await ordersRepository.update(freshOrder);

  // 9. Sincronização garantida da movimentação de venda (SALE) no Caixa aberto
  await cashRepository.syncOrderCashMovement(freshOrder, cashierId, cashierName);

  return {
    order: freshOrder,
    changeDueCents,
    cashMovementCreated: true,
    registeredCashRegisterId: openRegister.id,
  };
}

