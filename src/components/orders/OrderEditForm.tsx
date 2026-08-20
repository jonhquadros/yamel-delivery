/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import {
  User,
  Phone,
  Store,
  Bike,
  MapPin,
  Plus,
  Minus,
  Trash2,
  Undo2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Search,
  Tag,
  PackagePlus,
  FileText,
  X,
  Clock
} from 'lucide-react';
import {
  Order,
  OrderItem,
  Product,
  Category,
  ProductOption,
  ProductAddon,
  OrderItemOption,
  OrderItemAddon,
  PaymentMethod
} from '../../services/storage/types';
import {
  productsRepository,
  categoriesRepository,
  generateLocalId,
  getAccompanimentGroupsForProduct
} from '../../services/storage';
import { AccompanimentSelector } from '../accompaniments/AccompanimentSelector';
import {
  AccompanimentGroupWithItems,
  calculateTotalAccompanimentsPrice,
  validateAccompanimentSelections,
  buildOrderItemAccompaniments
} from '../../services/accompanimentService';
import {
  getOrderEditPermissions,
  calculateOrderFinancials,
  updateOrderDetailsSafely,
  EditOrderPayload,
  EditOrderPermission
} from '../../services/orderService';
import { formatCentsToBRL, parseBRLToCents } from '../../utils/currency';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Dialog } from '../ui/Overlay';

export interface OrderEditFormProps {
  order: Order;
  onCancel: () => void;
  onSaveSuccess: (updatedOrder: Order) => void;
}

export function OrderEditForm({ order, onCancel, onSaveSuccess }: OrderEditFormProps) {
  // 1. Permissões de Domínio
  const permissions: EditOrderPermission = useMemo(() => {
    return getOrderEditPermissions(order);
  }, [order]);

  // 2. Estados temporários de edição do cabeçalho / cliente
  const [customerName, setCustomerName] = useState<string>(order.customerSnapshot?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(order.customerSnapshot?.phone || '');
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>(
    order.fulfillmentType || (order.origin === 'DELIVERY' ? 'DELIVERY' : 'PICKUP')
  );

  // 3. Estados temporários de endereço
  const [addressStreet, setAddressStreet] = useState<string>(order.deliverySnapshot?.address || '');
  const [addressNumber, setAddressNumber] = useState<string>(order.deliverySnapshot?.number || '');
  const [addressComplement, setAddressComplement] = useState<string>(order.deliverySnapshot?.complement || '');
  const [addressNeighborhood, setAddressNeighborhood] = useState<string>(order.deliverySnapshot?.neighborhood || '');
  const [addressReference, setAddressReference] = useState<string>(order.deliverySnapshot?.reference || '');
  const [addressCity, setAddressCity] = useState<string>(order.deliverySnapshot?.city || 'São Paulo');
  const [addressState, setAddressState] = useState<string>(order.deliverySnapshot?.state || 'SP');
  const [addressPostalCode, setAddressPostalCode] = useState<string>(order.deliverySnapshot?.postalCode || '');

  // 4. Estados temporários de itens (preserva cópia profunda dos itens originais)
  const [items, setItems] = useState<OrderItem[]>(() => {
    return (order.items || []).map(item => ({ ...item }));
  });

  // 5. Estados temporários financeiros e de pagamento
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number>(() => {
    if (order.fulfillmentType === 'DELIVERY') {
      return order.deliveryFee || 700; // Padrão R$ 7,00 se não especificado
    }
    return 0;
  });
  const [discountCents, setDiscountCents] = useState<number>(order.discount || 0);
  const [discountInput, setDiscountInput] = useState<string>(
    order.discount ? (order.discount / 100).toFixed(2).replace('.', ',') : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod || 'PIX');
  const [changeForCents, setChangeForCents] = useState<number | undefined>(order.changeFor);
  const [changeForInput, setChangeForInput] = useState<string>(
    order.changeFor ? (order.changeFor / 100).toFixed(2).replace('.', ',') : ''
  );
  const [notes, setNotes] = useState<string>(order.notes || '');

  // 6. Estados de controle de UI e submissão
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 7. Estados do seletor de produtos do catálogo
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productAccompaniments, setProductAccompaniments] = useState<AccompanimentGroupWithItems[]>([]);
  const [selectedAccompaniments, setSelectedAccompaniments] = useState<Record<string, Record<string, number>>>({});
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, { choiceId: string; choiceName: string; price: number }>>({});
  const [selectedAddonsMap, setSelectedAddonsMap] = useState<Record<string, { addon: ProductAddon; quantity: number }>>({});
  const [newProductQuantity, setNewProductQuantity] = useState<number>(1);
  const [newProductNotes, setNewProductNotes] = useState<string>('');

  // Carregar produtos e categorias reais do repositório
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [prods, cats] = await Promise.all([
          productsRepository.getAll(),
          categoriesRepository.getAll()
        ]);
        setCatalogProducts(prods.filter(p => p.active && p.available));
        setCatalogCategories(cats.filter(c => c.active));
      } catch (err) {
        console.error('Erro ao carregar catálogo para edição:', err);
      }
    }
    loadCatalog();
  }, []);

  // Quando abre a seleção de um produto específico, carrega seus acompanhamentos, opções e adicionais
  useEffect(() => {
    if (!selectedProduct) {
      setProductAccompaniments([]);
      setSelectedAccompaniments({});
      setProductOptions([]);
      setProductAddons([]);
      setSelectedOptionsMap({});
      setSelectedAddonsMap({});
      setNewProductQuantity(1);
      setNewProductNotes('');
      return;
    }

    async function loadProductDetails() {
      try {
        const [accGroups, options, addons] = await Promise.all([
          getAccompanimentGroupsForProduct(selectedProduct!.id),
          productsRepository.getOptions(selectedProduct!.id),
          productsRepository.getAddons(selectedProduct!.id)
        ]);

        setProductAccompaniments(accGroups);
        setProductOptions(options);
        setProductAddons(addons);

        // Preenche escolhas iniciais para acompanhamentos obrigatórios de seleção única
        const initialAccs: Record<string, Record<string, number>> = {};
        accGroups.forEach(({ group, items: gItems }) => {
          if (group.required && group.maxSelections === 1 && gItems.length > 0) {
            initialAccs[group.id] = { [gItems[0].id]: 1 };
          }
        });
        setSelectedAccompaniments(initialAccs);

        // Preenche opções obrigatórias com a primeira escolha por padrão
        const initialOpts: Record<string, { choiceId: string; choiceName: string; price: number }> = {};
        for (const opt of options) {
          if (opt.required && opt.choices.length > 0) {
            initialOpts[opt.id] = {
              choiceId: opt.choices[0].id,
              choiceName: opt.choices[0].name,
              price: opt.choices[0].additionalPrice || 0
            };
          }
        }
        setSelectedOptionsMap(initialOpts);
      } catch (err) {
        console.error('Erro ao carregar detalhes do produto:', err);
      }
    }
    loadProductDetails();
  }, [selectedProduct]);

  // Recálculo financeiro dinâmico com o domínio
  const financials = useMemo(() => {
    return calculateOrderFinancials({
      items,
      fulfillmentType,
      deliveryFee: fulfillmentType === 'DELIVERY' ? deliveryFeeCents : 0,
      discount: discountCents,
      serviceFee: order.serviceFee || 0,
      changeFor: paymentMethod === 'CASH' ? changeForCents : undefined,
    });
  }, [items, fulfillmentType, deliveryFeeCents, discountCents, paymentMethod, changeForCents, order.serviceFee]);

  // Manipuladores de Modalidade
  const handleFulfillmentChange = (type: 'DELIVERY' | 'PICKUP') => {
    setFulfillmentType(type);
    if (type === 'PICKUP') {
      setDeliveryFeeCents(0);
    } else {
      setDeliveryFeeCents(order.deliveryFee || 700);
    }
  };

  // Manipuladores de Desconto
  const handleDiscountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDiscountInput(val);
    const parsed = parseBRLToCents(val);
    setDiscountCents(parsed);
  };

  // Manipuladores de Troco
  const handlePaymentMethodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const method = e.target.value as PaymentMethod;
    setPaymentMethod(method);
    if (method !== 'CASH') {
      setChangeForCents(undefined);
      setChangeForInput('');
    }
  };

  const handleChangeForInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChangeForInput(val);
    const parsed = parseBRLToCents(val);
    setChangeForCents(parsed > 0 ? parsed : undefined);
  };

  // Manipulação de Itens
  const handleIncreaseQuantity = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      const singleUnitBase = Math.round(item.subtotal / item.quantity);
      item.quantity += 1;
      item.subtotal = singleUnitBase * item.quantity;
      next[index] = item;
      return next;
    });
  };

  const handleDecreaseQuantity = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      if (item.quantity > 1) {
        const singleUnitBase = Math.round(item.subtotal / item.quantity);
        item.quantity -= 1;
        item.subtotal = singleUnitBase * item.quantity;
        next[index] = item;
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      const item = next[index];

      // Se o item já existia no pedido original, aplicamos soft cancellation
      const existedInOriginal = (order.items || []).some(oi => oi.id === item.id);
      if (existedInOriginal) {
        next[index] = {
          ...item,
          status: 'CANCELLED',
        };
      } else {
        // Se foi adicionado nesta sessão de edição e ainda não foi salvo, podemos remover da lista
        next.splice(index, 1);
      }
      return next;
    });
  };

  const handleRestoreItem = (index: number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        status: 'PENDING',
      };
      return next;
    });
  };

  const handleItemNotesChange = (index: number, newNotes: string) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        notes: newNotes,
      };
      return next;
    });
  };

  // Adição de Produto do Catálogo ao Pedido
  const handleAddProductToOrder = () => {
    if (!selectedProduct) return;

    // 1. Validação de Acompanhamentos
    if (productAccompaniments.length > 0) {
      const validation = validateAccompanimentSelections(productAccompaniments, selectedAccompaniments);
      if (!validation.isValid) {
        const msg = validation.errors[0]?.message || 'Por favor, selecione as opções obrigatórias de acompanhamento.';
        alert(msg);
        return;
      }
    }

    // Calcular preço unitário somando produto + acompanhamentos + opções + adicionais
    const accompanimentsExtraPrice = calculateTotalAccompanimentsPrice(productAccompaniments, selectedAccompaniments);
    let unitPrice = selectedProduct.price + accompanimentsExtraPrice;

    // Snapshot congelado dos acompanhamentos
    const formattedAccompaniments = buildOrderItemAccompaniments(productAccompaniments, selectedAccompaniments);

    const selectedOptionsList: OrderItemOption[] = [];
    Object.keys(selectedOptionsMap).forEach((optionId) => {
      const optChoice = selectedOptionsMap[optionId];
      const optDef = productOptions.find(o => o.id === optionId);
      if (optDef && optChoice) {
        unitPrice += optChoice.price;
        selectedOptionsList.push({
          optionId,
          optionName: optDef.name,
          choiceId: optChoice.choiceId,
          choiceName: optChoice.choiceName,
          additionalPrice: optChoice.price,
        });
      }
    });

    const selectedAddonsList: OrderItemAddon[] = [];
    Object.keys(selectedAddonsMap).forEach((addonId) => {
      const addonEntry = selectedAddonsMap[addonId];
      if (addonEntry && addonEntry.quantity > 0) {
        unitPrice += addonEntry.addon.price * addonEntry.quantity;
        selectedAddonsList.push({
          addonId,
          addonName: addonEntry.addon.name,
          price: addonEntry.addon.price,
          quantity: addonEntry.quantity,
        });
      }
    });

    const totalItemSubtotal = unitPrice * newProductQuantity;

    const newOrderItem: OrderItem = {
      id: generateLocalId(),
      orderId: order.id,
      productId: selectedProduct.id,
      productNameSnapshot: selectedProduct.name,
      unitPrice,
      quantity: newProductQuantity,
      subtotal: totalItemSubtotal,
      status: 'PENDING',
      selectedAccompaniments: formattedAccompaniments.length > 0 ? formattedAccompaniments : undefined,
      selectedOptions: selectedOptionsList.length > 0 ? selectedOptionsList : undefined,
      selectedAddons: selectedAddonsList.length > 0 ? selectedAddonsList : undefined,
      notes: newProductNotes.trim() ? newProductNotes.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setItems(prev => [...prev, newOrderItem]);
    setSelectedProduct(null);
    setIsCatalogOpen(false);
  };

  // Salvar Alterações
  const handleSave = async () => {
    if (saving) return;
    setFormError(null);

    // Validações básicas
    const activeItems = items.filter(i => i.status !== 'CANCELLED');
    if (activeItems.length === 0) {
      setFormError('O pedido deve conter ao menos um item ativo.');
      return;
    }

    if (fulfillmentType === 'DELIVERY') {
      if (!addressStreet.trim()) {
        setFormError('O logradouro/rua é obrigatório para entregas.');
        return;
      }
      if (!addressNumber.trim()) {
        setFormError('O número do endereço é obrigatório para entregas.');
        return;
      }
      if (!addressNeighborhood.trim()) {
        setFormError('O bairro é obrigatório para entregas.');
        return;
      }
    }

    if (paymentMethod === 'CASH' && changeForCents !== undefined && changeForCents > 0) {
      if (changeForCents < financials.total) {
        setFormError(`O valor para troco (${formatCentsToBRL(changeForCents)}) não pode ser menor que o total do pedido (${formatCentsToBRL(financials.total)}).`);
        return;
      }
    }

    try {
      setSaving(true);

      const payload: EditOrderPayload = {
        customerSnapshot: {
          name: customerName.trim() || 'Consumidor',
          phone: customerPhone.trim() || '',
        },
        fulfillmentType,
        deliverySnapshot: fulfillmentType === 'DELIVERY' ? {
          address: addressStreet.trim(),
          number: addressNumber.trim(),
          complement: addressComplement.trim() || undefined,
          neighborhood: addressNeighborhood.trim(),
          reference: addressReference.trim() || undefined,
          city: addressCity.trim() || 'São Paulo',
          state: addressState.trim() || 'SP',
          postalCode: addressPostalCode.trim() || undefined,
          deliveryFee: deliveryFeeCents,
        } : undefined,
        items,
        notes: notes.trim() || undefined,
        paymentMethod,
        changeFor: paymentMethod === 'CASH' ? changeForCents : undefined,
        discount: discountCents,
        deliveryFee: fulfillmentType === 'DELIVERY' ? deliveryFeeCents : 0,
      };

      const updatedOrder = await updateOrderDetailsSafely(order.id, payload);
      onSaveSuccess(updatedOrder);
    } catch (err: any) {
      console.error('Erro ao salvar edição do pedido:', err);
      setFormError(err.message || 'Falha ao salvar as alterações do pedido.');
    } finally {
      setSaving(false);
    }
  };

  // Filtragem dos produtos do catálogo
  const filteredCatalogProducts = useMemo(() => {
    return catalogProducts.filter(product => {
      const matchCategory = selectedCategoryId === 'ALL' || product.categoryId === selectedCategoryId;
      const matchSearch = !productSearch.trim() || 
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(productSearch.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [catalogProducts, selectedCategoryId, productSearch]);

  return (
    <div id="order-edit-form" className="flex flex-col gap-5 py-1 text-slate-900">
      {/* Banner de Permissão / Alerta de Status */}
      {permissions.reason && (
        <div id="edit-permission-alert" className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{permissions.reason}</span>
        </div>
      )}

      {/* Erro de Validação ou Salvamento */}
      {formError && (
        <div id="edit-form-error" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* SEÇÃO 1: DADOS DO CLIENTE */}
      <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-3 shadow-2xs">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <User className="w-3.5 h-3.5 text-slate-500" /> Identificação do Cliente
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="edit-customer-name"
            label="Nome do Cliente"
            placeholder="Nome do cliente"
            value={customerName}
            disabled={!permissions.canEditCustomer || saving}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          <Input
            id="edit-customer-phone"
            label="Telefone / WhatsApp"
            placeholder="(00) 00000-0000"
            value={customerPhone}
            disabled={!permissions.canEditCustomer || saving}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
      </div>

      {/* SEÇÃO 2: ATENDIMENTO / MODALIDADE */}
      <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-3 shadow-2xs">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <Store className="w-3.5 h-3.5 text-slate-500" /> Modalidade de Atendimento
        </h4>

        <div className="flex gap-2">
          <button
            id="btn-mod-delivery"
            type="button"
            disabled={!permissions.canEditFulfillmentType || saving}
            onClick={() => handleFulfillmentChange('DELIVERY')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
              fulfillmentType === 'DELIVERY'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            } disabled:opacity-50`}
          >
            <Bike className="w-4 h-4" /> Entrega em Domicílio
          </button>

          <button
            id="btn-mod-pickup"
            type="button"
            disabled={!permissions.canEditFulfillmentType || saving}
            onClick={() => handleFulfillmentChange('PICKUP')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
              fulfillmentType === 'PICKUP'
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            } disabled:opacity-50`}
          >
            <Store className="w-4 h-4" /> Retirada no Balcão
          </button>
        </div>
      </div>

      {/* SEÇÃO 3: ENDEREÇO DE ENTREGA (Exibido se DELIVERY) */}
      {fulfillmentType === 'DELIVERY' && (
        <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-3 shadow-2xs">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <MapPin className="w-3.5 h-3.5 text-slate-500" /> Endereço de Entrega
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                id="edit-address-street"
                label="Logradouro / Rua *"
                placeholder="Rua, Avenida, Alameda..."
                value={addressStreet}
                disabled={!permissions.canEditAddress || saving}
                onChange={(e) => setAddressStreet(e.target.value)}
              />
            </div>
            <div>
              <Input
                id="edit-address-number"
                label="Número *"
                placeholder="Ex: 120"
                value={addressNumber}
                disabled={!permissions.canEditAddress || saving}
                onChange={(e) => setAddressNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="edit-address-neighborhood"
              label="Bairro *"
              placeholder="Bairro"
              value={addressNeighborhood}
              disabled={!permissions.canEditAddress || saving}
              onChange={(e) => setAddressNeighborhood(e.target.value)}
            />
            <Input
              id="edit-address-complement"
              label="Complemento"
              placeholder="Apto, Bloco, Casa..."
              value={addressComplement}
              disabled={!permissions.canEditAddress || saving}
              onChange={(e) => setAddressComplement(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              id="edit-address-reference"
              label="Ponto de Referência"
              placeholder="Próximo a..."
              value={addressReference}
              disabled={!permissions.canEditAddress || saving}
              onChange={(e) => setAddressReference(e.target.value)}
            />
            <Input
              id="edit-address-city"
              label="Cidade"
              placeholder="Cidade"
              value={addressCity}
              disabled={!permissions.canEditAddress || saving}
              onChange={(e) => setAddressCity(e.target.value)}
            />
            <Input
              id="edit-address-cep"
              label="CEP"
              placeholder="00000-000"
              value={addressPostalCode}
              disabled={!permissions.canEditAddress || saving}
              onChange={(e) => setAddressPostalCode(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* SEÇÃO 4: ITENS DO PEDIDO */}
      <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-500" /> Itens do Pedido ({items.filter(i => i.status !== 'CANCELLED').length})
          </h4>

          {permissions.canAddItems && (
            <button
              id="btn-open-add-product"
              type="button"
              disabled={saving}
              onClick={() => setIsCatalogOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Produto
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-3 text-center">Nenhum item no pedido.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const isCancelled = item.status === 'CANCELLED';

              return (
                <div
                  key={item.id || idx}
                  className={`py-3 flex flex-col gap-1.5 transition-opacity ${
                    isCancelled ? 'opacity-50 bg-slate-50 p-2 rounded-lg my-1' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {item.productNameSnapshot}
                        </span>

                        {isCancelled && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-red-100 text-red-700 border border-red-200">
                            Cancelado
                          </span>
                        )}

                        {item.status === 'PREPARING' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Em Preparo
                          </span>
                        )}

                        {item.status === 'READY' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Pronto
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-500">
                        {formatCentsToBRL(item.unitPrice)} un.
                      </span>

                      {/* Acompanhamentos, Opções e Adicionais selecionados */}
                      {item.selectedAccompaniments && item.selectedAccompaniments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selectedAccompaniments.map((acc, aIdx) => (
                            <span
                              key={aIdx}
                              className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded"
                            >
                              +{acc.quantity}x {acc.itemName || acc.itemNameSnapshot}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {item.selectedOptions.map(opt => `${opt.optionName}: ${opt.choiceName}`).join(', ')}
                        </div>
                      )}
                      {item.selectedAddons && item.selectedAddons.length > 0 && (
                        <div className="text-[10px] text-amber-800 mt-0.5">
                          + {item.selectedAddons.map(ad => `${ad.quantity}x ${ad.addonName}`).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Preço Total do Item e Ações */}
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-xs font-extrabold ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {formatCentsToBRL(item.subtotal)}
                      </span>

                      {!isCancelled ? (
                        <div className="flex items-center gap-1">
                          {permissions.canEditQuantity && (
                            <div className="flex items-center border border-slate-200 rounded-md bg-white">
                              <button
                                type="button"
                                disabled={item.quantity <= 1 || saving}
                                onClick={() => handleDecreaseQuantity(idx)}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded-l disabled:opacity-30"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 text-xs font-bold text-slate-800 min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleIncreaseQuantity(idx)}
                                className="p-1 text-slate-500 hover:bg-slate-100 rounded-r"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {permissions.canRemoveItems && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRestoreItem(idx)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                        >
                          <Undo2 className="w-3 h-3" /> Restaurar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Observação do Item */}
                  {!isCancelled && permissions.canEditNotes && (
                    <input
                      type="text"
                      placeholder="Observação do item (ex: sem cebola)"
                      value={item.notes || ''}
                      disabled={saving}
                      onChange={(e) => handleItemNotesChange(idx, e.target.value)}
                      className="w-full text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:border-amber-500 focus:bg-white transition-colors text-slate-700"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 5: RESUMO FINANCEIRO & PAGAMENTO */}
      <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/70 flex flex-col gap-3 shadow-2xs">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200 pb-2">
          <CreditCard className="w-3.5 h-3.5 text-slate-500" /> Financeiro e Pagamento
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Forma de Pagamento
            </label>
            <select
              id="edit-payment-method"
              value={paymentMethod}
              disabled={saving}
              onChange={handlePaymentMethodChange}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
            >
              <option value="PIX">PIX</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
              <option value="CASH">Dinheiro</option>
              <option value="VOUCHER">Vale Refeição</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>

          <div>
            <Input
              id="edit-discount-input"
              label="Desconto (R$)"
              placeholder="0,00"
              value={discountInput}
              disabled={saving}
              onChange={handleDiscountChange}
            />
          </div>
        </div>

        {/* Campo de Troco se DINHEIRO */}
        {paymentMethod === 'CASH' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg">
            <div>
              <Input
                id="edit-change-for-input"
                label="Troco para quanto? (R$)"
                placeholder="Ex: 50,00"
                value={changeForInput}
                disabled={saving}
                onChange={handleChangeForInputChange}
              />
            </div>
            <div className="flex flex-col justify-center text-xs">
              <span className="font-semibold text-slate-600">Troco a devolver:</span>
              <span className={`text-sm font-extrabold ${financials.changeDue !== undefined && financials.changeDue > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                {financials.changeDue !== undefined ? formatCentsToBRL(financials.changeDue) : 'R$ 0,00'}
              </span>
            </div>
          </div>
        )}

        {/* Resumo de Valores */}
        <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs text-slate-600 font-medium">
          <div className="flex justify-between">
            <span>Subtotal dos itens ativos:</span>
            <span className="font-bold text-slate-800">{formatCentsToBRL(financials.subtotal)}</span>
          </div>

          {financials.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Taxa de Entrega:</span>
              <span className="font-bold text-slate-800">{formatCentsToBRL(financials.deliveryFee)}</span>
            </div>
          )}

          {financials.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Desconto Aplicado:</span>
              <span className="font-bold">- {formatCentsToBRL(financials.discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-black text-slate-950 pt-2 border-t border-slate-200">
            <span>Valor Total:</span>
            <span className="text-amber-700">{formatCentsToBRL(financials.total)}</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 6: OBSERVAÇÕES DO PEDIDO */}
      <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex flex-col gap-2 shadow-2xs">
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-500" /> Observações Gerais do Pedido
        </h4>
        <Textarea
          id="edit-order-notes"
          placeholder="Observações do pedido, ponto de referência adicional ou instruções para a cozinha..."
          value={notes}
          disabled={!permissions.canEditNotes || saving}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* BOTÕES DE AÇÃO: CANCELAR OU SALVAR */}
      <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
        <Button
          id="btn-cancel-edit"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
          className="flex-1 py-2.5 text-xs font-bold"
        >
          Cancelar Edição
        </Button>

        <Button
          id="btn-save-edit"
          variant="primary"
          disabled={saving}
          onClick={handleSave}
          className="flex-1 py-2.5 text-xs font-bold shadow-xs"
        >
          {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
        </Button>
      </div>

      {/* MODAL DO SELETOR DE PRODUTOS DO CATÁLOGO */}
      <Dialog
        id="catalog-product-picker-dialog"
        isOpen={isCatalogOpen}
        onClose={() => {
          setIsCatalogOpen(false);
          setSelectedProduct(null);
        }}
        title={selectedProduct ? `Configurar: ${selectedProduct.name}` : "Selecione um Produto do Catálogo"}
      >
        {!selectedProduct ? (
          <div className="flex flex-col gap-3">
            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar produto por nome..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            {/* Categorias */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('ALL')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-colors ${
                  selectedCategoryId === 'ALL'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {catalogCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-colors ${
                    selectedCategoryId === cat.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Lista de Produtos */}
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
              {filteredCatalogProducts.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Nenhum produto encontrado.</p>
              ) : (
                filteredCatalogProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedProduct(prod)}
                    className="py-2.5 px-2 hover:bg-amber-50/60 rounded-lg cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                      {prod.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1">{prod.description}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-amber-700">
                        {formatCentsToBRL(prod.price)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Customização do Produto Selecionado */
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <div>
                <span className="text-xs font-extrabold text-slate-900">{selectedProduct.name}</span>
                <p className="text-[11px] text-slate-500">{selectedProduct.description}</p>
              </div>
              <span className="text-sm font-black text-amber-700">
                {formatCentsToBRL(selectedProduct.price)}
              </span>
            </div>

            {/* Acompanhamentos por Categoria / Resolução Central */}
            {productAccompaniments.length > 0 && (
              <div className="flex flex-col gap-2">
                <AccompanimentSelector
                  groupsWithItems={productAccompaniments}
                  selectedItems={selectedAccompaniments}
                  onChange={setSelectedAccompaniments}
                />
              </div>
            )}

            {/* Opções do Produto (Ex: Ponto da Carne, Tamanho) */}
            {productOptions.map(opt => (
              <div key={opt.id} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {opt.name} {opt.required && <span className="text-red-500">*</span>}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {opt.choices.map(choice => {
                    const isSelected = selectedOptionsMap[opt.id]?.choiceId === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => {
                          setSelectedOptionsMap(prev => ({
                            ...prev,
                            [opt.id]: {
                              choiceId: choice.id,
                              choiceName: choice.name,
                              price: choice.additionalPrice || 0
                            }
                          }));
                        }}
                        className={`p-2 text-xs font-medium rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>{choice.name}</div>
                        {choice.additionalPrice > 0 && (
                          <div className="text-[10px] text-amber-700">+{formatCentsToBRL(choice.additionalPrice)}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Adicionais do Produto (Ex: Bacon, Queijo Extra) */}
            {productAddons.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Adicionais</label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                  {productAddons.map(addon => {
                    const qty = selectedAddonsMap[addon.id]?.quantity || 0;
                    return (
                      <div key={addon.id} className="py-1.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-slate-800">{addon.name}</span>
                          <span className="text-slate-500 text-[11px] ml-1.5">+{formatCentsToBRL(addon.price)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={qty === 0}
                            onClick={() => {
                              setSelectedAddonsMap(prev => ({
                                ...prev,
                                [addon.id]: { addon, quantity: Math.max(0, qty - 1) }
                              }));
                            }}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-30"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold min-w-[16px] text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAddonsMap(prev => ({
                                ...prev,
                                [addon.id]: { addon, quantity: qty + 1 }
                              }));
                            }}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observações do Item */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Observações deste item
              </label>
              <input
                type="text"
                placeholder="Ex: sem molho, bem assado..."
                value={newProductNotes}
                onChange={(e) => setNewProductNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500"
              />
            </div>

            {/* Quantidade e Botão Adicionar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                <button
                  type="button"
                  disabled={newProductQuantity <= 1}
                  onClick={() => setNewProductQuantity(q => Math.max(1, q - 1))}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-l disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 text-xs font-bold text-slate-800">
                  {newProductQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setNewProductQuantity(q => q + 1)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-r"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                >
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddProductToOrder}
                >
                  Adicionar ao Pedido
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
