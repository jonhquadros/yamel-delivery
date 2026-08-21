/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../../services/storage/types';
import { PrintPayload, PrinterPaperWidth, PrintSection } from '../types';
import { renderSectionsToText, formatCentsToBRL } from './formatters';

export interface OrderRenderOptions {
  order: Order;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

/**
 * Renderer geral para vias de comanda, conferência de mesa ou recibo de pedido.
 */
export function renderOrderCopy(options: OrderRenderOptions): PrintPayload {
  const { order, paperWidth = 80, isReprint = false } = options;
  const sections: PrintSection[] = [];

  // Header
  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  sections.push({ type: 'HEADER', text: 'YAMEL - COMPROVANTE DE PEDIDO' });

  // Identification
  sections.push({ type: 'TEXT', text: `PEDIDO: #${order.localId}`, bold: true });
  sections.push({ type: 'TEXT', text: `Origem: ${order.origin}` });

  if (order.createdAt) {
    const dateObj = new Date(order.createdAt);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    sections.push({ type: 'TEXT', text: `Data: ${dateStr} ${timeStr}` });
  }

  if (order.tableId) {
    sections.push({ type: 'TEXT', text: `Mesa ID: ${order.tableId}` });
  }

  if (order.customerSnapshot?.name) {
    sections.push({ type: 'TEXT', text: `Cliente: ${order.customerSnapshot.name}` });
  }

  sections.push({ type: 'LINE' });

  // Items
  sections.push({ type: 'TEXT', text: 'ITENS', bold: true });

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      sections.push({
        type: 'ITEM',
        leftText: `${item.quantity}x ${item.productNameSnapshot}`,
        rightText: formatCentsToBRL(item.subtotal),
        bold: true,
      });

      // Accompaniments
      if (item.selectedAccompaniments && item.selectedAccompaniments.length > 0) {
        for (const acc of item.selectedAccompaniments) {
          const accPriceStr = acc.subtotal > 0 ? formatCentsToBRL(acc.subtotal) : 'R$ 0,00';
          sections.push({
            type: 'ITEM',
            leftText: `+${acc.quantity}x ${acc.itemNameSnapshot}`,
            rightText: accPriceStr,
            indent: 3,
          });
        }
      }

      // Options
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        for (const opt of item.selectedOptions) {
          const optPriceStr = opt.additionalPrice > 0 ? formatCentsToBRL(opt.additionalPrice) : 'R$ 0,00';
          sections.push({
            type: 'ITEM',
            leftText: `Opção: ${opt.optionName ? `${opt.optionName}: ` : ''}${opt.choiceName}`,
            rightText: optPriceStr,
            indent: 3,
          });
        }
      }

      // Addons
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        for (const add of item.selectedAddons) {
          const addTotal = add.price * add.quantity;
          const addPriceStr = addTotal > 0 ? formatCentsToBRL(addTotal) : 'R$ 0,00';
          sections.push({
            type: 'ITEM',
            leftText: `+${add.quantity}x ${add.addonName}`,
            rightText: addPriceStr,
            indent: 3,
          });
        }
      }

      // Item Notes
      if (item.notes) {
        sections.push({
          type: 'TEXT',
          text: `Obs: ${item.notes}`,
          indent: 3,
        });
      }
    }
  }

  sections.push({ type: 'LINE' });

  // Totals
  sections.push({
    type: 'TOTAL',
    leftText: 'Subtotal:',
    rightText: formatCentsToBRL(order.subtotal || 0),
  });

  if (order.discount > 0) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Desconto:',
      rightText: `- ${formatCentsToBRL(order.discount)}`,
    });
  }

  if (order.serviceFee > 0) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Taxa de Serviço:',
      rightText: formatCentsToBRL(order.serviceFee),
    });
  }

  if (order.deliveryFee > 0) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Taxa de Entrega:',
      rightText: formatCentsToBRL(order.deliveryFee),
    });
  }

  sections.push({
    type: 'TOTAL',
    leftText: 'TOTAL:',
    rightText: formatCentsToBRL(order.total || 0),
    bold: true,
  });

  // Payment Status
  if (order.paymentMethod || order.paymentStatus) {
    sections.push({ type: 'LINE' });
    if (order.paymentMethod) {
      sections.push({ type: 'TEXT', text: `Forma de Pagamento: ${order.paymentMethod}` });
    }
    if (order.paymentStatus) {
      sections.push({ type: 'TEXT', text: `Status Pagamento: ${order.paymentStatus}` });
    }
  }

  if (order.notes) {
    sections.push({ type: 'LINE' });
    sections.push({ type: 'TEXT', text: `Obs: ${order.notes}` });
  }

  sections.push({ type: 'FOOTER', text: 'YAMEL SISTEMAS' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Via Pedido #${order.localId}`,
    content,
    width: paperWidth,
    sections,
    data: {
      orderId: order.id,
      orderLocalId: order.localId,
      totalCents: order.total,
      isReprint,
    },
  };
}
