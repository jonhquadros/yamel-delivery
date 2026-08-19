/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  ShoppingBag,
  MapPin,
  Phone,
  User,
  CreditCard,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Store
} from 'lucide-react';
import { useRouter } from '../services/router';
import { ordersRepository } from '../services/storage';
import { Order, OrderStatus } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { Card, CardHeader, CardContent } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';

export function PublicOrderTrackerView() {
  const { params, navigate } = useRouter();
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const foundOrder = await ordersRepository.getById(orderId);
        if (isMounted) {
          setOrder(foundOrder);
        }
      } catch (err) {
        console.error('Erro ao carregar pedido do IndexedDB:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    // Auto-refresh order status every 5 seconds if open
    const interval = setInterval(loadOrder, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const handleCopyOrderCode = () => {
    if (order?.localId) {
      navigator.clipboard.writeText(order.localId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const getWhatsAppMessageUrl = () => {
    if (!order) return '';
    const phone = '559198370095'; // Yamel store phone: +55 91 98370-0095

    let msg = `*Olá, gostaria de confirmar o meu pedido no Yamel!*\n\n`;
    msg += `*Pedido:* ${order.localId}\n`;
    msg += `*Cliente:* ${order.customerSnapshot?.name || 'Cliente'}\n`;
    msg += `*Telefone:* ${order.customerSnapshot?.phone || ''}\n`;
    msg += `*Tipo:* ${order.fulfillmentType === 'PICKUP' ? 'Retirada no Balcão' : 'Entrega em Domicílio'}\n`;

    if (order.fulfillmentType === 'DELIVERY' && order.deliverySnapshot) {
      msg += `*Endereço:* ${order.deliverySnapshot.address}, ${order.deliverySnapshot.number}`;
      if (order.deliverySnapshot.complement) msg += ` (${order.deliverySnapshot.complement})`;
      msg += ` - ${order.deliverySnapshot.neighborhood}\n`;
    }

    msg += `\n*Itens do Pedido:*\n`;
    order.items.forEach((item) => {
      msg += `• ${item.quantity}x ${item.productNameSnapshot} - ${formatCentsToBRL(item.subtotal)}\n`;
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        item.selectedOptions.forEach(opt => {
          msg += `  - ${opt.optionName}: ${opt.choiceName}\n`;
        });
      }
      if (item.selectedAddons && item.selectedAddons.length > 0) {
        item.selectedAddons.forEach(add => {
          msg += `  - Adicional: ${add.addonName} (${add.quantity}x)\n`;
        });
      }
    });

    msg += `\n*Subtotal:* ${formatCentsToBRL(order.subtotal)}\n`;
    msg += `*Taxa de Entrega:* ${formatCentsToBRL(order.deliveryFee)}\n`;
    msg += `*Total:* ${formatCentsToBRL(order.total)}\n`;
    msg += `*Forma de Pagamento:* ${getPaymentMethodLabel(order.paymentMethod, order.changeFor)}\n`;

    if (order.notes) {
      msg += `\n*Obs:* ${order.notes}\n`;
    }

    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  function getPaymentMethodLabel(method?: string, changeFor?: number): string {
    switch (method) {
      case 'PIX':
        return 'PIX';
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      case 'DEBIT_CARD':
        return 'Cartão de Débito';
      case 'CASH':
        return changeFor && changeFor > 0
          ? `Dinheiro (Troco para ${formatCentsToBRL(changeFor)})`
          : 'Dinheiro (Sem troco)';
      default:
        return 'A combinar';
    }
  }

  function getStatusBadge(status: OrderStatus) {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Pedido Recebido / Pendente
          </span>
        );
      case 'CONFIRMED':
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
            <Package className="w-3.5 h-3.5" /> Em Preparo na Cozinha
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pronto para Retirada
          </span>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Truck className="w-3.5 h-3.5" /> Saiu para Entrega
          </span>
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pedido Finalizado
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" /> Pedido Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  }

  function renderStatusSteps(status: OrderStatus) {
    const steps = [
      { key: 'PENDING', label: 'Recebido' },
      { key: 'PREPARING', label: 'Em Preparo' },
      { key: 'READY', label: order?.fulfillmentType === 'PICKUP' ? 'Pronto para Retirada' : 'Saiu para Entrega' },
      { key: 'COMPLETED', label: 'Concluído' }
    ];

    const getStepIndex = (st: OrderStatus) => {
      if (st === 'PENDING' || st === 'DRAFT') return 0;
      if (st === 'CONFIRMED' || st === 'PREPARING') return 1;
      if (st === 'READY' || st === 'OUT_FOR_DELIVERY') return 2;
      if (st === 'DELIVERED' || st === 'COMPLETED') return 3;
      return 0;
    };

    const activeIdx = getStepIndex(status);

    return (
      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-2">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <div key={step.key} className="flex flex-col items-center z-10 flex-1 text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-amber-600 text-white shadow-md ring-4 ring-amber-100'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] mt-2 font-bold max-w-[80px] leading-tight ${
                    isCurrent ? 'text-amber-800 font-extrabold' : isCompleted ? 'text-emerald-800' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-600">Buscando detalhes do pedido no banco local...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-900">Pedido não encontrado</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Não foi possível localizar o código do pedido <strong className="text-slate-800">{orderId}</strong> no banco de dados do dispositivo.
        </p>
        <Button size="md" onClick={() => navigate('/catalogo')} className="gap-2 font-bold">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-28 px-2 sm:px-0">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/catalogo')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 transition-colors bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-3xs"
        >
          <ArrowLeft className="w-4 h-4" /> Novo Pedido
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">Status Local:</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            💾 Salvo no IndexedDB
          </span>
        </div>
      </div>

      {/* Main Order Confirmation Hero */}
      <Card className="p-6 border border-slate-200 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-950 tracking-tight">
                Pedido #{order.localId}
              </h1>
              <button
                onClick={handleCopyOrderCode}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                title="Copiar código"
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Realizado em {new Date(order.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>

          <div>{getStatusBadge(order.status)}</div>
        </div>

        {/* Visual Progress Steps */}
        {renderStatusSteps(order.status)}

        {/* Action WhatsApp Button & Explanation */}
        <div className="pt-2 flex flex-col gap-2">
          <a
            href={getWhatsAppMessageUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4 fill-white" /> Enviar Pedido pelo WhatsApp (+55 91 98370-0095)
          </a>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            * O seu pedido <strong>já foi criado e gravado com sucesso</strong>. O envio pelo WhatsApp é opcional e abre uma conversa direta com a loja. Não há confirmação automatizada por API.
          </p>
        </div>
      </Card>

      {/* Order Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Customer & Delivery Data */}
        <Card className="p-4 border border-slate-200 shadow-2xs flex flex-col gap-3">
          <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <User className="w-3.5 h-3.5 text-amber-600" /> Cliente e Entrega
          </h3>

          <div className="flex flex-col gap-2 text-xs text-slate-700">
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Nome:</span>
              <strong className="text-slate-900 font-bold">{order.customerSnapshot?.name || 'Cliente'}</strong>
            </div>

            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Telefone/WhatsApp:</span>
              <strong className="text-slate-900 font-bold">{order.customerSnapshot?.phone || '-'}</strong>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 font-medium block text-[11px]">Modalidade:</span>
              <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-900">
                {order.fulfillmentType === 'PICKUP' ? (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" /> Retirada no Balcão
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-amber-600" /> Entrega em Domicílio
                  </>
                )}
              </div>
            </div>

            {order.fulfillmentType === 'DELIVERY' && order.deliverySnapshot && (
              <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl mt-1 text-[11px] leading-relaxed">
                <span className="font-extrabold text-slate-900 block mb-0.5">Endereço de Entrega:</span>
                <p className="text-slate-700 font-medium">
                  {order.deliverySnapshot.address}, {order.deliverySnapshot.number}
                  {order.deliverySnapshot.complement ? ` (${order.deliverySnapshot.complement})` : ''}
                  <br />
                  {order.deliverySnapshot.neighborhood}
                  {order.deliverySnapshot.reference ? ` — Ref: ${order.deliverySnapshot.reference}` : ''}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Payment & Financial Summary */}
        <Card className="p-4 border border-slate-200 shadow-2xs flex flex-col gap-3">
          <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <CreditCard className="w-3.5 h-3.5 text-amber-600" /> Pagamento e Valores
          </h3>

          <div className="flex flex-col gap-2 text-xs">
            <div>
              <span className="text-slate-400 font-medium block text-[11px]">Forma de Pagamento:</span>
              <strong className="text-slate-900 font-bold">
                {getPaymentMethodLabel(order.paymentMethod, order.changeFor)}
              </strong>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal dos Produtos:</span>
                <span className="font-bold text-slate-900">{formatCentsToBRL(order.subtotal)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Taxa de Entrega:</span>
                <span className="font-bold text-slate-900">{formatCentsToBRL(order.deliveryFee)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-black text-slate-950">Total do Pedido:</span>
                <span className="text-base font-black text-amber-700">{formatCentsToBRL(order.total)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Items List Card */}
      <Card className="p-5 border border-slate-200 shadow-2xs flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" /> Itens do Pedido ({order.items.reduce((a, b) => a + b.quantity, 0)})
        </h3>

        <div className="flex flex-col divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <div className="flex items-baseline gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">{item.productNameSnapshot}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{formatCentsToBRL(item.subtotal)}</span>
              </div>

              {/* Options and Addons */}
              {((item.selectedOptions && item.selectedOptions.length > 0) ||
                (item.selectedAddons && item.selectedAddons.length > 0)) && (
                <div className="ml-7 text-[11px] text-slate-500 flex flex-col gap-0.5">
                  {item.selectedOptions?.map((opt, idx) => (
                    <span key={idx}>
                      • {opt.optionName}: <strong>{opt.choiceName}</strong>
                    </span>
                  ))}
                  {item.selectedAddons?.map((add, idx) => (
                    <span key={idx}>
                      • Adicional: <strong>{add.addonName}</strong> ({add.quantity}x)
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="ml-7 text-[11px] text-slate-500 italic">Obs: "{item.notes}"</p>
              )}
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="mt-2 p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-xs text-slate-700">
            <span className="font-bold text-amber-900 block mb-0.5">Observações do Pedido:</span>
            <p className="italic">{order.notes}</p>
          </div>
        )}
      </Card>

      {/* Footer Back Button */}
      <div className="flex justify-center pt-2">
        <Button id="btn-back-to-menu" size="md" variant="outline" onClick={() => navigate('/catalogo')} className="gap-2 font-bold">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Cardápio Digital
        </Button>
      </div>
    </div>
  );
}
