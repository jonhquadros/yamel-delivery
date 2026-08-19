/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  Phone,
  User,
  ShoppingBag,
  Utensils,
  Store,
  Bike,
  MessageSquare,
  ChevronRight,
  MapPin,
  CreditCard,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  PackageCheck,
  Send,
  Edit3
} from 'lucide-react';
import { useRouter } from '../services/router';
import { ordersRepository, tablesRepository } from '../services/storage';
import { Order, OrderStatus, OrderOrigin, Table } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Overlay';
import { LoadingState } from '../components/ui/Feedback';
import { whatsappService } from '../services/whatsappService';
import { OrderEditForm } from '../components/orders/OrderEditForm';
import {
  getOrderOriginConfig,
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getAvailableTransitions,
  changeOrderStatusSafely,
  getOrderEditPermissions,
  sendRoundToPreparation
} from '../services/orderService';

type PeriodFilter = 'TODAY' | 'WEEK' | 'ALL';

export function PedidosView() {
  const { params, navigate } = useRouter();
  const routeOrderId = params.id;

  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [tablesMap, setTablesMap] = useState<Record<string, Table>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Order Drawer State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingRoundId, setSendingRoundId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleSendRoundToPreparo = async (roundId: string) => {
    if (!selectedOrder || sendingRoundId === roundId) return;
    try {
      setSendingRoundId(roundId);
      setStatusError(null);
      await sendRoundToPreparation(selectedOrder.id, roundId);
      const updatedOrder = await ordersRepository.getById(selectedOrder.id);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      }
      await loadData();
    } catch (err: any) {
      console.error('Erro ao enviar rodada para preparo:', err);
      setStatusError(err.message || 'Erro ao enviar rodada para preparo.');
    } finally {
      setSendingRoundId(null);
    }
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [originFilter, setOriginFilter] = useState<OrderOrigin | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TODAY');

  // Load orders and tables from IndexedDB
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [fetchedOrders, fetchedTables] = await Promise.all([
        ordersRepository.getAll(),
        tablesRepository.getAll()
      ]);

      // Map tables by ID
      const tMap: Record<string, Table> = {};
      for (const t of fetchedTables) {
        tMap[t.id] = t;
      }
      setTablesMap(tMap);

      // Sort newest orders first
      fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(fetchedOrders);

      // Handle route-based selected order (/pedidos/:id)
      if (routeOrderId) {
        const found = fetchedOrders.find(o => o.id === routeOrderId || o.localId === routeOrderId);
        if (found) {
          setSelectedOrder(found);
        }
      } else if (selectedOrder) {
        // Keep active drawer order updated with fresh IndexedDB state
        const fresh = fetchedOrders.find(o => o.id === selectedOrder.id);
        if (fresh) setSelectedOrder(fresh);
      }
    } catch (err) {
      console.error('Erro ao carregar pedidos do IndexedDB:', err);
      setError('Não foi possível carregar os pedidos do banco de dados local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [routeOrderId]);

  // Filter Logic
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const nowTs = Date.now();
    const todayStr = new Date().toDateString();
    const sevenDaysAgo = nowTs - 7 * 24 * 60 * 60 * 1000;

    return orders.filter(order => {
      // 1. Period Filter
      const orderDate = new Date(order.createdAt);
      if (periodFilter === 'TODAY') {
        if (orderDate.toDateString() !== todayStr) return false;
      } else if (periodFilter === 'WEEK') {
        if (orderDate.getTime() < sevenDaysAgo) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // 3. Origin Filter
      if (originFilter !== 'ALL' && order.origin !== originFilter) {
        return false;
      }

      // 4. Search Query
      if (query) {
        const localId = (order.localId || '').toLowerCase();
        const orderNum = (order.orderNumber || '').toString();
        const custName = (order.customerSnapshot?.name || '').toLowerCase();
        const custPhone = (order.customerSnapshot?.phone || '').toLowerCase();
        const notes = (order.notes || '').toLowerCase();
        const tableName = order.tableId && tablesMap[order.tableId] ? tablesMap[order.tableId].name.toLowerCase() : '';

        const matches =
          localId.includes(query) ||
          orderNum.includes(query) ||
          custName.includes(query) ||
          custPhone.includes(query) ||
          notes.includes(query) ||
          tableName.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, originFilter, periodFilter, tablesMap]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);

    const totalCount = todayOrders.length;
    const activeCount = todayOrders.filter(o =>
      ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status)
    ).length;
    const completedCount = todayOrders.filter(o =>
      ['COMPLETED', 'DELIVERED'].includes(o.status)
    ).length;
    const revenueCents = todayOrders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalCount,
      activeCount,
      completedCount,
      revenueCents,
    };
  }, [orders]);

  // Order selection handler
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setStatusError(null);
  };

  const handleCloseDrawer = () => {
    setSelectedOrder(null);
    setIsEditing(false);
    setStatusError(null);
    if (routeOrderId) {
      navigate('/pedidos');
    }
  };

  // Status transition handler with idempotency and concurrency locks
  const handleStatusTransition = async (nextStatus: OrderStatus) => {
    if (!selectedOrder || updatingId === selectedOrder.id) return;

    try {
      setUpdatingId(selectedOrder.id);
      setStatusError(null);

      const updated = await changeOrderStatusSafely(selectedOrder.id, nextStatus);
      setSelectedOrder(updated);

      // Refresh background list
      await loadData();
    } catch (err: any) {
      console.error('Erro ao alterar status do pedido:', err);
      setStatusError(err.message || 'Não foi possível alterar o status do pedido.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Trigger WhatsApp communication
  const handleSendWhatsApp = (order: Order) => {
    if (!order.customerSnapshot?.phone) return;

    const itemsSummary = (order.items || [])
      .map(i => `• ${i.quantity}x ${i.productNameSnapshot} (${formatCentsToBRL(i.subtotal)})`)
      .join('\n');

    const address = order.deliverySnapshot
      ? `${order.deliverySnapshot.address}, ${order.deliverySnapshot.number} - ${order.deliverySnapshot.neighborhood}`
      : undefined;

    whatsappService.sendOrderMessage(
      {
        orderId: order.localId || `YML-${order.orderNumber}`,
        customerName: order.customerSnapshot?.name,
        itemsSummary,
        total: (order.total || 0) / 100,
        deliveryAddress: address,
      },
      order.customerSnapshot.phone
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* PAGE HEADER */}
      <PageHeader
        title="Central Operacional de Pedidos"
        description="Acompanhamento, filtros e gerenciamento em tempo real dos pedidos registrados."
        id="pedidos-header"
        primaryAction={
          <Button
            id="pedidos-refresh-btn"
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            Atualizar Pedidos
          </Button>
        }
      />

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Pedidos Hoje</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{metrics.totalCount}</div>
        </div>

        <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold">Em Andamento</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">{metrics.activeCount}</div>
        </div>

        <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold">Concluídos Hoje</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">{metrics.completedCount}</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Faturamento Hoje</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-950">
            {formatCentsToBRL(metrics.revenueCents)}
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH CONTROLS BAR */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="pedidos-search-input"
              type="text"
              placeholder="Buscar por número, cliente, telefone, mesa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-amber-500 outline-none font-medium"
            />
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
            {(
              [
                { id: 'TODAY', label: 'Hoje' },
                { id: 'WEEK', label: '7 Dias' },
                { id: 'ALL', label: 'Todos' },
              ] as const
            ).map(p => (
              <button
                key={p.id}
                id={`filter-period-${p.id}`}
                onClick={() => setPeriodFilter(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors select-none ${
                  periodFilter === p.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status and Origin Filter Dropdowns/Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
            Status:
          </span>
          <select
            id="pedidos-status-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
            className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-amber-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PREPARING">Em Preparo</option>
            <option value="READY">Pronto</option>
            <option value="OUT_FOR_DELIVERY">Saiu p/ Entrega</option>
            <option value="DELIVERED">Entregue</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
          </select>

          <span className="font-bold text-slate-500 ml-2 mr-1 flex items-center gap-1">
            Origem:
          </span>
          <select
            id="pedidos-origin-select"
            value={originFilter}
            onChange={e => setOriginFilter(e.target.value as OrderOrigin | 'ALL')}
            className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-amber-500"
          >
            <option value="ALL">Todas as Origens</option>
            <option value="CATALOG">Catálogo</option>
            <option value="TABLE">Mesa</option>
            <option value="COUNTER">Balcão</option>
            <option value="DELIVERY">Delivery</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INTERNAL">Interno</option>
          </select>

          {/* Active filter counter */}
          <span className="ml-auto text-[11px] font-semibold text-slate-500">
            Exibindo <strong className="text-slate-900">{filteredOrders.length}</strong> de{' '}
            {orders.length} pedidos
          </span>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div id="pedidos-error-banner" className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {loading ? (
        <LoadingState id="pedidos-loading" message="Carregando pedidos do banco de dados local IndexedDB..." />
      ) : filteredOrders.length === 0 ? (
        /* EMPTY STATE */
        <div id="pedidos-empty-state" className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Não há pedidos para os filtros selecionados</h3>
            <p className="text-xs text-slate-500 mt-1">
              Tente alterar a busca, o período ou selecionar um filtro de status diferente.
            </p>
          </div>
          {(searchQuery || statusFilter !== 'ALL' || originFilter !== 'ALL' || periodFilter !== 'ALL') && (
            <Button
              id="clear-filters-btn"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setOriginFilter('ALL');
                setPeriodFilter('ALL');
              }}
              className="mt-2 text-xs"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      ) : (
        /* ORDERS GRID / LIST */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const originCfg = getOrderOriginConfig(order.origin);
            const statusCfg = getOrderStatusConfig(order.status);
            const paymentCfg = getPaymentStatusConfig(order.paymentStatus);
            const tableInfo = order.tableId && tablesMap[order.tableId] ? tablesMap[order.tableId].name : null;
            const itemsCount = (order.items || []).reduce((acc, it) => acc + it.quantity, 0);

            return (
              <div
                key={order.id}
                id={`order-card-${order.id}`}
                onClick={() => handleSelectOrder(order)}
                className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-2xs transition-all duration-150 flex flex-col justify-between cursor-pointer hover:shadow-xs group"
              >
                <div>
                  {/* Top Bar: Order ID + Origin Badge + Sync Status */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-950">
                        {order.localId || `YML-${order.orderNumber}`}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${originCfg.colorClass}`}
                      >
                        {originCfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Customer / Context Info */}
                  <div className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span className="truncate flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {order.customerSnapshot?.name || order.notes || 'Cliente Consumidor'}
                      </span>
                      {tableInfo && (
                        <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0">
                          {tableInfo}
                        </span>
                      )}
                    </div>

                    {order.customerSnapshot?.phone && (
                      <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {order.customerSnapshot.phone}
                      </p>
                    )}

                    {order.fulfillmentType && (
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mt-1">
                        Atendimento: {order.fulfillmentType === 'DELIVERY' ? '🛵 Delivery' : '🛍️ Retirada'}
                      </p>
                    )}
                  </div>

                  {/* Items Preview */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 mb-3">
                    <div className="font-semibold text-slate-800 mb-1">
                      {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}:
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-600 line-clamp-2">
                      {(order.items || []).slice(0, 2).map((it, idx) => (
                        <li key={idx} className="truncate">
                          • {it.quantity}x {it.productNameSnapshot}
                        </li>
                      ))}
                      {(order.items || []).length > 2 && (
                        <li className="text-slate-400 italic">
                          + {(order.items || []).length - 2} outros itens...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Footer Bar: Total + Badges */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Valor Total:</span>
                    <span className="text-sm font-black text-slate-950">
                      {formatCentsToBRL(order.total || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold rounded-md border ${statusCfg.colorClass}`}
                    >
                      {statusCfg.label}
                    </span>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${paymentCfg.colorClass}`}
                    >
                      {paymentCfg.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
                    <span className="flex items-center gap-1 text-slate-400">
                      <CloudOff className="w-3 h-3" /> IndexedDB Local
                    </span>
                    <span className="text-amber-600 font-bold group-hover:underline flex items-center gap-0.5">
                      Ver detalhes <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER DETALHES DO PEDIDO */}
      <Drawer
        id="pedido-details-drawer"
        isOpen={Boolean(selectedOrder)}
        onClose={handleCloseDrawer}
        title={
          selectedOrder
            ? isEditing
              ? `Editar Pedido ${selectedOrder.localId || `YML-${selectedOrder.orderNumber}`}`
              : `Pedido ${selectedOrder.localId || `YML-${selectedOrder.orderNumber}`}`
            : ''
        }
      >
        {selectedOrder && (
          isEditing ? (
            <OrderEditForm
              order={selectedOrder}
              onCancel={() => setIsEditing(false)}
              onSaveSuccess={async (updatedOrder) => {
                setSelectedOrder(updatedOrder);
                setIsEditing(false);
                await loadData();
              }}
            />
          ) : (
            <div className="flex flex-col gap-5 py-2">
              {/* Status error banner */}
              {statusError && (
                <div id="drawer-status-error" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              {/* Botão de Edição de Pedido (se permitido pelo domínio) */}
              {getOrderEditPermissions(selectedOrder).allowed && (
                <button
                  id="btn-open-edit-order"
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2.5 px-3 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Editar Dados / Itens do Pedido</span>
                </button>
              )}

              {/* Header badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                    Origem do Pedido
                  </span>
                  <span
                    className={`inline-block mt-0.5 px-2.5 py-0.5 text-xs font-extrabold rounded-full border ${
                      getOrderOriginConfig(selectedOrder.origin).colorClass
                    }`}
                  >
                    {getOrderOriginConfig(selectedOrder.origin).label}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block text-right">
                    Status Operacional
                  </span>
                  <span
                    className={`inline-block mt-0.5 px-2.5 py-0.5 text-xs font-extrabold rounded-full border ${
                      getOrderStatusConfig(selectedOrder.status).colorClass
                    }`}
                  >
                    {getOrderStatusConfig(selectedOrder.status).label}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Cliente
                </h4>
                <div className="text-xs text-slate-800 font-bold">
                  {selectedOrder.customerSnapshot?.name || selectedOrder.notes || 'Cliente Consumidor'}
                </div>

                {selectedOrder.customerSnapshot?.phone && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedOrder.customerSnapshot.phone}
                    </span>

                    <button
                      id="btn-drawer-whatsapp"
                      type="button"
                      onClick={() => handleSendWhatsApp(selectedOrder)}
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Send className="w-3 h-3" /> WhatsApp
                    </button>
                  </div>
                )}
              </div>

              {/* Atendimento e Entrega */}
              <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" /> Atendimento
                </h4>

                {selectedOrder.tableId && tablesMap[selectedOrder.tableId] && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Mesa Vinculada: {tablesMap[selectedOrder.tableId].name}
                  </p>
                )}

                {selectedOrder.fulfillmentType && (
                  <p className="text-xs text-slate-700 font-semibold">
                    Modalidade:{' '}
                    {selectedOrder.fulfillmentType === 'DELIVERY' ? 'Entrega em Domicílio' : 'Retirada no Balcão'}
                  </p>
                )}

                {selectedOrder.deliverySnapshot && (
                  <div className="mt-1 pt-2 border-t border-slate-100 text-xs text-slate-600 flex flex-col gap-0.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Endereço de Entrega:
                    </span>
                    <span>
                      {selectedOrder.deliverySnapshot.address}, {selectedOrder.deliverySnapshot.number}
                    </span>
                    {selectedOrder.deliverySnapshot.complement && (
                      <span className="text-slate-500">
                        Comp: {selectedOrder.deliverySnapshot.complement}
                      </span>
                    )}
                    <span>
                      Bairro: {selectedOrder.deliverySnapshot.neighborhood} — {selectedOrder.deliverySnapshot.city}/
                      {selectedOrder.deliverySnapshot.state}
                    </span>
                    {selectedOrder.deliverySnapshot.reference && (
                      <span className="text-slate-500 italic">
                        Ref: {selectedOrder.deliverySnapshot.reference}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Itens do Pedido */}
              <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center justify-between">
                  <span>Itens do Pedido ({selectedOrder.items?.filter(i => i.status !== 'CANCELLED').length || 0})</span>
                </h4>

                {(() => {
                  const items = selectedOrder.items || [];
                  const roundsMap = new Map<string, { roundNumber: number; roundId: string; items: typeof items }>();
                  items.forEach(item => {
                    const roundNumber = item.roundNumber || 1;
                    const roundId = item.roundId || `R${String(roundNumber).padStart(3, '0')}`;
                    if (!roundsMap.has(roundId)) {
                      roundsMap.set(roundId, { roundNumber, roundId, items: [] });
                    }
                    roundsMap.get(roundId)!.items.push(item);
                  });

                  const sortedRounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);

                  return (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {sortedRounds.map(group => {
                        const activeGroupItems = group.items.filter(i => i.status !== 'CANCELLED');
                        const isRoundReady = activeGroupItems.length > 0 && activeGroupItems.every(i => i.status === 'READY');
                        const isRoundPreparing = activeGroupItems.some(i => i.status === 'PREPARING' || i.status === 'READY');
                        const isRoundPending = !isRoundReady && !isRoundPreparing;

                        return (
                          <div key={group.roundId} className="border border-slate-100 rounded-lg p-2 bg-slate-50/50 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded uppercase">
                                  Rodada #{group.roundNumber}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700">{group.roundId}</span>
                                {isRoundReady ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">🟢 PRONTO</span>
                                ) : isRoundPreparing ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">🟠 EM PREPARO</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">⚪ AGUARDANDO ENVIO</span>
                                )}
                              </div>

                              {isRoundPending && (
                                <Button
                                  id={`btn-order-send-round-${group.roundId}`}
                                  size="sm"
                                  disabled={sendingRoundId === group.roundId}
                                  onClick={() => handleSendRoundToPreparo(group.roundId)}
                                  className="py-0.5 px-2 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-extrabold gap-1"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>{sendingRoundId === group.roundId ? 'Enviando...' : 'ENVIAR'}</span>
                                </Button>
                              )}
                            </div>

                            <div className="divide-y divide-slate-100">
                              {group.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`py-1 text-xs flex flex-col gap-0.5 ${
                                    item.status === 'CANCELLED' ? 'opacity-40 line-through' : ''
                                  }`}
                                >
                                  <div className="flex justify-between items-start font-bold text-slate-900">
                                    <span>
                                      {item.quantity}x {item.productNameSnapshot}
                                      {item.status === 'CANCELLED' && (
                                        <span className="ml-1 text-[10px] text-red-600 font-semibold no-underline">(Cancelado)</span>
                                      )}
                                    </span>
                                    <span>{formatCentsToBRL(item.subtotal)}</span>
                                  </div>

                                  {item.notes && (
                                    <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                                      Obs: {item.notes}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Resumo Financeiro & Pagamento */}
              <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                  Financeiro
                </h4>

                <div className="text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCentsToBRL(selectedOrder.subtotal || 0)}</span>
                  </div>

                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Taxa de Entrega:</span>
                      <span className="font-semibold">{formatCentsToBRL(selectedOrder.deliveryFee)}</span>
                    </div>
                  )}

                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Desconto:</span>
                      <span>- {formatCentsToBRL(selectedOrder.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-slate-200">
                    <span>Total:</span>
                    <span>{formatCentsToBRL(selectedOrder.total || 0)}</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    Pagamento: {selectedOrder.paymentMethod || 'Não informado'}
                  </span>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                      getPaymentStatusConfig(selectedOrder.paymentStatus).colorClass
                    }`}
                  >
                    {getPaymentStatusConfig(selectedOrder.paymentStatus).label}
                  </span>
                </div>

                {selectedOrder.changeFor && selectedOrder.changeFor > 0 && (
                  <div className="text-[11px] font-bold text-amber-800 bg-amber-50 p-2 rounded-md border border-amber-200">
                    Troco para: {formatCentsToBRL(selectedOrder.changeFor)} (Troco: {formatCentsToBRL(selectedOrder.changeFor - (selectedOrder.total || 0))})
                  </div>
                )}
              </div>

              {/* AÇÕES DE MUDANÇA DE STATUS (CONCORRÊNCIA E IDEMPOTÊNCIA PROTEGIDAS) */}
              <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-extrabold text-slate-800">Ações de Status:</span>

                {getAvailableTransitions(selectedOrder).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Este pedido está em status terminal ({getOrderStatusConfig(selectedOrder.status).label}). Não há ações adicionais.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {getAvailableTransitions(selectedOrder).map(action => {
                      const isUpdating = updatingId === selectedOrder.id;

                      return (
                        <Button
                          key={action.nextStatus}
                          id={`btn-transition-${action.nextStatus.toLowerCase()}`}
                          disabled={isUpdating}
                          onClick={() => handleStatusTransition(action.nextStatus)}
                          className={`w-full py-2.5 text-xs transition-all ${action.buttonClass} disabled:opacity-50`}
                        >
                          {isUpdating ? 'Processando alteração...' : action.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </Drawer>
    </div>
  );
}
