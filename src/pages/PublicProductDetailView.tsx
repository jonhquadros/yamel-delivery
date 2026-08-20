/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Clock,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Star,
  Check
} from 'lucide-react';
import { useRouter } from '../services/router';
import { productsRepository, categoriesRepository, getAccompanimentGroupsForProduct } from '../services/storage';
import { Product, Category, ProductOption, ProductAddon, AccompanimentGroup, AccompanimentItem } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { cartService, CartItemOption, CartItemAddon } from '../services/cartService';
import {
  validateAccompanimentSelections,
  buildOrderItemAccompaniments,
  calculateTotalAccompanimentsPrice
} from '../services/accompanimentService';
import { AccompanimentSelector, AccompanimentGroupWithItems } from '../components/accompaniments/AccompanimentSelector';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';

export function PublicProductDetailView() {
  const { navigate, params } = useRouter();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [accompanimentGroups, setAccompanimentGroups] = useState<AccompanimentGroupWithItems[]>([]);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);

  // User Selections
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedAccompaniments, setSelectedAccompaniments] = useState<Record<string, Record<string, number>>>({});
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({}); // optionId -> choiceId
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({}); // addonId -> quantity

  const [addedSuccess, setAddedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load product from IndexedDB by ID
  useEffect(() => {
    async function loadProductDetail() {
      if (!productId) return;
      setLoading(true);
      try {
        const prod = await productsRepository.getById(productId);
        if (prod) {
          setProduct(prod);

          const [cat, accGroups, opts, adds] = await Promise.all([
            categoriesRepository.getById(prod.categoryId),
            getAccompanimentGroupsForProduct(prod.id),
            productsRepository.getOptions(prod.id),
            productsRepository.getAddons(prod.id)
          ]);

          setCategory(cat);
          setAccompanimentGroups(accGroups);
          setOptions(opts);
          setAddons(adds);

          // Pre-select first choice for single-choice required accompaniment groups
          const initialAccSelections: Record<string, Record<string, number>> = {};
          accGroups.forEach(({ group, items }) => {
            if (group.required && group.maxSelections === 1 && items.length > 0) {
              initialAccSelections[group.id] = { [items[0].id]: 1 };
            }
          });
          setSelectedAccompaniments(initialAccSelections);

          // Pre-select first choice for legacy required options
          const initialChoices: Record<string, string> = {};
          opts.forEach((opt) => {
            if (opt.required && opt.choices.length > 0) {
              initialChoices[opt.id] = opt.choices[0].id;
            }
          });
          setSelectedChoices(initialChoices);
        }
      } catch (err) {
        console.error('Error loading product detail:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProductDetail();
  }, [productId]);

  // Extract flat lists for service computations
  const allGroups = useMemo(() => accompanimentGroups.map(g => g.group), [accompanimentGroups]);
  const allAccItems = useMemo(() => accompanimentGroups.flatMap(g => g.items), [accompanimentGroups]);

  // Real-time accompaniments price calculation in cents
  const accompanimentsPriceCents = useMemo(() => {
    return calculateTotalAccompanimentsPrice(allGroups, allAccItems, selectedAccompaniments);
  }, [allGroups, allAccItems, selectedAccompaniments]);

  // Calculate Unit Total in Cents (Base Price + Accompaniments + Legacy Choices + Addons)
  const unitTotalCents = useMemo(() => {
    if (!product) return 0;
    let total = product.price + accompanimentsPriceCents;

    // Add legacy option choice additional prices
    options.forEach((opt) => {
      const selectedChoiceId = selectedChoices[opt.id];
      if (selectedChoiceId) {
        const choice = opt.choices.find((c) => c.id === selectedChoiceId);
        if (choice) {
          total += choice.additionalPrice || 0;
        }
      }
    });

    // Add legacy selected addons prices
    addons.forEach((add) => {
      const qty = selectedAddons[add.id] || 0;
      if (qty > 0) {
        total += (add.price || 0) * qty;
      }
    });

    return total;
  }, [product, accompanimentsPriceCents, options, addons, selectedChoices, selectedAddons]);

  const itemTotalCents = useMemo(() => {
    return unitTotalCents * quantity;
  }, [unitTotalCents, quantity]);

  // Validation
  const validationResult = useMemo(() => {
    return validateAccompanimentSelections(allGroups, allAccItems, selectedAccompaniments);
  }, [allGroups, allAccItems, selectedAccompaniments]);

  const handleChoiceSelect = (optionId: string, choiceId: string) => {
    setSelectedChoices((prev) => ({
      ...prev,
      [optionId]: choiceId
    }));
  };

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      return {
        ...prev,
        [addonId]: current > 0 ? 0 : 1
      };
    });
  };

  const handleAddToCart = () => {
    if (!product || !product.available || !product.active) return;

    // Validate accompaniments
    if (!validationResult.valid) {
      setValidationError(validationResult.errors[0]?.message || 'Por favor, verifique as opções obrigatórias selecionadas.');
      return;
    }
    setValidationError(null);

    // Build accompaniments snapshots
    const formattedAccompaniments = buildOrderItemAccompaniments(
      allGroups,
      allAccItems,
      selectedAccompaniments
    );

    // Format selected options snapshot
    const formattedOptions: CartItemOption[] = [];
    options.forEach((opt) => {
      const choiceId = selectedChoices[opt.id];
      if (choiceId) {
        const choice = opt.choices.find((c) => c.id === choiceId);
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

    // Format selected addons snapshot
    const formattedAddons: CartItemAddon[] = [];
    addons.forEach((add) => {
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

    cartService.addItem({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: product.price,
      quantity,
      notes: notes.trim() || undefined,
      selectedAccompaniments: formattedAccompaniments.length > 0 ? formattedAccompaniments : undefined,
      selectedOptions: formattedOptions.length > 0 ? formattedOptions : undefined,
      selectedAddons: formattedAddons.length > 0 ? formattedAddons : undefined
    });

    setAddedSuccess(true);
    setTimeout(() => {
      navigate('/catalogo/carrinho');
    }, 600);
  };

  if (loading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center max-w-xl mx-auto">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Buscando detalhes do produto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-16 text-center flex flex-col items-center justify-center max-w-xl mx-auto">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-bold text-slate-800">Produto não encontrado</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          O produto solicitado pode ter sido desativado ou removido.
        </p>
        <Button id="btn-product-not-found-back" size="sm" onClick={() => navigate('/catalogo')} className="gap-1 font-bold">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Cardápio
        </Button>
      </div>
    );
  }

  const isUnavailable = !product.available || !product.active;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-28">
      {/* Back Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/catalogo')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 transition-colors bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-3xs"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Cardápio
        </button>

        {category && (
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {category.name}
          </span>
        )}
      </div>

      {/* Product Banner & Details Card */}
      <Card id="product-detail-card" className="p-6 flex flex-col gap-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Product Image / Emoji */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-5xl font-bold select-none overflow-hidden shadow-inner">
            {product.image && product.image.startsWith('http') ? (
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              product.image || '🍔'
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {product.featured && (
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Destaque da Casa
                </span>
              )}

              {isUnavailable ? (
                <span className="text-[10px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                  Produto Indisponível
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Disponível para Pedido
                </span>
              )}
            </div>

            <h1 className="text-xl font-black text-slate-900 leading-snug">{product.name}</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {product.description || 'Ingredientes selecionados e preparados no padrão de qualidade Yamel.'}
            </p>

            <div className="flex items-center gap-4 mt-2">
              <span className="text-xl font-black text-slate-950">
                {formatCentsToBRL(product.price)}
              </span>

              {product.preparationTime && (
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> ~{product.preparationTime} min de preparo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Accompaniments Groups */}
        {accompanimentGroups.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-3" id="product-accompaniments-section">
            <AccompanimentSelector
              groupsWithItems={accompanimentGroups}
              selectedItems={selectedAccompaniments}
              onChange={setSelectedAccompaniments}
            />
          </div>
        )}

        {/* Product Options (e.g., Ponto da Carne, Tamanho) */}
        {options.map((opt) => (
          <div key={opt.id} className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{opt.name}</h3>
              {opt.required && (
                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Obrigatório
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {opt.choices.map((choice) => {
                const isSelected = selectedChoices[opt.id] === choice.id;
                return (
                  <label
                    key={choice.id}
                    onClick={() => handleChoiceSelect(opt.id, choice.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 text-slate-950 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold">{choice.name}</span>
                    </div>

                    {choice.additionalPrice > 0 && (
                      <span className="text-xs font-extrabold text-slate-800">
                        +{formatCentsToBRL(choice.additionalPrice)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Product Addons (Adicionais) */}
        {addons.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Adicionais Extras</h3>
            <div className="flex flex-col gap-2 mt-1">
              {addons.map((addon) => {
                const isSelected = (selectedAddons[addon.id] || 0) > 0;
                return (
                  <label
                    key={addon.id}
                    onClick={() => handleToggleAddon(addon.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 text-slate-950 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs font-bold">{addon.name}</span>
                    </div>

                    <span className="text-xs font-extrabold text-slate-800">
                      +{formatCentsToBRL(addon.price)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Observations Input */}
        <div className="pt-4 border-t border-slate-100 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-800 select-none">Observações do Item</label>
          <input
            type="text"
            placeholder="Ex: Sem cebola, molho à parte, bem passado..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl outline-none font-medium text-slate-800 focus:border-amber-500 bg-slate-50/50 focus:bg-white"
          />
        </div>
      </Card>

      {/* Floating Bottom Add Bar */}
      <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40 flex flex-col gap-2">
        {validationError && (
          <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
        <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-200 flex items-center justify-between gap-4">
          {/* Quantity Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isUnavailable}
              className="w-8 h-8 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs disabled:opacity-50 hover:bg-slate-50"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-black text-sm text-slate-900">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              disabled={isUnavailable}
              className="w-8 h-8 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs disabled:opacity-50 hover:bg-slate-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAddToCart}
            disabled={isUnavailable || addedSuccess}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black flex items-center justify-between transition-all shadow-md active:scale-[0.99] ${
              isUnavailable
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : addedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isUnavailable ? (
              <span>Produto Indisponível</span>
            ) : addedSuccess ? (
              <span className="flex items-center gap-1.5 mx-auto">
                <CheckCircle className="w-4 h-4" /> Item Adicionado ao Carrinho!
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" /> Adicionar
                </span>
                <span>{formatCentsToBRL(itemTotalCents)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
