/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  QrCode,
  DollarSign,
  Receipt,
  Layers
} from 'lucide-react';
import { RegisterSummary } from '../../services/cashService';
import { formatCentsToBRL } from '../../utils/currency';

interface CaixaSummaryCardsProps {
  summary: RegisterSummary;
}

export function CaixaSummaryCards({ summary }: CaixaSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Saldo em Dinheiro na Gaveta (Físico) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Dinheiro na Gaveta
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight block">
            {formatCentsToBRL(summary.expectedPhysicalCash)}
          </span>
          <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
            Fundo inicial ({formatCentsToBRL(summary.openingAmount)}) + Vendas - Sangrias
          </span>
        </div>
      </div>

      {/* 2. Total de Vendas do Turno */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Vendido
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-extrabold text-blue-600 tracking-tight block">
            {formatCentsToBRL(summary.salesTotal)}
          </span>
          <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
            {summary.salesCount} {summary.salesCount === 1 ? 'venda registrada' : 'vendas registradas'} • Ticket Médio: {formatCentsToBRL(summary.averageTicket)}
          </span>
        </div>
      </div>

      {/* 3. Meios Eletrônicos (Pix e Cartões) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Pix & Cartões
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight block">
            {formatCentsToBRL(summary.expectedElectronicTotal)}
          </span>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-slate-500">
            <span>Pix: {formatCentsToBRL(summary.salesByMethod.PIX.amount)}</span>
            <span>•</span>
            <span>Cartões: {formatCentsToBRL(summary.salesByMethod.CREDIT_CARD.amount + summary.salesByMethod.DEBIT_CARD.amount)}</span>
          </div>
        </div>
      </div>

      {/* 4. Suprimentos e Sangrias */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Aportes & Sangrias
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-700 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" /> +{formatCentsToBRL(summary.depositsTotal)}
            </span>
            <span className="text-rose-700 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> -{formatCentsToBRL(summary.withdrawalsTotal)}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block">
            {summary.depositsCount} suprimento(s) • {summary.withdrawalsCount} sangria(s)
          </span>
        </div>
      </div>
    </div>
  );
}
