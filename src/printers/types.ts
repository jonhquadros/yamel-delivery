/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Auditable, ProductionStationType } from '../services/storage/types';

// --- PRINT JOB TYPES ---
export type PrintJobType =
  | 'KITCHEN_NEW_ORDER'
  | 'KITCHEN_READY'
  | 'DELIVERY_ORDER'
  | 'ORDER_COPY'
  | 'CASH_RECEIPT';

// --- PRINT JOB SOURCES ---
export type PrintJobSource =
  | 'KDS'
  | 'DELIVERY'
  | 'ORDER'
  | 'CASH'
  | 'PDV'
  | 'TABLE'
  | 'SYSTEM';

// --- PRINT JOB STATUSES ---
export type PrintJobStatus =
  | 'PENDING'
  | 'PRINTING'
  | 'PRINTED'
  | 'FAILED'
  | 'WAITING_AGENT';

// --- PRINTER CONNECTION TYPES ---
export type PrinterConnectionType =
  | 'USB'
  | 'NETWORK'
  | 'SYSTEM'
  | 'AGENT';

// --- PRINTER PAPER WIDTHS ---
export type PrinterPaperWidth = 58 | 80;

// --- PRINTER CONFIGURATION ---
export interface PrinterConfig extends Auditable {
  id: string; // UUID
  name: string;
  type: PrinterConnectionType;
  address?: string; // IP address or USB port path
  port?: number; // Network port (default 9100)
  enabled: boolean;
  paperWidth: PrinterPaperWidth;
  station?: ProductionStationType;
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
}

// --- PRINT PAYLOAD STRUCTURE ---
export type PrintSectionType =
  | 'HEADER'
  | 'TEXT'
  | 'LINE'
  | 'ITEM'
  | 'TOTAL'
  | 'FOOTER';

export interface PrintSection {
  type: PrintSectionType;
  text?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: 'normal' | 'medium' | 'large';
  leftText?: string;
  rightText?: string;
  indent?: number;
}

export interface PrintPayload {
  title?: string;
  content?: string;
  width?: PrinterPaperWidth;
  sections?: PrintSection[];
  data?: Record<string, any>;
  rawCommands?: string;
}

// --- PRINT JOB MODEL ---
export interface PrintJob {
  id: string; // UUID
  type: PrintJobType;
  status: PrintJobStatus;
  source: PrintJobSource;
  orderId?: string;
  ticketId?: string;
  roundNumber?: number;
  station?: ProductionStationType;
  printerId?: string;
  payload?: PrintPayload | string | Record<string, any>;
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  attempts: number;
  lastError?: string;
  printedAt?: string; // ISO-8601 string
  isReprint: boolean;
  eventKey?: string; // Idempotency key (e.g., KITCHEN_ticket123_R1_KITCHEN)
  originalJobId?: string;
}
