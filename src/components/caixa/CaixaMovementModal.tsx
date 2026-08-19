/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { CashMovementType, PaymentMethod } from '../../services/storage/types';
import { formatCentsToBRL, parseBRLToCents } from '../../utils/currency';

interface CaixaMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    type: CashMovementType;
    amount: number; // Integer in CENTS
    paymentMethod: PaymentMethod;
    description: string;
    userName: string;
  }) => Promise<void>;
  initialType?: 'WITHDRAWAL' | 'DEPOSIT';
  availableCashInDrawer?: number; // in CENTS
}

export function CaixaMovementModal({
  isOpen,
  onClose,
  onConfirm,
  initialType = 'WITHDRAWAL',
  availableCashInDrawer = 0
}: CaixaMovementModalProps) {
  const [type, setType] = useState<CashMovementType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [userName, setUserName] = useState<string>('Operador Caixa');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setAmountStr('');
      setDescription('');
      setPaymentMethod('CASH');
      setErrorMsg(null);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const parsedCents = parseBRLToCents(amountStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedCents <= 0) {
      setErrorMsg('Informe um valor maior que R$ 0,00');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Informe uma justificativa ou descrição para o lançamento');
      return;
    }

    if (type === 'WITHDRAWAL' && paymentMethod === 'CASH' && parsedCents > availableCashInDrawer) {
      setErrorMsg(
        `Valor da sangria (${formatCentsToBRL(parsedCents)}) excede o saldo em dinheiro disponível na gaveta (${formatCentsToBRL(availableCashInDrawer)}). Operação bloqueada.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm({
        type,
        amount: parsedCents,
        paymentMethod,
        description: description.trim(),
        userName: userName.trim() || 'Operador'
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (cents: number) => {
    setAmountStr((cents / 100).toFixed(2).replace('.', ','));
  };

  const isWithdrawal = type === 'WITHDRAWAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isWithdrawal ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
              }`}
            >
              {isWithdrawal ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isWithdrawal ? 'Registrar Sangria (Retirada)' : 'Registrar Suprimento (Aporte)'}
              </h3>
              <p className="text-xs text-slate-500">
                {isWithdrawal
                  ? 'Retirada de valores físicos da gaveta / cofre'
                  : 'Entrada de troco ou reforço de numerário'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Selector Type (Sangria vs Suprimento) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('WITHDRAWAL')}
              className={`py-2 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                type === 'WITHDRAWAL'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Sangria (Saída)
            </button>
            <button
              type="button"
              onClick={() => setType('DEPOSIT')}
              className={`py-2 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                type === 'DEPOSIT'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              Suprimento (Entrada)
            </button>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Valor do Lançamento</label>
              {isWithdrawal && (
                <span className="text-[11px] font-medium text-slate-500">
                  Gaveta: <strong className="text-slate-800">{formatCentsToBRL(availableCashInDrawer)}</strong>
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                R$
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Quick amount buttons */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atalhos:</span>
              {[2000, 5000, 10000, 20000].map(cents => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => handleQuickAmount(cents)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  +{formatCentsToBRL(cents)}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Forma de Movimentação
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="CASH">Dinheiro em Espécie (Gaveta Físico)</option>
              <option value="PIX">Transferência Pix</option>
              <option value="OTHER">Outros / Bancário</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Justificativa / Motivo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                isWithdrawal
                  ? 'Ex: Sangria para cofre seguro, Pagamento fornecedor de gelo...'
                  : 'Ex: Fundo extra de moedas, Troco em notas de R$ 5...'
              }
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Operator Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Operador Responsável
            </label>
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-extrabold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                isWithdrawal
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Registrando...' : isWithdrawal ? 'Confirmar Sangria' : 'Confirmar Suprimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
