/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Check,
  DollarSign,
  CreditCard,
  Wallet,
  QrCode,
  User,
  Phone,
  Tag,
  AlertCircle,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  FileText,
  ShoppingBag,
  Clock,
  ArrowRight
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Overlay';
import { useRouter } from '../services/router';
import { useNetwork } from '../hooks/useNetwork';
import { formatCentsToBRL, parseBRLToCents } from '../utils/currency';
import {
  productsRepository,
  categoriesRepository,
  ordersRepository,
  syncQueueRepository,
  getOrRegisterDeviceId,
  getAccompanimentGroupsForProduct
} from '../services/storage';
import {
  Category,
  Product,
  ProductOption,
  ProductAddon,
  AccompanimentGroup,
  AccompanimentItem,
  Order,
  OrderItem,
  OrderItemOption,
  OrderItemAddon,
  OrderItemAccompaniment,
  PaymentMethod
} from '../services/storage/types';
import {
  validateAccompanimentSelections,
  buildOrderItemAccompaniments,
  calculateTotalAccompanimentsPrice
} from '../services/accompanimentService';
import { AccompanimentSelector, AccompanimentGroupWithItems } from '../components/accompaniments/AccompanimentSelector';

// Item structure in the PDV cart
export interface PdvCartItem {
  id: string; // Temporary unique ID for cart item
  productId: string;
  productNameSnapshot: string;
  unitPrice: number; // Integer in CENTS
  quantity: number;
  subtotal: number; // Integer in CENTS (unitPrice * quantity)
  notes?: string;
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: OrderItemOption[];
  selectedAddons?: OrderItemAddon[];
}

export function PdvView() {
  const { navigate } = useRouter();
  const { isOnline } = useNetwork();

  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State
  const [cartItems, setCartItems] = useState<PdvCartItem[]>([]);

  // Customer & Order Information
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [discountText, setDiscountText] = useState<string>('');
  const [receivedAmountText, setReceivedAmountText] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Config Modal State (for product accompaniments / options / addons)
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);
  const [productAccompaniments, setProductAccompaniments] = useState<AccompanimentGroupWithItems[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [selectedAccompaniments, setSelectedAccompaniments] = useState<Record<string, Record<string, number>>>({});
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({}); // optionId -> choiceId
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({}); // addonId -> quantity
  const [modalAccValidationError, setModalAccValidationError] = useState<string | null>(null);

  // Checkout Processing & Success Modal
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [completedOrderChangeFor, setCompletedOrderChangeFor] = useState<number>(0);

  // Load Categories, Products & Queue Status from IndexedDB
  const loadPdvData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [fetchedCategories, fetchedProducts, pendingQueue] = await Promise.all([
        categoriesRepository.getAll(),
        productsRepository.getAll(),
        syncQueueRepository.getPending(),
      ]);

      // Active, non-deleted categories sorted by sortOrder
      const activeCategories = fetchedCategories
        .filter(c => c.active && !c.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      // Active, available, non-deleted products
      const activeProducts = fetchedProducts
        .filter(p => p.active && p.available !== false && !p.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setCategories(activeCategories);
      setProducts(activeProducts);
      setPendingQueueCount(pendingQueue.length);
    } catch (err) {
      console.error('Erro ao carregar dados para o PDV:', err);
      setErrorMessage('Erro ao carregar cardápio e produtos do banco local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdvData();
  }, []);

  // Filter products by selected category and search query
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Handle clicking a product in the catalog
  const handleSelectProduct = async (product: Product) => {
    try {
      const [accGroups, opts, adds] = await Promise.all([
        getAccompanimentGroupsForProduct(product.id),
        productsRepository.getOptions(product.id),
        productsRepository.getAddons(product.id)
      ]);

      const activeAccGroups = accGroups || [];
      const activeOpts = opts || [];
      const activeAdds = (adds || []).filter(a => a.active);

      // If product has accompaniments, options, or addons, open customization modal
      if (activeAccGroups.length > 0 || activeOpts.length > 0 || activeAdds.length > 0) {
        setConfiguringProduct(product);
        setProductAccompaniments(activeAccGroups);
        setProductOptions(activeOpts);
        setProductAddons(activeAdds);
        setModalQuantity(1);
        setModalNotes('');
        setModalAccValidationError(null);

        // Pre-select first choice for single-choice required accompaniment groups
        const initialAccSelections: Record<string, Record<string, number>> = {};
        activeAccGroups.forEach(({ group, items }) => {
          if (group.required && group.maxSelections === 1 && items.length > 0) {
            initialAccSelections[group.id] = { [items[0].id]: 1 };
          }
        });
        setSelectedAccompaniments(initialAccSelections);

        // Pre-select required options
        const initialChoices: Record<string, string> = {};
        activeOpts.forEach(opt => {
          if (opt.required && opt.choices.length > 0) {
            initialChoices[opt.id] = opt.choices[0].id;
          }
        });
        setSelectedChoices(initialChoices);
        setSelectedAddons({});
      } else {
        // Direct add to cart if simple product
        addSimpleProductToCart(product);
      }
    } catch (err) {
      console.error('Erro ao buscar adicionais e acompanhamentos do produto:', err);
      addSimpleProductToCart(product);
    }
  };

  // Add a simple product (without options/addons/accompaniments) to cart
  const addSimpleProductToCart = (product: Product) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(
        item => item.productId === product.id && !item.selectedAccompaniments && !item.selectedOptions && !item.selectedAddons && !item.notes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          subtotal: current.unitPrice * newQty
        };
        return updated;
      }

      const newItem: PdvCartItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        productNameSnapshot: product.name,
        unitPrice: product.price,
        quantity: 1,
        subtotal: product.price
      };

      return [...prev, newItem];
    });
  };

  // Extract flat lists for accompaniment calculations
  const modalAccGroups = useMemo(() => productAccompaniments.map(g => g.group), [productAccompaniments]);
  const modalAccItems = useMemo(() => productAccompaniments.flatMap(g => g.items), [productAccompaniments]);

  // Real-time accompaniments price calculation in cents
  const modalAccompanimentsPriceCents = useMemo(() => {
    return calculateTotalAccompanimentsPrice(modalAccGroups, modalAccItems, selectedAccompaniments);
  }, [modalAccGroups, modalAccItems, selectedAccompaniments]);

  // Calculate Unit Total for the Modal Item (Base Price + Accompaniments + Choices + Addons)
  const modalUnitTotalCents = useMemo(() => {
    if (!configuringProduct) return 0;
    let total = configuringProduct.price + modalAccompanimentsPriceCents;

    productOptions.forEach(opt => {
      const choiceId = selectedChoices[opt.id];
      if (choiceId) {
        const choice = opt.choices.find(c => c.id === choiceId);
        if (choice) {
          total += choice.additionalPrice || 0;
        }
      }
    });

    productAddons.forEach(add => {
      const qty = selectedAddons[add.id] || 0;
      if (qty > 0) {
        total += (add.price || 0) * qty;
      }
    });

    return total;
  }, [configuringProduct, modalAccompanimentsPriceCents, productOptions, productAddons, selectedChoices, selectedAddons]);

  // Confirm product configuration in Modal and add to Cart
  const handleConfirmAddFromModal = () => {
    if (!configuringProduct) return;

    // Validate accompaniments
    if (modalAccGroups.length > 0) {
      const validation = validateAccompanimentSelections(modalAccGroups, modalAccItems, selectedAccompaniments);
      if (!validation.valid) {
        setModalAccValidationError(validation.errors[0]?.message || 'Verifique as opções obrigatórias.');
        return;
      }
    }
    setModalAccValidationError(null);

    // Build accompaniments snapshot
    const formattedAccompaniments = buildOrderItemAccompaniments(
      modalAccGroups,
      modalAccItems,
      selectedAccompaniments
    );

    // Build options snapshot
    const formattedOptions: OrderItemOption[] = [];
    productOptions.forEach(opt => {
      const choiceId = selectedChoices[opt.id];
      if (choiceId) {
        const choice = opt.choices.find(c => c.id === choiceId);
        if (choice) {
          formattedOptions.push({
            optionId: opt.id,
            optionName: opt.name,
            choiceId: choice.id,
            choiceName: choice.name,
            additionalPrice: choice.additionalPrice || 0
          });
        }
      }
    });

    // Build addons snapshot
    const formattedAddons: OrderItemAddon[] = [];
    productAddons.forEach(add => {
      const qty = selectedAddons[add.id] || 0;
      if (qty > 0) {
        formattedAddons.push({
          addonId: add.id,
          addonName: add.name,
          price: add.price,
          quantity: qty
        });
      }
    });

    const newItem: PdvCartItem = {
      id: crypto.randomUUID(),
      productId: configuringProduct.id,
      productNameSnapshot: configuringProduct.name,
      unitPrice: modalUnitTotalCents,
      quantity: modalQuantity,
      subtotal: modalUnitTotalCents * modalQuantity,
      notes: modalNotes.trim() || undefined,
      selectedAccompaniments: formattedAccompaniments.length > 0 ? formattedAccompaniments : undefined,
      selectedOptions: formattedOptions.length > 0 ? formattedOptions : undefined,
      selectedAddons: formattedAddons.length > 0 ? formattedAddons : undefined
    };

    setCartItems(prev => [...prev, newItem]);
    setConfiguringProduct(null);
  };

  // Cart Adjustments
  const handleUpdateItemQuantity = (cartItemId: string, delta: number) => {
    setCartItems(prev => {
      return prev
        .map(item => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: item.unitPrice * newQty
            };
          }
          return item;
        })
        .filter(Boolean) as PdvCartItem[];
    });
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setDiscountText('');
    setReceivedAmountText('');
    setOrderNotes('');
    setCustomerName('');
    setCustomerPhone('');
    setErrorMessage(null);
  };

  // Totals Calculations in CENTS
  const cartSubtotalCents = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cartItems]);

  const discountCents = useMemo(() => {
    if (!discountText) return 0;
    const parsed = parseBRLToCents(discountText);
    return Math.min(parsed, cartSubtotalCents);
  }, [discountText, cartSubtotalCents]);

  const cartTotalCents = useMemo(() => {
    return Math.max(0, cartSubtotalCents - discountCents);
  }, [cartSubtotalCents, discountCents]);

  // Cash Payment & Change Calculations in CENTS
  const receivedAmountCents = useMemo(() => {
    if (paymentMethod !== 'CASH' || !receivedAmountText) return 0;
    return parseBRLToCents(receivedAmountText);
  }, [paymentMethod, receivedAmountText]);

  const changeForCents = useMemo(() => {
    if (paymentMethod !== 'CASH') return 0;
    return Math.max(0, receivedAmountCents - cartTotalCents);
  }, [paymentMethod, receivedAmountCents, cartTotalCents]);

  const isCashInsufficient = useMemo(() => {
    if (paymentMethod !== 'CASH') return false;
    if (!receivedAmountText) return true; // Needs value
    return receivedAmountCents < cartTotalCents;
  }, [paymentMethod, receivedAmountText, receivedAmountCents, cartTotalCents]);

  // CREATE ORDER HANDLER WITH IDEMPOTENCY AND LOCAL VALIDATION
  const handleCreateOrder = async () => {
    if (submitting) return; // Prevent double submit
    setErrorMessage(null);

    // 1. Basic Validations
    if (cartItems.length === 0) {
      setErrorMessage('Adicione pelo menos um produto ao pedido.');
      return;
    }

    if (paymentMethod === 'CASH' && isCashInsufficient) {
      setErrorMessage(
        `O valor recebido em dinheiro (${formatCentsToBRL(receivedAmountCents)}) é inferior ao total do pedido (${formatCentsToBRL(cartTotalCents)}).`
      );
      return;
    }

    setSubmitting(true);

    try {
      // 2. Validate current availability of items in IndexedDB
      const freshProducts = await productsRepository.getAll();
      const freshProductMap = new Map(freshProducts.map(p => [p.id, p]));

      for (const cartItem of cartItems) {
        const p = freshProductMap.get(cartItem.productId);
        if (!p || !p.active || p.available === false || p.deletedAt) {
          setErrorMessage(`O produto "${cartItem.productNameSnapshot}" não está mais disponível para venda.`);
          setSubmitting(false);
          return;
        }
      }

      // 3. Device Identification
      const deviceId = await getOrRegisterDeviceId();
      const now = new Date().toISOString();

      // 4. Build OrderItems array with snapshots
      const orderItems: OrderItem[] = cartItems.map(item => ({
        id: crypto.randomUUID(),
        orderId: '',
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        notes: item.notes,
        status: 'PENDING',
        selectedAccompaniments: item.selectedAccompaniments,
        selectedOptions: item.selectedOptions,
        selectedAddons: item.selectedAddons,
        createdAt: now,
        updatedAt: now
      }));

      // 5. Build Order Entity
      const orderData: Omit<Order, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'> = {
        orderNumber: Math.floor(Math.random() * 9000) + 1000,
        companyId: 'comp-1',
        deviceId,
        origin: 'COUNTER', // COUNTER origin for PDV / Balcão
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod,
        fulfillmentType: 'PICKUP', // Counter / Pickup
        subtotal: cartSubtotalCents,
        discount: discountCents,
        serviceFee: 0,
        deliveryFee: 0,
        total: cartTotalCents,
        changeFor: paymentMethod === 'CASH' ? changeForCents : undefined,
        notes: orderNotes.trim() || undefined,
        items: orderItems,
        customerSnapshot: {
          name: customerName.trim() || 'Consumidor não identificado',
          phone: customerPhone.trim() || undefined
        }
      };

      // 6. Persist in IndexedDB, generate localId YML-XXXX, sync Queue & KDS
      const createdOrder = await ordersRepository.create(orderData);

      // 7. Show Success Modal & Reset Cart
      setCompletedOrder(createdOrder);
      setCompletedOrderChangeFor(paymentMethod === 'CASH' ? changeForCents : 0);

      // Reset Form State
      setCartItems([]);
      setDiscountText('');
      setReceivedAmountText('');
      setOrderNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setPendingQueueCount(prev => prev + 1);
    } catch (err) {
      console.error('Erro ao registrar pedido no PDV:', err);
      setErrorMessage('Falha ao registrar pedido localmente. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* PAGE HEADER */}
      <PageHeader
        title="PDV — Caixa e Balcão"
        description="Frente de caixa ágil para atendimento e emissão de pedidos no balcão."
        id="pdv-header"
      />

      {/* LOCAL STORAGE & NETWORK BANNER */}
      <div id="pdv-notice-banner" className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <CloudOff className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-bold text-slate-800">Operação Local-First (IndexedDB)</span>
          <span className="text-slate-500 hidden sm:inline">• Registre vendas diretamente no balcão sem depender de sinal de internet.</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold text-[11px] ${
            isOnline ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isOnline ? 'Conectado' : 'Modo Offline'}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-white font-bold text-[11px] text-slate-700">
            <FileText className="w-3 h-3 text-slate-400" />
            Fila Local: <strong className="text-slate-900">{pendingQueueCount}</strong>
          </span>
        </div>
      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CATALOG (CATEGORIES & PRODUCTS) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          {/* CATEGORIES BAR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
            <button
              id="cat-filter-all"
              onClick={() => setSelectedCategoryId('ALL')}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-1.5 ${
                selectedCategoryId === 'ALL'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              🔥 Todos os Produtos
            </button>

            {categories.map(cat => (
              <button
                key={cat.id}
                id={`cat-filter-${cat.id}`}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-1.5 ${
                  selectedCategoryId === cat.id
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="pdv-product-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, SKU ou ingrediente do produto..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded"
              >
                Limpar
              </button>
            )}
          </div>

          {/* PRODUCTS GRID */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span>Carregando produtos do banco local...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200 rounded-xl text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Nenhum produto encontrado</p>
              <p className="text-[11px] text-slate-400">Tente buscar por outro termo ou selecione outra categoria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-3">
              {filteredProducts.map(product => {
                return (
                  <Card
                    key={product.id}
                    id={`pdv-product-card-${product.id}`}
                    onClick={() => { void handleSelectProduct(product); }}
                    className="p-3 cursor-pointer hover:border-amber-400 hover:shadow-xs transition-all duration-150 flex flex-col justify-between group min-h-[120px] bg-white border-slate-200"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2">
                          {product.name}
                        </h4>
                        {product.productionStation && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0 uppercase">
                            {product.productionStation === 'KITCHEN'
                              ? 'Cozinha'
                              : product.productionStation === 'BAR'
                              ? 'Bar'
                              : product.productionStation === 'ICE_CREAM'
                              ? 'Sorvetes'
                              : 'Outro'}
                          </span>
                        )}
                      </div>

                      {product.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                      <span className="text-xs font-black text-slate-950">
                        {formatCentsToBRL(product.price)}
                      </span>

                      <div className="w-7 h-7 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 flex items-center justify-center transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CURRENT ORDER CART & CHECKOUT PANEL */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <Card id="pdv-cart-card" className="p-4 bg-white border-slate-200 shadow-xs flex flex-col gap-4">
            {/* CART HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pedido Atual</h3>
                  <span className="text-[10px] font-medium text-slate-500 block">Atendimento de Balcão</span>
                </div>
              </div>

              {cartItems.length > 0 && (
                <button
                  id="pdv-clear-cart-btn"
                  onClick={handleClearCart}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
            </div>

            {/* CART ITEMS LIST */}
            {cartItems.length === 0 ? (
              <div className="py-10 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <ShoppingBag className="w-8 h-8 text-slate-200" />
                <p className="text-xs font-bold text-slate-600">Nenhum produto no pedido</p>
                <p className="text-[11px] text-slate-400 max-w-[200px]">
                  Clique nos produtos do catálogo ao lado para adicionar ao pedido.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1 divide-y divide-slate-100">
                {cartItems.map(item => (
                  <div key={item.id} id={`pdv-cart-item-${item.id}`} className="pt-2.5 first:pt-0 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 leading-tight">
                          {item.productNameSnapshot}
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Un: {formatCentsToBRL(item.unitPrice)}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-950 shrink-0">
                        {formatCentsToBRL(item.subtotal)}
                      </span>
                    </div>

                    {/* Options & Addons Snapshot badges */}
                    {(item.selectedOptions || item.selectedAddons || item.notes) && (
                      <div className="flex flex-wrap gap-1 text-[10px] text-slate-500 my-0.5">
                        {item.selectedOptions?.map((opt, idx) => (
                          <span key={idx} className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                            {opt.choiceName}
                          </span>
                        ))}
                        {item.selectedAddons?.map((add, idx) => (
                          <span key={idx} className="bg-amber-50 px-1.5 py-0.2 rounded text-amber-800 border border-amber-200">
                            +{add.addonName} ({formatCentsToBRL(add.price)})
                          </span>
                        ))}
                        {item.notes && (
                          <span className="italic text-slate-500">Obs: {item.notes}</span>
                        )}
                      </div>
                    )}

                    {/* Quantity Controls & Delete */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                        <button
                          onClick={() => handleUpdateItemQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-900 w-6 text-center select-none">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateItemQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CUSTOMER IDENTIFICATION (OPTIONAL) */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Identificação do Cliente (Opcional)
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="pdv-customer-name"
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="pdv-customer-phone"
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Telefone / Whats"
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* DISCOUNT & ORDER NOTES (OPTIONAL) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="pdv-discount-input" className="text-[11px] font-bold text-slate-500 block mb-1">
                  Desconto (R$)
                </label>
                <div className="relative">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    id="pdv-discount-input"
                    type="text"
                    value={discountText}
                    onChange={e => setDiscountText(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pdv-order-notes" className="text-[11px] font-bold text-slate-500 block mb-1">
                  Observação
                </label>
                <input
                  id="pdv-order-notes"
                  type="text"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Ex: Viagem / Para levar"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-amber-500"
                />
              </div>
            </div>

            {/* PAYMENT METHOD SELECTOR */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Forma de Pagamento
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'PIX', label: 'PIX', icon: QrCode },
                  { id: 'CREDIT_CARD', label: 'Crédito', icon: CreditCard },
                  { id: 'DEBIT_CARD', label: 'Débito', icon: Wallet },
                  { id: 'CASH', label: 'Dinheiro', icon: DollarSign },
                ].map(method => {
                  const IconComp = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      id={`pdv-pay-${method.id}`}
                      onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {/* CASH PAYMENT & CHANGE CALCULATION */}
              {paymentMethod === 'CASH' && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col gap-2 mt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="pdv-received-amount" className="text-xs font-bold text-amber-950">
                      Valor Recebido (R$):
                    </label>
                    <input
                      id="pdv-received-amount"
                      type="text"
                      value={receivedAmountText}
                      onChange={e => setReceivedAmountText(e.target.value)}
                      placeholder="0,00"
                      className="w-28 px-2.5 py-1 text-xs font-extrabold text-right bg-white border border-amber-300 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Quick Money Buttons */}
                  <div className="flex gap-1 overflow-x-auto pb-0.5">
                    <button
                      onClick={() => setReceivedAmountText((cartTotalCents / 100).toFixed(2).replace('.', ','))}
                      className="px-2 py-1 text-[10px] font-bold bg-white text-amber-900 border border-amber-200 rounded hover:bg-amber-100 shrink-0"
                    >
                      Exato
                    </button>
                    {[10, 20, 50, 100].map(val => (
                      <button
                        key={val}
                        onClick={() => setReceivedAmountText(`${val},00`)}
                        className="px-2 py-1 text-[10px] font-bold bg-white text-amber-900 border border-amber-200 rounded hover:bg-amber-100 shrink-0"
                      >
                        R$ {val}
                      </button>
                    ))}
                  </div>

                  {/* Troco Result */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/60">
                    <span className="font-bold text-amber-900">Troco a devolver:</span>
                    <span className={`font-black text-sm ${isCashInsufficient ? 'text-red-600' : 'text-emerald-700'}`}>
                      {isCashInsufficient ? 'Insuficiente' : formatCentsToBRL(changeForCents)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ERROR MESSAGE DISPLAY */}
            {errorMessage && (
              <div id="pdv-checkout-error" className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs font-medium text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* FINANCIAL SUMMARY & SUBMIT BUTTON */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">{formatCentsToBRL(cartSubtotalCents)}</span>
                </div>

                {discountCents > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Desconto</span>
                    <span>- {formatCentsToBRL(discountCents)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t border-slate-100">
                  <span>Total do Pedido</span>
                  <span className="text-base text-amber-700">{formatCentsToBRL(cartTotalCents)}</span>
                </div>
              </div>

              <Button
                id="pdv-submit-order-btn"
                onClick={handleCreateOrder}
                disabled={submitting || cartItems.length === 0 || (paymentMethod === 'CASH' && isCashInsufficient)}
                className="w-full mt-2 py-3 text-sm font-extrabold flex items-center justify-center gap-2 min-h-[44px]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Registrando Pedido...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar Pedido ({formatCentsToBRL(cartTotalCents)})
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ITEM OPTIONS / ADDONS CONFIGURATION MODAL */}
      <Dialog
        id="pdv-product-config-dialog"
        isOpen={!!configuringProduct}
        onClose={() => setConfiguringProduct(null)}
        title={configuringProduct ? `Opções de ${configuringProduct.name}` : 'Personalizar Item'}
      >
        {configuringProduct && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-slate-500 leading-relaxed">{configuringProduct.description}</p>
              <p className="text-sm font-black text-slate-900 mt-1">
                Preço Base: {formatCentsToBRL(configuringProduct.price)}
              </p>
            </div>

            {/* ACCOMPANIMENTS */}
            {productAccompaniments.length > 0 && (
              <div className="flex flex-col gap-2">
                <AccompanimentSelector
                  groupsWithItems={productAccompaniments}
                  selectedItems={selectedAccompaniments}
                  onChange={setSelectedAccompaniments}
                />
              </div>
            )}

            {/* OPTIONS */}
            {productOptions.map(opt => (
              <div key={opt.id} className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{opt.name}</span>
                  {opt.required && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                      Obrigatório
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-1 mt-1">
                  {opt.choices.map(choice => {
                    const isSelected = selectedChoices[opt.id] === choice.id;
                    return (
                      <button
                        key={choice.id}
                        onClick={() =>
                          setSelectedChoices(prev => ({ ...prev, [opt.id]: choice.id }))
                        }
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors min-h-[44px] ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{choice.name}</span>
                        <span>
                          {choice.additionalPrice > 0
                            ? `+ ${formatCentsToBRL(choice.additionalPrice)}`
                            : 'Incluso'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ADDONS */}
            {productAddons.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs font-bold text-slate-900 mb-1">Adicionais / Extras</span>
                <div className="grid grid-cols-1 gap-1">
                  {productAddons.map(add => {
                    const qty = selectedAddons[add.id] || 0;
                    return (
                      <div
                        key={add.id}
                        onClick={() =>
                          setSelectedAddons(prev => ({
                            ...prev,
                            [add.id]: qty > 0 ? 0 : 1
                          }))
                        }
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors min-h-[44px] ${
                          qty > 0
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{add.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatCentsToBRL(add.price)}</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            qty > 0 ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300 bg-white'
                          }`}>
                            {qty > 0 ? '✓' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ITEM NOTES */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pdv-modal-item-notes" className="text-xs font-bold text-slate-700">
                Observação do Item
              </label>
              <input
                id="pdv-modal-item-notes"
                type="text"
                value={modalNotes}
                onChange={e => setModalNotes(e.target.value)}
                placeholder="Ex: Sem cebola, molho à parte..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500"
              />
            </div>

            {/* MODAL VALIDATION ERROR */}
            {modalAccValidationError && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-2 text-xs font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{modalAccValidationError}</span>
              </div>
            )}

            {/* QUANTITY & CONFIRM BUTTON */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
                <button
                  onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-white rounded font-bold"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-extrabold">{modalQuantity}</span>
                <button
                  onClick={() => setModalQuantity(q => q + 1)}
                  className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-white rounded font-bold"
                >
                  +
                </button>
              </div>

              <Button
                id="pdv-confirm-modal-item-btn"
                onClick={handleConfirmAddFromModal}
                className="px-4 py-2 text-xs font-extrabold"
              >
                Adicionar ({formatCentsToBRL(modalUnitTotalCents * modalQuantity)})
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ORDER CREATION SUCCESS CONFIRMATION MODAL */}
      <Dialog
        id="pdv-success-dialog"
        isOpen={!!completedOrder}
        onClose={() => setCompletedOrder(null)}
        title="Pedido Registrado com Sucesso!"
      >
        {completedOrder && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código do Pedido</span>
              <h2 className="text-2xl font-black text-slate-950 mt-0.5">{completedOrder.localId}</h2>
              <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-200">
                Origem: Balcão (PDV)
              </span>
            </div>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-col gap-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-900">{completedOrder.customerSnapshot?.name || 'Consumidor não identificado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pagamento:</span>
                <span className="font-bold text-slate-900">
                  {completedOrder.paymentMethod === 'PIX'
                    ? 'PIX'
                    : completedOrder.paymentMethod === 'CREDIT_CARD'
                    ? 'Cartão de Crédito'
                    : completedOrder.paymentMethod === 'DEBIT_CARD'
                    ? 'Cartão de Débito'
                    : 'Dinheiro'}
                </span>
              </div>

              {completedOrderChangeFor > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Troco a devolver:</span>
                  <span>{formatCentsToBRL(completedOrderChangeFor)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-slate-200">
                <span>Total Pago:</span>
                <span className="text-amber-700">{formatCentsToBRL(completedOrder.total)}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              O pedido foi enviado para o monitor da cozinha (KDS) e já pode ser acompanhado na Fila de Pedidos.
            </p>

            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              <Button
                id="pdv-success-new-order-btn"
                variant="outline"
                onClick={() => setCompletedOrder(null)}
                className="w-full text-xs font-bold min-h-[44px]"
              >
                Novo Pedido
              </Button>

              <Button
                id="pdv-success-view-orders-btn"
                onClick={() => {
                  const id = completedOrder.id;
                  setCompletedOrder(null);
                  navigate(`/pedidos/${id}`);
                }}
                className="w-full text-xs font-bold flex items-center justify-center gap-1 min-h-[44px]"
              >
                Ver Pedido <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
