/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  KeyRound,
  DollarSign,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Store,
  Sparkles
} from 'lucide-react';
import { formatCentsToBRL, parseBRLToCents } from '../../utils/currency';

interface CaixaOpenFormProps {
  onOpen: (params: {
    openingAmount: number; // in CENTS
    userId: string;
    userName: string;
    notes?: string;
  }) => Promise<void>;
  defaultOperatorName?: string;
}

export function CaixaOpenForm({
  onOpen,
  defaultOperatorName = 'João Silva (Gerente)'
}: CaixaOpenFormProps) {
  const [amountStr, setAmountStr] = useState<string>('150,00');
  const [userName, setUserName] = useState<string>(defaultOperatorName);
  const [notes, setNotes] = useState<string>('Abertura de turno');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedCents = parseBRLToCents(amountStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedCents < 0) {
      setErrorMsg('O saldo inicial não pode ser negativo');
      return;
    }

    if (!userName.trim()) {
      setErrorMsg('Informe o nome do operador responsável');
      return;
    }

    try {
      setIsSubmitting(true);
      await onOpen({
        openingAmount: parsedCents,
        userId: 'usr-1',
        userName: userName.trim(),
        notes: notes.trim() || undefined
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao abrir o caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (cents: number) => {
    setAmountStr((cents / 100).toFixed(2).replace('.', ','));
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 sm:p-8 border-b border-amber-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs shrink-0">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-full border border-amber-200">
                Turno Fechado
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Store className="w-3.5 h-3.5" /> Terminal Central PDV
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              Abertura de Caixa Operacional
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Informe o fundo de troco inicial e os dados do operador para iniciar as vendas.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fundo de Troco / Saldo Inicial */}
          <div>
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-2">
              Fundo de Troco Inicial (Gaveta)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-extrabold text-slate-400">
                R$
              </span>
              <input
                type="text"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0,00"
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">Sugestões:</span>
              {[0, 5000, 10000, 15000, 20000].map(cents => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => handleQuickAmount(cents)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    parsedCents === cents
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {formatCentsToBRL(cents)}
                </button>
              ))}
            </div>
          </div>

          {/* Operador Responsável */}
          <div>
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-2">
              Operador Responsável
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Nome do operador..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Observações de Abertura */}
          <div>
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-2">
              Observações de Abertura (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Turno matutino, abertura com moedas e notas trocadas..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Info pill */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 text-slate-500 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              O caixa será sincronizado automaticamente no IndexedDB com suporte a operações offline e Transactional Outbox.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-extrabold text-sm rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {isSubmitting ? 'Abrindo Caixa...' : 'Abrir Caixa Operacional'}
          </button>
        </form>
      </div>
    </div>
  );
}
