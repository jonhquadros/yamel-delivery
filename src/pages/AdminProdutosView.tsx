/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent, MouseEvent } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  Star,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  PackageCheck
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import {
  productsRepository,
  categoriesRepository,
  getOrRegisterDeviceId
} from '../services/storage';
import { Product, Category } from '../services/storage/types';
import { formatCentsToBRL, parseBRLToCents } from '../utils/currency';

export function AdminProdutosView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceBRL, setFormPriceBRL] = useState('');
  const [formCostBRL, setFormCostBRL] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrepTime, setFormPrepTime] = useState('15');
  const [formProductionStation, setFormProductionStation] = useState<'KITCHEN' | 'BAR' | 'ICE_CREAM'>('KITCHEN');
  const [formSortOrder, setFormSortOrder] = useState('1');
  const [formActive, setFormActive] = useState(true);
  const [formAvailable, setFormAvailable] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);

  // Form Error
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load Data from IndexedDB
  const loadData = async () => {
    setLoading(true);
    try {
      const devId = await getOrRegisterDeviceId();
      setDeviceId(devId);

      const [prods, cats] = await Promise.all([
        productsRepository.getAll(),
        categoriesRepository.getAll()
      ]);

      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      console.error('Error loading products for admin:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Category
      const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;

      // Status
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.active) ||
        (statusFilter === 'INACTIVE' && !p.active);

      // Availability
      const matchAvail =
        availabilityFilter === 'ALL' ||
        (availabilityFilter === 'AVAILABLE' && p.available) ||
        (availabilityFilter === 'UNAVAILABLE' && !p.available);

      return matchSearch && matchCat && matchStatus && matchAvail;
    });
  }, [products, searchTerm, selectedCategory, statusFilter, availabilityFilter]);

  // Open Modal for Create or Edit
  const openModal = (product?: Product) => {
    setFormError(null);
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormCategoryId(product.categoryId);
      setFormDescription(product.description || '');
      setFormPriceBRL((product.price / 100).toFixed(2).replace('.', ','));
      setFormCostBRL(product.cost ? (product.cost / 100).toFixed(2).replace('.', ',') : '');
      setFormImage(product.image || '');
      setFormSku(product.sku || '');
      setFormPrepTime(product.preparationTime ? String(product.preparationTime) : '15');
      setFormProductionStation(product.productionStation || 'KITCHEN');
      setFormSortOrder(String(product.sortOrder || 1));
      setFormActive(product.active);
      setFormAvailable(product.available);
      setFormFeatured(product.featured);
    } else {
      setEditingProduct(null);
      setFormName('');
      setFormCategoryId(categories[0]?.id || '');
      setFormDescription('');
      setFormPriceBRL('19,90');
      setFormCostBRL('8,50');
      setFormImage('');
      setFormSku('YML-' + Math.floor(100 + Math.random() * 900));
      setFormPrepTime('15');
      setFormProductionStation('KITCHEN');
      setFormSortOrder(String(products.length + 1));
      setFormActive(true);
      setFormAvailable(true);
      setFormFeatured(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormError(null);
  };

  // Form Validation & Save
  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    if (!formName.trim()) {
      setFormError('O nome do produto é obrigatório.');
      return;
    }

    if (!formCategoryId) {
      setFormError('Selecione uma categoria para o produto.');
      return;
    }

    const priceCents = parseBRLToCents(formPriceBRL);
    if (priceCents <= 0) {
      setFormError('O preço de venda deve ser maior que zero (R$ 0,00).');
      return;
    }

    const prepTimeNum = parseInt(formPrepTime, 10);
    if (isNaN(prepTimeNum) || prepTimeNum < 0) {
      setFormError('O tempo de preparo não pode ser negativo.');
      return;
    }

    const sortOrderNum = parseInt(formSortOrder, 10);
    if (isNaN(sortOrderNum) || sortOrderNum < 0) {
      setFormError('A ordem de exibição deve ser um número válido.');
      return;
    }

    const costCents = formCostBRL ? parseBRLToCents(formCostBRL) : 0;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const prodId = editingProduct ? editingProduct.id : 'prod-' + Date.now();
      const localId = editingProduct ? editingProduct.localId : 'L-' + Math.floor(100 + Math.random() * 900);

      const productToSave: Product = {
        id: prodId,
        localId,
        categoryId: formCategoryId,
        name: formName.trim(),
        description: formDescription.trim(),
        image: formImage.trim() || undefined,
        price: priceCents,
        cost: costCents,
        active: formActive,
        available: formAvailable,
        featured: formFeatured,
        sortOrder: sortOrderNum,
        preparationTime: prepTimeNum,
        productionStation: formProductionStation,
        sku: formSku.trim() || undefined,
        createdAt: editingProduct ? editingProduct.createdAt : now,
        updatedAt: now,
        syncStatus: 'PENDING',
        deviceId: deviceId || 'device-local'
      };

      await productsRepository.save(productToSave);
      await loadData();
      closeModal();
    } catch (err) {
      console.error('Failed to save product:', err);
      setFormError('Ocorreu um erro ao salvar o produto no banco local.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Toggle Active
  const handleToggleActive = async (product: Product) => {
    try {
      const updated = { ...product, active: !product.active };
      await productsRepository.save(updated);
      await loadData();
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  // Quick Toggle Availability
  const handleToggleAvailable = async (product: Product) => {
    try {
      const updated = { ...product, available: !product.available };
      await productsRepository.save(updated);
      await loadData();
    } catch (err) {
      console.error('Error toggling available:', err);
    }
  };

  // Soft Delete Product
  const handleDeleteProduct = async (id: string) => {
    try {
      await productsRepository.delete(id, deviceId || 'device-local');
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // Map category ID to name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gestão de Produtos"
        description="Cadastro, alteração de preços e disponibilidade no catálogo digital."
        id="admin-produtos-header"
        primaryAction={
          <Button id="btn-new-product" size="sm" onClick={() => openModal()} className="gap-1.5 font-bold">
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        }
      />

      {/* Filters Bar */}
      <Card id="products-filter-card" className="p-4 bg-white border border-slate-200">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, descrição ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-amber-500 font-medium"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-slate-700"
            >
              <option value="ALL">Todas Categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-slate-700"
            >
              <option value="ALL">Status: Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </select>
          </div>

          {/* Availability Filter */}
          <div className="w-full md:w-40">
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-slate-700"
            >
              <option value="ALL">Disponibilidade</option>
              <option value="AVAILABLE">Disponíveis</option>
              <option value="UNAVAILABLE">Esgotados</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading ? (
        <Card id="loading-card" className="p-12 text-center flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Carregando catálogo do IndexedDB...</p>
        </Card>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <Card id="empty-products-card" className="p-12 text-center flex flex-col items-center justify-center border border-dashed border-slate-200">
          <PackageCheck className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="text-base font-bold text-slate-800">Nenhum produto encontrado</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Não foram encontrados produtos com os filtros selecionados. Tente ajustar a busca ou cadastre um novo item.
          </p>
          <Button id="btn-empty-add" size="sm" onClick={() => openModal()} className="gap-1 font-bold">
            <Plus className="w-4 h-4" /> Cadastrar Produto
          </Button>
        </Card>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const categoryName = categoryMap.get(product.categoryId) || 'Sem Categoria';

            return (
              <Card
                key={product.id}
                id={`product-card-${product.id}`}
                className={`flex flex-col justify-between border transition-all ${
                  !product.active
                    ? 'border-slate-200 bg-slate-50/70 opacity-60'
                    : !product.available
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-slate-200 hover:border-amber-400 bg-white shadow-3xs'
                }`}
              >
                <div className="p-4 flex flex-col gap-3">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        {product.sku || product.localId}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {categoryName}
                      </span>
                      {product.featured && (
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Destaque
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {product.active ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded text-emerald-800 bg-emerald-100 uppercase">
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded text-slate-600 bg-slate-200 uppercase">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="flex gap-3 items-start mt-1">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-2xl font-bold select-none overflow-hidden">
                      {product.image && product.image.startsWith('http') ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        product.image || '🍔'
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-sm font-extrabold text-slate-900 truncate leading-snug">{product.name}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
                        {product.description || 'Sem descrição cadastrada.'}
                      </p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 mt-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Preço</span>
                        <span className="text-sm font-black text-slate-950">{formatCentsToBRL(product.price)}</span>
                      </div>
                      {product.cost ? (
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Custo</span>
                          <span className="text-xs font-bold text-slate-600">{formatCentsToBRL(product.cost)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{product.preparationTime || 15} min</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAvailable(product)}
                      className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                        product.available
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
                      title="Alternar disponibilidade no cardápio"
                    >
                      {product.available ? 'Disponível' : 'Esgotado'}
                    </button>

                    <button
                      onClick={() => handleToggleActive(product)}
                      className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                        product.active
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                      title="Ativar/Desativar produto"
                    >
                      {product.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(product)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Editar Produto"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(product.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir Produto (Soft Delete)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">
                    Nome do Produto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Burger Bacon Supremo"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-semibold focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg outline-none font-semibold text-slate-800 focus:border-amber-500"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 select-none">Descrição do Produto</label>
                <textarea
                  rows={2}
                  placeholder="Ingredientes e detalhes para exibição no cardápio digital..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium focus:border-amber-500"
                />
              </div>

              {/* Price & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">
                    Preço de Venda (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="24,90"
                    value={formPriceBRL}
                    onChange={(e) => setFormPriceBRL(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-bold text-slate-900 focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">
                    Armazenado em centavos: {parseBRLToCents(formPriceBRL)}¢
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Custo Estimado (R$)</label>
                  <input
                    type="text"
                    placeholder="10,00"
                    value={formCostBRL}
                    onChange={(e) => setFormCostBRL(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* SKU, Prep Time, KDS Station, Sort Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Código / SKU</label>
                  <input
                    type="text"
                    placeholder="YML-101"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-mono text-slate-800"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Preparo (Minutos)</label>
                  <input
                    type="number"
                    min="0"
                    value={formPrepTime}
                    onChange={(e) => setFormPrepTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Setor KDS</label>
                  <select
                    value={formProductionStation}
                    onChange={(e) => setFormProductionStation(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg outline-none font-semibold text-slate-800 focus:border-amber-500"
                  >
                    <option value="KITCHEN">🍳 Cozinha</option>
                    <option value="BAR">☕ Bar / Bebidas</option>
                    <option value="ICE_CREAM">🍦 Sorveteria</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Ordem Exibição</label>
                  <input
                    type="number"
                    min="0"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Image / Emoji */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 select-none">Imagem (URL ou Emoji)</label>
                <input
                  type="text"
                  placeholder="Emoji 🍔 ou URL de imagem..."
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium text-slate-800"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span>Produto Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formAvailable}
                    onChange={(e) => setFormAvailable(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span>Em Estoque</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span>Destaque</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100 mt-2">
                <Button id="btn-cancel-product" type="button" variant="outline" size="sm" onClick={closeModal} className="font-bold">
                  Cancelar
                </Button>
                <Button id="btn-save-product" type="submit" size="sm" disabled={isSaving} className="gap-1.5 font-bold">
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Confirmar Exclusão</h4>
                <p className="text-xs text-slate-500">O produto será desativado via Soft Delete no IndexedDB.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta ação removerá o produto do catálogo público e gerará um evento de exclusão na fila de sincronização (Outbox).
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button id="btn-cancel-delete-product" variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} className="font-bold">
                Cancelar
              </Button>
              <Button
                id="btn-confirm-delete-product"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
                onClick={() => handleDeleteProduct(deleteConfirmId)}
              >
                <Trash2 className="w-4 h-4" /> Confirmar Exclusão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
