/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  DollarSign,
  CreditCard,
  QrCode,
  Truck,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Receipt,
  Store,
  Wallet,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Order, PaymentMethod, CashRegister } from '../../services/storage/types';
import { cashRepository } from '../../services/storage';
import { confirmCatalogDeliveryPayment } from '../../services/orderService';
import { formatCentsToBRL, parseBRLToCents } from '../../utils/currency';
import { Dialog } from '../ui/Overlay';
import { Button } from '../ui/Button';

export interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onPaymentConfirmed: (updatedOrder: Order, changeDueCents: number) => Promise<void> | void;
}

export function PaymentConfirmationModal({
  isOpen,
  onClose,
  order,
  onPaymentConfirmed,
}: PaymentConfirmationModalProps) {
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null);
  const [checkingRegister, setCheckingRegister] = useState<boolean>(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('PIX');
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [completeAfter, setCompleteAfter] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    orderLocalId: string;
    totalCents: number;
    paymentMethod: PaymentMethod;
    changeDueCents: number;
  } | null>(null);

  // Carregar caixa aberto e preencher valores iniciais sempre que o modal abre
  useEffect(() => {
    if (isOpen && order) {
      setErrorMessage(null);
      setSuccessInfo(null);
      setSubmitting(false);

      // Predefinir método selecionado a partir do pedido
      const initialMethod = order.paymentMethod || 'PIX';
      setSelectedMethod(initialMethod);

      // Se houver troco solicitado no pedido original
      if (order.changeFor && order.changeFor > 0) {
        setReceivedAmountInput((order.changeFor / 100).toFixed(2).replace('.', ','));
      } else {
        setReceivedAmountInput((order.total / 100).toFixed(2).replace('.', ','));
      }

      // Se o pedido já estiver pronto ou em entrega, sugerir conclusão
      setCompleteAfter(order.status === 'READY' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED');

      // Consultar caixa aberto no IndexedDB
      setCheckingRegister(true);
      cashRepository.getOpenRegister()
        .then(reg => {
          setOpenRegister(reg);
        })
        .catch(err => {
          console.error('Erro ao consultar caixa aberto:', err);
          setOpenRegister(null);
        })
        .finally(() => {
          setCheckingRegister(false);
        });
    }
  }, [isOpen, order]);

  if (!order) return null;

  const totalCents = order.total || 0;

  // Cálculo de troco em tempo real
  const receivedCents = selectedMethod === 'CASH' && receivedAmountInput.trim()
    ? parseBRLToCents(receivedAmountInput)
    : totalCents;

  const changeDueCents = selectedMethod === 'CASH' && receivedCents > totalCents
    ? receivedCents - totalCents
    : 0;

  const isCashInsufficient = selectedMethod === 'CASH' && receivedCents < totalCents;

  const handleConfirm = async () => {
    if (submitting || !order) return;
    setErrorMessage(null);

    if (!openRegister) {
      setErrorMessage('Não é possível confirmar o pagamento porque não existe um Caixa aberto.');
      return;
    }

    if (selectedMethod === 'CASH' && isCashInsufficient) {
      setErrorMessage(`O valor recebido (${formatCentsToBRL(receivedCents)}) não pode ser menor que o total da conta (${formatCentsToBRL(totalCents)}).`);
      return;
    }

    try {
      setSubmitting(true);

      const result = await confirmCatalogDeliveryPayment({
        orderId: order.id,
        paymentMethod: selectedMethod,
        receivedAmountCents: selectedMethod === 'CASH' ? receivedCents : undefined,
        cashierId: openRegister.openedBy || 'usr-1',
        cashierName: openRegister.openedByName || 'Operador de Caixa',
        notes: notes.trim() || undefined,
        completeOrderAfterPayment: completeAfter,
      });

      setSuccessInfo({
        orderLocalId: result.order.localId || `YML-${result.order.orderNumber}`,
        totalCents: result.order.total,
        paymentMethod: selectedMethod,
        changeDueCents: result.changeDueCents,
      });

      // Notificar callback pai
      await onPaymentConfirmed(result.order, result.changeDueCents);
    } catch (err: any) {
      console.error('Erro ao confirmar pagamento na entrega:', err);
      setErrorMessage(err.message || 'Erro inesperado ao registrar o pagamento no Caixa.');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMethodsList: { method: PaymentMethod; label: string; icon: any; hint: string }[] = [
    { method: 'PIX', label: 'PIX', icon: QrCode, hint: 'Transferência instantânea' },
    { method: 'CASH', label: 'Dinheiro', icon: DollarSign, hint: 'Pagamento em espécie' },
    { method: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: CreditCard, hint: 'Maquininha' },
    { method: 'DEBIT_CARD', label: 'Cartão de Débito', icon: CreditCard, hint: 'Maquininha' },
    { method: 'MEAL_VOUCHER', label: 'Vale Refeição', icon: Wallet, hint: 'Alelo, Sodexo, VR' },
    { method: 'OTHER', label: 'Outro', icon: Receipt, hint: 'Outros meios' },
  ];

  return (
    <Dialog
      id="modal-confirm-catalog-delivery-payment"
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirmar Pagamento — Pedido #${order.localId || order.orderNumber}`}
      size="lg"
    >
      <div className="flex flex-col gap-4 text-slate-800">
        {/* TELA DE SUCESSO */}
        {successInfo ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-black text-emerald-950">Pagamento Confirmado com Sucesso!</h3>
              <p className="text-xs text-emerald-800 mt-1">
                A venda foi registrada no Caixa aberto (SALE) e o status do pedido foi atualizado para <strong>PAGO</strong>.
              </p>
            </div>

            <div className="w-full bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Pedido:</span>
                <span className="font-bold text-slate-900">#{successInfo.orderLocalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor Pago:</span>
                <span className="font-extrabold text-slate-950 text-sm">{formatCentsToBRL(successInfo.totalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <span className="font-bold text-emerald-700 uppercase">{successInfo.paymentMethod}</span>
              </div>
              {successInfo.paymentMethod === 'CASH' && (
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Troco Devolvido:</span>
                  <span className="font-bold text-amber-700">{formatCentsToBRL(successInfo.changeDueCents)}</span>
                </div>
              )}
            </div>

            <Button
              id="btn-close-payment-success"
              onClick={onClose}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <>
            {/* STATUS DO CAIXA ABERTO */}
            {checkingRegister ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-slate-400" />
                <span>Verificando status do Caixa Operacional...</span>
              </div>
            ) : openRegister ? (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-emerald-950">Caixa Aberto:</span>
                  <span className="font-semibold text-emerald-800">{openRegister.localId || 'CX-1001'} ({openRegister.openedByName || 'Operador'})</span>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  SALE DIRETA
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-red-950">Nenhum Caixa Aberto no Momento</h4>
                  <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                    Não é possível confirmar o recebimento sem um caixa aberto. Acesse a aba <strong>Caixa</strong> e abra o turno antes de prosseguir.
                  </p>
                </div>
              </div>
            )}

            {/* MENSAGEM DE ERRO */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* CABEÇALHO DO PEDIDO E CLIENTE */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {order.customerSnapshot?.name || order.notes || 'Consumidor'}
                </span>
                <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wide bg-white px-2 py-0.5 rounded border border-slate-200">
                  {order.origin === 'CATALOG' ? '🛍️ Catálogo Online' : order.origin}
                </span>
              </div>

              {order.fulfillmentType && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span>
                    Modalidade: {order.fulfillmentType === 'DELIVERY' ? 'Entrega em Domicílio' : 'Retirada'}
                  </span>
                </div>
              )}

              {order.deliverySnapshot && (
                <div className="text-[11px] text-slate-600 flex items-start gap-1 pt-1 border-t border-slate-200/60">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {order.deliverySnapshot.address}, {order.deliverySnapshot.number} — {order.deliverySnapshot.neighborhood}
                  </span>
                </div>
              )}
            </div>

            {/* RESUMO FINANCEIRO (COM PRESERVAÇÃO DE TAXA DE ENTREGA E DESCONTO) */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 text-xs shadow-2xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal dos Itens:</span>
                <span className="font-semibold">{formatCentsToBRL(order.subtotal || 0)}</span>
              </div>

              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Taxa de Entrega:</span>
                  <span className="font-semibold">{formatCentsToBRL(order.deliveryFee)}</span>
                </div>
              )}

              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Desconto Aplicado:</span>
                  <span>- {formatCentsToBRL(order.discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-950 pt-2 border-t border-slate-100">
                <span>Total a Cobrar / Receber:</span>
                <span className="text-base text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {formatCentsToBRL(totalCents)}
                </span>
              </div>
            </div>

            {/* SELEÇÃO DA FORMA DE PAGAMENTO */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Forma de Pagamento Utilizada na Entrega:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentMethodsList.map(item => {
                  const Icon = item.icon;
                  const isSelected = selectedMethod === item.method;

                  return (
                    <button
                      key={item.method}
                      id={`btn-select-payment-${item.method.toLowerCase()}`}
                      type="button"
                      onClick={() => setSelectedMethod(item.method)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/70 border-amber-500 text-amber-950 ring-1 ring-amber-500 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-700' : 'text-slate-400'}`} />
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                      </div>
                      <span className="text-xs font-extrabold leading-tight">{item.label}</span>
                      <span className="text-[10px] text-slate-400 leading-tight">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DETALHES ESPECÍFICOS PARA DINHEIRO (CASH) */}
            {selectedMethod === 'CASH' && (
              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl flex flex-col gap-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-cash-received" className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                    Valor em Dinheiro Recebido (R$):
                  </label>
                  <span className="text-[10px] text-amber-800 font-semibold">
                    Total: {formatCentsToBRL(totalCents)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      id="input-cash-received"
                      type="text"
                      inputMode="decimal"
                      value={receivedAmountInput}
                      onChange={e => setReceivedAmountInput(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3 py-2 text-xs font-black text-slate-900 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Botão para preencher valor exato */}
                  <button
                    type="button"
                    onClick={() => setReceivedAmountInput((totalCents / 100).toFixed(2).replace('.', ','))}
                    className="px-3 py-2 text-[11px] font-bold text-amber-800 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                  >
                    Exato
                  </button>
                </div>

                {/* Cálculo do Troco */}
                {isCashInsufficient ? (
                  <div className="p-2 bg-red-100/80 border border-red-200 rounded-lg text-[11px] text-red-800 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>Valor recebido insuficiente (Faltam {formatCentsToBRL(totalCents - receivedCents)}).</span>
                  </div>
                ) : changeDueCents > 0 ? (
                  <div className="p-2.5 bg-white border border-amber-300 rounded-lg text-xs flex justify-between items-center">
                    <span className="font-bold text-slate-700">Troco a ser Devolvido:</span>
                    <span className="text-sm font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      {formatCentsToBRL(changeDueCents)}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pagamento com valor exato (Sem troco).</span>
                  </div>
                )}
              </div>
            )}

            {/* OBSERVAÇÃO OPCIONAL */}
            <div className="space-y-1">
              <label htmlFor="input-payment-notes" className="text-[11px] font-bold text-slate-600">
                Observações do Recebimento (Opcional):
              </label>
              <input
                id="input-payment-notes"
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Recebido pelo motoboy Lucas, PIX comprovado..."
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* CHECKBOX DE CONCLUSÃO OPERACIONAL */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
              <input
                id="checkbox-complete-order-after"
                type="checkbox"
                checked={completeAfter}
                onChange={e => setCompleteAfter(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="checkbox-complete-order-after" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Marcar pedido operacionalmente como <strong>CONCLUÍDO / ENTREGUE</strong>
              </label>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              <Button
                id="btn-cancel-confirm-payment"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600"
              >
                Cancelar
              </Button>

              <Button
                id="btn-execute-confirm-payment"
                onClick={handleConfirm}
                disabled={submitting || !openRegister || (selectedMethod === 'CASH' && isCashInsufficient)}
                className="flex-2 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Confirmando no Caixa...'
                    : `Confirmar Recebimento (${formatCentsToBRL(totalCents)})`}
                </span>
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
