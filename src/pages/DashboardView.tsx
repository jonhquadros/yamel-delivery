/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  Clock, 
  RefreshCw,
  FileText,
  DollarSign,
  CloudOff,
  AlertCircle, 
  ArrowUpRight
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useRouter } from '../services/router';
import { ordersRepository, productionRepository, syncQueueRepository, tablesRepository } from '../services/storage';
import { Order, ProductionTicket, Table } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { getOrderOriginConfig, getOrderStatusConfig } from '../services/orderService';
import { useNetwork } from '../hooks/useNetwork';
import { Button } from '../components/ui/Button';

export function DashboardView() {
  const { navigate } = useRouter();
  const { isOnline } = useNetwork();

  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [productionTickets, setProductionTickets] = useState<ProductionTicket[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [tablesMap, setTablesMap] = useState<Record<string, Table>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data from IndexedDB repositories
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [fetchedOrders, fetchedTickets, pendingQueue, fetchedTables] = await Promise.all([
        ordersRepository.getAll(),
        productionRepository.getAllTickets(),
        syncQueueRepository.getPending(),
        tablesRepository.getAll(),
      ]);

      // Map tables by ID for fast lookup
      const tMap: Record<string, Table> = {};
      for (const t of fetchedTables) {
        tMap[t.id] = t;
      }
      setTablesMap(tMap);

      // Filter out soft-deleted orders & sort newest first
      const activeOrders = fetchedOrders
        .filter(o => !o.deletedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOrders(activeOrders);
      setProductionTickets(fetchedTickets.filter(t => !t.deletedAt));
      setPendingQueueCount(pendingQueue.length);
    } catch (err) {
      console.error('Erro ao carregar dados reais do IndexedDB para o Dashboard:', err);
      setError('Não foi possível carregar os indicadores operacionais do banco local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Metrics derived from real IndexedDB data
  const { salesTodayCents, validOrdersTodayCount, averageTicketCents, inPreparationCount } = useMemo(() => {
    const todayStr = new Date().toDateString();

    // Valid orders for today (excluding CANCELLED and deleted)
    const todayOrders = orders.filter(
      o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'CANCELLED'
    );

    const salesTodayCents = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const validOrdersTodayCount = todayOrders.length;
    const averageTicketCents =
      validOrdersTodayCount > 0 ? Math.round(salesTodayCents / validOrdersTodayCount) : 0;

    // KDS Production Tickets currently in PREPARING status
    const inPreparationCount = productionTickets.filter(t => t.status === 'PREPARING').length;

    return {
      salesTodayCents,
      validOrdersTodayCount,
      averageTicketCents,
      inPreparationCount,
    };
  }, [orders, productionTickets]);

  // Channels Distribution (Today's valid orders grouped by origin)
  const channelsDistribution = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayValidOrders = orders.filter(
      o => new Date(o.createdAt).toDateString() === todayStr && o.status !== 'CANCELLED'
    );

    if (todayValidOrders.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const order of todayValidOrders) {
      const orig = order.origin || 'INTERNAL';
      counts[orig] = (counts[orig] || 0) + 1;
    }

    const total = todayValidOrders.length;
    return Object.entries(counts).map(([origin, count]) => {
      const percentage = Math.round((count / total) * 100);
      return {
        origin,
        count,
        percentage,
        cfg: getOrderOriginConfig(origin as any),
      };
    });
  }, [orders]);

  // 5 Most recent active orders
  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* PAGE HEADER */}
      <PageHeader
        title="Visão Geral Operacional"
        description="Métricas operacionais reais derivadas do banco de dados local IndexedDB."
        id="dashboard-header"
        primaryAction={
          <Button
            id="dashboard-refresh-btn"
            size="sm"
            variant="outline"
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            Atualizar Dados Locais
          </Button>
        }
      />

      {/* LOCAL STORAGE & NETWORK BANNER */}
      <div id="dashboard-notice-banner" className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <CloudOff className="w-5 h-5 text-slate-500 shrink-0 mt-0.5 md:mt-0" />
          <div>
            <h4 className="font-bold text-slate-900">Operação Local-First (IndexedDB)</h4>
            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
              Todos os dados exibidos são calculados em tempo real a partir das operações locais armazenadas neste dispositivo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold text-[11px] ${
            isOnline ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isOnline ? 'Conectado à Internet' : 'Sem Conexão (Modo Offline)'}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white font-bold text-[11px] text-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Fila Local: <strong className="text-slate-900">{pendingQueueCount}</strong> pendentes
          </span>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div id="dashboard-error-banner" className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* REAL METRICS STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Vendas Hoje */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vendas Hoje</p>
            <h3 className="text-xl font-black text-slate-950 mt-1">
              {formatCentsToBRL(salesTodayCents)}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Soma de pedidos válidos
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Pedidos Hoje */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pedidos Hoje</p>
            <h3 className="text-xl font-black text-slate-950 mt-1">
              {validOrdersTodayCount} {validOrdersTodayCount === 1 ? 'pedido' : 'pedidos'}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Registrados no dia
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Ticket Médio */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ticket Médio</p>
            <h3 className="text-xl font-black text-slate-950 mt-1">
              {formatCentsToBRL(averageTicketCents)}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Vendas ÷ Pedidos
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Em Preparo (KDS) */}
        <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Em Preparo (KDS)</p>
            <h3 className="text-xl font-black text-amber-950 mt-1">
              {inPreparationCount} {inPreparationCount === 1 ? 'ticket' : 'tickets'}
            </h3>
            <p className="text-[11px] font-semibold text-amber-700 mt-1">
              Status KDS em preparo
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID: RECENT ORDERS + CHANNELS DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT REAL ORDERS LIST */}
        <div className="lg:col-span-2 flex flex-col gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pedidos Recentes</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Últimos pedidos registrados no sistema local
              </p>
            </div>
            <button
              id="btn-nav-pedidos"
              onClick={() => navigate('/pedidos')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Nenhum pedido registrado recentemente</p>
              <p className="text-[11px] text-slate-400">
                Os novos pedidos realizados via Catálogo, Mesas ou Balcão aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map(order => {
                const origCfg = getOrderOriginConfig(order.origin);
                const statusCfg = getOrderStatusConfig(order.status);
                const tableInfo = order.tableId && tablesMap[order.tableId] ? tablesMap[order.tableId].name : null;

                return (
                  <div
                    key={order.id}
                    id={`recent-order-row-${order.id}`}
                    onClick={() => navigate(`/pedidos/${order.id}`)}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-extrabold text-xs shrink-0">
                        {order.localId || `YML-${order.orderNumber}`}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {order.customerSnapshot?.name || order.notes || 'Cliente Consumidor'}
                          </span>
                          {tableInfo && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0">
                              {tableInfo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded border ${origCfg.colorClass}`}>
                            {origCfg.label}
                          </span>
                          <span className="text-slate-400">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-black text-slate-950">
                        {formatCentsToBRL(order.total || 0)}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${statusCfg.colorClass}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* REAL CHANNELS BREAKDOWN */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Operação por Canal Hoje</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuição percentual de vendas por origem
            </p>
          </div>

          {channelsDistribution.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              Nenhum pedido disponível para análise.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {channelsDistribution.map((channel, idx) => (
                <div key={idx} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className={`px-2 py-0.5 text-[10px] rounded border ${channel.cfg.colorClass}`}>
                      {channel.cfg.label}
                    </span>
                    <span className="text-slate-900">
                      {channel.count} {channel.count === 1 ? 'pedido' : 'pedidos'} ({channel.percentage}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${channel.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
