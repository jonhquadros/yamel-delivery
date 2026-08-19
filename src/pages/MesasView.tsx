/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Ban,
  ArrowRight,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  CreditCard,
  QrCode,
  Banknote,
  Trash2,
  Edit2,
  Settings,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Lock,
  Unlock,
  Eye,
  ShoppingBag,
  Sparkles,
  Send
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardContent } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import { Drawer, Dialog } from '../components/ui/Overlay';
import { LoadingState, EmptyState } from '../components/ui/Feedback';
import { formatCentsToBRL, parseBRLToCents } from '../utils/currency';
import {
  Table,
  Order,
  OrderItem,
  Product,
  Category,
  TableStatus,
  PaymentMethod
} from '../services/storage/types';
import {
  tablesRepository,
  ordersRepository,
  productsRepository,
  categoriesRepository,
  cashRepository,
  getOrRegisterDeviceId
} from '../services/storage';
import {
  addProductToTableComanda,
  addBatchProductsToTableComanda,
  updateComandaItemQuantity,
  cancelComandaItem,
  requestTableAccountClosure,
  reopenTableComanda,
  processTablePayment,
  cancelTableComanda,
  sendRoundToPreparation
} from '../services/orderService';

export interface StagedItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
}

export function MesasView() {
  const [tables, setTables] = useState<Table[]>([]);
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<string, Order>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingTableId, setSubmittingTableId] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | TableStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Table / Order for Comanda Drawer
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Comanda Action Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isClosingAccount, setIsClosingAccount] = useState<boolean>(false);

  // Item Cancellation Modal
  const [isItemCancelModalOpen, setIsItemCancelModalOpen] = useState<boolean>(false);
  const [itemToCancel, setItemToCancel] = useState<OrderItem | null>(null);
  const [itemCancelReason, setItemCancelReason] = useState<string>('');
  const [isCancellingItem, setIsCancellingItem] = useState<boolean>(false);

  // Add Item to Comanda form states
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('ALL');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isSubmittingItem, setIsSubmittingItem] = useState<boolean>(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [sendingRoundId, setSendingRoundId] = useState<string | null>(null);

  const handleSendRoundToPreparo = async (roundId: string) => {
    if (!selectedOrder || sendingRoundId === roundId) return;
    try {
      setSendingRoundId(roundId);
      const result = await sendRoundToPreparation(selectedOrder.id, roundId);
      setSelectedOrder(result.order);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao enviar rodada para preparo:', err);
      alert(err.message || 'Erro ao enviar rodada para preparo.');
    } finally {
      setSendingRoundId(null);
    }
  };

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [openRegisterExists, setOpenRegisterExists] = useState<boolean>(true);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    order: Order;
    table: Table;
    changeDueCents: number;
    paymentMethod: PaymentMethod;
  } | null>(null);

  // Cancel Comanda form states
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Table Management states (CRUD)
  const [isManageTablesOpen, setIsManageTablesOpen] = useState<boolean>(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState<boolean>(false);
  const [isEditTableOpen, setIsEditTableOpen] = useState<boolean>(false);
  const [tableToEdit, setTableToEdit] = useState<Table | null>(null);
  const [tableFormNumber, setTableFormNumber] = useState<string>('');
  const [tableFormName, setTableFormName] = useState<string>('');
  const [tableFormCapacity, setTableFormCapacity] = useState<number>(4);
  const [tableFormError, setTableFormError] = useState<string | null>(null);
  const [isSavingTable, setIsSavingTable] = useState<boolean>(false);

  // =========================================================================
  // 1. CARREGAMENTO DE DADOS (LOCAL-FIRST / INDEXEDDB)
  // =========================================================================
  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedActiveTables, fetchedAllTables, fetchedOrders, fetchedProducts, fetchedCategories, openRegister] =
        await Promise.all([
          tablesRepository.getAll(false),
          tablesRepository.getAll(true),
          ordersRepository.getAll(),
          productsRepository.getAll(),
          categoriesRepository.getAll(),
          cashRepository.getOpenRegister()
        ]);

      setOpenRegisterExists(Boolean(openRegister));

      // Map active orders to their table ID
      const activeMap: Record<string, Order> = {};
      for (const order of fetchedOrders) {
        if (order.tableId && order.status !== 'CANCELLED' && order.status !== 'COMPLETED') {
          activeMap[order.tableId] = order;
        }
      }

      setTables(fetchedActiveTables);
      setAllTables(fetchedAllTables);
      setOrdersMap(activeMap);
      setProducts(fetchedProducts.filter(p => p.active));
      setCategories(fetchedCategories.filter(c => c.active));

      // If drawer is open, keep selected table and order updated
      if (selectedTable) {
        const freshTable = fetchedAllTables.find(t => t.id === selectedTable.id) || null;
        setSelectedTable(freshTable);
        if (freshTable && freshTable.currentOrderId) {
          const freshOrder =
            fetchedOrders.find(o => o.id === freshTable.currentOrderId) || activeMap[freshTable.id] || null;
          setSelectedOrder(freshOrder);
        } else {
          setSelectedOrder(null);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================================
  // 2. ABERTURA DE MESA (FREE -> OCCUPIED)
  // =========================================================================
  const handleOpenTable = async (table: Table) => {
    if (submittingTableId === table.id) return;

    try {
      setSubmittingTableId(table.id);

      // Reconsulta atômica no IndexedDB
      const freshTable = await tablesRepository.getById(table.id);
      if (!freshTable || freshTable.status !== 'FREE') {
        await loadData();
        if (freshTable && freshTable.currentOrderId) {
          const existingOrder = await ordersRepository.getById(freshTable.currentOrderId);
          setSelectedTable(freshTable);
          setSelectedOrder(existingOrder);
        }
        setSubmittingTableId(null);
        return;
      }

      const devId = await getOrRegisterDeviceId();
      const newOrder = await ordersRepository.create({
        orderNumber: Date.now() % 10000,
        companyId: 'comp-1',
        tableId: table.id,
        deviceId: devId,
        origin: 'TABLE',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotal: 0,
        discount: 0,
        serviceFee: 0,
        deliveryFee: 0,
        total: 0,
        items: [],
        notes: `Abertura de mesa ${table.name || 'Mesa ' + table.number}`,
      });

      freshTable.status = 'OCCUPIED';
      freshTable.currentOrderId = newOrder.id;
      await tablesRepository.save(freshTable);

      await loadData();

      setSelectedTable(freshTable);
      setSelectedOrder(newOrder);
    } catch (err: any) {
      console.error('Erro ao abrir mesa:', err);
      alert(err.message || 'Erro ao abrir a mesa.');
    } finally {
      setSubmittingTableId(null);
    }
  };

  // =========================================================================
  // 3. SELEÇÃO DE MESA (ACESSAR COMANDA)
  // =========================================================================
  const handleSelectTable = async (table: Table) => {
    try {
      const freshTable = await tablesRepository.getById(table.id);
      if (!freshTable) return;

      setSelectedTable(freshTable);

      if (freshTable.currentOrderId) {
        const order = await ordersRepository.getById(freshTable.currentOrderId);
        setSelectedOrder(order);
      } else {
        const order = ordersMap[freshTable.id] || null;
        setSelectedOrder(order);
      }
    } catch (err) {
      console.error('Erro ao selecionar mesa:', err);
    }
  };

  // =========================================================================
  // 4. LANÇAMENTO DE PRODUTOS NA COMANDA (RODADAS ETAPA 09.8.3)
  // =========================================================================
  const handleOpenAddItemModal = () => {
    if (!selectedTable || selectedTable.status === 'WAITING_PAYMENT') {
      alert('Não é possível adicionar produtos com a conta fechada. Reabra a comanda primeiro.');
      return;
    }
    setSelectedProductId(products[0]?.id || '');
    setQuantity(1);
    setItemNotes('');
    setStagedItems([]);
    setAddItemError(null);
    setProductSearchQuery('');
    setProductCategoryFilter('ALL');
    setIsAddItemOpen(true);
  };

  const handleAddStagedItem = (product: Product) => {
    if (!product || quantity <= 0) return;
    setStagedItems(prev => {
      const cleanNotes = itemNotes.trim();
      const existingIdx = prev.findIndex(item => item.productId === product.id && item.notes === cleanNotes);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + quantity,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: quantity,
          notes: cleanNotes,
        },
      ];
    });
    setItemNotes('');
    setQuantity(1);
  };

  const handleAddProductQuickly = (product: Product) => {
    if (!product) return;
    setStagedItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id && !item.notes);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const handleRemoveStagedItem = (stagedId: string) => {
    setStagedItems(prev => prev.filter(item => item.id !== stagedId));
  };

  const handleUpdateStagedItemQty = (stagedId: string, delta: number) => {
    setStagedItems(prev =>
      prev
        .map(item => {
          if (item.id === stagedId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as StagedItem[]
    );
  };

  const handleSubmitRound = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTable) return;

    try {
      setIsSubmittingItem(true);
      setAddItemError(null);

      if (stagedItems.length > 0) {
        const result = await addBatchProductsToTableComanda({
          tableId: selectedTable.id,
          orderId: selectedOrder?.id,
          items: stagedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        });
        setSelectedOrder(result.order);
      } else if (selectedProductId && quantity > 0) {
        const result = await addProductToTableComanda({
          tableId: selectedTable.id,
          orderId: selectedOrder?.id,
          productId: selectedProductId,
          quantity,
          notes: itemNotes,
        });
        setSelectedOrder(result.order);
      } else {
        setAddItemError('Adicione pelo menos um produto para enviar a rodada.');
        setIsSubmittingItem(false);
        return;
      }

      setStagedItems([]);
      setIsAddItemOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao adicionar produtos na comanda:', err);
      setAddItemError(err.message || 'Erro ao lançar produtos na comanda.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // =========================================================================
  // 5. ALTERAÇÃO DE QUANTIDADE E CANCELAMENTO DE ITENS
  // =========================================================================
  const handleIncrementItem = async (item: OrderItem) => {
    if (!selectedTable || !selectedOrder || selectedTable.status === 'WAITING_PAYMENT') return;
    try {
      const updatedOrder = await updateComandaItemQuantity({
        tableId: selectedTable.id,
        orderId: selectedOrder.id,
        itemId: item.id,
        newQuantity: item.quantity + 1,
      });
      setSelectedOrder(updatedOrder);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao incrementar quantidade.');
    }
  };

  const handleDecrementItem = async (item: OrderItem) => {
    if (!selectedTable || !selectedOrder || selectedTable.status === 'WAITING_PAYMENT') return;

    if (item.quantity === 1) {
      setItemToCancel(item);
      setItemCancelReason('');
      setIsItemCancelModalOpen(true);
      return;
    }

    try {
      const updatedOrder = await updateComandaItemQuantity({
        tableId: selectedTable.id,
        orderId: selectedOrder.id,
        itemId: item.id,
        newQuantity: item.quantity - 1,
      });
      setSelectedOrder(updatedOrder);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao decrementar quantidade.');
    }
  };

  const handleConfirmCancelItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedOrder || !itemToCancel) return;

    try {
      setIsCancellingItem(true);
      const updatedOrder = await cancelComandaItem({
        tableId: selectedTable.id,
        orderId: selectedOrder.id,
        itemId: itemToCancel.id,
        reason: itemCancelReason,
      });
      setSelectedOrder(updatedOrder);
      setIsItemCancelModalOpen(false);
      setItemToCancel(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar item.');
    } finally {
      setIsCancellingItem(false);
    }
  };

  // =========================================================================
  // 6. FECHAMENTO DE CONTA (OCCUPIED -> WAITING_PAYMENT)
  // =========================================================================
  const handleRequestCloseAccount = async () => {
    if (!selectedTable || !selectedOrder) return;
    try {
      setIsClosingAccount(true);
      const { table, order } = await requestTableAccountClosure(selectedTable.id, selectedOrder.id);
      setSelectedTable(table);
      setSelectedOrder(order);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao fechar conta da mesa:', err);
      alert(err.message || 'Erro ao fechar conta.');
    } finally {
      setIsClosingAccount(false);
    }
  };

  // =========================================================================
  // 7. REABERTURA DE COMANDA (WAITING_PAYMENT -> OCCUPIED)
  // =========================================================================
  const handleReopenComanda = async () => {
    if (!selectedTable) return;
    try {
      setIsClosingAccount(true);
      const { table, order } = await reopenTableComanda(selectedTable.id);
      setSelectedTable(table);
      setSelectedOrder(order);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao reabrir comanda:', err);
      alert(err.message || 'Erro ao reabrir comanda.');
    } finally {
      setIsClosingAccount(false);
    }
  };

  // =========================================================================
  // 8. RECEBIMENTO DE PAGAMENTO & LIBERAÇÃO DA MESA
  // =========================================================================
  const handleOpenPaymentModal = () => {
    if (!selectedOrder || !selectedTable) return;
    setPaymentMethod('CASH');
    setReceivedAmountInput('');
    setDiscountInput('');
    setPaymentNotes('');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedOrder) return;

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      const discountCents = discountInput ? parseBRLToCents(discountInput) : 0;
      const receivedAmountCents =
        paymentMethod === 'CASH' && receivedAmountInput
          ? parseBRLToCents(receivedAmountInput)
          : undefined;

      const result = await processTablePayment({
        tableId: selectedTable.id,
        orderId: selectedOrder.id,
        paymentMethod,
        receivedAmountCents,
        discountCents,
        notes: paymentNotes,
      });

      setIsPaymentModalOpen(false);
      setPaymentSuccessData({
        order: result.order,
        table: result.table,
        changeDueCents: result.changeDueCents,
        paymentMethod,
      });
      setIsSuccessModalOpen(true);

      // Reseta seleção do drawer
      setSelectedTable(null);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao processar pagamento da mesa:', err);
      setPaymentError(err.message || 'Erro ao processar o pagamento.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // =========================================================================
  // 9. CANCELAMENTO DE COMANDA
  // =========================================================================
  const handleOpenCancelModal = () => {
    setCancelReason('');
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelComanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedOrder) return;

    try {
      setIsCancelling(true);
      setCancelError(null);

      await cancelTableComanda(selectedTable.id, selectedOrder.id, cancelReason);

      setIsCancelModalOpen(false);
      setSelectedTable(null);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao cancelar comanda:', err);
      setCancelError(err.message || 'Erro ao cancelar a comanda.');
    } finally {
      setIsCancelling(false);
    }
  };

  // =========================================================================
  // 10. GESTÃO DE MESAS (CRUD & ADMINISTRAÇÃO)
  // =========================================================================
  const handleOpenCreateTable = () => {
    // Sugere próximo número livre
    const maxNum = allTables.reduce((max, t) => (t.number > max ? t.number : max), 0);
    setTableFormNumber(String(maxNum + 1));
    setTableFormName(`Mesa ${String(maxNum + 1).padStart(2, '0')}`);
    setTableFormCapacity(4);
    setTableFormError(null);
    setIsCreateTableOpen(true);
  };

  const handleSaveCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(tableFormNumber, 10);
    if (isNaN(num) || num <= 0) {
      setTableFormError('Informe um número válido e maior que zero para a mesa.');
      return;
    }

    if (tableFormCapacity <= 0) {
      setTableFormError('A capacidade deve ser de pelo menos 1 pessoa.');
      return;
    }

    try {
      setIsSavingTable(true);
      setTableFormError(null);

      await tablesRepository.create({
        number: num,
        name: tableFormName.trim() || `Mesa ${String(num).padStart(2, '0')}`,
        capacity: tableFormCapacity,
      });

      setIsCreateTableOpen(false);
      await loadData();
    } catch (err: any) {
      setTableFormError(err.message || 'Erro ao cadastrar mesa.');
    } finally {
      setIsSavingTable(false);
    }
  };

  const handleOpenEditTable = (table: Table) => {
    setTableToEdit(table);
    setTableFormNumber(String(table.number));
    setTableFormName(table.name);
    setTableFormCapacity(table.capacity);
    setTableFormError(null);
    setIsEditTableOpen(true);
  };

  const handleSaveEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableToEdit) return;

    const num = parseInt(tableFormNumber, 10);
    if (isNaN(num) || num <= 0) {
      setTableFormError('Informe um número válido para a mesa.');
      return;
    }

    try {
      setIsSavingTable(true);
      setTableFormError(null);

      await tablesRepository.update({
        ...tableToEdit,
        number: num,
        name: tableFormName.trim() || `Mesa ${String(num).padStart(2, '0')}`,
        capacity: tableFormCapacity,
      });

      setIsEditTableOpen(false);
      setTableToEdit(null);
      await loadData();
    } catch (err: any) {
      setTableFormError(err.message || 'Erro ao atualizar mesa.');
    } finally {
      setIsSavingTable(false);
    }
  };

  const handleDeactivateTable = async (table: Table) => {
    if (table.status === 'OCCUPIED') {
      alert('Não é possível excluir uma mesa ocupada. Finalize ou cancele a comanda primeiro.');
      return;
    }
    if (table.status === 'WAITING_PAYMENT') {
      alert('Não é possível excluir uma mesa aguardando pagamento. Finalize o pagamento ou cancele a comanda.');
      return;
    }

    const confirm = window.confirm(`Deseja realmente desativar a ${table.name || 'Mesa ' + table.number}?`);
    if (!confirm) return;

    try {
      await tablesRepository.deactivate(table.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao desativar mesa.');
    }
  };

  const handleReactivateTable = async (table: Table) => {
    try {
      await tablesRepository.reactivate(table.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao reativar mesa.');
    }
  };

  const handleToggleBlockTable = async (table: Table) => {
    const isCurrentlyBlocked = table.status === 'BLOCKED';
    try {
      await tablesRepository.toggleBlock(table.id, !isCurrentlyBlocked);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar bloqueio da mesa.');
    }
  };

  // =========================================================================
  // 11. CÁLCULO E FORMATAÇÃO DE DADOS
  // =========================================================================
  const filteredTables = tables.filter(table => {
    if (statusFilter !== 'ALL' && table.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = String(table.number).includes(q);
      const matchName = table.name.toLowerCase().includes(q);
      return matchNum || matchName;
    }
    return true;
  });

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'FREE':
        return {
          label: 'Livre',
          icon: CheckCircle,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'OCCUPIED':
        return {
          label: 'Ocupada',
          icon: Clock,
          className: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'WAITING_PAYMENT':
        return {
          label: 'Ag. Pagamento',
          icon: Receipt,
          className: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-bold'
        };
      case 'BLOCKED':
        return {
          label: 'Bloqueada',
          icon: Ban,
          className: 'bg-slate-100 text-slate-600 border-slate-300'
        };
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const activeOrderItems = (selectedOrder?.items || []).filter(i => i.status !== 'CANCELLED');
  const cancelledOrderItems = (selectedOrder?.items || []).filter(i => i.status === 'CANCELLED');

  interface RoundGroup {
    roundNumber: number;
    roundId: string;
    items: OrderItem[];
    createdAt: string;
  }

  // Agrupamento por Rodada (Round) para exibição e controle operacional
  const roundGroups: Record<string, RoundGroup> = activeOrderItems.reduce((acc, item) => {
    const rNum = item.roundNumber || 1;
    const rId = item.roundId || `R${String(rNum).padStart(3, '0')}`;
    if (!acc[rId]) {
      acc[rId] = {
        roundNumber: rNum,
        roundId: rId,
        items: [],
        createdAt: item.createdAt,
      };
    }
    acc[rId].items.push(item);
    return acc;
  }, {} as Record<string, RoundGroup>);

  const sortedRounds: RoundGroup[] = Object.values(roundGroups).sort((a: RoundGroup, b: RoundGroup) => a.roundNumber - b.roundNumber);

  const currentMaxRound = activeOrderItems.reduce((max, i) => Math.max(max, i.roundNumber || 1), 0);
  const nextRoundNumber = activeOrderItems.length > 0 ? currentMaxRound + 1 : 1;

  const filteredProducts = products.filter(product => {
    if (productCategoryFilter !== 'ALL' && product.categoryId !== productCategoryFilter) {
      return false;
    }
    if (productSearchQuery) {
      const q = productSearchQuery.toLowerCase().trim();
      return product.name.toLowerCase().includes(q) || (product.description && product.description.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div id="mesas-view" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          id="mesas-view-header"
          title="Mesas e Comandas"
          description="Gestão operacional de consumo presencial no salão com fechamento, lançamento de itens e liberação de mesas."
        />

        <div className="flex items-center gap-2">
          <Button
            id="refresh-tables-btn"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs h-9 px-3 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            id="manage-tables-btn"
            variant="outline"
            size="sm"
            onClick={() => setIsManageTablesOpen(true)}
            className="text-xs h-9 px-3 gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            Gerenciar Mesas
          </Button>

          <Button
            id="create-table-btn"
            variant="primary"
            size="sm"
            onClick={handleOpenCreateTable}
            className="text-xs h-9 px-3.5 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            <Plus className="w-4 h-4" />
            Nova Mesa
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['ALL', 'FREE', 'OCCUPIED', 'WAITING_PAYMENT', 'BLOCKED'] as const).map(st => {
            const count = st === 'ALL' ? tables.length : tables.filter(t => t.status === st).length;
            const isSelected = statusFilter === st;
            let label = 'Todas';
            if (st === 'FREE') label = 'Livres';
            if (st === 'OCCUPIED') label = 'Ocupadas';
            if (st === 'WAITING_PAYMENT') label = 'Ag. Pagamento';
            if (st === 'BLOCKED') label = 'Bloqueadas';

            return (
              <button
                key={st}
                id={`filter-status-${st.toLowerCase()}`}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-slate-700 text-amber-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-tables-input"
            type="text"
            placeholder="Buscar por número ou nome..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <LoadingState id="mesas-loading-state" message="Carregando mesas do salão..." />
      ) : filteredTables.length === 0 ? (
        <EmptyState
          id="mesas-empty-state"
          title="Nenhuma mesa encontrada"
          description={
            searchQuery || statusFilter !== 'ALL'
              ? 'Tente alterar os filtros de busca para visualizar outras mesas.'
              : 'Clique em "+ Nova Mesa" para cadastrar a primeira mesa do salão.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTables.map(table => {
            const statusConfig = getStatusBadge(table.status);
            const StatusIcon = statusConfig.icon;
            const order = table.currentOrderId ? ordersMap[table.id] : null;
            const isSubmitting = submittingTableId === table.id;

            return (
              <Card
                key={table.id}
                id={`table-card-${table.id}`}
                className={`relative flex flex-col justify-between overflow-hidden border transition-all duration-200 hover:shadow-md ${
                  table.status === 'WAITING_PAYMENT'
                    ? 'border-rose-300 bg-rose-50/20'
                    : table.status === 'OCCUPIED'
                    ? 'border-amber-200 bg-white'
                    : table.status === 'BLOCKED'
                    ? 'border-slate-200 bg-slate-50 opacity-75'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-extrabold text-slate-900">
                        {table.name || `Mesa ${String(table.number).padStart(2, '0')}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Capacidade: {table.capacity} pessoas
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusConfig.className}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Card Body / Consumption Info */}
                <div className="p-4 flex-1 flex flex-col justify-center">
                  {table.status === 'FREE' && (
                    <div className="text-center py-2">
                      <p className="text-xs text-slate-400 font-medium">Mesa disponível para atendimento</p>
                    </div>
                  )}

                  {table.status === 'BLOCKED' && (
                    <div className="text-center py-2">
                      <p className="text-xs text-slate-400 font-medium">Mesa bloqueada temporariamente</p>
                    </div>
                  )}

                  {(table.status === 'OCCUPIED' || table.status === 'WAITING_PAYMENT') && (
                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <span>Comanda:</span>
                        <span className="font-mono text-slate-700">
                          {order?.localId || (table.currentOrderId ? `CMD-${table.number}` : '---')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <span>Itens:</span>
                        <span className="text-slate-700 font-bold">
                          {order?.items?.filter(i => i.status !== 'CANCELLED').length || 0} lançados
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-xs font-extrabold text-slate-800">Total:</span>
                        <span className="text-sm font-extrabold text-amber-600">
                          {formatCentsToBRL(order?.total || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                  {table.status === 'FREE' && (
                    <Button
                      id={`open-table-btn-${table.id}`}
                      variant="primary"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleOpenTable(table)}
                      className="w-full text-xs py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      {isSubmitting ? 'Abrindo...' : 'Abrir Mesa'}
                    </Button>
                  )}

                  {table.status === 'OCCUPIED' && (
                    <Button
                      id={`access-comanda-btn-${table.id}`}
                      variant="primary"
                      size="sm"
                      onClick={() => handleSelectTable(table)}
                      className="w-full text-xs py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1"
                    >
                      <span>Acessar Comanda</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {table.status === 'WAITING_PAYMENT' && (
                    <div className="w-full flex gap-1.5">
                      <Button
                        id={`receive-bill-btn-${table.id}`}
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          handleSelectTable(table);
                          handleOpenPaymentModal();
                        }}
                        className="flex-1 text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold gap-1"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Receber</span>
                      </Button>
                      <Button
                        id={`view-comanda-btn-${table.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectTable(table)}
                        className="px-2.5 text-xs py-2 border-slate-300"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {table.status === 'BLOCKED' && (
                    <Button
                      id={`unblock-table-btn-${table.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBlockTable(table)}
                      className="w-full text-xs py-2 border-slate-300 text-slate-600 hover:bg-slate-200"
                    >
                      Desbloquear Mesa
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: DETALHES E GESTÃO DA COMANDA ATIVA */}
      {/* ========================================================================= */}
      {selectedTable && (
        <Drawer
          id="mesa-detail-drawer"
          isOpen={Boolean(selectedTable)}
          onClose={() => setSelectedTable(null)}
          title={`Comanda — ${selectedTable.name || 'Mesa ' + selectedTable.number}`}
          position="right"
        >
          <div className="flex flex-col h-full space-y-4">
            {/* Header info status banner */}
            <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                  Comanda Salão
                </span>
                <h3 className="text-base font-extrabold font-mono">
                  {selectedOrder?.localId || (selectedTable.currentOrderId ? `CMD-${selectedTable.number}` : '---')}
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  {selectedTable.name} • {selectedTable.capacity} Lugares
                </p>
              </div>

              <div className="text-right">
                {selectedTable.status === 'WAITING_PAYMENT' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-full animate-pulse">
                    <Receipt className="w-3.5 h-3.5" />
                    Conta Fechada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    Em Consumo
                  </span>
                )}
              </div>
            </div>

            {/* WAITING_PAYMENT Notice */}
            {selectedTable.status === 'WAITING_PAYMENT' && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Conta Fechada:</strong> Novos lançamentos estão bloqueados. Receba o pagamento ou reabra a comanda.
                  </span>
                </div>
                <Button
                  id="reopen-comanda-top-btn"
                  variant="outline"
                  size="sm"
                  disabled={isClosingAccount}
                  onClick={handleReopenComanda}
                  className="text-[11px] h-7 px-2 border-rose-300 bg-white text-rose-700 hover:bg-rose-100 shrink-0 gap-1 font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reabrir
                </Button>
              </div>
            )}

            {/* Action Bar inside Drawer: Add Products button */}
            {selectedTable.status === 'OCCUPIED' && (
              <div className="flex gap-2">
                <Button
                  id="drawer-add-product-btn"
                  variant="primary"
                  onClick={handleOpenAddItemModal}
                  className="flex-1 py-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Lançar Produtos na Mesa
                </Button>
              </div>
            )}

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700">
                  Itens Consumidos ({activeOrderItems.length})
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Snapshot de preços em centavos</span>
              </div>

              {activeOrderItems.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Nenhum item consumido ainda</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Clique no botão acima para lançar a 1ª rodada de produtos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedRounds.map(group => {
                    const activeGroupItems = group.items.filter(i => i.status !== 'CANCELLED');
                    const isRoundReady = activeGroupItems.length > 0 && activeGroupItems.every(i => i.status === 'READY');
                    const isRoundPreparing = activeGroupItems.some(i => i.status === 'PREPARING' || i.status === 'READY');
                    const isRoundPending = !isRoundReady && !isRoundPreparing;

                    return (
                      <div key={group.roundId} className="space-y-2">
                        {/* Round Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded uppercase tracking-wider">
                              Rodada #{group.roundNumber}
                            </span>
                            <span className="text-[11px] font-bold text-amber-950">{group.roundId}</span>

                            {/* Round Status Badge */}
                            {isRoundReady ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px] rounded-full uppercase flex items-center gap-1">
                                🟢 PRONTO
                              </span>
                            ) : isRoundPreparing ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] rounded-full uppercase flex items-center gap-1">
                                🟠 EM PREPARO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 font-extrabold text-[10px] rounded-full uppercase flex items-center gap-1">
                                ⚪ AGUARDANDO ENVIO
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Action button if PENDING */}
                            {isRoundPending && selectedTable?.status === 'OCCUPIED' && (
                              <Button
                                id={`btn-send-round-${group.roundId}`}
                                size="sm"
                                disabled={sendingRoundId === group.roundId}
                                onClick={() => handleSendRoundToPreparo(group.roundId)}
                                className="py-1 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-extrabold gap-1.5 shadow-2xs"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingRoundId === group.roundId ? 'Enviando...' : 'ENVIAR PARA PREPARO'}</span>
                              </Button>
                            )}

                            <span className="text-[10px] text-amber-800 font-medium">
                              {group.items.reduce((s, i) => s + i.quantity, 0)} itens • {new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                      {/* Items in this round */}
                      <div className="space-y-1.5">
                        {group.items.map(item => (
                          <div
                            key={item.id}
                            id={`order-item-${item.id}`}
                            className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {item.productNameSnapshot}
                                </span>
                                {item.status && item.status !== 'PENDING' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-[10px] text-slate-500 truncate italic">Obs: {item.notes}</p>
                              )}
                              <span className="text-[11px] text-slate-400 font-medium">
                                {formatCentsToBRL(item.unitPrice)} un.
                              </span>
                            </div>

                            {/* Quantity controls & subtotal */}
                            <div className="flex items-center gap-2.5">
                              {selectedTable.status === 'OCCUPIED' && (
                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    id={`item-decrement-${item.id}`}
                                    type="button"
                                    onClick={() => handleDecrementItem(item)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title="Diminuir ou remover item"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center text-xs font-extrabold text-slate-800">
                                    {item.quantity}
                                  </span>
                                  <button
                                    id={`item-increment-${item.id}`}
                                    type="button"
                                    onClick={() => handleIncrementItem(item)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title="Aumentar quantidade"
                                  >
                                    +
                                  </button>
                                </div>
                              )}

                              {selectedTable.status !== 'OCCUPIED' && (
                                <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                                  x{item.quantity}
                                </span>
                              )}

                              <span className="text-xs font-extrabold text-slate-900 w-16 text-right">
                                {formatCentsToBRL(item.subtotal)}
                              </span>

                              {selectedTable.status === 'OCCUPIED' && (
                                <button
                                  id={`item-cancel-btn-${item.id}`}
                                  type="button"
                                  onClick={() => {
                                    setItemToCancel(item);
                                    setItemCancelReason('');
                                    setIsItemCancelModalOpen(true);
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                  title="Cancelar item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Cancelled items list if any */}
              {cancelledOrderItems.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Itens Cancelados ({cancelledOrderItems.length})
                  </span>
                  <div className="space-y-1.5 opacity-60">
                    {cancelledOrderItems.map(item => (
                      <div
                        key={item.id}
                        className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center text-slate-500 line-through"
                      >
                        <span>
                          {item.quantity}x {item.productNameSnapshot}
                        </span>
                        <span>{formatCentsToBRL(item.subtotal)} (Cancelado)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal Consumido</span>
                <span className="font-semibold">{formatCentsToBRL(selectedOrder?.subtotal || 0)}</span>
              </div>

              {(selectedOrder?.discount || 0) > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Desconto</span>
                  <span className="font-semibold">- {formatCentsToBRL(selectedOrder?.discount || 0)}</span>
                </div>
              )}

              {(selectedOrder?.serviceFee || 0) > 0 && (
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Taxa de Serviço</span>
                  <span className="font-semibold">+ {formatCentsToBRL(selectedOrder?.serviceFee || 0)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-amber-400 pt-2 border-t border-slate-800">
                <span>Total da Mesa</span>
                <span className="text-lg">{formatCentsToBRL(selectedOrder?.total || 0)}</span>
              </div>
            </div>

            {/* Comanda Bottom Action Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {selectedTable.status === 'OCCUPIED' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    id="close-account-btn"
                    variant="outline"
                    disabled={isClosingAccount}
                    onClick={handleRequestCloseAccount}
                    className="text-xs py-2.5 border-slate-300 hover:bg-slate-50 font-bold gap-1.5"
                  >
                    <Receipt className="w-4 h-4 text-slate-600" />
                    <span>Fechar Conta</span>
                  </Button>

                  <Button
                    id="receive-payment-direct-btn"
                    variant="primary"
                    onClick={handleOpenPaymentModal}
                    className="text-xs py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-1.5 shadow-sm"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Receber Agora</span>
                  </Button>
                </div>
              )}

              {selectedTable.status === 'WAITING_PAYMENT' && (
                <div className="space-y-2">
                  <Button
                    id="drawer-receive-payment-btn"
                    variant="primary"
                    onClick={handleOpenPaymentModal}
                    className="w-full text-xs py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold gap-2 shadow-md animate-pulse"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>RECEBER PAGAMENTO & LIBERAR MESA</span>
                  </Button>

                  <Button
                    id="drawer-reopen-comanda-btn"
                    variant="outline"
                    disabled={isClosingAccount}
                    onClick={handleReopenComanda}
                    className="w-full text-xs py-2 border-slate-300 font-bold gap-1.5 text-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reabrir Comanda (Continuar Consumo)</span>
                  </Button>
                </div>
              )}

              {/* Cancel comanda option */}
              <div className="pt-1 text-center">
                <button
                  id="cancel-comanda-link-btn"
                  type="button"
                  onClick={handleOpenCancelModal}
                  className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors"
                >
                  Cancelar Comanda e Liberar Mesa
                </button>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LANÇAR PRODUTOS NA COMANDA (RODADAS ETAPA 09.8.3) */}
      {/* ========================================================================= */}
      <Dialog
        id="add-item-dialog"
        size="xl"
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        title={`Lançar Produtos • Mesa ${selectedTable?.number ? String(selectedTable.number).padStart(2, '0') : ''}`}
      >
        <div className="flex flex-col gap-4">
          {/* Round Indicator Banner */}
          <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-600 text-white text-[11px] font-black rounded-md tracking-wider uppercase">
                Rodada #{nextRoundNumber}
              </span>
              <span className="text-xs font-bold text-amber-950">
                {selectedTable?.name || `Mesa ${selectedTable?.number}`}
              </span>
            </div>
            <span className="text-[11px] font-medium text-amber-800">
              {stagedItems.length} {stagedItems.length === 1 ? 'item pronto' : 'itens prontos'} na rodada
            </span>
          </div>

          {addItemError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addItemError}</span>
            </div>
          )}

          {/* Responsive Two-Column / Stack Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Products Catalog Selection (Lg: 7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Search & Category Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="product-search-input"
                    type="text"
                    placeholder="Buscar por nome do produto..."
                    value={productSearchQuery}
                    onChange={e => setProductSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Category Chips */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setProductCategoryFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                        productCategoryFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todas
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setProductCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
                          productCategoryFilter === cat.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Products Grid/List */}
              <div className="max-h-60 sm:max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1.5">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhum produto encontrado no catálogo.</p>
                ) : (
                  filteredProducts.map(product => {
                    const isSelected = selectedProductId === product.id;
                    return (
                      <div
                        key={product.id}
                        id={`product-item-${product.id}`}
                        onClick={() => setSelectedProductId(product.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-xs font-bold truncate block">{product.name}</span>
                          {product.description && (
                            <p className="text-[10px] text-slate-400 truncate max-w-xs font-normal">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold text-amber-600">
                            {formatCentsToBRL(product.price)}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleAddProductQuickly(product);
                            }}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold transition-colors"
                            title="Adicionar 1 un. à rodada"
                          >
                            + 1
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Item Customizer & Staged Round (Lg: 5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              {/* Selected Product Form */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Item Selecionado
                </span>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-slate-900 truncate">
                    {selectedProduct?.name || 'Selecione um produto'}
                  </span>
                  <span className="text-xs font-extrabold text-amber-600">
                    {selectedProduct ? formatCentsToBRL(selectedProduct.price) : 'R$ 0,00'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Qtd.</label>
                    <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-6 h-6 flex items-center justify-center bg-white rounded text-slate-700 font-bold shadow-xs text-xs"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center text-xs font-black text-slate-800">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(q => q + 1)}
                        className="w-6 h-6 flex items-center justify-center bg-white rounded text-slate-700 font-bold shadow-xs text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Observações</label>
                    <input
                      id="add-item-notes-input"
                      type="text"
                      placeholder="Ex: sem gelo, bem passado..."
                      value={itemNotes}
                      onChange={e => setItemNotes(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedProduct}
                  onClick={() => selectedProduct && handleAddStagedItem(selectedProduct)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Adicionar à Rodada #{nextRoundNumber}</span>
                </button>
              </div>

              {/* Staged Items List */}
              <div className="flex-1 flex flex-col min-h-32">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Itens desta Rodada ({stagedItems.length})
                  </span>
                  {stagedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStagedItems([])}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto max-h-36 space-y-1.5 pr-0.5">
                  {stagedItems.length === 0 ? (
                    <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[11px] text-slate-400 font-medium">Nenhum item adicionado à rodada ainda.</p>
                      <p className="text-[10px] text-slate-400">Clique em "+ 1" ou "Adicionar à Rodada".</p>
                    </div>
                  ) : (
                    stagedItems.map(staged => (
                      <div
                        key={staged.id}
                        className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-1.5 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-800 truncate block">
                            {staged.productName}
                          </span>
                          {staged.notes && (
                            <p className="text-[10px] text-slate-500 italic truncate">Obs: {staged.notes}</p>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatCentsToBRL(staged.unitPrice * staged.quantity)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center bg-slate-100 rounded border border-slate-200 p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateStagedItemQty(staged.id, -1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-white rounded text-[10px] font-bold"
                            >
                              -
                            </button>
                            <span className="w-4 text-center text-[11px] font-black text-slate-800">
                              {staged.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateStagedItemQty(staged.id, 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-white rounded text-[10px] font-bold"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveStagedItem(staged.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remover item da rodada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Subtotal of the staged round */}
                <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Subtotal da Rodada:</span>
                  <span className="text-sm font-extrabold text-amber-700">
                    {formatCentsToBRL(
                      stagedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) ||
                        (selectedProduct ? selectedProduct.price * quantity : 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
            <Button
              id="add-item-cancel-btn"
              type="button"
              variant="outline"
              disabled={isSubmittingItem}
              className="w-full sm:w-auto text-xs py-2.5 px-4"
              onClick={() => setIsAddItemOpen(false)}
            >
              Cancelar
            </Button>

            <Button
              id="add-item-confirm-btn"
              type="button"
              disabled={isSubmittingItem || (stagedItems.length === 0 && !selectedProductId)}
              onClick={() => handleSubmitRound()}
              className="flex-1 text-xs py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-sm gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSubmittingItem
                  ? 'Enviando Rodada...'
                  : stagedItems.length > 0
                  ? `Enviar Rodada #${nextRoundNumber} (${stagedItems.reduce((s, i) => s + i.quantity, 0)} itens) para Cozinha/Bar`
                  : `Enviar 1 Item como Rodada #${nextRoundNumber}`}
              </span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CANCELAR ITEM DA COMANDA */}
      {/* ========================================================================= */}
      <Dialog
        id="cancel-item-dialog"
        isOpen={isItemCancelModalOpen}
        onClose={() => setIsItemCancelModalOpen(false)}
        title="Cancelar Item da Comanda"
      >
        <form onSubmit={handleConfirmCancelItem} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
            <p className="font-bold">Item a ser cancelado:</p>
            <p className="text-slate-700">
              {itemToCancel?.quantity}x {itemToCancel?.productNameSnapshot} (
              {formatCentsToBRL(itemToCancel?.subtotal || 0)})
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do cancelamento (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Cliente desistiu, erro de digitação..."
              value={itemCancelReason}
              onChange={e => setItemCancelReason(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isCancellingItem}
              className="flex-1 text-xs py-2.5"
              onClick={() => setIsItemCancelModalOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={isCancellingItem}
              className="flex-1 text-xs py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold"
            >
              {isCancellingItem ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: RECEBER PAGAMENTO DA MESA (ETAPA 09.8.1 / 09.8.2) */}
      {/* ========================================================================= */}
      <Dialog
        id="payment-dialog"
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Receber Pagamento — ${selectedTable?.name || 'Mesa ' + selectedTable?.number}`}
      >
        <form onSubmit={handleConfirmPayment} className="space-y-4">
          {!openRegisterExists && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Nenhum caixa aberto no momento. O pagamento será registrado e conciliado no próximo fechamento de caixa.
              </span>
            </div>
          )}

          {paymentError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {/* Total Highlight */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Valor Total da Conta
              </span>
              <h4 className="text-2xl font-extrabold text-amber-400 font-mono">
                {formatCentsToBRL(selectedOrder?.total || 0)}
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              {activeOrderItems.length} itens consumidos
            </span>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { method: 'CASH', label: 'Dinheiro', icon: Banknote },
                { method: 'PIX', label: 'PIX', icon: QrCode },
                { method: 'CREDIT_CARD', label: 'Crédito', icon: CreditCard },
                { method: 'DEBIT_CARD', label: 'Débito', icon: CreditCard },
                { method: 'MEAL_VOUCHER', label: 'Vale Refeição', icon: DollarSign },
                { method: 'OTHER', label: 'Outro', icon: DollarSign }
              ].map(({ method, label, icon: Icon }) => (
                <button
                  key={method}
                  id={`payment-method-${method.toLowerCase()}`}
                  type="button"
                  onClick={() => setPaymentMethod(method as PaymentMethod)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all ${
                    paymentMethod === method
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${paymentMethod === method ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Amount Received and Change calculation */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-700">Valor Recebido do Cliente (R$)</label>
              <input
                id="cash-received-input"
                type="text"
                placeholder="Ex: 50,00"
                value={receivedAmountInput}
                onChange={e => setReceivedAmountInput(e.target.value)}
                className="w-full p-2 text-sm font-bold border border-slate-300 rounded-xl bg-white focus:border-emerald-500 outline-none"
              />

              {/* Quick Cash Shortcuts */}
              <div className="flex gap-1.5 overflow-x-auto pt-1">
                {[
                  { label: 'Exato', cents: selectedOrder?.total || 0 },
                  { label: 'R$ 20', cents: 2000 },
                  { label: 'R$ 50', cents: 5000 },
                  { label: 'R$ 100', cents: 10000 },
                  { label: 'R$ 200', cents: 20000 }
                ].map((sc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReceivedAmountInput((sc.cents / 100).toFixed(2).replace('.', ','))}
                    className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 whitespace-nowrap"
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              {/* Change due preview */}
              {receivedAmountInput && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">Troco a Devolver:</span>
                  <span
                    className={`font-extrabold text-sm ${
                      parseBRLToCents(receivedAmountInput) >= (selectedOrder?.total || 0)
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    }`}
                  >
                    {parseBRLToCents(receivedAmountInput) >= (selectedOrder?.total || 0)
                      ? formatCentsToBRL(parseBRLToCents(receivedAmountInput) - (selectedOrder?.total || 0))
                      : 'Valor insuficiente'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Optional Discount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Desconto Adicional (R$ - Opcional)</label>
            <input
              id="discount-input"
              type="text"
              placeholder="0,00"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Payment Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observações do Pagamento</label>
            <input
              id="payment-notes-input"
              type="text"
              placeholder="Ex: Pago pelo cliente da ponta, nota emitida..."
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              id="cancel-payment-btn"
              type="button"
              variant="outline"
              disabled={isProcessingPayment}
              className="flex-1 text-xs py-2.5"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancelar
            </Button>

            <Button
              id="confirm-payment-btn"
              type="submit"
              disabled={isProcessingPayment}
              className="flex-1 text-xs py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md"
            >
              {isProcessingPayment ? 'Processando...' : 'CONFIRMAR E LIBERAR'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: SUCESSO DO PAGAMENTO & RECIBO */}
      {/* ========================================================================= */}
      <Dialog
        id="success-receipt-dialog"
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        title="Pagamento Concluído com Sucesso"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h4 className="text-base font-extrabold text-slate-900">
              {paymentSuccessData?.table.name || 'Mesa'} Liberada!
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              O pagamento foi processado, a comanda finalizada e a mesa está livre para novo atendimento.
            </p>
          </div>

          {/* Receipt Info */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Comanda:</span>
              <span className="font-mono font-bold text-slate-900">
                {paymentSuccessData?.order.localId || '---'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Forma de Pagamento:</span>
              <span className="font-bold text-slate-900">{paymentSuccessData?.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Pago:</span>
              <span className="font-extrabold text-emerald-600">
                {formatCentsToBRL(paymentSuccessData?.order.total || 0)}
              </span>
            </div>
            {(paymentSuccessData?.changeDueCents || 0) > 0 && (
              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-900">Troco Devolvido:</span>
                <span className="font-extrabold text-amber-600">
                  {formatCentsToBRL(paymentSuccessData?.changeDueCents || 0)}
                </span>
              </div>
            )}
          </div>

          <Button
            id="close-success-receipt-btn"
            variant="primary"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            onClick={() => setIsSuccessModalOpen(false)}
          >
            Concluir e Voltar ao Salão
          </Button>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: CANCELAR COMANDA */}
      {/* ========================================================================= */}
      <Dialog
        id="cancel-comanda-dialog"
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Comanda e Liberar Mesa"
      >
        <form onSubmit={handleConfirmCancelComanda} className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs space-y-1">
            <p className="font-bold">Atenção: Ação irreversível!</p>
            <p>
              Ao cancelar, todos os itens da comanda e tickets no KDS serão cancelados e a mesa retornará imediatamente ao status LIVRE.
            </p>
          </div>

          {cancelError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{cancelError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo do Cancelamento (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Desistência do cliente, mesa trocada..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-red-500 outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isCancelling}
              className="flex-1 text-xs py-2.5"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={isCancelling}
              className="flex-1 text-xs py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold"
            >
              {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: NOVA MESA (CREATE TABLE) */}
      {/* ========================================================================= */}
      <Dialog
        id="create-table-dialog"
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        title="Cadastrar Nova Mesa"
      >
        <form onSubmit={handleSaveCreateTable} className="space-y-4">
          {tableFormError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{tableFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Número da Mesa <span className="text-red-500">*</span>
            </label>
            <input
              id="create-table-number-input"
              type="number"
              min="1"
              required
              value={tableFormNumber}
              onChange={e => setTableFormNumber(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome / Identificação
            </label>
            <input
              id="create-table-name-input"
              type="text"
              placeholder="Ex: Mesa 09, Varanda 02, Camarote 01"
              value={tableFormName}
              onChange={e => setTableFormName(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Capacidade (Pessoas) <span className="text-red-500">*</span>
            </label>
            <input
              id="create-table-capacity-input"
              type="number"
              min="1"
              required
              value={tableFormCapacity}
              onChange={e => setTableFormCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none font-bold"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isSavingTable}
              className="flex-1 text-xs py-2.5"
              onClick={() => setIsCreateTableOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              id="confirm-create-table-btn"
              type="submit"
              disabled={isSavingTable}
              className="flex-1 text-xs py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold"
            >
              {isSavingTable ? 'Salvando...' : 'Criar Mesa'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: EDITAR MESA */}
      {/* ========================================================================= */}
      <Dialog
        id="edit-table-dialog"
        isOpen={isEditTableOpen}
        onClose={() => setIsEditTableOpen(false)}
        title={`Editar ${tableToEdit?.name || 'Mesa ' + tableToEdit?.number}`}
      >
        <form onSubmit={handleSaveEditTable} className="space-y-4">
          {tableFormError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{tableFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Número da Mesa <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-table-number-input"
              type="number"
              min="1"
              required
              value={tableFormNumber}
              onChange={e => setTableFormNumber(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome / Identificação
            </label>
            <input
              id="edit-table-name-input"
              type="text"
              value={tableFormName}
              onChange={e => setTableFormName(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Capacidade (Pessoas) <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-table-capacity-input"
              type="number"
              min="1"
              required
              value={tableFormCapacity}
              onChange={e => setTableFormCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-amber-500 outline-none font-bold"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isSavingTable}
              className="flex-1 text-xs py-2.5"
              onClick={() => setIsEditTableOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              id="confirm-edit-table-btn"
              type="submit"
              disabled={isSavingTable}
              className="flex-1 text-xs py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold"
            >
              {isSavingTable ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* DRAWER: GERENCIAR TODAS AS MESAS (ADMINISTRAÇÃO & STATUS) */}
      {/* ========================================================================= */}
      <Drawer
        id="manage-tables-drawer"
        isOpen={isManageTablesOpen}
        onClose={() => setIsManageTablesOpen(false)}
        title="Gerenciamento de Mesas do Salão"
        position="right"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Lista completa de mesas cadastradas, ativas e inativas.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateTable}
              className="text-xs py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Mesa
            </Button>
          </div>

          <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
            {allTables.map(table => {
              const statusConfig = getStatusBadge(table.status);
              const StatusIcon = statusConfig.icon;
              const isInactive = table.active === false;

              return (
                <div
                  key={table.id}
                  id={`manage-table-row-${table.id}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isInactive ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {table.name || `Mesa ${table.number}`}
                      </span>
                      {isInactive && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">
                          Desativada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Nº {table.number} • {table.capacity} Lugares • Status:{' '}
                      <span className="font-bold">{statusConfig.label}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isInactive && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditTable(table)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Editar dados da mesa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBlockTable(table)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title={table.status === 'BLOCKED' ? 'Desbloquear mesa' : 'Bloquear mesa'}
                        >
                          {table.status === 'BLOCKED' ? (
                            <Unlock className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeactivateTable(table)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Desativar mesa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isInactive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReactivateTable(table)}
                        className="text-[11px] py-1 px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                      >
                        Reativar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
