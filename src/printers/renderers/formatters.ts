/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrinterPaperWidth, PrintSection } from '../types';
import { formatCentsToBRL as rawFormatCentsToBRL } from '../../utils/currency';

/**
 * Formata centavos para BRL e garante espaços regulares (sem \\u00a0) para impressoras térmicas.
 */
export function formatCentsToBRL(cents: number): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return 'R$ 0,00';
  }
  const str = rawFormatCentsToBRL(cents);
  return str.replace(/\u00a0/g, ' ');
}

/**
 * Retorna a largura em caracteres baseada na largura de papel em mm.
 * 58mm -> 32 colunas
 * 80mm -> 48 colunas
 */
export function getColumnWidth(paperWidth: PrinterPaperWidth = 80): number {
  return paperWidth === 58 ? 32 : 48;
}

/**
 * Cria uma linha divisória repetindo o caractere de separação.
 */
export function formatSeparator(char: string = '-', width: number = 48): string {
  return char.repeat(width);
}

/**
 * Centraliza o texto no número de colunas.
 */
export function centerText(text: string, width: number = 48): string {
  const clean = text.trim();
  if (clean.length >= width) return clean;
  const totalPadding = width - clean.length;
  const leftPadding = Math.floor(totalPadding / 2);
  return ' '.repeat(leftPadding) + clean;
}

/**
 * Formata duas colunas (esquerda e direita) preenchendo o espaço entre elas.
 * Se a esquerda for muito longa para a linha, faz a quebra de linha elegante.
 */
export function formatLine(left: string, right: string, width: number = 48): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const availableSpace = width - cleanRight.length - 1;

  if (availableSpace <= 0 || cleanLeft.length <= availableSpace) {
    const spacesCount = Math.max(1, width - cleanLeft.length - cleanRight.length);
    return cleanLeft + ' '.repeat(spacesCount) + cleanRight;
  }

  // Se a esquerda for maior do que o espaço disponível, quebra em múltiplas linhas
  const chunks: string[] = [];
  let remaining = cleanLeft;

  while (remaining.length > 0) {
    if (remaining.length <= availableSpace) {
      chunks.push(remaining);
      break;
    }
    let breakIdx = remaining.lastIndexOf(' ', availableSpace);
    if (breakIdx <= 0) breakIdx = availableSpace;
    chunks.push(remaining.substring(0, breakIdx));
    remaining = remaining.substring(breakIdx).trimStart();
  }

  const firstChunk = chunks[0];
  const spaces = ' '.repeat(Math.max(1, width - firstChunk.length - cleanRight.length));
  const line1 = firstChunk + spaces + cleanRight;

  const restLines = chunks.slice(1);
  return [line1, ...restLines].join('\n');
}

/**
 * Converte um array de PrintSection em um texto contínuo e estruturado.
 */
export function renderSectionsToText(sections: PrintSection[], paperWidth: PrinterPaperWidth = 80): string {
  const width = getColumnWidth(paperWidth);
  const lines: string[] = [];

  for (const sec of sections) {
    switch (sec.type) {
      case 'HEADER':
        if (sec.text) {
          lines.push(formatSeparator('=', width));
          lines.push(centerText(sec.text.toUpperCase(), width));
          lines.push(formatSeparator('=', width));
        }
        break;

      case 'LINE':
        lines.push(formatSeparator(sec.text || '-', width));
        break;

      case 'TEXT':
        if (sec.text) {
          if (sec.align === 'center') {
            lines.push(centerText(sec.text, width));
          } else if (sec.align === 'right') {
            const pad = Math.max(0, width - sec.text.length);
            lines.push(' '.repeat(pad) + sec.text);
          } else {
            const indentStr = sec.indent ? ' '.repeat(sec.indent) : '';
            lines.push(indentStr + sec.text);
          }
        }
        break;

      case 'ITEM':
      case 'TOTAL':
        if (sec.leftText !== undefined && sec.rightText !== undefined) {
          const indentStr = sec.indent ? ' '.repeat(sec.indent) : '';
          const lineStr = formatLine(sec.leftText, sec.rightText, width - (sec.indent || 0));
          lines.push(indentStr + lineStr);
        } else if (sec.text) {
          lines.push(sec.text);
        }
        break;

      case 'FOOTER':
        if (sec.text) {
          lines.push(formatSeparator('=', width));
          lines.push(centerText(sec.text, width));
          lines.push(formatSeparator('=', width));
        } else {
          lines.push(formatSeparator('=', width));
        }
        break;
    }
  }

  return lines.join('\n');
}
