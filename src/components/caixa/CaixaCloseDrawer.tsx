/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Lock,
  DollarSign,
  QrCode,
  CreditCard,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  User,
  Calculator,
  ChevronRight
} from 'lucide-react';
import { RegisterSummary } from '../../services/cashService';
import { CashRegisterClosingCounts } from '../../services/storage/types';
import { formatCentsToBRL, parseBRLToCents } from '../../utils/currency';

interface CaixaCloseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: RegisterSummary;
  onConfirmClose: (data: {
    closingAmount: number; // in CENTS
    closingCounts: CashRegisterClosingCounts;
    notes?: string;
    userName: string;
  }) => Promise<void>;
}

export function CaixaCloseDrawer({
  isOpen,
  onClose,
  summary,
  onConfirmClose
}: CaixaCloseDrawerProps) {
  const [cashStr, setCashStr] = useState<string>('');
  const [pixStr, setPixStr] = useState<string>('');
  const [creditStr, setCreditStr] = useState<string>('');
  const [debitStr, setDebitStr] = useState<string>('');
  const [voucherStr, setVoucherStr] = useState<string>('');
  const [otherStr, setOtherStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [userName, setUserName] = useState<string>('Operador Caixa');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Convert inputs to cents
  const cashCents = parseBRLToCents(cashStr);
  const pixCents = parseBRLToCents(pixStr);
  const creditCents = parseBRLToCents(creditStr);
  const debitCents = parseBRLToCents(debitStr);
  const voucherCents = parseBRLToCents(voucherStr);
  const otherCents = parseBRLToCents(otherStr);

  const declaredTotal = cashCents + pixCents + creditCents + debitCents + voucherCents + otherCents;
  const difference = declaredTotal - summary.expectedTotal;

  // Auto fill suggestions helper
  const handleAutoFillExpected = () => {
    setCashStr((summary.expectedPhysicalCash / 100).toFixed(2).replace('.', ','));
    setPixStr((summary.salesByMethod.PIX.amount / 100).toFixed(2).replace('.', ','));
    setCreditStr((summary.salesByMethod.CREDIT_CARD.amount / 100).toFixed(2).replace('.', ','));
    setDebitStr((summary.salesByMethod.DEBIT_CARD.amount / 100).toFixed(2).replace('.', ','));
    setVoucherStr((summary.salesByMethod.MEAL_VOUCHER.amount / 100).toFixed(2).replace('.', ','));
    setOtherStr((summary.salesByMethod.OTHER.amount / 100).toFixed(2).replace('.', ','));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (difference !== 0 && !notes.trim()) {
      setErrorMsg('Como há divergência entre os valores esperados e apurados, informe a justificativa nas observações.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmClose({
        closingAmount: declaredTotal,
        closingCounts: {
          cash: cashCents,
          pix: pixCents,
          creditCard: creditCents,
          debitCard: debitCents,
          mealVoucher: voucherCents,
          other: otherCents
        },
        notes: notes.trim() || undefined,
        userName: userName.trim() || 'Operador'
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fechar caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div
        className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Fechamento Operacional do Caixa
              </h2>
              <p className="text-xs text-slate-500">
                Conferência de valores, apuração de diferenças e encerramento do turno
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick autofill toolbar */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-bold text-amber-950">
                Total Esperado pelo Sistema: <strong>{formatCentsToBRL(summary.expectedTotal)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoFillExpected}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-2xs"
            >
              Preencher com Esperados
            </button>
          </div>

          {/* Step 1: Contagem por Meios de Pagamento */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3">
              1. Contagem Declarada pelo Operador
            </h3>
            <div className="space-y-3">
              {/* Dinheiro */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Dinheiro na Gaveta (Espécie)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Esperado: {formatCentsToBRL(summary.expectedPhysicalCash)}
                    </span>
                  </div>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={cashStr}
                    onChange={e => setCashStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Pix */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Transferências Pix
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Esperado: {formatCentsToBRL(summary.salesByMethod.PIX.amount)}
                    </span>
                  </div>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={pixStr}
                    onChange={e => setPixStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Cartão de Crédito */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Cartão de Crédito
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Esperado: {formatCentsToBRL(summary.salesByMethod.CREDIT_CARD.amount)}
                    </span>
                  </div>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={creditStr}
                    onChange={e => setCreditStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Cartão de Débito */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Cartão de Débito
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Esperado: {formatCentsToBRL(summary.salesByMethod.DEBIT_CARD.amount)}
                    </span>
                  </div>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={debitStr}
                    onChange={e => setDebitStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Outros / Vale Refeição */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Vale Refeição & Outros
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Esperado: {formatCentsToBRL(summary.salesByMethod.MEAL_VOUCHER.amount + summary.salesByMethod.OTHER.amount)}
                    </span>
                  </div>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={voucherStr}
                    onChange={e => setVoucherStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Comparativo e Diferença */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>Total Esperado (Sistema)</span>
              <span className="font-bold text-slate-200">{formatCentsToBRL(summary.expectedTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>Total Declarado (Contagem)</span>
              <span className="font-bold text-slate-200">{formatCentsToBRL(declaredTotal)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-extrabold">Diferença de Caixa:</span>
              <span
                className={`text-base font-extrabold tracking-tight px-2.5 py-1 rounded-xl ${
                  difference === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : difference > 0
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {difference === 0
                  ? 'Exato (R$ 0,00)'
                  : difference > 0
                  ? `Sobra de +${formatCentsToBRL(difference)}`
                  : `Falta de ${formatCentsToBRL(difference)}`}
              </span>
            </div>
          </div>

          {/* Operador e Justificativa */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Operador Responsável pelo Fechamento
              </label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Observações / Justificativa {difference !== 0 && <span className="text-rose-500">* (Obrigatório devido à diferença)</span>}
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Turno encerrado sem divergências, ou justificativa de quebra/sobra..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-xs transition-all flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {isSubmitting ? 'Encerrando Caixa...' : 'Confirmar Fechamento do Caixa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
