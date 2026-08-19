/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Calendar,
  Clock,
  User,
  DollarSign,
  QrCode,
  CreditCard,
  Receipt,
  FileText,
  ChevronRight,
  Layers
} from 'lucide-react';
import { CashRegister, CashMovement } from '../../services/storage/types';
import { cashService, RegisterSummary, calculateRegisterSummary } from '../../services/cashService';
import { formatCentsToBRL } from '../../utils/currency';

interface CaixaHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaixaHistoryDrawer({ isOpen, onClose }: CaixaHistoryDrawerProps) {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<RegisterSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const all = await cashService.getAllRegisters();
      const closed = all.filter(r => r.status === 'CLOSED');
      setRegisters(closed);
      if (closed.length > 0) {
        handleSelectRegister(closed[0]);
      } else {
        setSelectedRegister(null);
        setSelectedSummary(null);
      }
    } catch (e) {
      console.error('Erro ao carregar histórico de caixas:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRegister = async (reg: CashRegister) => {
    setSelectedRegister(reg);
    const movs = await cashService.getMovements(reg.id);
    const summ = calculateRegisterSummary(reg, movs);
    setSelectedSummary(summ);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div
        className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Histórico & Auditoria de Caixas
              </h2>
              <p className="text-xs text-slate-500">
                Relatórios consolidados de turnos anteriores e conferências passadas
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

        {/* Body Layout: Left list / Right detail */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Registers List */}
          <div className="w-full md:w-80 border-r border-slate-100 flex flex-col overflow-y-auto bg-slate-50/50">
            <div className="p-3 border-b border-slate-100 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Turnos Encerrados ({registers.length})
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Carregando histórico...</div>
            ) : registers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum caixa fechado no histórico.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {registers.map(reg => {
                  const isSelected = selectedRegister?.id === reg.id;
                  const diff = reg.difference || 0;
                  const openedDate = new Date(reg.openedAt).toLocaleDateString('pt-BR');
                  const openedTime = new Date(reg.openedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const closedTime = reg.closedAt
                    ? new Date(reg.closedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '--:--';

                  return (
                    <button
                      key={reg.id}
                      onClick={() => handleSelectRegister(reg)}
                      className={`w-full text-left p-4 transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500'
                          : 'hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            {reg.localId || 'Caixa'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {openedDate}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{openedTime} às {closedTime}</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-700 mt-1">
                          Fechado em: {formatCentsToBRL(reg.closingAmount || 0)}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            diff === 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : diff > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {diff === 0 ? 'Exato' : diff > 0 ? `+${formatCentsToBRL(diff)}` : formatCentsToBRL(diff)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 mt-2 ml-auto" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Register Report */}
          <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col">
            {selectedRegister && selectedSummary ? (
              <div className="space-y-6">
                {/* Top Action Bar */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-slate-900 text-white font-extrabold text-[11px] rounded-full">
                        {selectedRegister.localId || 'Caixa'}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {new Date(selectedRegister.openedAt).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Aberto por {selectedRegister.openedByName || 'Operador'} • Fechado por{' '}
                      {selectedRegister.closedByName || 'Operador'}
                    </p>
                  </div>

                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório
                  </button>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Fundo Inicial
                    </span>
                    <span className="text-base font-extrabold text-slate-900 mt-1 block">
                      {formatCentsToBRL(selectedSummary.openingAmount)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Vendido
                    </span>
                    <span className="text-base font-extrabold text-emerald-600 mt-1 block">
                      {formatCentsToBRL(selectedSummary.salesTotal)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Esperado
                    </span>
                    <span className="text-base font-extrabold text-slate-900 mt-1 block">
                      {formatCentsToBRL(selectedSummary.expectedTotal)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Diferença Apurada
                    </span>
                    <span
                      className={`text-base font-extrabold mt-1 block ${
                        (selectedRegister.difference || 0) === 0
                          ? 'text-emerald-600'
                          : (selectedRegister.difference || 0) > 0
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {formatCentsToBRL(selectedRegister.difference || 0)}
                    </span>
                  </div>
                </div>

                {/* Breakdown by Payment Method */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2.5">
                    Vendas por Forma de Pagamento
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-700">Dinheiro</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.CASH.amount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-bold text-slate-700">Pix</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.PIX.amount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-700">Crédito</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.CREDIT_CARD.amount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">Débito</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.DEBIT_CARD.amount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-slate-700">Voucher</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.MEAL_VOUCHER.amount)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-700">Outros</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCentsToBRL(selectedSummary.salesByMethod.OTHER.amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes and Justifications */}
                {(selectedRegister.notes || selectedRegister.closingNotes) && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                    {selectedRegister.notes && (
                      <div>
                        <strong className="text-slate-700">Nota de Abertura:</strong>{' '}
                        <span className="text-slate-600">{selectedRegister.notes}</span>
                      </div>
                    )}
                    {selectedRegister.closingNotes && (
                      <div>
                        <strong className="text-slate-700">Justificativa / Nota de Fechamento:</strong>{' '}
                        <span className="text-slate-600">{selectedRegister.closingNotes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Movements Table */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2.5">
                    Lançamentos do Turno ({selectedSummary.movements.length})
                  </h4>
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {selectedSummary.movements.map(mov => (
                      <div
                        key={mov.id}
                        className="p-3 text-xs flex items-center justify-between hover:bg-slate-50"
                      >
                        <div>
                          <span className="font-extrabold text-slate-900 block">
                            {mov.description}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(mov.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}{' '}
                            • {mov.userName || 'Operador'}
                          </span>
                        </div>
                        <span
                          className={`font-extrabold ${
                            mov.type === 'WITHDRAWAL' || mov.type === 'REFUND'
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {mov.type === 'WITHDRAWAL' || mov.type === 'REFUND' ? '-' : '+'}
                          {formatCentsToBRL(Math.abs(mov.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="m-auto text-center text-slate-400">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Selecione um turno</p>
                <p className="text-xs">Clique em um caixa ao lado para ver o relatório completo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
