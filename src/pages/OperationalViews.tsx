/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  Clock,
  Check,
  RefreshCw
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

// 4. COZINHA VIEW (KDS)
export function CozinhaView() {
  const { path } = useRouter();
  const [tickets, setTickets] = useState<ProductionTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<ProductionStationType | 'ALL'>('ALL');
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

  // Filtered tickets
  const filtered = selectedStation === 'ALL'
    ? tickets
    : tickets.filter(t => t.station === selectedStation);

  const sortBySendTimeAndRound = (a: ProductionTicket, b: ProductionTicket) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const roundA = a.roundNumber || 1;
    const roundB = b.roundNumber || 1;
    if (roundA !== roundB) return roundA - roundB;
    return a.id.localeCompare(b.id);
  };

  const novos = filtered.filter(t => t.status === 'PENDING').sort(sortBySendTimeAndRound);
  const preparo = filtered.filter(t => t.status === 'PREPARING').sort(sortBySendTimeAndRound);
  const prontos = filtered.filter(t => t.status === 'READY').sort(sortBySendTimeAndRound);

  return (
    <div className="flex flex-col gap-6">
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

      {/* Station Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">Setor:</span>
          
          <button
            id="kds-filter-all"
            onClick={() => setSelectedStation('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedStation === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos os Setores ({tickets.length})
          </button>

          <button
            id="kds-filter-kitchen"
            onClick={() => setSelectedStation('KITCHEN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedStation === 'KITCHEN'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>🍳</span> Cozinha ({tickets.filter(t => t.station === 'KITCHEN').length})
          </button>

          <button
            id="kds-filter-bar"
            onClick={() => setSelectedStation('BAR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedStation === 'BAR'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            <span>☕</span> Bar ({tickets.filter(t => t.station === 'BAR').length})
          </button>

          <button
            id="kds-filter-icecream"
            onClick={() => setSelectedStation('ICE_CREAM')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedStation === 'ICE_CREAM'
                ? 'bg-pink-600 text-white shadow-2xs'
                : 'bg-pink-50 text-pink-800 border border-pink-200 hover:bg-pink-100'
            }`}
          >
            <span>🍦</span> Sorveteria ({tickets.filter(t => t.station === 'ICE_CREAM').length})
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          KDS Local-First Operacional
        </div>
      </div>

      {loading ? (
        <LoadingState message="Sincronizando fila de produção do KDS..." id="kds-loading" />
      ) : (
        /* KDS Kanban 3-Columns Layout */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: NOVOS (PENDING) */}
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
                {novos.map((ticket) => {
                  const stationInfo = getStationBadge(ticket.station);
                  const originInfo = getOriginInfo(ticket);
                  const priority = getPriorityInfo(ticket.createdAt);
                  const time = formatElapsedTime(ticket.createdAt);

                  return (
                    <div
                      key={ticket.id}
                      className={`border rounded-xl bg-white flex flex-col shadow-xs overflow-hidden transition-all ${priority.borderClass}`}
                    >
                      {/* Ticket Header */}
                      <div className="p-3 border-b border-slate-100 flex justify-between items-start bg-slate-50/80 gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900">
                              #{ticket.orderLocalId}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                              Rodada {ticket.roundNumber || 1}
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
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Obs: {ticket.notes}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          <span className={`text-xs ${priority.timeClass}`}>
                            <Clock className="w-3.5 h-3.5" /> {time.formatted}
                          </span>
                          {priority.isUrgent && (
                            <span className="text-[9px] font-extrabold text-red-600 uppercase mt-0.5">
                              ⚠️ Prioridade Alta
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Items */}
                      <div className="p-4 flex-1 flex flex-col gap-2.5">
                        {ticket.items.map((item) => (
                          <div key={item.id} className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5 last:border-none last:pb-0">
                            <div className="flex items-baseline justify-between text-xs font-bold text-slate-800">
                              <span>
                                <strong className="text-slate-950 font-black text-sm mr-1">{item.quantity}x</strong>
                                {item.productNameSnapshot}
                              </span>
                            </div>
                            {item.notes && (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-100">
                                ⚠️ {item.notes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Ticket Action Footer */}
                      <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                        <Button
                          id={`kds-btn-start-${ticket.id}`}
                          size="sm"
                          disabled={updatingId === ticket.id}
                          onClick={() => handleStatusChange(ticket.id, 'PREPARING')}
                          className="w-full text-xs py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
                        >
                          {updatingId === ticket.id ? 'Iniciando...' : 'Iniciar Preparo'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 2: EM PREPARO (PREPARING) */}
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
                {preparo.map((ticket) => {
                  const stationInfo = getStationBadge(ticket.station);
                  const originInfo = getOriginInfo(ticket);
                  const priority = getPriorityInfo(ticket.createdAt);
                  const time = formatElapsedTime(ticket.createdAt);

                  return (
                    <div
                      key={ticket.id}
                      className={`border rounded-xl bg-white flex flex-col shadow-xs overflow-hidden transition-all ${priority.borderClass}`}
                    >
                      {/* Ticket Header */}
                      <div className="p-3 border-b border-amber-100 flex justify-between items-start bg-amber-50/40 gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900">
                              #{ticket.orderLocalId}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              Rodada {ticket.roundNumber || 1}
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
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Obs: {ticket.notes}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          <span className={`text-xs ${priority.timeClass}`}>
                            <Clock className="w-3.5 h-3.5" /> {time.formatted}
                          </span>
                          {priority.isUrgent && (
                            <span className="text-[9px] font-extrabold text-red-600 uppercase mt-0.5">
                              ⚠️ Atrasado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Items */}
                      <div className="p-4 flex-1 flex flex-col gap-2.5">
                        {ticket.items.map((item) => (
                          <div key={item.id} className="flex flex-col gap-0.5 border-b border-slate-50 pb-1.5 last:border-none last:pb-0">
                            <div className="flex items-baseline justify-between text-xs font-bold text-slate-800">
                              <span>
                                <strong className="text-amber-700 font-black text-sm mr-1">{item.quantity}x</strong>
                                {item.productNameSnapshot}
                              </span>
                            </div>
                            {item.notes && (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-100">
                                ⚠️ {item.notes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Ticket Action Footer */}
                      <div className="p-3 bg-amber-50/20 border-t border-amber-100">
                        <Button
                          id={`kds-btn-ready-${ticket.id}`}
                          size="sm"
                          disabled={updatingId === ticket.id}
                          onClick={() => handleStatusChange(ticket.id, 'READY')}
                          className="w-full text-xs py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
                        >
                          {updatingId === ticket.id ? 'Atualizando...' : 'Marcar como Pronto'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 3: PRONTOS (READY) */}
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
                {prontos.map((ticket) => {
                  const stationInfo = getStationBadge(ticket.station);
                  const originInfo = getOriginInfo(ticket);

                  return (
                    <div
                      key={ticket.id}
                      className="border border-emerald-200 rounded-xl bg-white flex flex-col shadow-xs overflow-hidden opacity-90 hover:opacity-100 transition-opacity"
                    >
                      {/* Ticket Header */}
                      <div className="p-3 border-b border-emerald-100 flex justify-between items-start bg-emerald-50/40 gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-extrabold text-slate-900">
                              #{ticket.orderLocalId}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Rodada {ticket.roundNumber || 1}
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
                        </div>

                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5" /> Pronto
                        </span>
                      </div>

                      {/* Ticket Items */}
                      <div className="p-4 flex-1 flex flex-col gap-2">
                        {ticket.items.map((item) => (
                          <div key={item.id} className="flex items-baseline text-xs font-bold text-slate-500 line-through">
                            <span>{item.quantity}x {item.productNameSnapshot}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer Badge */}
                      <div className="p-3 bg-emerald-50/10 border-t border-emerald-100 text-center">
                        <span className="text-[11px] font-bold text-emerald-700">
                          ✓ Prontinho para servir / entregar
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
