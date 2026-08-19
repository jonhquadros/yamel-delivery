/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Search,
  RefreshCw,
  Clock,
  Phone,
  User,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Send,
  Navigation,
  Calendar,
  DollarSign,
  ChevronRight,
  Wifi,
  WifiOff,
  Bike,
  ChefHat,
  ShoppingBag,
  CloudOff,
  Building2,
  Users,
  X,
  Edit3
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Overlay';
import { LoadingState } from '../components/ui/Feedback';
import { ordersRepository, syncQueueRepository } from '../services/storage';
import { Order, OrderStatus, PaymentStatus } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { whatsappService } from '../services/whatsappService';
import { useNetwork } from '../hooks/useNetwork';
import { OrderEditForm } from '../components/orders/OrderEditForm';
import { PaymentConfirmationModal } from '../components/orders/PaymentConfirmationModal';
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getAvailableTransitions,
  changeOrderStatusSafely,
  getOrderEditPermissions
} from '../services/orderService';

type PeriodFilter = 'TODAY' | 'WEEK' | 'ALL';
type DeliveryStatusTab = 'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED_COMPLETED' | 'CANCELLED';

// Helper to calculate elapsed time in friendly readable format
function formatElapsedTime(isoString: string): { formatted: string; isRecent: boolean } {
  try {
    const orderDate = new Date(isoString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60));

    if (diffMinutes < 1) {
      return { formatted: 'Agora mesmo', isRecent: true };
    }
    if (diffMinutes < 60) {
      return { formatted: `Há ${diffMinutes} min`, isRecent: diffMinutes < 15 };
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return { formatted: `Há ${diffHours}h ${diffMinutes % 60}m`, isRecent: false };
    }
    return {
      formatted: orderDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      isRecent: false
    };
  } catch {
    return { formatted: 'Horário desconhecido', isRecent: false };
  }
}

export function DeliveryView() {
  // Connectivity hook
  const { isOnline } = useNetwork();

  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer / Selection State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Payment Confirmation Modal State (Etapa 09.9)
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusTab, setStatusTab] = useState<DeliveryStatusTab>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('TODAY');

  // Load orders and outbox count from IndexedDB (Local-First)
  const loadDeliveryOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const [allOrders, pendingQueue] = await Promise.all([
        ordersRepository.getAll(),
        syncQueueRepository.getPending()
      ]);

      setPendingSyncCount(pendingQueue.length);

      // Filter strictly for Delivery orders and exclude soft-deleted records
      const deliveryOnly = allOrders.filter(o => {
        if (o.deletedAt) return false;
        return o.origin === 'DELIVERY' || (o.origin === 'CATALOG' && o.fulfillmentType === 'DELIVERY') || Boolean(o.deliverySnapshot);
      });

      // Sort newest orders first
      deliveryOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOrders(deliveryOnly);

      // Keep active drawer order synchronized with fresh IndexedDB state
      if (selectedOrder) {
        const fresh = deliveryOnly.find(o => o.id === selectedOrder.id);
        if (fresh) {
          setSelectedOrder(fresh);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar pedidos de delivery do IndexedDB:', err);
      setError('Não foi possível carregar os pedidos de delivery do banco local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveryOrders();
  }, []);

  // Summary Metrics calculated dynamically from real IndexedDB data
  const metrics = useMemo(() => {
    let novos = 0;
    let emPreparo = 0;
    let prontos = 0;
    let emRota = 0;
    let concluidos = 0;
    let totalTaxasCents = 0;
    const bairrosCount: Record<string, number> = {};

    for (const order of orders) {
      if (order.status !== 'CANCELLED') {
        totalTaxasCents += (order.deliveryFee || 0);

        const bairro = order.deliverySnapshot?.neighborhood;
        if (bairro) {
          bairrosCount[bairro] = (bairrosCount[bairro] || 0) + 1;
        }
      }

      switch (order.status) {
        case 'PENDING':
          novos++;
          break;
        case 'CONFIRMED':
        case 'PREPARING':
          emPreparo++;
          break;
        case 'READY':
          prontos++;
          break;
        case 'OUT_FOR_DELIVERY':
          emRota++;
          break;
        case 'DELIVERED':
        case 'COMPLETED':
          concluidos++;
          break;
      }
    }

    // Top neighborhoods with deliveries
    const topNeighborhoods = Object.entries(bairrosCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      novos,
      emPreparo,
      prontos,
      emRota,
      concluidos,
      total: orders.length,
      totalTaxasCents,
      topNeighborhoods
    };
  }, [orders]);

  // Active in-transit orders for fleet tracking panel
  const inTransitOrders = useMemo(() => {
    return orders.filter(o => o.status === 'OUT_FOR_DELIVERY');
  }, [orders]);

  // Filtered Orders List
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

      // 2. Status Tab Filter
      if (statusTab === 'PENDING') {
        if (order.status !== 'PENDING') return false;
      } else if (statusTab === 'PREPARING') {
        if (order.status !== 'CONFIRMED' && order.status !== 'PREPARING') return false;
      } else if (statusTab === 'READY') {
        if (order.status !== 'READY') return false;
      } else if (statusTab === 'OUT_FOR_DELIVERY') {
        if (order.status !== 'OUT_FOR_DELIVERY') return false;
      } else if (statusTab === 'DELIVERED_COMPLETED') {
        if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') return false;
      } else if (statusTab === 'CANCELLED') {
        if (order.status !== 'CANCELLED') return false;
      }

      // 3. Search Query Filter
      if (query) {
        const localId = (order.localId || '').toLowerCase();
        const customerName = (order.customerSnapshot?.name || '').toLowerCase();
        const customerPhone = (order.customerSnapshot?.phone || '').toLowerCase();
        const address = (order.deliverySnapshot?.address || order.customerSnapshot?.address || '').toLowerCase();
        const neighborhood = (order.deliverySnapshot?.neighborhood || '').toLowerCase();
        const notes = (order.notes || '').toLowerCase();

        const matches =
          localId.includes(query) ||
          customerName.includes(query) ||
          customerPhone.includes(query) ||
          address.includes(query) ||
          neighborhood.includes(query) ||
          notes.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [orders, statusTab, periodFilter, searchQuery]);

  // Handle Safe Status Transition
  const handleStatusTransition = async (targetOrder: Order, nextStatus: OrderStatus) => {
    if (updatingId === targetOrder.id) return; // Prevent double click

    try {
      setUpdatingId(targetOrder.id);
      setStatusError(null);

      const updated = await changeOrderStatusSafely(targetOrder.id, nextStatus);

      // Refresh list locally
      await loadDeliveryOrders();

      if (selectedOrder && selectedOrder.id === targetOrder.id) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      console.error('Erro ao atualizar status do pedido de delivery:', err);
      setStatusError(err.message || 'Não foi possível atualizar o pedido. Tente novamente.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open WhatsApp to talk with customer
  const handleOpenWhatsApp = (order: Order) => {
    if (!order.customerSnapshot?.phone) return;
    const phone = order.customerSnapshot.phone;
    const customerName = order.customerSnapshot.name || 'Cliente';
    const localId = order.localId || order.id.slice(0, 8);
    const text = `Olá, ${customerName}! Tudo bem? Entramos em contato referente ao seu pedido *#${localId}* no *Yamel Operações*.`;
    const url = whatsappService.generateChatUrl(text, phone);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-12" id="delivery-view-container">
      {/* 1. HEADER DO MÓDULO */}
      <PageHeader
        id="delivery-page-header"
        title="Delivery — Entregas"
        description="Gestão operacional dos pedidos que precisam ser despachados e entregues."
        primaryAction={
          <div className="flex items-center gap-2.5">
            {/* Real Network Status Badge */}
            <span
              id="delivery-network-status"
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors select-none ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isOnline ? 'Conectado' : 'Modo Offline'}
            </span>

            {/* Refresh Local Data Button */}
            <Button
              id="delivery-btn-refresh"
              variant="outline"
              size="sm"
              onClick={loadDeliveryOrders}
              disabled={loading}
              className="text-xs font-bold gap-1.5 bg-white border-slate-200 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
              <span>Atualizar</span>
            </Button>
          </div>
        }
      />

      {/* OUTBOX BANNER: OPERAÇÕES LOCAIS PENDENTES */}
      {pendingSyncCount > 0 && (
        <div
          id="delivery-outbox-banner"
          className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900 shadow-2xs"
        >
          <CloudOff className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="flex-1 leading-relaxed">
            <strong className="font-bold text-amber-950">
              Operações locais pendentes ({pendingSyncCount}):
            </strong>{' '}
            Existem {pendingSyncCount} operações armazenadas localmente aguardando sincronização com o servidor. Seus dados permanecem seguros neste dispositivo.
          </div>
        </div>
      )}

      {/* 2. INDICADORES OPERACIONAIS (CARDS INTERATIVOS DE STATUS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" id="delivery-metrics-bar">
        {/* Novos */}
        <button
          type="button"
          id="metric-card-novos"
          onClick={() => setStatusTab(statusTab === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
            statusTab === 'PENDING'
              ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
              : 'bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusTab === 'PENDING' ? 'text-amber-100' : 'text-slate-500'}`}>
              Novos
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${statusTab === 'PENDING' ? 'text-white' : 'text-slate-900'}`}>
              {metrics.novos}
            </div>
            <span className={`text-[11px] font-semibold ${statusTab === 'PENDING' ? 'text-amber-100' : 'text-slate-400'}`}>
              Aguardando confirmação
            </span>
          </div>
        </button>

        {/* Em Preparo */}
        <button
          type="button"
          id="metric-card-preparo"
          onClick={() => setStatusTab(statusTab === 'PREPARING' ? 'ALL' : 'PREPARING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
            statusTab === 'PREPARING'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-300'
              : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusTab === 'PREPARING' ? 'text-indigo-100' : 'text-slate-500'}`}>
              Em Preparo
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusTab === 'PREPARING' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${statusTab === 'PREPARING' ? 'text-white' : 'text-slate-900'}`}>
              {metrics.emPreparo}
            </div>
            <span className={`text-[11px] font-semibold ${statusTab === 'PREPARING' ? 'text-indigo-100' : 'text-slate-400'}`}>
              Na cozinha / montagem
            </span>
          </div>
        </button>

        {/* Prontos */}
        <button
          type="button"
          id="metric-card-prontos"
          onClick={() => setStatusTab(statusTab === 'READY' ? 'ALL' : 'READY')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
            statusTab === 'READY'
              ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300'
              : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusTab === 'READY' ? 'text-blue-100' : 'text-slate-500'}`}>
              Prontos
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusTab === 'READY' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${statusTab === 'READY' ? 'text-white' : 'text-slate-900'}`}>
              {metrics.prontos}
            </div>
            <span className={`text-[11px] font-semibold ${statusTab === 'READY' ? 'text-blue-100' : 'text-slate-400'}`}>
              Aguardando entregador
            </span>
          </div>
        </button>

        {/* Em Rota */}
        <button
          type="button"
          id="metric-card-em-rota"
          onClick={() => setStatusTab(statusTab === 'OUT_FOR_DELIVERY' ? 'ALL' : 'OUT_FOR_DELIVERY')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
            statusTab === 'OUT_FOR_DELIVERY'
              ? 'bg-purple-600 text-white border-purple-700 shadow-xs ring-2 ring-purple-300'
              : 'bg-white border-slate-200 hover:border-purple-400 hover:bg-purple-50/20 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusTab === 'OUT_FOR_DELIVERY' ? 'text-purple-100' : 'text-slate-500'}`}>
              Em Rota
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusTab === 'OUT_FOR_DELIVERY' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'}`}>
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${statusTab === 'OUT_FOR_DELIVERY' ? 'text-white' : 'text-slate-900'}`}>
              {metrics.emRota}
            </div>
            <span className={`text-[11px] font-semibold ${statusTab === 'OUT_FOR_DELIVERY' ? 'text-purple-100' : 'text-slate-400'}`}>
              Com entregador na rua
            </span>
          </div>
        </button>

        {/* Concluídos */}
        <button
          type="button"
          id="metric-card-concluidos"
          onClick={() => setStatusTab(statusTab === 'DELIVERED_COMPLETED' ? 'ALL' : 'DELIVERED_COMPLETED')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 col-span-2 sm:col-span-1 ${
            statusTab === 'DELIVERED_COMPLETED'
              ? 'bg-slate-900 text-white border-slate-950 shadow-xs ring-2 ring-slate-400'
              : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${statusTab === 'DELIVERED_COMPLETED' ? 'text-slate-300' : 'text-slate-500'}`}>
              Concluídos
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${statusTab === 'DELIVERED_COMPLETED' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${statusTab === 'DELIVERED_COMPLETED' ? 'text-white' : 'text-slate-900'}`}>
              {metrics.concluidos}
            </div>
            <span className={`text-[11px] font-semibold ${statusTab === 'DELIVERED_COMPLETED' ? 'text-slate-300' : 'text-slate-400'}`}>
              Entregas finalizadas
            </span>
          </div>
        </button>
      </div>

      {/* 3. ÁREA PRINCIPAL EM 2 COLUNAS (8 COLS ESQUERDA / 4 COLS DIREITA NO DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="delivery-main-content">
        {/* ========================================================================= */}
        {/* COLUNA ESQUERDA: FILTROS E LISTA DE PEDIDOS (8 de 12 colunas)             */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 flex flex-col gap-4" id="delivery-orders-column">
          {/* FILTROS E CONTROLE DE BUSCA */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-3.5">
            {/* Linha 1: Input de Busca e Botões de Período */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
              {/* Input de Busca */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="delivery-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por #, cliente, telefone, rua ou bairro..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50/50 focus:bg-white focus:border-amber-500 transition-colors font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botões de Período */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto shrink-0 select-none">
                <button
                  type="button"
                  id="delivery-filter-period-today"
                  onClick={() => setPeriodFilter('TODAY')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    periodFilter === 'TODAY'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  id="delivery-filter-period-week"
                  onClick={() => setPeriodFilter('WEEK')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    periodFilter === 'WEEK'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  id="delivery-filter-period-all"
                  onClick={() => setPeriodFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    periodFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Linha 2: Abas de Status com Contadores Operacionais */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 pt-3 select-none">
              <button
                type="button"
                onClick={() => setStatusTab('ALL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Todos ({orders.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('PENDING')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'PENDING'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Novos ({metrics.novos})
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('PREPARING')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'PREPARING'
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Em Preparo ({metrics.emPreparo})
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('READY')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'READY'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Prontos ({metrics.prontos})
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('OUT_FOR_DELIVERY')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'OUT_FOR_DELIVERY'
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Em Rota ({metrics.emRota})
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('DELIVERED_COMPLETED')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                  statusTab === 'DELIVERED_COMPLETED'
                    ? 'bg-slate-800 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Concluídos ({metrics.concluidos})
              </button>

              <span className="ml-auto text-[11px] font-semibold text-slate-400 shrink-0 hidden sm:block">
                Exibindo <strong className="text-slate-800">{filteredOrders.length}</strong> pedidos
              </span>
            </div>
          </div>

          {/* ERROR BANNER */}
          {error && (
            <div id="delivery-error-banner" className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-xs font-medium">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* LISTA DE PEDIDOS */}
          {loading ? (
            <LoadingState id="delivery-loading" message="Carregando pedidos de delivery do banco de dados local..." />
          ) : filteredOrders.length === 0 ? (
            /* EMPTY STATE PROFISSIONAL */
            <div id="delivery-empty-state" className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Truck className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nenhum pedido de delivery encontrado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {searchQuery || statusTab !== 'ALL' || periodFilter !== 'TODAY'
                    ? 'Não existem pedidos de entrega que correspondam aos filtros selecionados.'
                    : 'Quando houver pedidos de entrega cadastrados no sistema, eles aparecerão organizados nesta central operacional.'}
                </p>
              </div>
              {(searchQuery || statusTab !== 'ALL' || periodFilter !== 'TODAY') && (
                <Button
                  id="delivery-clear-filters-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusTab('ALL');
                    setPeriodFilter('TODAY');
                  }}
                  className="mt-2 text-xs font-bold"
                >
                  Limpar Filtros de Busca
                </Button>
              )}
            </div>
          ) : (
            /* GRID DE CARDS OPERACIONAIS DE PEDIDOS */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" id="delivery-orders-grid">
              {filteredOrders.map(order => {
                const statusCfg = getOrderStatusConfig(order.status);
                const paymentCfg = getPaymentStatusConfig(order.paymentStatus);
                const timeInfo = formatElapsedTime(order.createdAt);
                const itemsCount = (order.items || []).reduce((acc, it) => acc + it.quantity, 0);
                const customerName = order.customerSnapshot?.name || 'Consumidor não identificado';
                const customerPhone = order.customerSnapshot?.phone || null;

                // Address display string
                const deliveryAddress = order.deliverySnapshot
                  ? `${order.deliverySnapshot.address}, ${order.deliverySnapshot.number}${order.deliverySnapshot.complement ? ` (${order.deliverySnapshot.complement})` : ''}`
                  : order.customerSnapshot?.address
                  ? order.customerSnapshot.address
                  : 'Endereço não informado';

                const neighborhood = order.deliverySnapshot?.neighborhood || null;
                const isUpdating = updatingId === order.id;

                return (
                  <div
                    key={order.id}
                    id={`delivery-card-${order.id}`}
                    className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-2xs transition-all duration-150 flex flex-col justify-between gap-3.5 group"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Topo do Card: Código, Status & Tempo */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                              #{order.localId || order.id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                              Delivery
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {timeInfo.formatted}
                          </span>
                        </div>

                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${statusCfg.colorClass}`}>
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Dados do Cliente e WhatsApp */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{customerName}</span>
                        </span>

                        {customerPhone && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenWhatsApp(order);
                            }}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                            title="Falar com cliente pelo WhatsApp"
                          >
                            <Send className="w-2.5 h-2.5" /> WhatsApp
                          </button>
                        )}
                      </div>

                      {/* Endereço de Entrega */}
                      <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium text-slate-800 truncate">{deliveryAddress}</span>
                          {neighborhood && (
                            <span className="text-slate-500 font-semibold text-[10px] mt-0.5">
                              Bairro: <strong className="text-slate-700">{neighborhood}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prévia de Itens */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          <strong className="text-slate-800 font-bold">{itemsCount}</strong> {itemsCount === 1 ? 'item' : 'itens'}
                        </span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[180px]" title={order.items?.map(i => `${i.quantity}x ${i.productNameSnapshot}`).join(', ')}>
                          {order.items?.map(i => `${i.quantity}x ${i.productNameSnapshot}`).join(', ') || 'Sem itens'}
                        </span>
                      </div>
                    </div>

                    {/* Rodapé do Card: Total Financeiro & Ações Rápidas */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Total com taxa</span>
                          <span className="text-sm font-black text-slate-900">
                            {formatCentsToBRL(order.total || 0)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${paymentCfg.colorClass}`}>
                            {paymentCfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Botão de Confirmação de Pagamento Pendente na Entrega */}
                      {order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED' && (
                        <button
                          id={`btn-delivery-card-pay-${order.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModalOrder(order);
                          }}
                          className="w-full py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Confirmar Pagamento ({formatCentsToBRL(order.total || 0)})</span>
                        </button>
                      )}

                      {/* Barra de Ações Operacionais */}
                      <div className="flex items-center gap-2">
                        <Button
                          id={`btn-open-drawer-${order.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsEditing(false);
                          }}
                          className="flex-1 text-xs font-bold py-2 border-slate-200 hover:bg-slate-50 bg-white"
                        >
                          Ver Detalhes
                        </Button>

                        {/* Botão de Ação Rápida por Status com Proteção de Duplo Clique */}
                        {order.status === 'PENDING' && (
                          <Button
                            id={`btn-quick-confirm-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'CONFIRMED')}
                            className="flex-1 text-xs font-bold py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Confirmar'}
                          </Button>
                        )}

                        {order.status === 'CONFIRMED' && (
                          <Button
                            id={`btn-quick-prepare-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'PREPARING')}
                            className="flex-1 text-xs font-bold py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Enviar Preparo'}
                          </Button>
                        )}

                        {order.status === 'PREPARING' && (
                          <Button
                            id={`btn-quick-ready-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'READY')}
                            className="flex-1 text-xs font-bold py-2 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Marcar Pronto'}
                          </Button>
                        )}

                        {order.status === 'READY' && (
                          <Button
                            id={`btn-quick-dispatch-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'OUT_FOR_DELIVERY')}
                            className="flex-1 text-xs font-bold py-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Despachar (Rota)'}
                          </Button>
                        )}

                        {order.status === 'OUT_FOR_DELIVERY' && (
                          <Button
                            id={`btn-quick-deliver-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'DELIVERED')}
                            className="flex-1 text-xs font-bold py-2 bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Marcar Entregue'}
                          </Button>
                        )}

                        {order.status === 'DELIVERED' && (
                          <Button
                            id={`btn-quick-complete-${order.id}`}
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(order, 'COMPLETED')}
                            className="flex-1 text-xs font-bold py-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          >
                            {isUpdating ? 'Salvando...' : 'Concluir'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUNA DIREITA: STATUS DA FROTA & PAINEL DE DESPACHO (4 de 12 colunas)    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 flex flex-col gap-4 sticky top-6" id="delivery-fleet-column">
          {/* Card Principal da Frota */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Status da Frota
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Acompanhamento de entregadores
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {inTransitOrders.length} em trânsito
              </span>
            </div>

            {/* Pedidos em trânsito no momento (Dados Reais) */}
            {inTransitOrders.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Entregas em Rota Ativa
                </span>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                  {inTransitOrders.map(order => {
                    const timeInfo = formatElapsedTime(order.createdAt);
                    const neighborhood = order.deliverySnapshot?.neighborhood || 'Bairro central';

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="p-2.5 flex items-center justify-between hover:bg-purple-50/40 cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900">
                            #{order.localId || order.id.slice(0, 8)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                            {order.customerSnapshot?.name || 'Cliente'} • {neighborhood}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/60 px-1.5 py-0.5 rounded">
                            {timeInfo.formatted}
                          </span>
                          <span className="text-[11px] font-black text-slate-800 mt-0.5">
                            {formatCentsToBRL(order.total || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Empty State de Entregadores / Frota */
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-9 h-9 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-400">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Nenhum entregador em rota</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Quando pedidos forem despachados (Em Rota), o rastreamento local será exibido aqui.
                  </p>
                </div>
              </div>
            )}

            {/* Bairros mais atendidos (Estatística real calculada com os dados do IndexedDB) */}
            {metrics.topNeighborhoods.length > 0 && (
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Bairros Mais Atendidos (Hoje)
                </span>
                <div className="flex flex-col gap-1.5">
                  {metrics.topNeighborhoods.map(([bairro, count], idx) => (
                    <div key={bairro} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}º</span>
                        <span className="font-semibold text-slate-700 truncate">{bairro}</span>
                      </div>
                      <span className="font-extrabold text-slate-900 text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                        {count} {count === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card de Resumo de Taxas de Entrega Reais */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Total Taxas de Entrega
              </span>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {formatCentsToBRL(metrics.totalTaxasCents)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Soma acumulada de todas as taxas de entrega dos pedidos ativos no banco local.
            </p>
          </div>
        </div>
      </div>

      {/* 4. DRAWER: DETALHES COMPLETOS DO PEDIDO DE DELIVERY */}
      <Drawer
        id="delivery-order-drawer"
        isOpen={Boolean(selectedOrder)}
        onClose={() => {
          setSelectedOrder(null);
          setIsEditing(false);
          setStatusError(null);
        }}
        title={
          selectedOrder
            ? isEditing
              ? `Editar Pedido #${selectedOrder.localId || ''}`
              : `Pedido #${selectedOrder.localId || ''}`
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
                await loadDeliveryOrders();
              }}
            />
          ) : (
            <div className="flex flex-col gap-5 text-slate-800 pb-6">
              {/* Status Header Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Origem & Canal</span>
                  <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <Truck className="w-4 h-4 text-purple-600" /> Atendimento Delivery
                  </span>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status Operacional</span>
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-md border mt-0.5 uppercase ${getOrderStatusConfig(selectedOrder.status).colorClass}`}>
                    {getOrderStatusConfig(selectedOrder.status).label}
                  </span>
                </div>
              </div>

              {/* Error in Drawer */}
              {statusError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              {/* Botão de Edição de Pedido de Delivery */}
              {getOrderEditPermissions(selectedOrder).allowed && (
                <button
                  id="btn-delivery-edit-order"
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2.5 px-3 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>Editar Dados / Itens do Pedido</span>
                </button>
              )}

              {/* 1. Seção: CLIENTE */}
              <div className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col gap-2.5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" /> Dados do Cliente
                </h4>

                <div className="text-xs font-bold text-slate-900">
                  {selectedOrder.customerSnapshot?.name || 'Consumidor não identificado'}
                </div>

                {selectedOrder.customerSnapshot?.phone ? (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedOrder.customerSnapshot.phone}
                    </span>

                    <button
                      id="delivery-drawer-whatsapp-btn"
                      type="button"
                      onClick={() => handleOpenWhatsApp(selectedOrder)}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-600" /> Falar no WhatsApp
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Telefone não informado pelo cliente</span>
                )}
              </div>

              {/* 2. Seção: ENDEREÇO DE ENTREGA */}
              <div className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col gap-2.5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-600" /> Endereço de Entrega
                </h4>

                {selectedOrder.deliverySnapshot ? (
                  <div className="text-xs text-slate-700 flex flex-col gap-1">
                    <div className="font-bold text-slate-900 text-sm">
                      {selectedOrder.deliverySnapshot.address}, {selectedOrder.deliverySnapshot.number}
                    </div>
                    {selectedOrder.deliverySnapshot.complement && (
                      <div className="text-slate-600 font-medium">
                        Complemento: {selectedOrder.deliverySnapshot.complement}
                      </div>
                    )}
                    <div className="text-slate-600 font-medium">
                      Bairro: <strong className="text-slate-800">{selectedOrder.deliverySnapshot.neighborhood}</strong> — {selectedOrder.deliverySnapshot.city}/{selectedOrder.deliverySnapshot.state}
                    </div>
                    {selectedOrder.deliverySnapshot.postalCode && (
                      <div className="text-slate-500 text-[11px]">
                        CEP: {selectedOrder.deliverySnapshot.postalCode}
                      </div>
                    )}
                    {selectedOrder.deliverySnapshot.reference && (
                      <div className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 text-xs font-semibold mt-1">
                        📍 Referência: {selectedOrder.deliverySnapshot.reference}
                      </div>
                    )}
                  </div>
                ) : selectedOrder.customerSnapshot?.address ? (
                  <div className="text-xs text-slate-800 font-semibold">
                    {selectedOrder.customerSnapshot.address}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Endereço de entrega não informado.</span>
                )}
              </div>

              {/* 3. Seção: ITENS DO PEDIDO */}
              <div className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col gap-2.5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Itens do Pedido ({(selectedOrder.items || []).filter(it => it.status !== 'CANCELLED').reduce((acc, it) => acc + it.quantity, 0)})</span>
                </h4>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className={`py-2.5 text-xs flex flex-col gap-1 ${
                        item.status === 'CANCELLED' ? 'opacity-40 line-through' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start font-extrabold text-slate-900">
                        <span>
                          <strong className="text-amber-600 font-black mr-1">{item.quantity}x</strong>
                          {item.productNameSnapshot}
                          {item.status === 'CANCELLED' && (
                            <span className="ml-1 text-[10px] text-red-600 font-semibold no-underline">(Cancelado)</span>
                          )}
                        </span>
                        <span>{formatCentsToBRL(item.subtotal)}</span>
                      </div>

                      {/* Options / Addons */}
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-slate-500 pl-4">
                          {item.selectedOptions.map((opt, oIdx) => (
                            <span key={oIdx} className="block">
                              • {opt.optionName}: {opt.choiceName}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="text-[11px] text-slate-500 pl-4">
                          {item.selectedAddons.map((ad, aIdx) => (
                            <span key={aIdx} className="block text-emerald-700 font-medium">
                              + {ad.quantity}x {ad.addonName} ({formatCentsToBRL(ad.price * ad.quantity)})
                            </span>
                          ))}
                        </div>
                      )}

                      {item.notes && (
                        <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5">
                          ⚠️ Obs: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Seção: FINANCEIRO & FORMA DE PAGAMENTO */}
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/70 flex flex-col gap-2.5 shadow-2xs">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Resumo Financeiro
                </h4>

                <div className="text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal dos itens:</span>
                    <span className="font-semibold text-slate-800">{formatCentsToBRL(selectedOrder.subtotal || 0)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Taxa de Entrega:</span>
                    <span className="font-semibold text-slate-800">{formatCentsToBRL(selectedOrder.deliveryFee || 0)}</span>
                  </div>

                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Desconto aplicado:</span>
                      <span>- {formatCentsToBRL(selectedOrder.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black text-slate-950 pt-2 border-t border-slate-200">
                    <span>Total Geral:</span>
                    <span className="text-base text-slate-950">{formatCentsToBRL(selectedOrder.total || 0)}</span>
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    Forma de Pagamento: <strong>{selectedOrder.paymentMethod || 'Não informado'}</strong>
                  </span>

                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md border ${
                      getPaymentStatusConfig(selectedOrder.paymentStatus).colorClass
                    }`}
                  >
                    {getPaymentStatusConfig(selectedOrder.paymentStatus).label}
                  </span>
                </div>

                {selectedOrder.changeFor && selectedOrder.changeFor > 0 && (
                  <div className="text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-1">
                    Troco solicitado para: <strong>{formatCentsToBRL(selectedOrder.changeFor)}</strong>
                    <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      Valor a devolver: {formatCentsToBRL(selectedOrder.changeFor - (selectedOrder.total || 0))}
                    </div>
                  </div>
                )}

                {/* BOTÃO DE CONFIRMAÇÃO DE PAGAMENTO NA ENTREGA (ETAPA 09.9) */}
                {selectedOrder.paymentStatus === 'PENDING' && selectedOrder.status !== 'CANCELLED' && (
                  <div className="pt-2.5 border-t border-slate-200 flex flex-col gap-1.5">
                    <button
                      id="btn-delivery-drawer-confirm-payment"
                      type="button"
                      onClick={() => setPaymentModalOrder(selectedOrder)}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pagamento no Caixa ({formatCentsToBRL(selectedOrder.total || 0)})</span>
                    </button>
                    <span className="text-[10px] text-slate-400 text-center font-medium">
                      Registra a venda no Caixa Operacional e altera para PAGO
                    </span>
                  </div>
                )}
              </div>

              {/* 5. AÇÕES DE MUDANÇA DE STATUS */}
              <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Ações Operacionais de Status:
                </span>

                {getAvailableTransitions(selectedOrder).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Este pedido está em status terminal ({getOrderStatusConfig(selectedOrder.status).label}). Não há ações adicionais necessárias.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {getAvailableTransitions(selectedOrder).map(action => {
                      const isUpdating = updatingId === selectedOrder.id;

                      return (
                        <Button
                          key={action.nextStatus}
                          id={`delivery-transition-${action.nextStatus.toLowerCase()}`}
                          disabled={isUpdating}
                          onClick={() => handleStatusTransition(selectedOrder, action.nextStatus)}
                          className={`w-full py-2.5 text-xs transition-all ${action.buttonClass} disabled:opacity-50`}
                        >
                          {isUpdating ? 'Processando alteração no IndexedDB...' : action.label}
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

      {/* MODAL DE CONFIRMAÇÃO DE PAGAMENTO NA ENTREGA (ETAPA 09.9) */}
      <PaymentConfirmationModal
        isOpen={Boolean(paymentModalOrder)}
        order={paymentModalOrder}
        onClose={() => setPaymentModalOrder(null)}
        onPaymentConfirmed={async (updatedOrder) => {
          setSelectedOrder(updatedOrder);
          await loadDeliveryOrders();
        }}
      />
    </div>
  );
}
