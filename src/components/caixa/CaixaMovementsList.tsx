/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  CreditCard,
  QrCode,
  DollarSign,
  Receipt,
  Layers,
  Clock,
  User
} from 'lucide-react';
import { CashMovement, CashMovementType, PaymentMethod } from '../../services/storage/types';
import { formatCentsToBRL } from '../../utils/currency';

interface CaixaMovementsListProps {
  movements: CashMovement[];
}

export function CaixaMovementsList({ movements }: CaixaMovementsListProps) {
  const [filterType, setFilterType] = useState<CashMovementType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMovements = useMemo(() => {
    return movements.filter(mov => {
      if (filterType !== 'ALL' && mov.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (mov.description || '').toLowerCase();
        const orderId = (mov.orderLocalId || mov.orderId || '').toLowerCase();
        const user = (mov.userName || mov.userId || '').toLowerCase();
        return desc.includes(q) || orderId.includes(q) || user.includes(q);
      }
      return true;
    });
  }, [movements, filterType, searchQuery]);

  const getMovementBadge = (type: CashMovementType) => {
    switch (type) {
      case 'SALE':
        return {
          label: 'Venda',
          class: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />,
          isPositive: true
        };
      case 'DEPOSIT':
        return {
          label: 'Suprimento',
          class: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />,
          isPositive: true
        };
      case 'WITHDRAWAL':
        return {
          label: 'Sangria',
          class: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />,
          isPositive: false
        };
      case 'REFUND':
        return {
          label: 'Estorno',
          class: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: <RefreshCw className="w-3.5 h-3.5 text-purple-600" />,
          isPositive: false
        };
      case 'ADJUSTMENT':
        return {
          label: 'Ajuste',
          class: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />,
          isPositive: true
        };
      default:
        return {
          label: type,
          class: 'bg-slate-50 text-slate-800 border-slate-200',
          icon: <Layers className="w-3.5 h-3.5 text-slate-600" />,
          isPositive: true
        };
    }
  };

  const getPaymentMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return { label: 'Dinheiro', class: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: <DollarSign className="w-3 h-3" /> };
      case 'PIX':
        return { label: 'Pix', class: 'bg-teal-50 text-teal-800 border-teal-200', icon: <QrCode className="w-3 h-3" /> };
      case 'CREDIT_CARD':
        return { label: 'Crédito', class: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: <CreditCard className="w-3 h-3" /> };
      case 'DEBIT_CARD':
        return { label: 'Débito', class: 'bg-blue-50 text-blue-800 border-blue-200', icon: <CreditCard className="w-3 h-3" /> };
      case 'MEAL_VOUCHER':
        return { label: 'Vale Refeição', class: 'bg-amber-50 text-amber-800 border-amber-200', icon: <Receipt className="w-3 h-3" /> };
      default:
        return { label: 'Outro', class: 'bg-slate-50 text-slate-700 border-slate-200', icon: <DollarSign className="w-3 h-3" /> };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Movimentações do Turno
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de vendas, suprimentos, sangrias e estornos em tempo real.
          </p>
        </div>

        {/* Filter buttons & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar movimentação ou pedido..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-full sm:w-60"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Todas ({movements.length})
            </button>
            <button
              onClick={() => setFilterType('SALE')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'SALE'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Vendas
            </button>
            <button
              onClick={() => setFilterType('WITHDRAWAL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'WITHDRAWAL'
                  ? 'bg-white text-rose-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sangrias
            </button>
            <button
              onClick={() => setFilterType('DEPOSIT')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                filterType === 'DEPOSIT'
                  ? 'bg-white text-blue-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Suprimentos
            </button>
          </div>
        </div>
      </div>

      {/* Movements Table / List */}
      {filteredMovements.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
          <Layers className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">Nenhuma movimentação encontrada</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {searchQuery || filterType !== 'ALL'
              ? 'Tente alterar os filtros de busca aplicados.'
              : 'As vendas e lançamentos deste turno aparecerão listados aqui.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-x-auto">
          {filteredMovements.map(mov => {
            const badge = getMovementBadge(mov.type);
            const methodBadge = getPaymentMethodBadge(mov.paymentMethod);
            const isNegative = mov.type === 'WITHDRAWAL' || mov.type === 'REFUND';
            const formattedTime = new Date(mov.createdAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={mov.id}
                className="p-4 sm:px-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors gap-4"
              >
                {/* Left info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${badge.class}`}>
                    {badge.icon}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {mov.description}
                      </span>
                      {mov.orderLocalId && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          #{mov.orderLocalId}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${methodBadge.class}`}>
                        {methodBadge.icon}
                        {methodBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedTime}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {mov.userName || 'Operador'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right value */}
                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-extrabold tracking-tight ${
                      isNegative ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isNegative ? '-' : '+'} {formatCentsToBRL(Math.abs(mov.amount))}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mt-0.5">
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
