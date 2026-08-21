/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProductionTicket } from '../../services/storage/types';
import { PrintPayload, PrinterPaperWidth, PrintSection } from '../types';
import { renderSectionsToText } from './formatters';

export interface KitchenRenderOptions {
  ticket: ProductionTicket;
  paperWidth?: PrinterPaperWidth;
  isReprint?: boolean;
}

/**
 * Renderer exclusivo da via de produção / cozinha.
 * REGRA CRÍTICA: NÃO exibe valores financeiros ou preços.
 */
export function renderKitchenTicket(options: KitchenRenderOptions): PrintPayload {
  const { ticket, paperWidth = 80, isReprint = false } = options;
  const sections: PrintSection[] = [];

  // Header
  if (isReprint) {
    sections.push({ type: 'HEADER', text: '*** REIMPRESSÃO - 2ª VIA ***' });
  }

  const stationTitle = ticket.station ? `COZINHA - ${ticket.station}` : 'COZINHA';
  sections.push({ type: 'HEADER', text: `YAMEL - ${stationTitle}` });

  // Identification
  sections.push({ type: 'TEXT', text: `PEDIDO: #${ticket.orderLocalId}`, bold: true });
  if (ticket.roundNumber) {
    sections.push({ type: 'TEXT', text: `RODADA: #${ticket.roundNumber}`, bold: true });
  }
  sections.push({ type: 'TEXT', text: `Origem: ${ticket.orderOrigin}` });

  if (ticket.tableName || ticket.tableNumber) {
    sections.push({ type: 'TEXT', text: `Mesa/Comanda: ${ticket.tableName || `Mesa ${ticket.tableNumber}`}` });
  }

  if (ticket.customerName) {
    sections.push({ type: 'TEXT', text: `Cliente: ${ticket.customerName}` });
  }

  if (ticket.deliveryType) {
    sections.push({ type: 'TEXT', text: `Modalidade: ${ticket.deliveryType}` });
  }

  const timeStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  if (timeStr) {
    sections.push({ type: 'TEXT', text: `Hora: ${timeStr}` });
  }

  sections.push({ type: 'LINE' });

  // Items
  if (ticket.items && ticket.items.length > 0) {
    for (const item of ticket.items) {
      // Product Name
      sections.push({
        type: 'TEXT',
        text: `${item.quantity}x ${item.productNameSnapshot}`,
        bold: true,
      });

      // Accompaniments (No prices!)
      if (item.selectedAccompaniments && item.selectedAccompaniments.length > 0) {
        for (const acc of item.selectedAccompaniments) {
          sections.push({
            type: 'TEXT',
            text: `+${acc.quantity}x ${acc.itemNameSnapshot}`,
            indent: 3,
          });
        }
      }

      // Options (No prices!)
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        for (const opt of item.selectedOptions) {
          sections.push({
            type: 'TEXT',
            text: `Opção: ${opt.optionName ? `${opt.optionName}: ` : ''}${opt.choiceName}`,
            indent: 3,
          });
        }
      }

      // Addons (No prices!)
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        for (const add of item.selectedAddons) {
          sections.push({
            type: 'TEXT',
            text: `+${add.quantity}x ${add.addonName}`,
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

      sections.push({ type: 'LINE', text: '-' });
    }
  }

  // Ticket level notes
  if (ticket.notes) {
    sections.push({ type: 'TEXT', text: `OBS DO TICKET: ${ticket.notes}`, bold: true });
    sections.push({ type: 'LINE' });
  }

  sections.push({ type: 'FOOTER', text: 'FIM DO COMPROVANTE DE PRODUÇÃO' });

  const content = renderSectionsToText(sections, paperWidth);

  return {
    title: `Ticket Cozinha #${ticket.orderLocalId}`,
    content,
    width: paperWidth,
    sections,
    data: {
      ticketId: ticket.id,
      orderLocalId: ticket.orderLocalId,
      station: ticket.station,
      isReprint,
    },
  };
}
