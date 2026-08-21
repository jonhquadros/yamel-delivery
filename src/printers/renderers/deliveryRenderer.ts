/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../../services/storage/types';
import { PrintPayload, PrinterPaperWidth, PrintSection } from '../types';
import { renderSectionsToText, formatCentsToBRL } from './formatters';

export interface DeliveryRenderOptions {
  order: Order;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

/**
 * Renderer completo para a via de entrega de Delivery.
 */
export function renderDeliveryOrder(options: DeliveryRenderOptions): PrintPayload {
  const { order, paperWidth = 80, isReprint = false } = options;
  const sections: PrintSection[] = [];

  // Header
  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  sections.push({ type: 'HEADER', text: 'YAMEL - PEDIDO DELIVERY' });

  // Identification & Date
  sections.push({ type: 'TEXT', text: `PEDIDO: #${order.localId}`, bold: true });
  if (order.createdAt) {
    const dateObj = new Date(order.createdAt);
    const dateStr = dateObj.toLocaleDateString('pt-BR');
    const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    sections.push({ type: 'TEXT', text: `Data: ${dateStr} ${timeStr}` });
  }

  sections.push({ type: 'LINE' });

  // Customer & Delivery Address
  sections.push({ type: 'TEXT', text: 'DADOS DO CLIENTE & ENTREGA', bold: true });
  
  if (order.customerSnapshot?.name) {
    sections.push({ type: 'TEXT', text: `Cliente: ${order.customerSnapshot.name}` });
  }
  if (order.customerSnapshot?.phone) {
    sections.push({ type: 'TEXT', text: `Tel/WhatsApp: ${order.customerSnapshot.phone}` });
  }

  const fulfillment = order.fulfillmentType || 'DELIVERY';
  sections.push({ type: 'TEXT', text: `Modalidade: ${fulfillment === 'DELIVERY' ? 'ENTREGA EM DOMICÍLIO' : 'RETIRADA NO BALCÃO'}` });

  if (fulfillment === 'DELIVERY' && order.deliverySnapshot) {
    const ds = order.deliverySnapshot;
    sections.push({ type: 'TEXT', text: `Endereço: ${ds.address}, ${ds.number}` });
    if (ds.neighborhood) {
      sections.push({ type: 'TEXT', text: `Bairro: ${ds.neighborhood}` });
    }
    if (ds.complement) {
      sections.push({ type: 'TEXT', text: `Complemento: ${ds.complement}` });
    }
    if (ds.reference) {
      sections.push({ type: 'TEXT', text: `Referência: ${ds.reference}` });
    }
    if (ds.city || ds.state) {
      sections.push({ type: 'TEXT', text: `Cidade: ${[ds.city, ds.state].filter(Boolean).join('/')}` });
    }
    if (ds.postalCode) {
      sections.push({ type: 'TEXT', text: `CEP: ${ds.postalCode}` });
    }
  } else if (order.customerSnapshot?.address) {
    sections.push({ type: 'TEXT', text: `Endereço: ${order.customerSnapshot.address}` });
  }

  sections.push({ type: 'LINE' });

  // Items
  sections.push({ type: 'TEXT', text: 'ITENS DO PEDIDO', bold: true });

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
          const accName = acc.itemNameSnapshot || 'Acompanhamento';
          const accSubtotal = typeof acc.subtotal === 'number' ? acc.subtotal : ((acc.priceSnapshot || 0) * (acc.quantity || 1));
          const accPriceStr = accSubtotal > 0 ? formatCentsToBRL(accSubtotal) : 'R$ 0,00';
          sections.push({
            type: 'ITEM',
            leftText: `+${acc.quantity}x ${accName}`,
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

      // Item notes
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

  // Financial Summary
  sections.push({
    type: 'TOTAL',
    leftText: 'Subtotal:',
    rightText: formatCentsToBRL(order.subtotal || 0),
  });

  if (order.deliveryFee > 0) {
    sections.push({
      type: 'TOTAL',
      leftText: 'Taxa de Entrega:',
      rightText: formatCentsToBRL(order.deliveryFee),
    });
  }

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

  sections.push({
    type: 'TOTAL',
    leftText: 'TOTAL:',
    rightText: formatCentsToBRL(order.total || 0),
    bold: true,
  });

  sections.push({ type: 'LINE' });

  // Payment Info
  sections.push({ type: 'TEXT', text: 'PAGAMENTO', bold: true });
  if (order.paymentMethod) {
    sections.push({ type: 'TEXT', text: `Forma: ${order.paymentMethod}` });
  }
  if (order.paymentStatus) {
    sections.push({ type: 'TEXT', text: `Status: ${order.paymentStatus === 'PAID' ? 'PAGO' : order.paymentStatus}` });
  }

  if (order.paymentMethod === 'CASH' && order.changeFor && order.changeFor > 0) {
    sections.push({
      type: 'ITEM',
      leftText: 'Troco para:',
      rightText: formatCentsToBRL(order.changeFor),
    });
    if (order.changeFor > order.total) {
      const changeReturn = order.changeFor - order.total;
      sections.push({
        type: 'ITEM',
        leftText: 'Troco a devolver:',
        rightText: formatCentsToBRL(changeReturn),
        bold: true,
      });
    }
  }

  if (order.notes) {
    sections.push({ type: 'LINE' });
    sections.push({ type: 'TEXT', text: `Observações do Pedido: ${order.notes}` });
  }

  sections.push({ type: 'FOOTER', text: 'OBRIGADO PELA PREFERÊNCIA!' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Delivery #${order.localId}`,
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
