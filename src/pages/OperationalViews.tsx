/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Check,
  RefreshCw,
  Search,
  X,
  Flame,
  AlertCircle,
  ChefHat,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { LoadingState } from '../components/ui/Feedback';
import { useRouter } from '../services/router';
import {
  ProductionTicket,
  ProductionStationType,
  ProductionStatus
} from '../services/storage/types';
import {
  productionRepository
} from '../services/storage';

// 1. PDV VIEW (PONTO DE VENDA)
export { PdvView } from './PdvView';

// 2. PEDIDOS VIEW (CENTRAL OPERACIONAL)
export { PedidosView } from './PedidosView';

// 3. MESAS VIEW (GESTÃO DE MESAS E COMANDAS)
export { MesasView } from './MesasView';

export type PeriodFilter = 'TODAY' | 'WEEK' | 'ALL';
export type StatusFilter = 'ALL' | 'PENDING' | 'PREPARING' | 'READY';

// 4. COZINHA VIEW (KDS - MONITOR DE PREPARO)
export function CozinhaView() {
  const { path } = useRouter();
  const [tickets, setTickets] = useState<ProductionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<ProductionStationType | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [now, setNow] = useState(Date.now());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Auto-select station based on route path
  useEffect(() => {
    if (path.includes('/cozinha/bar')) {
      setSelectedStation('BAR');
    } else if (path.includes('/cozinha/ice-cream') || path.includes('/cozinha/sorveteria')) {
      setSelectedStation('ICE_CREAM');
    } else if (path.includes('/cozinha/kitchen') || path.includes('/cozinha/cozinha')) {
      setSelectedStation('KITCHEN');
    }
  }, [path]);

  // Load and sync production tickets
  const loadTickets = async () => {
    try {
      await productionRepository.syncTicketsFromOrders();
      const list = await productionRepository.getAllTickets();
      setTickets(list);
    } catch (err) {
      console.error('Erro ao carregar tickets do KDS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000); // 1-second live clock update
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (ticketId: string, nextStatus: ProductionStatus) => {
    if (updatingId === ticketId) return;
    try {
      setUpdatingId(ticketId);
      await productionRepository.updateTicketStatus(ticketId, nextStatus);
      await loadTickets();
    } catch (err) {
      console.error('Erro ao atualizar status do ticket KDS:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Station badges helper
  const getStationBadge = (station: ProductionStationType) => {
    switch (station) {
      case 'BAR':
        return { label: 'Bar', icon: '☕', class: 'bg-sky-100 text-sky-800 border-sky-300' };
      case 'ICE_CREAM':
        return { label: 'Sorveteria', icon: '🍦', class: 'bg-pink-100 text-pink-800 border-pink-300' };
      case 'KITCHEN':
      default:
        return { label: 'Cozinha', icon: '🍳', class: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
  };

  // Helper to format origin
  const getOriginInfo = (ticket: ProductionTicket) => {
    if (ticket.tableName || ticket.tableNumber) {
      return {
        label: ticket.tableName || `Mesa ${ticket.tableNumber}`,
        class: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      };
    }
    if (ticket.orderOrigin === 'DELIVERY') {
      return {
        label: '🚴 Delivery',
        class: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    if (ticket.orderOrigin === 'CATALOG' || ticket.orderOrigin === 'WHATSAPP') {
      return {
        label: ticket.customerName ? `📱 ${ticket.customerName}` : '📱 Catálogo Digital',
        class: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }
    return {
      label: 'Balcão / PDV',
      class: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  };

  // Format elapsed time in MM:SS
  const formatElapsedTime = (createdAtISO: string) => {
    const created = new Date(createdAtISO).getTime();
    const diffSec = Math.max(0, Math.floor((now - created) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return {
      minutes: mins,
      formatted: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    };
  };

  // Priority indicator helper
  const getPriorityInfo = (createdAtISO: string) => {
    const { minutes } = formatElapsedTime(createdAtISO);
    if (minutes >= 20) {
      return {
        label: 'URGENTE',
        timeClass: 'text-red-700 font-black flex items-center gap-1',
        borderClass: 'border-red-300 ring-2 ring-red-200 bg-red-50/20',
        badgeClass: 'bg-red-600 text-white animate-pulse',
        isUrgent: true
      };
    }
    if (minutes >= 10) {
      return {
        label: 'Atenção',
        timeClass: 'text-amber-700 font-extrabold flex items-center gap-1',
        borderClass: 'border-amber-300 bg-amber-50/10',
        badgeClass: 'bg-amber-500 text-white',
        isUrgent: false
      };
    }
    return {
      label: 'Normal',
      timeClass: 'text-slate-600 font-bold flex items-center gap-1',
      borderClass: 'border-slate-200',
      badgeClass: 'bg-slate-200 text-slate-700',
      isUrgent: false
    };
  };

  // 1. Filtragem por Período
  const periodFilteredTickets = useMemo(() => {
    const todayStr = new Date().toDateString();
    const nowTs = Date.now();
    const sevenDaysAgo = nowTs - 7 * 24 * 60 * 60 * 1000;

    return tickets.filter(t => {
      if (t.deletedAt) return false;
      const tDate = new Date(t.createdAt || 0);

      if (periodFilter === 'TODAY') {
        return tDate.toDateString() === todayStr;
      }
      if (periodFilter === 'WEEK') {
        return tDate.getTime() >= sevenDaysAgo;
      }
      return true; // 'ALL'
    });
  }, [tickets, periodFilter]);

  // Contadores dinâmicos reais para o cabeçalho baseados no período
  const periodMetrics = useMemo(() => {
    const aguardando = periodFilteredTickets.filter(t => t.status === 'PENDING').length;
    const emPreparo = periodFilteredTickets.filter(t => t.status === 'PREPARING').length;
    const prontos = periodFilteredTickets.filter(t => t.status === 'READY').length;
    const total = periodFilteredTickets.length;
    const urgentes = periodFilteredTickets.filter(t => {
      if (t.status === 'READY') return false;
      const created = new Date(t.createdAt || 0).getTime();
      return Math.floor((now - created) / 60000) >= 20;
    }).length;

    return { aguardando, emPreparo, prontos, total, urgentes };
  }, [periodFilteredTickets, now]);

  // 2. Filtragem combinada completa (Período + Estação + Status + Busca)
  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return periodFilteredTickets.filter(t => {
      // Filtro por Estação
      if (selectedStation !== 'ALL' && t.station !== selectedStation) {
        return false;
      }

      // Filtro por Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }

      // Busca por texto
      if (query) {
        const orderId = (t.orderLocalId || '').toLowerCase();
        const tableName = (t.tableName || '').toLowerCase();
        const tableNum = (t.tableNumber || '').toString();
        const roundId = (t.roundId || '').toLowerCase();
        const roundNum = (t.roundNumber || '').toString();
        const custName = (t.customerName || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        const itemsMatch = t.items.some(
          i => i.productNameSnapshot.toLowerCase().includes(query) || (i.notes && i.notes.toLowerCase().includes(query))
        );

        const match =
          orderId.includes(query) ||
          tableName.includes(query) ||
          tableNum.includes(query) ||
          roundId.includes(query) ||
          roundNum.includes(query) ||
          custName.includes(query) ||
          notes.includes(query) ||
          itemsMatch;

        if (!match) return false;
      }

      return true;
    });
  }, [periodFilteredTickets, selectedStation, statusFilter, searchQuery]);

  // Ordenação operacional estrita da fila de produção:
  // 1. PENDING: Chegada mais antiga primeiro (createdAt ASC) para atender quem chegou antes
  // 2. PREPARING: Ordem de início/chegada (createdAt ASC ou updatedAt ASC)
  // 3. READY: Ordem de conclusão mais recente no topo (updatedAt DESC)
  const sortByArrivalAsc = (a: ProductionTicket, b: ProductionTicket) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const roundA = a.roundNumber || 1;
    const roundB = b.roundNumber || 1;
    if (roundA !== roundB) return roundA - roundB;
    return a.id.localeCompare(b.id);
  };

  const sortByUpdatedDesc = (a: ProductionTicket, b: ProductionTicket) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id.localeCompare(a.id);
  };

  const novos = filteredTickets.filter(t => t.status === 'PENDING').sort(sortByArrivalAsc);
  const preparo = filteredTickets.filter(t => t.status === 'PREPARING').sort(sortByArrivalAsc);
  const prontos = filteredTickets.filter(t => t.status === 'READY').sort(sortByUpdatedDesc);

  const renderTicketCard = (ticket: ProductionTicket) => {
    const stationInfo = getStationBadge(ticket.station);
    const originInfo = getOriginInfo(ticket);
    const priority = getPriorityInfo(ticket.createdAt);
    const time = formatElapsedTime(ticket.createdAt);

    return (
      <div
        key={ticket.id}
        id={`kds-card-${ticket.id}`}
        className={`border rounded-xl bg-white flex flex-col shadow-xs overflow-hidden transition-all ${
          ticket.status === 'READY' ? 'border-emerald-200 opacity-95' : priority.borderClass
        }`}
      >
        {/* Ticket Header */}
        <div
          className={`p-3 border-b flex justify-between items-start gap-2 ${
            ticket.status === 'PENDING'
              ? 'border-slate-100 bg-slate-50/80'
              : ticket.status === 'PREPARING'
              ? 'border-amber-100 bg-amber-50/40'
              : 'border-emerald-100 bg-emerald-50/40'
          }`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-slate-900">
                #{ticket.orderLocalId}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                Rodada #{ticket.roundNumber || 1} {ticket.roundId ? `(${ticket.roundId})` : ''}
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${originInfo.class}`}>
                {originInfo.label}
              </span>
              {selectedStation === 'ALL' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stationInfo.class}`}>
                  {stationInfo.icon} {stationInfo.label}
                </span>
              )}
            </div>
            {ticket.notes && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 break-words">
                ⚠️ Obs: {ticket.notes}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end shrink-0">
            {ticket.status !== 'READY' ? (
              <>
                <span className={`text-xs ${priority.timeClass}`}>
                  <Clock className="w-3.5 h-3.5" /> {time.formatted}
                </span>
                {priority.isUrgent && (
                  <span className="text-[9px] font-extrabold text-red-600 uppercase mt-0.5">
                    ⚠️ Prioridade Alta
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Pronto
              </span>
            )}
          </div>
        </div>

        {/* Ticket Items */}
        <div className="p-4 flex-1 flex flex-col gap-2.5">
          {ticket.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5 last:border-none last:pb-0"
            >
              <div className="flex items-baseline justify-between text-xs font-bold text-slate-800">
                <span className={ticket.status === 'READY' ? 'text-slate-500 line-through' : ''}>
                  <strong className={`font-black text-sm mr-1.5 ${ticket.status === 'PREPARING' ? 'text-amber-700' : 'text-slate-950'}`}>
                    {item.quantity}x
                  </strong>
                  {item.productNameSnapshot}
                </span>
              </div>

              {/* Accompaniments Snapshot */}
              {item.selectedAccompaniments && item.selectedAccompaniments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.selectedAccompaniments.map((acc, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80 px-1.5 py-0.2 rounded"
                    >
                      +{acc.quantity}x {acc.itemNameSnapshot}
                    </span>
                  ))}
                </div>
              )}

              {/* Options Snapshot */}
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.selectedOptions.map((opt, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded"
                    >
                      {opt.optionName}: {opt.choiceName}
                    </span>
                  ))}
                </div>
              )}

              {/* Addons Snapshot */}
              {item.selectedAddons && item.selectedAddons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.selectedAddons.map((add, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.2 rounded"
                    >
                      +{add.quantity}x {add.addonName}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-100 mt-0.5">
                  ⚠️ {item.notes}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Ticket Action Footer */}
        <div
          className={`p-3 border-t ${
            ticket.status === 'PENDING'
              ? 'bg-slate-50/50 border-slate-100'
              : ticket.status === 'PREPARING'
              ? 'bg-amber-50/20 border-amber-100'
              : 'bg-emerald-50/10 border-emerald-100 text-center'
          }`}
        >
          {ticket.status === 'PENDING' && (
            <Button
              id={`kds-btn-start-${ticket.id}`}
              size="sm"
              disabled={updatingId === ticket.id}
              onClick={() => handleStatusChange(ticket.id, 'PREPARING')}
              className="w-full text-xs py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              {updatingId === ticket.id ? 'Iniciando...' : 'Iniciar Preparo'}
            </Button>
          )}

          {ticket.status === 'PREPARING' && (
            <Button
              id={`kds-btn-ready-${ticket.id}`}
              size="sm"
              disabled={updatingId === ticket.id}
              onClick={() => handleStatusChange(ticket.id, 'READY')}
              className="w-full text-xs py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {updatingId === ticket.id ? 'Atualizando...' : 'Marcar como Pronto'}
            </Button>
          )}

          {ticket.status === 'READY' && (
            <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Prontinho para servir / retirar
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Operacional */}
      <PageHeader
        title="Monitor de Preparo (KDS)"
        description="Painel tático de produção local-first para Cozinha, Bar e Sorveteria."
        id="cozinha-header"
        primaryAction={
          <Button
            id="kds-refresh-btn"
            variant="outline"
            size="sm"
            onClick={loadTickets}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sincronizar KDS
          </Button>
        }
      />

      {/* KPI Cards / Indicadores Dinâmicos Reais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Aguardando</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-700">{periodMetrics.aguardando}</span>
            <span className="text-xs text-slate-400 font-semibold">na fila</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col bg-amber-50/10">
          <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">Em Preparo</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600">{periodMetrics.emPreparo}</span>
            <span className="text-xs text-amber-700/60 font-semibold">na bancada</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col bg-emerald-50/10">
          <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">Prontos</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-600">{periodMetrics.prontos}</span>
            <span className="text-xs text-emerald-700/60 font-semibold">para entrega</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total no Período</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{periodMetrics.total}</span>
            {periodMetrics.urgentes > 0 && (
              <span className="text-xs font-bold text-red-600 animate-pulse">
                ({periodMetrics.urgentes} urgentes)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar: Busca + Filtro de Período + Setores + Status */}
      <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        {/* Linha 1: Campo de Busca e Filtro de Período */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Busca Operacional */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="kds-search-input"
              type="text"
              placeholder="Buscar por pedido (#YML-1034), mesa, rodada, cliente ou item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Temporal (Hoje / Últimos 7 dias / Todos) */}
          <div className="flex items-center gap-1.5 self-start md:self-auto shrink-0 bg-slate-100 p-1 rounded-lg">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase px-1.5">Período:</span>
            <button
              id="kds-period-today"
              onClick={() => setPeriodFilter('TODAY')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                periodFilter === 'TODAY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              id="kds-period-week"
              onClick={() => setPeriodFilter('WEEK')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                periodFilter === 'WEEK'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              id="kds-period-all"
              onClick={() => setPeriodFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                periodFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        {/* Linha 2: Seletor de Setor + Seletor de Status */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Seletor de Setor */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mr-1 shrink-0">Setor:</span>
            
            <button
              id="kds-filter-all"
              onClick={() => setSelectedStation('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStation === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({periodFilteredTickets.length})
            </button>

            <button
              id="kds-filter-kitchen"
              onClick={() => setSelectedStation('KITCHEN')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                selectedStation === 'KITCHEN'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>🍳</span> Cozinha ({periodFilteredTickets.filter(t => t.station === 'KITCHEN').length})
            </button>

            <button
              id="kds-filter-bar"
              onClick={() => setSelectedStation('BAR')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                selectedStation === 'BAR'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
              }`}
            >
              <span>☕</span> Bar ({periodFilteredTickets.filter(t => t.station === 'BAR').length})
            </button>

            <button
              id="kds-filter-icecream"
              onClick={() => setSelectedStation('ICE_CREAM')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                selectedStation === 'ICE_CREAM'
                  ? 'bg-pink-600 text-white shadow-2xs'
                  : 'bg-pink-50 text-pink-800 border border-pink-200 hover:bg-pink-100'
              }`}
            >
              <span>🍦</span> Sorveteria ({periodFilteredTickets.filter(t => t.station === 'ICE_CREAM').length})
            </button>
          </div>

          {/* Seletor de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mr-1 shrink-0">Status:</span>

            <button
              id="kds-status-all"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>

            <button
              id="kds-status-pending"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              Aguardando ({periodFilteredTickets.filter(t => t.status === 'PENDING').length})
            </button>

            <button
              id="kds-status-preparing"
              onClick={() => setStatusFilter('PREPARING')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'PREPARING'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Em Preparo ({periodFilteredTickets.filter(t => t.status === 'PREPARING').length})
            </button>

            <button
              id="kds-status-ready"
              onClick={() => setStatusFilter('READY')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Prontos ({periodFilteredTickets.filter(t => t.status === 'READY').length})
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal do KDS */}
      {loading ? (
        <LoadingState message="Sincronizando fila de produção do KDS..." id="kds-loading" />
      ) : filteredTickets.length === 0 ? (
        /* Estado Vazio */
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center gap-3">
          <ChefHat className="w-12 h-12 text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">Nenhum pedido encontrado na fila</h3>
          <p className="text-xs text-slate-500 max-w-md">
            {searchQuery
              ? `Não foram encontrados tickets para o termo "${searchQuery}" com os filtros atuais.`
              : 'Não há pedidos ou rodadas pendentes no período selecionado.'}
          </p>
          {(searchQuery || selectedStation !== 'ALL' || statusFilter !== 'ALL' || periodFilter !== 'TODAY') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedStation('ALL');
                setStatusFilter('ALL');
                setPeriodFilter('TODAY');
              }}
              className="text-xs mt-2"
            >
              Limpar Todos os Filtros
            </Button>
          )}
        </div>
      ) : statusFilter === 'ALL' ? (
        /* KDS Kanban 3-Colunas Padrão */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Coluna 1: NOVOS (PENDING) */}
          <div className="flex flex-col gap-4 bg-slate-100/70 p-4 rounded-xl border border-slate-200 min-h-[500px]">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <h3 className="text-xs font-extrabold tracking-wider text-blue-700 uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                Novos Pedidos ({novos.length})
              </h3>
              <span className="text-[10px] font-bold text-slate-500">Aguardando Início</span>
            </div>

            {novos.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-slate-400 bg-white/50 rounded-lg border border-dashed border-slate-200 my-auto">
                Nenhum pedido pendente para produção.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {novos.map(renderTicketCard)}
              </div>
            )}
          </div>

          {/* Coluna 2: EM PREPARO (PREPARING) */}
          <div className="flex flex-col gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-200 min-h-[500px]">
            <div className="flex justify-between items-center border-b border-amber-200 pb-2.5">
              <h3 className="text-xs font-extrabold tracking-wider text-amber-700 uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                Em Preparo ({preparo.length})
              </h3>
              <span className="text-[10px] font-bold text-amber-600">Na Bancada</span>
            </div>

            {preparo.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-amber-600/60 bg-white/50 rounded-lg border border-dashed border-amber-200 my-auto">
                Nenhum pedido em preparo no momento.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {preparo.map(renderTicketCard)}
              </div>
            )}
          </div>

          {/* Coluna 3: PRONTOS (READY) */}
          <div className="flex flex-col gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 min-h-[500px]">
            <div className="flex justify-between items-center border-b border-emerald-200 pb-2.5">
              <h3 className="text-xs font-extrabold tracking-wider text-emerald-700 uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                Prontos ({prontos.length})
              </h3>
              <span className="text-[10px] font-bold text-emerald-600">Aguardando Retirada</span>
            </div>

            {prontos.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-emerald-600/60 bg-white/50 rounded-lg border border-dashed border-emerald-200 my-auto">
                Nenhum pedido pronto finalizado recentemente.
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {prontos.map(renderTicketCard)}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Visualização Focada por Status Selecionado */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700">
              Exibindo apenas tickets com status: <strong className="text-slate-900 uppercase">{statusFilter}</strong> ({filteredTickets.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusFilter('ALL')}
              className="text-xs"
            >
              Voltar ao Kanban Geral
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.map(renderTicketCard)}
          </div>
        </div>
      )}
    </div>
  );
}

// 5. DELIVERY VIEW (CENTRAL OPERACIONAL DE ENTREGAS)
export { DeliveryView } from './DeliveryView';

// 6. CAIXA VIEW (FLUXO E FECHAMENTO OPERACIONAL)
export { CaixaView } from './CaixaView';
