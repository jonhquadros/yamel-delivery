/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CashRegister,
  CashMovement,
  CashMovementType,
  PaymentMethod,
  Order,
  CashRegisterClosingCounts
} from './storage/types';
import { cashRepository, getOrRegisterDeviceId } from './storage';

export interface MethodFinancialSummary {
  amount: number; // Integer in CENTS
  count: number;
}

export interface RegisterSummary {
  register: CashRegister;
  movements: CashMovement[];
  openingAmount: number; // Integer in CENTS
  salesTotal: number; // Integer in CENTS
  salesCount: number;
  salesByMethod: Record<PaymentMethod, MethodFinancialSummary>;
  depositsTotal: number; // Suprimentos in CENTS
  depositsCount: number;
  withdrawalsTotal: number; // Sangrias in CENTS
  withdrawalsCount: number;
  refundsTotal: number; // Estornos in CENTS
  refundsCount: number;
  adjustmentsTotal: number; // Ajustes in CENTS
  adjustmentsCount: number;
  expectedPhysicalCash: number; // Dinheiro físico esperado na gaveta in CENTS
  expectedElectronicTotal: number; // Pix + Cartões + Vouchers in CENTS
  expectedTotal: number; // Total esperado apurado in CENTS
  closingAmount?: number; // Valor declarado no fechamento in CENTS
  difference?: number; // closingAmount - expectedTotal in CENTS
  ordersCount: number;
  averageTicket: number; // Ticket médio in CENTS
}

/**
 * Recalcula com precisão matemática em centavos inteiros todos os totais do caixa.
 */
export function calculateRegisterSummary(
  register: CashRegister,
  movements: CashMovement[]
): RegisterSummary {
  const openingAmount = Math.max(0, register.openingAmount || 0);

  let salesTotal = 0;
  let salesCount = 0;
  let depositsTotal = 0;
  let depositsCount = 0;
  let withdrawalsTotal = 0;
  let withdrawalsCount = 0;
  let refundsTotal = 0;
  let refundsCount = 0;
  let adjustmentsTotal = 0;
  let adjustmentsCount = 0;

  const salesByMethod: Record<PaymentMethod, MethodFinancialSummary> = {
    CASH: { amount: 0, count: 0 },
    PIX: { amount: 0, count: 0 },
    CREDIT_CARD: { amount: 0, count: 0 },
    DEBIT_CARD: { amount: 0, count: 0 },
    MEAL_VOUCHER: { amount: 0, count: 0 },
    OTHER: { amount: 0, count: 0 }
  };

  const refundsByMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    PIX: 0,
    CREDIT_CARD: 0,
    DEBIT_CARD: 0,
    MEAL_VOUCHER: 0,
    OTHER: 0
  };

  const uniqueOrders = new Set<string>();

  for (const mov of movements) {
    const amt = Math.abs(mov.amount || 0);
    const method = mov.paymentMethod || 'CASH';

    switch (mov.type) {
      case 'SALE':
        salesTotal += amt;
        salesCount += 1;
        if (salesByMethod[method]) {
          salesByMethod[method].amount += amt;
          salesByMethod[method].count += 1;
        }
        if (mov.orderId) {
          uniqueOrders.add(mov.orderId);
        }
        break;

      case 'DEPOSIT':
        depositsTotal += amt;
        depositsCount += 1;
        break;

      case 'WITHDRAWAL':
        withdrawalsTotal += amt;
        withdrawalsCount += 1;
        break;

      case 'REFUND':
        refundsTotal += amt;
        refundsCount += 1;
        if (refundsByMethod[method] !== undefined) {
          refundsByMethod[method] += amt;
        }
        break;

      case 'ADJUSTMENT':
        adjustmentsTotal += mov.amount; // Can be positive or negative
        adjustmentsCount += 1;
        break;
    }
  }

  // Dinheiro Físico Esperado na Gaveta:
  // Saldo de Abertura + Vendas em Dinheiro Líquidas + Suprimentos - Sangrias
  const netCashSales = Math.max(0, salesByMethod.CASH.amount - refundsByMethod.CASH);
  const expectedPhysicalCash = Math.max(
    0,
    openingAmount +
      netCashSales +
      depositsTotal -
      withdrawalsTotal
  );

  // Meios Eletrônicos Esperados (Pix + Cartões + Vouchers + Outros Líquidos):
  const expectedElectronicTotal = Math.max(
    0,
    Math.max(0, salesByMethod.PIX.amount - refundsByMethod.PIX) +
      Math.max(0, salesByMethod.CREDIT_CARD.amount - refundsByMethod.CREDIT_CARD) +
      Math.max(0, salesByMethod.DEBIT_CARD.amount - refundsByMethod.DEBIT_CARD) +
      Math.max(0, salesByMethod.MEAL_VOUCHER.amount - refundsByMethod.MEAL_VOUCHER) +
      Math.max(0, salesByMethod.OTHER.amount - refundsByMethod.OTHER)
  );

  // Total de Vendas Válidas Líquidas (sem cancelamentos/estornos)
  const netSalesTotal = Math.max(0, salesTotal - refundsTotal);
  const netSalesCount = Math.max(0, salesCount - refundsCount);

  // Total Geral Esperado
  const expectedTotal = expectedPhysicalCash + expectedElectronicTotal + adjustmentsTotal;

  // Diferença de Fechamento (se fechado)
  const closingAmount = register.closingAmount;
  let difference: number | undefined = undefined;
  if (closingAmount !== undefined) {
    difference = closingAmount - expectedTotal;
  }

  const ordersCount = Math.max(0, (uniqueOrders.size || salesCount) - refundsCount);
  const averageTicket = ordersCount > 0 ? Math.round(netSalesTotal / ordersCount) : 0;

  return {
    register,
    movements,
    openingAmount,
    salesTotal: netSalesTotal,
    salesCount: netSalesCount,
    salesByMethod: {
      CASH: { amount: Math.max(0, salesByMethod.CASH.amount - refundsByMethod.CASH), count: Math.max(0, salesByMethod.CASH.count - (refundsByMethod.CASH > 0 ? 1 : 0)) },
      PIX: { amount: Math.max(0, salesByMethod.PIX.amount - refundsByMethod.PIX), count: Math.max(0, salesByMethod.PIX.count - (refundsByMethod.PIX > 0 ? 1 : 0)) },
      CREDIT_CARD: { amount: Math.max(0, salesByMethod.CREDIT_CARD.amount - refundsByMethod.CREDIT_CARD), count: Math.max(0, salesByMethod.CREDIT_CARD.count - (refundsByMethod.CREDIT_CARD > 0 ? 1 : 0)) },
      DEBIT_CARD: { amount: Math.max(0, salesByMethod.DEBIT_CARD.amount - refundsByMethod.DEBIT_CARD), count: Math.max(0, salesByMethod.DEBIT_CARD.count - (refundsByMethod.DEBIT_CARD > 0 ? 1 : 0)) },
      MEAL_VOUCHER: { amount: Math.max(0, salesByMethod.MEAL_VOUCHER.amount - refundsByMethod.MEAL_VOUCHER), count: Math.max(0, salesByMethod.MEAL_VOUCHER.count - (refundsByMethod.MEAL_VOUCHER > 0 ? 1 : 0)) },
      OTHER: { amount: Math.max(0, salesByMethod.OTHER.amount - refundsByMethod.OTHER), count: Math.max(0, salesByMethod.OTHER.count - (refundsByMethod.OTHER > 0 ? 1 : 0)) },
    },
    depositsTotal,
    depositsCount,
    withdrawalsTotal,
    withdrawalsCount,
    refundsTotal,
    refundsCount,
    adjustmentsTotal,
    adjustmentsCount,
    expectedPhysicalCash,
    expectedElectronicTotal,
    expectedTotal,
    closingAmount,
    difference,
    ordersCount,
    averageTicket
  };
}

export interface OpenRegisterParams {
  openingAmount: number; // Integer in CENTS
  userId: string;
  userName?: string;
  notes?: string;
}

export interface CloseRegisterParams {
  registerId: string;
  closingAmount: number; // Integer in CENTS
  userId: string;
  userName?: string;
  notes?: string;
  closingCounts?: CashRegisterClosingCounts;
}

export interface AddMovementParams {
  cashRegisterId: string;
  type: CashMovementType;
  amount: number; // Integer in CENTS
  paymentMethod: PaymentMethod;
  description: string;
  userId: string;
  userName?: string;
  orderId?: string;
  orderLocalId?: string;
}

export const cashService = {
  /**
   * Obtém o caixa atualmente aberto no sistema.
   */
  async getOpenRegister(): Promise<CashRegister | null> {
    return cashRepository.getOpenRegister();
  },

  /**
   * Obtém a lista de todos os caixas (ordenados do mais recente para o mais antigo).
   */
  async getAllRegisters(): Promise<CashRegister[]> {
    return cashRepository.getAll();
  },

  /**
   * Obtém os detalhes de um caixa específico pelo ID.
   */
  async getRegisterById(id: string): Promise<CashRegister | null> {
    return cashRepository.getById(id);
  },

  /**
   * Obtém todas as movimentações de um caixa específico.
   */
  async getMovements(registerId: string): Promise<CashMovement[]> {
    return cashRepository.getMovements(registerId);
  },

  /**
   * Obtém o resumo financeiro consolidado do caixa aberto ou de um caixa específico.
   */
  async getRegisterSummary(registerId?: string): Promise<RegisterSummary | null> {
    let register: CashRegister | null = null;
    if (registerId) {
      register = await cashRepository.getById(registerId);
    } else {
      register = await cashRepository.getOpenRegister();
    }

    if (!register) return null;

    const movements = await cashRepository.getMovements(register.id);
    return calculateRegisterSummary(register, movements);
  },

  /**
   * Realiza a Abertura Operacional do Caixa.
   */
  async openRegister(params: OpenRegisterParams): Promise<CashRegister> {
    const deviceId = await getOrRegisterDeviceId();
    return cashRepository.open(params.openingAmount, params.userId, deviceId, {
      userName: params.userName,
      notes: params.notes
    });
  },

  /**
   * Realiza o Fechamento Operacional do Caixa com conferência.
   */
  async closeRegister(params: CloseRegisterParams): Promise<CashRegister> {
    return cashRepository.close(params.registerId, params.closingAmount, params.userId, {
      userName: params.userName,
      notes: params.notes,
      closingCounts: params.closingCounts
    });
  },

  /**
   * Registra uma movimentação no caixa (Suprimento, Sangria, Estorno, Ajuste).
   */
  async addMovement(params: AddMovementParams): Promise<CashMovement> {
    const deviceId = await getOrRegisterDeviceId();
    return cashRepository.addMovement({
      ...params,
      deviceId
    });
  },

  /**
   * Sincroniza o pagamento de um pedido com o caixa aberto atual.
   */
  async recordOrderPayment(order: Order, userId?: string, userName?: string): Promise<void> {
    await cashRepository.syncOrderCashMovement(order, userId, userName);
  }
};
