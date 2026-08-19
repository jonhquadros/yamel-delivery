/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, MouseEvent } from 'react';
import {
  Search,
  ShoppingCart,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Check,
  Star
} from 'lucide-react';
import { useRouter } from '../services/router';
import { productsRepository, categoriesRepository } from '../services/storage';
import { Product, Category } from '../services/storage/types';
import { formatCentsToBRL } from '../utils/currency';
import { cartService, CartState } from '../services/cartService';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { Card } from '../components/ui/DataDisplay';

export function PublicCatalogView() {
  const { navigate, params } = useRouter();
  const activeCategoryIdFromUrl = params.id || 'ALL';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(activeCategoryIdFromUrl);

  const [cart, setCart] = useState<CartState>(cartService.getCart());
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  // Sync category state with URL params
  useEffect(() => {
    if (params.id) {
      setSelectedCategory(params.id);
    }
  }, [params.id]);

  // Subscribe to cart updates
  useEffect(() => {
    const unsubscribe = cartService.subscribe(() => {
      setCart(cartService.getCart());
    });
    return unsubscribe;
  }, []);

  // Fetch real catalog from IndexedDB
  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [allProds, allCats] = await Promise.all([
        productsRepository.getAll(),
        categoriesRepository.getAll()
      ]);

      // Filter active and non-deleted categories, sorted by sortOrder
      const activeCats = allCats
        .filter((c) => c.active && !c.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      // Filter active and non-deleted products, sorted by sortOrder
      const activeProds = allProds
        .filter((p) => p.active && !p.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setCategories(activeCats);
      setProducts(activeProds);
    } catch (e) {
      console.error('Error loading digital catalog:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === 'ALL') {
      navigate('/catalogo');
    } else {
      navigate(`/catalogo/categoria/${catId}`);
    }
  };

  const handleQuickAddToCart = (e: MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!product.available || !product.active) return;

    cartService.addItem({
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: product.price,
      quantity: 1,
      notes: ''
    });

    setAddedAnimationId(product.id);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const totalCartCount = useMemo(() => {
    return cart.items.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-24">
      {/* Catalog Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shrink-0 font-extrabold select-none shadow-inner">
            🍔
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Yamel Hamburgueria Gourmet</h2>
            <p className="text-xs text-amber-100 mt-0.5 font-medium">
              Cardápio Digital Oficial • Faça seu pedido online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Atendimento Aberto</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="O que você quer saborear hoje? Pesquise por nome ou ingrediente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl outline-none bg-white focus:border-amber-500 shadow-2xs font-medium text-slate-800"
        />
      </div>

      {/* Category Navigation Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
        <button
          onClick={() => handleCategorySelect('ALL')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl border whitespace-nowrap transition-all ${
            selectedCategory === 'ALL'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          🔥 Cardápio Completo
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl border whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{cat.image || '🍔'}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-16 text-center flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Carregando cardápio digital...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card id="empty-catalog-card" className="p-12 text-center flex flex-col items-center justify-center border border-dashed border-slate-200">
          <span className="text-4xl mb-3">🍔</span>
          <h4 className="text-base font-bold text-slate-800">Nenhum produto disponível</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Não encontramos produtos na categoria selecionada. Tente escolher outra seção do cardápio.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const isUnavailable = !product.available || !product.active;
            const isAdded = addedAnimationId === product.id;

            return (
              <div
                key={product.id}
                onClick={() => navigate(`/catalogo/produto/${product.id}`)}
                className={`group bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between transition-all cursor-pointer shadow-3xs hover:shadow-md hover:border-amber-400 relative overflow-hidden ${
                  isUnavailable ? 'opacity-70 bg-slate-50/50' : ''
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-2">
                    {product.featured ? (
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Destaque
                      </span>
                    ) : <span />}

                    {isUnavailable ? (
                      <span className="text-[10px] font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                        Esgotado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Disponível
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex gap-3 items-start mt-1">
                    <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-3xl font-bold select-none overflow-hidden group-hover:scale-105 transition-transform">
                      {product.image && product.image.startsWith('http') ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        product.image || '🍔'
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug group-hover:text-amber-700 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {product.description || 'Delicioso item preparado com ingredientes selecionados Yamel.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price and Add Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-base font-black text-slate-950">
                      {formatCentsToBRL(product.price)}
                    </span>
                    {product.preparationTime && (
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> ~{product.preparationTime} min
                      </span>
                    )}
                  </div>

                  {isUnavailable ? (
                    <button
                      disabled
                      className="px-3 py-1.5 text-xs font-bold text-slate-400 bg-slate-100 rounded-xl cursor-not-allowed"
                    >
                      Indisponível
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleQuickAddToCart(e, product)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition-all shadow-xs ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Adicionado
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Adicionar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Cart Footer Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40">
          <div
            onClick={() => navigate('/catalogo/carrinho')}
            className="bg-slate-950 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer border border-slate-800 hover:bg-slate-900 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                  {totalCartCount}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block">Ver Carrinho</span>
                <span className="text-base font-black text-white">{formatCentsToBRL(cart.total)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs font-extrabold text-amber-400">
              <span>Avançar para Pedido</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Official Support */}
      <div className="mt-6 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">💬</span>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-900">Dúvidas com seu pedido?</h4>
            <p className="text-xs text-emerald-700 mt-0.5 max-w-xl">
              Entre em contato direto com a equipe Yamel pelo WhatsApp oficial para ajuda no cardápio ou comandas personalizadas.
            </p>
          </div>
        </div>
        <WhatsAppButton id="catalog-whatsapp-btn" text="Atendimento WhatsApp" phone="+55 91 98370-0095" size="md" variant="primary" />
      </div>
    </div>
  );
}
