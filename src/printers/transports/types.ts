/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrintJob } from '../types';

/**
 * Motivos padronizados de falha ou espera do transporte de impressão.
 */
export type PrintTransportFailureReason =
  | 'AGENT_UNAVAILABLE'
  | 'PRINTER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'PAPER_OUT'
  | 'COMMUNICATION_ERROR'
  | 'UNKNOWN';

/**
 * Resultado fortemente tipado da tentativa de envio para o transporte.
 */
export type PrintTransportResult =
  | {
      success: true;
      message?: string;
    }
  | {
      success: false;
      reason: PrintTransportFailureReason;
      message?: string;
      retryable?: boolean;
    };

/**
 * Interface abstrata do transporte de impressão.
 * Desacopla o motor de fila de qualquer driver físico, rede ou agente externo.
 */
export interface PrintTransport {
  readonly name: string;
  process(job: PrintJob): Promise<PrintTransportResult>;
}
