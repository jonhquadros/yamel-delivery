/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import {
  ShoppingBag,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  FileText,
  Truck,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  MapPin,
  CreditCard,
  Store,
  DollarSign,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { useRouter } from '../services/router';
import { cartService, CartState } from '../services/cartService';
import { ordersRepository, productsRepository, customersRepository, getOrRegisterDeviceId } from '../services/storage';
import { Order, OrderItem, PaymentMethod } from '../services/storage/types';
import { formatCentsToBRL, parseBRLToCents } from '../utils/currency';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';

export function PublicCartView() {
  const { navigate } = useRouter();
  const [cart, setCart] = useState<CartState>(cartService.getCart());

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');

  // Address State
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressReference, setAddressReference] = useState('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [changeForText, setChangeForText] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to cart updates
  useEffect(() => {
    const unsubscribe = cartService.subscribe(() => {
      setCart(cartService.getCart());
    });
    return unsubscribe;
  }, []);

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    cartService.updateQuantity(itemId, delta);
  };

  const handleRemoveItem = (itemId: string) => {
    cartService.removeItem(itemId);
  };

  const handleClearCart = () => {
    cartService.clearCart();
  };

  // Delivery Fee calculation
  const currentDeliveryFee = fulfillmentType === 'DELIVERY' ? 700 : 0; // 700 cents = R$ 7,00
  const grandTotal = cart.subtotal + currentDeliveryFee;

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    // 1. Validation
    if (cart.items.length === 0) {
      setErrorMessage('Seu carrinho está vazio.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Por favor, informe o seu Nome Completo.');
      return;
    }

    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setErrorMessage('Por favor, informe um Telefone/WhatsApp válido.');
      return;
    }

    if (fulfillmentType === 'DELIVERY') {
      if (!addressStreet.trim()) {
        setErrorMessage('Por favor, informe o Logradouro / Rua para entrega.');
        return;
      }
      if (!addressNumber.trim()) {
        setErrorMessage('Por favor, informe o Número do endereço.');
        return;
      }
      if (!addressNeighborhood.trim()) {
        setErrorMessage('Por favor, informe o Bairro para entrega.');
        return;
      }
    }

    let changeForCents: number | undefined = undefined;
    if (paymentMethod === 'CASH' && changeForText.trim()) {
      const parsed = parseBRLToCents(changeForText);
      if (parsed < grandTotal) {
        setErrorMessage(`O valor para troco (R$ ${changeForText}) deve ser maior que o total do pedido (${formatCentsToBRL(grandTotal)}).`);
        return;
      }
      changeForCents = parsed;
    }

    setSubmitting(true);

    try {
      // 2. Validate products in IndexedDB to verify availability
      const allActiveProducts = await productsRepository.getAll();
      const activeProductMap = new Map(allActiveProducts.map(p => [p.id, p]));

      for (const cartItem of cart.items) {
        const prod = activeProductMap.get(cartItem.productId);
        if (!prod || !prod.active || prod.available === false) {
          setErrorMessage(`O produto "${cartItem.productNameSnapshot}" não está mais disponível no cardápio.`);
          setSubmitting(false);
          return;
        }
      }

      // 3. Register or load device ID
      const deviceId = await getOrRegisterDeviceId();

      // 4. Construct Order Item Snapshots
      const orderItems: OrderItem[] = cart.items.map(item => ({
        id: crypto.randomUUID(),
        orderId: '',
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        unitPrice: item.unitPriceSnapshot,
        quantity: item.quantity,
        subtotal: item.subtotal,
        notes: item.notes,
        status: 'PENDING',
        selectedOptions: item.selectedOptions?.map(o => ({
          optionId: o.optionId,
          optionName: o.optionName,
          choiceId: o.choiceId,
          choiceName: o.choiceName,
          additionalPrice: o.additionalPrice
        })),
        selectedAddons: item.selectedAddons?.map(a => ({
          addonId: a.addonId,
          addonName: a.addonName,
          price: a.price,
          quantity: a.quantity
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      // 5. Construct Order Entity
      const fullAddressString = fulfillmentType === 'DELIVERY'
        ? `${addressStreet}, ${addressNumber}${addressComplement ? ` (${addressComplement})` : ''} - ${addressNeighborhood}`
        : 'Retirada no Balcão';

      const orderData: Omit<Order, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'deletedAt'> = {
        orderNumber: Math.floor(Math.random() * 9000) + 1000,
        companyId: 'comp-1',
        deviceId,
        origin: 'CATALOG',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod,
        fulfillmentType,
        changeFor: changeForCents,
        subtotal: cart.subtotal,
        discount: 0,
        serviceFee: 0,
        deliveryFee: currentDeliveryFee,
        total: grandTotal,
        notes: orderNotes.trim() || undefined,
        items: orderItems,
        customerSnapshot: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: fullAddressString
        },
        deliverySnapshot: fulfillmentType === 'DELIVERY' ? {
          address: addressStreet.trim(),
          number: addressNumber.trim(),
          complement: addressComplement.trim() || undefined,
          neighborhood: addressNeighborhood.trim(),
          reference: addressReference.trim() || undefined,
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01000-000',
          deliveryFee: currentDeliveryFee,
          status: 'PENDING'
        } : undefined
      };

      // 6. Save Order in IndexedDB & Enqueue Sync Outbox
      const createdOrder = await ordersRepository.create(orderData);

      // 7. Save or update customer record locally for quick lookup
      try {
        await customersRepository.save({
          id: crypto.randomUUID(),
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: fullAddressString,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Silently ignorable customer save note:', err);
      }

      // 8. Clear Cart & Redirect to Order Confirmation/Tracking Page
      cartService.clearCart();
      navigate(`/pedido/${createdOrder.id}`);
    } catch (err) {
      console.error('Erro ao processar criação de pedido:', err);
      setErrorMessage('Ocorreu um erro ao salvar o pedido no dispositivo local. Tente novamente.');
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center px-4">
        <div className="w-20 h-20 bg-amber-50 border border-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mb-4 shadow-xs">
          <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">Seu carrinho está vazio</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
          Navegue pelo nosso cardápio digital e adicione seus hambúrgueres e acompanhamentos favoritos.
        </p>

        <Button id="btn-back-to-catalog" size="md" onClick={() => navigate('/catalogo')} className="gap-2 font-bold">
          <ArrowLeft className="w-4 h-4" /> Ver Catálogo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCheckout} className="flex flex-col gap-6 max-w-4xl mx-auto pb-28 px-2 sm:px-0">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/catalogo')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 transition-colors bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-3xs"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Cardápio
        </button>

        <button
          type="button"
          onClick={handleClearCart}
          className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors"
        >
          Esvaziar Carrinho
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Cart Items & Checkout Form */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Section 1: Cart Items */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              Itens do Pedido ({cart.items.reduce((a, b) => a + b.quantity, 0)})
            </h2>

            <div className="flex flex-col gap-3">
              {cart.items.map((item) => (
                <Card
                  key={item.id}
                  id={`cart-item-${item.id}`}
                  className="p-4 flex flex-col gap-3 border border-slate-200 shadow-2xs"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-extrabold text-slate-950">{item.productNameSnapshot}</h3>
                      <span className="text-xs font-extrabold text-amber-700 mt-0.5">
                        {formatCentsToBRL(item.unitPriceSnapshot)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options & Addons List */}
                  {((item.selectedOptions && item.selectedOptions.length > 0) ||
                    (item.selectedAddons && item.selectedAddons.length > 0)) && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col gap-1">
                      {item.selectedOptions?.map((opt, idx) => (
                        <span key={idx} className="font-medium">
                          • {opt.optionName}: <strong>{opt.choiceName}</strong>
                          {opt.additionalPrice > 0 ? ` (+${formatCentsToBRL(opt.additionalPrice)})` : ''}
                        </span>
                      ))}
                      {item.selectedAddons?.map((add, idx) => (
                        <span key={idx} className="font-medium">
                          • Adicional: <strong>{add.addonName}</strong> ({add.quantity}x) (+{formatCentsToBRL(add.price)})
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-amber-50/50 px-2.5 py-1 rounded border border-amber-100">
                      Obs: "{item.notes}"
                    </p>
                  )}

                  {/* Quantity Controls & Subtotal */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs hover:bg-slate-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs text-slate-900">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-md bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs hover:bg-slate-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-sm font-black text-slate-950">
                      Subtotal: {formatCentsToBRL(item.subtotal)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 2: Dados do Cliente */}
          <Card className="p-5 border border-slate-200 shadow-2xs flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-amber-600" /> Identificação do Cliente
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">
                  Telefone / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                />
              </div>
            </div>
          </Card>

          {/* Section 3: Entrega ou Retirada */}
          <Card className="p-5 border border-slate-200 shadow-2xs flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Truck className="w-4 h-4 text-amber-600" /> Modalidade de Entrega
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType('DELIVERY')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  fulfillmentType === 'DELIVERY'
                    ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Truck className={`w-5 h-5 ${fulfillmentType === 'DELIVERY' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-xs font-extrabold">Entrega em Domicílio</span>
                <span className="text-[10px] text-slate-500">Taxa R$ 7,00</span>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentType('PICKUP')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  fulfillmentType === 'PICKUP'
                    ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Store className={`w-5 h-5 ${fulfillmentType === 'PICKUP' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-xs font-extrabold">Retirada no Balcão</span>
                <span className="text-[10px] text-emerald-600 font-bold">Sem Taxa (Grátis)</span>
              </button>
            </div>

            {/* Address fields when DELIVERY */}
            {fulfillmentType === 'DELIVERY' ? (
              <div className="flex flex-col gap-3 pt-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-800">
                      Rua / Logradouro <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={fulfillmentType === 'DELIVERY'}
                      placeholder="Ex: Av. Paulista"
                      value={addressStreet}
                      onChange={(e) => setAddressStreet(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-800">
                      Número <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={fulfillmentType === 'DELIVERY'}
                      placeholder="1000"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-800">
                      Bairro <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={fulfillmentType === 'DELIVERY'}
                      placeholder="Ex: Bela Vista"
                      value={addressNeighborhood}
                      onChange={(e) => setAddressNeighborhood(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-800">Complemento (opcional)</label>
                    <input
                      type="text"
                      placeholder="Apto 42, Bloco B"
                      value={addressComplement}
                      onChange={(e) => setAddressComplement(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-800">Ponto de Referência (opcional)</label>
                  <input
                    type="text"
                    placeholder="Próximo ao metrô Trianon"
                    value={addressReference}
                    onChange={(e) => setAddressReference(e.target.value)}
                    className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2 leading-relaxed">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Endereço de Retirada:</strong> Av. Paulista, 1000 - Bela Vista, São Paulo - SP. Seu pedido ficará disponível no balcão assim que estiver pronto.
                </span>
              </div>
            )}
          </Card>

          {/* Section 4: Forma de Pagamento */}
          <Card className="p-5 border border-slate-200 shadow-2xs flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-amber-600" /> Forma de Pagamento
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                  paymentMethod === 'PIX'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 text-emerald-600" /> PIX
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" /> Cartão Crédito
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('DEBIT_CARD')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                  paymentMethod === 'DEBIT_CARD'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-purple-600" /> Cartão Débito
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <DollarSign className="w-4 h-4 text-emerald-600" /> Dinheiro
              </button>
            </div>

            {paymentMethod === 'CASH' && (
              <div className="flex flex-col gap-1 pt-1">
                <label className="text-xs font-bold text-slate-800">Troco para quanto?</label>
                <input
                  type="text"
                  placeholder="Ex: 50,00 ou deixe em branco se não precisar de troco"
                  value={changeForText}
                  onChange={(e) => setChangeForText(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-900 bg-white focus:border-amber-500 shadow-2xs"
                />
              </div>
            )}
          </Card>

          {/* Section 5: Observações */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Observações do Pedido
            </label>
            <textarea
              rows={2}
              placeholder="Instruções para a cozinha ou entregador..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-800 bg-white focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary & Checkout Button */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Resumo Financeiro</h2>

          <Card id="cart-summary-card" className="p-5 flex flex-col gap-4 border border-slate-200 sticky top-4">
            <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal dos Produtos</span>
                <span className="font-bold text-slate-900">{formatCentsToBRL(cart.subtotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-400" /> Taxa de Entrega
                </span>
                <span className="font-bold text-slate-900">
                  {currentDeliveryFee > 0 ? formatCentsToBRL(currentDeliveryFee) : 'Grátis'}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-slate-950">Total do Pedido</span>
                <span className="text-xl font-black text-amber-700">{formatCentsToBRL(grandTotal)}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-medium leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Modo Offline Ativo:</strong> Seu pedido é registrado diretamente no IndexedDB do dispositivo e enfileirado no Sync Queue.
              </span>
            </div>

            <Button
              id="btn-submit-order"
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full font-black text-sm py-3.5 bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm"
            >
              {submitting ? 'Gravando Pedido...' : 'Finalizar e Enviar Pedido'}
            </Button>

            {/* Official WhatsApp Support */}
            <WhatsAppButton
              id="cart-whatsapp-btn"
              text="Dúvidas? Falar no WhatsApp"
              phone="559198370095"
              size="sm"
              variant="outline"
            />
          </Card>
        </div>
      </div>
    </form>
  );
}
