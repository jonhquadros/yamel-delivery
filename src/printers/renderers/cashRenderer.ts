/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CashMovement, CashRegister, PaymentMethod } from '../../services/storage/types';
import { PrintPayload, PrinterPaperWidth, PrintSection } from '../types';
import { renderSectionsToText, formatCentsToBRL } from './formatters';

export interface CashReceiptRenderOptions {
  orderLocalId: string;
  totalCents: number;
  paidAmountCents: number;
  paymentMethod: PaymentMethod;
  changeCents?: number;
  customerName?: string;
  createdAt?: string;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

export interface CashMovementRenderOptions {
  movement: CashMovement;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

export interface CashRegisterClosingRenderOptions {
  register: CashRegister;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

/**
 * Renderer de comprovante de pagamento rápido do caixa.
 */
export function renderCashReceipt(options: CashReceiptRenderOptions): PrintPayload {
  const {
    orderLocalId,
    totalCents,
    paidAmountCents,
    paymentMethod,
    changeCents = 0,
    customerName,
    createdAt,
    paperWidth = 80,
    isReprint = false,
  } = options;

  const sections: PrintSection[] = [];

  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  sections.push({ type: 'HEADER', text: 'YAMEL - COMPROVANTE DE PAGAMENTO' });

  sections.push({ type: 'TEXT', text: `PEDIDO: #${orderLocalId}`, bold: true });

  const dateObj = createdAt ? new Date(createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString('pt-BR');
  const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  sections.push({ type: 'TEXT', text: `Data: ${dateStr} ${timeStr}` });

  if (customerName) {
    sections.push({ type: 'TEXT', text: `Cliente: ${customerName}` });
  }

  sections.push({ type: 'LINE' });

  sections.push({
    type: 'TOTAL',
    leftText: 'Valor Total:',
    rightText: formatCentsToBRL(totalCents),
  });

  sections.push({
    type: 'TOTAL',
    leftText: 'Valor Pago:',
    rightText: formatCentsToBRL(paidAmountCents),
    bold: true,
  });

  sections.push({ type: 'TEXT', text: `Forma de Pagamento: ${paymentMethod}` });

  if (paymentMethod === 'CASH' && changeCents > 0) {
    sections.push({
      type: 'ITEM',
      leftText: 'Troco a devolver:',
      rightText: formatCentsToBRL(changeCents),
      bold: true,
    });
  }

  sections.push({ type: 'LINE' });
  sections.push({ type: 'TEXT', text: 'PAGAMENTO CONFIRMADO E REGISTRADO NO CAIXA', align: 'center' });
  sections.push({ type: 'FOOTER', text: 'OBRIGADO PELA PREFERÊNCIA!' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Recibo Caixa #${orderLocalId}`,
    content,
    width: paperWidth,
    sections,
    data: {
      orderLocalId,
      totalCents,
      paidAmountCents,
      paymentMethod,
      changeCents,
      isReprint,
    },
  };
}

/**
 * Renderer para movimentação individual de caixa (Sangria, Suprimento, Venda, etc.).
 */
export function renderCashMovement(options: CashMovementRenderOptions): PrintPayload {
  const { movement, paperWidth = 80, isReprint = false } = options;
  const sections: PrintSection[] = [];

  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  const typeMap: Record<string, string> = {
    SALE: 'VENDA EM CAIXA',
    REFUND: 'REEMBOLSO / ESTORNO',
    WITHDRAWAL: 'SANGRIA / RETIRADA',
    DEPOSIT: 'SUPRIMENTO / DEPÓSITO',
    ADJUSTMENT: 'AJUSTE DE CAIXA',
  };

  const titleType = typeMap[movement.type] || movement.type;
  sections.push({ type: 'HEADER', text: `YAMEL - MOVIMENTAÇÃO DE CAIXA` });
  sections.push({ type: 'TEXT', text: `TIPO: ${titleType}`, bold: true });

  const dateObj = movement.createdAt ? new Date(movement.createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString('pt-BR');
  const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  sections.push({ type: 'TEXT', text: `Data: ${dateStr} ${timeStr}` });

  if (movement.userName) {
    sections.push({ type: 'TEXT', text: `Operador: ${movement.userName}` });
  }

  if (movement.orderLocalId) {
    sections.push({ type: 'TEXT', text: `Pedido Ref.: #${movement.orderLocalId}` });
  }

  sections.push({ type: 'LINE' });

  sections.push({
    type: 'TOTAL',
    leftText: 'Valor:',
    rightText: formatCentsToBRL(movement.amount),
    bold: true,
  });

  sections.push({ type: 'TEXT', text: `Forma de Pagamento: ${movement.paymentMethod}` });

  if (movement.description) {
    sections.push({ type: 'TEXT', text: `Descrição/Motivo: ${movement.description}` });
  }

  sections.push({ type: 'FOOTER', text: 'YAMEL CAIXA' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Movimentação Caixa (${titleType})`,
    content,
    width: paperWidth,
    sections,
    data: {
      movementId: movement.id,
      type: movement.type,
      amountCents: movement.amount,
      isReprint,
    },
  };
}

/**
 * Renderer para fechamento de caixa.
 */
export function renderCashRegisterClosing(options: CashRegisterClosingRenderOptions): PrintPayload {
  const { register, paperWidth = 80, isReprint = false } = options;
  const sections: PrintSection[] = [];

  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  sections.push({ type: 'HEADER', text: 'YAMEL - FECHAMENTO DE CAIXA' });

  if (register.localId) {
    sections.push({ type: 'TEXT', text: `CAIXA: #${register.localId}`, bold: true });
  }

  sections.push({ type: 'TEXT', text: `Status: ${register.status}` });

  if (register.openedByName) {
    sections.push({ type: 'TEXT', text: `Aberto por: ${register.openedByName}` });
  }
  if (register.openedAt) {
    const dateObj = new Date(register.openedAt);
    sections.push({ type: 'TEXT', text: `Abertura: ${dateObj.toLocaleDateString('pt-BR')} ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` });
  }

  if (register.closedByName) {
    sections.push({ type: 'TEXT', text: `Fechado por: ${register.closedByName}` });
  }
  if (register.closedAt) {
    const dateObj = new Date(register.closedAt);
    sections.push({ type: 'TEXT', text: `Fechamento: ${dateObj.toLocaleDateString('pt-BR')} ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` });
  }

  sections.push({ type: 'LINE' });

  // Summary
  sections.push({ type: 'TEXT', text: 'RESUMO FINANCEIRO', bold: true });

  sections.push({
    type: 'TOTAL',
    leftText: 'Fundo Inicial:',
    rightText: formatCentsToBRL(register.openingAmount || 0),
  });

  if (register.closingCounts) {
    const cc = register.closingCounts;
    sections.push({ type: 'LINE', text: '-' });
    sections.push({ type: 'TEXT', text: 'CONTAGEM DE FECHAMENTO:' });
    if (cc.cash !== undefined) sections.push({ type: 'ITEM', leftText: 'Dinheiro:', rightText: formatCentsToBRL(cc.cash), indent: 2 });
    if (cc.pix !== undefined) sections.push({ type: 'ITEM', leftText: 'PIX:', rightText: formatCentsToBRL(cc.pix), indent: 2 });
    if (cc.creditCard !== undefined) sections.push({ type: 'ITEM', leftText: 'Crédito:', rightText: formatCentsToBRL(cc.creditCard), indent: 2 });
    if (cc.debitCard !== undefined) sections.push({ type: 'ITEM', leftText: 'Débito:', rightText: formatCentsToBRL(cc.debitCard), indent: 2 });
    if (cc.mealVoucher !== undefined) sections.push({ type: 'ITEM', leftText: 'Voucher:', rightText: formatCentsToBRL(cc.mealVoucher), indent: 2 });
    if (cc.other !== undefined) sections.push({ type: 'ITEM', leftText: 'Outros:', rightText: formatCentsToBRL(cc.other), indent: 2 });
  }

  sections.push({ type: 'LINE', text: '-' });

  if (register.expectedAmount !== undefined) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Total Esperado:',
      rightText: formatCentsToBRL(register.expectedAmount),
    });
  }

  if (register.closingAmount !== undefined) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Total Informado:',
      rightText: formatCentsToBRL(register.closingAmount),
      bold: true,
    });
  }

  if (register.difference !== undefined) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Diferença:',
      rightText: formatCentsToBRL(register.difference),
      bold: true,
    });
  }

  if (register.closingNotes) {
    sections.push({ type: 'LINE' });
    sections.push({ type: 'TEXT', text: `Observações: ${register.closingNotes}` });
  }

  sections.push({ type: 'FOOTER', text: 'RELATÓRIO DE CAIXA YAMEL' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Fechamento Caixa #${register.localId || register.id}`,
    content,
    width: paperWidth,
    sections,
    data: {
      registerId: register.id,
      localId: register.localId,
      expectedAmount: register.expectedAmount,
      closingAmount: register.closingAmount,
      difference: register.difference,
      isReprint,
    },
  };
}
