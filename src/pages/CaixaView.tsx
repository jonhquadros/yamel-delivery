/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  History,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  Store,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { cashService, RegisterSummary } from '../services/cashService';
import { CashMovementType, PaymentMethod, CashRegisterClosingCounts } from '../services/storage/types';
import { CaixaSummaryCards } from '../components/caixa/CaixaSummaryCards';
import { CaixaMovementsList } from '../components/caixa/CaixaMovementsList';
import { CaixaMovementModal } from '../components/caixa/CaixaMovementModal';
import { CaixaCloseDrawer } from '../components/caixa/CaixaCloseDrawer';
import { CaixaOpenForm } from '../components/caixa/CaixaOpenForm';
import { CaixaHistoryDrawer } from '../components/caixa/CaixaHistoryDrawer';
import { formatCentsToBRL } from '../utils/currency';

export function CaixaView() {
  const [summary, setSummary] = useState<RegisterSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [movementModalOpen, setMovementModalOpen] = useState<boolean>(false);
  const [movementModalType, setMovementModalType] = useState<'WITHDRAWAL' | 'DEPOSIT'>('WITHDRAWAL');
  const [closeDrawerOpen, setCloseDrawerOpen] = useState<boolean>(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshCashRegister = useCallback(async () => {
    try {
      const summ = await cashService.getRegisterSummary();
      setSummary(summ);
    } catch (err) {
      console.error('Erro ao carregar resumo do caixa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCashRegister();
    // Periodic refresh every 5 seconds to catch newly registered orders seamlessly
    const interval = setInterval(refreshCashRegister, 5000);
    return () => clearInterval(interval);
  }, [refreshCashRegister]);

  // Handler for Opening Cash Register
  const handleOpenRegister = async (params: {
    openingAmount: number;
    userId: string;
    userName: string;
    notes?: string;
  }) => {
    try {
      await cashService.openRegister(params);
      setFeedbackMessage({
        type: 'success',
        text: `Caixa aberto com sucesso! Fundo inicial: ${formatCentsToBRL(params.openingAmount)}`
      });
      await refreshCashRegister();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao abrir caixa.'
      });
    }
  };

  // Handler for Sangria / Suprimento
  const handleAddMovement = async (data: {
    type: CashMovementType;
    amount: number;
    paymentMethod: PaymentMethod;
    description: string;
    userName: string;
  }) => {
    if (!summary?.register) return;

    try {
      await cashService.addMovement({
        cashRegisterId: summary.register.id,
        type: data.type,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        description: data.description,
        userId: 'usr-1',
        userName: data.userName
      });

      setFeedbackMessage({
        type: 'success',
        text: `${data.type === 'WITHDRAWAL' ? 'Sangria' : 'Suprimento'} de ${formatCentsToBRL(data.amount)} registrado com sucesso!`
      });
      await refreshCashRegister();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao registrar movimentação.'
      });
    }
  };

  // Handler for Closing Cash Register
  const handleCloseRegister = async (data: {
    closingAmount: number;
    closingCounts: CashRegisterClosingCounts;
    notes?: string;
    userName: string;
  }) => {
    if (!summary?.register) return;

    try {
      await cashService.closeRegister({
        registerId: summary.register.id,
        closingAmount: data.closingAmount,
        closingCounts: data.closingCounts,
        notes: data.notes,
        userId: 'usr-1',
        userName: data.userName
      });

      setFeedbackMessage({
        type: 'success',
        text: `Caixa encerrado com sucesso! Valor final: ${formatCentsToBRL(data.closingAmount)}`
      });
      await refreshCashRegister();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao fechar caixa.'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-sm font-extrabold text-slate-700">Carregando Fluxo de Caixa...</span>
        </div>
      </div>
    );
  }

  // 1. If NO cash register is open -> Render Open Cash Form
  if (!summary || summary.register.status !== 'OPEN') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 min-h-full flex flex-col justify-between">
        <div>
          <div className="max-w-xl mx-auto flex items-center justify-end mb-2">
            <button
              onClick={() => setHistoryDrawerOpen(true)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2 transition-all"
            >
              <History className="w-4 h-4 text-slate-500" />
              Histórico de Caixas Anteriores
            </button>
          </div>

          {feedbackMessage && (
            <div
              className={`max-w-xl mx-auto mb-4 p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          <CaixaOpenForm onOpen={handleOpenRegister} />
        </div>

        {/* History Drawer */}
        <CaixaHistoryDrawer
          isOpen={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
        />
      </div>
    );
  }

  // 2. ACTIVE OPEN REGISTER VIEW
  const reg = summary.register;
  const openedTime = new Date(reg.openedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const openedDate = new Date(reg.openedAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 min-h-full space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                CAIXA ABERTO
              </span>
              <span className="text-xs font-bold text-slate-600">
                {reg.localId || 'CX-1001'}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Terminal Central PDV
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
              Controle & Fechamento de Caixa
            </h1>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Aberto às {openedTime} ({openedDate})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" /> {reg.openedByName || 'Operador'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Suprimento */}
          <button
            onClick={() => {
              setMovementModalType('DEPOSIT');
              setMovementModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
          >
            <ArrowDownRight className="w-4 h-4 text-blue-600" />
            Suprimento
          </button>

          {/* Sangria */}
          <button
            onClick={() => {
              setMovementModalType('WITHDRAWAL');
              setMovementModalOpen(true);
            }}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            Sangria
          </button>

          {/* Histórico */}
          <button
            onClick={() => setHistoryDrawerOpen(true)}
            className="p-2 sm:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            title="Histórico de Turnos Fechados"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Histórico</span>
          </button>

          {/* Fechar Caixa */}
          <button
            onClick={() => setCloseDrawerOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Fechar Caixa
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <CaixaSummaryCards summary={summary} />

      {/* Real-time Movements List & Audit Log */}
      <CaixaMovementsList movements={summary.movements} />

      {/* Modals & Drawers */}
      <CaixaMovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        onConfirm={handleAddMovement}
        initialType={movementModalType}
        availableCashInDrawer={summary.expectedPhysicalCash}
      />

      <CaixaCloseDrawer
        isOpen={closeDrawerOpen}
        onClose={() => setCloseDrawerOpen(false)}
        summary={summary}
        onConfirmClose={handleCloseRegister}
      />

      <CaixaHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      />
    </div>
  );
}
