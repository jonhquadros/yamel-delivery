/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrintJob } from '../types';
import { PrintTransport, PrintTransportResult } from './types';

/**
 * Transporte padrão inicial / indisponível.
 *
 * Utilizado quando não há Print Agent local conectado ou ativo.
 * Não acessa USB, TCP/IP, WebSocket, HTTP nem abre diálogo de impressão do navegador.
 * Sinaliza de forma segura e não bloqueante que o trabalho aguarda o agente (WAITING_AGENT).
 */
export class UnavailablePrintTransport implements PrintTransport {
  readonly name = 'UnavailablePrintTransport';

  async process(_job: PrintJob): Promise<PrintTransportResult> {
    return {
      success: false,
      reason: 'AGENT_UNAVAILABLE',
      message: 'Yamel Print Agent não está disponível ou conectado no momento.',
      retryable: true,
    };
  }
}

export const defaultUnavailableTransport = new UnavailablePrintTransport();
