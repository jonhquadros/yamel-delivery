/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  Sparkles,
  Layers,
  FolderOpen,
  Tag,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  ListPlus,
  SlidersHorizontal,
  CheckCircle2,
  Package,
  Info,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import {
  accompanimentGroupsRepository,
  accompanimentItemsRepository,
  productsRepository,
  categoriesRepository
} from '../services/storage';
import {
  AccompanimentGroup,
  AccompanimentItem,
  AccompanimentScope,
  ProductionStationType,
  Product,
  Category
} from '../services/storage/types';
import { formatCentsToBRL, parseBRLToCents } from '../utils/currency';
import { generateLocalId } from '../services/storage';

export function AdminAcompanhamentosView() {
  const [groups, setGroups] = useState<AccompanimentGroup[]>([]);
  const [items, setItems] = useState<AccompanimentItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccompanimentGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupRequired, setGroupRequired] = useState(true);
  const [groupMinSelections, setGroupMinSelections] = useState('1');
  const [groupMaxSelections, setGroupMaxSelections] = useState('1');
  const [groupFreeSelections, setGroupFreeSelections] = useState('0');
  const [groupAllowRepeated, setGroupAllowRepeated] = useState(false);
  const [groupSortOrder, setGroupSortOrder] = useState('1');
  const [groupActive, setGroupActive] = useState(true);
  const [groupIsGlobal, setGroupIsGlobal] = useState(false);
  
  // Category Linker State in Group Modal
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [unlinkWarningMessage, setUnlinkWarningMessage] = useState<string | null>(null);

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccompanimentItem | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPriceBRL, setItemPriceBRL] = useState('0,00');
  const [itemCostBRL, setItemCostBRL] = useState('0,00');
  const [itemMaxQuantity, setItemMaxQuantity] = useState('1');
  const [itemStation, setItemStation] = useState<ProductionStationType>('KITCHEN');
  const [itemSortOrder, setItemSortOrder] = useState('1');
  const [itemActive, setItemActive] = useState(true);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  // Notification Toast Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [grps, itms, prods, cats] = await Promise.all([
        accompanimentGroupsRepository.getAll(),
        accompanimentItemsRepository.getAll(),
        productsRepository.getAll(),
        categoriesRepository.getAll()
      ]);

      setGroups(grps);
      setItems(itms);
      setProducts(prods.filter(p => !p.deletedAt));
      setCategories(cats.filter(c => !c.deletedAt));

      if (grps.length > 0 && !selectedGroupId) {
        setSelectedGroupId(grps[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de acompanhamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get effective category IDs for a group
  const getGroupCategoryIds = (group: AccompanimentGroup): string[] => {
    if (group.categoryIds && group.categoryIds.length > 0) {
      return group.categoryIds;
    }
    if (group.categoryId) {
      return [group.categoryId];
    }
    return [];
  };

  // Helper to calculate reached products dynamically
  const calculateReachedProductsCount = (catIds: string[]): number => {
    if (catIds.length === 0) return 0;
    const catSet = new Set(catIds);
    return products.filter(p => p.active && !p.deletedAt && catSet.has(p.categoryId)).length;
  };

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      // 1. Search term
      const matchSearch =
        !searchTerm ||
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Status filter
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && g.active) ||
        (statusFilter === 'INACTIVE' && !g.active);

      // 3. Category filter
      const groupCats = getGroupCategoryIds(g);
      const matchCategory =
        categoryFilter === 'ALL' ||
        (categoryFilter === 'GLOBAL' && (g.scope === 'GLOBAL' || groupCats.length === 0)) ||
        groupCats.includes(categoryFilter);

      return matchSearch && matchStatus && matchCategory;
    });
  }, [groups, searchTerm, statusFilter, categoryFilter]);

  // Selected Group Details
  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  // Items for Selected Group
  const activeGroupItems = useMemo(() => {
    if (!selectedGroupId) return [];
    return items.filter(i => i.groupId === selectedGroupId && !i.deletedAt);
  }, [items, selectedGroupId]);

  // Modal Computed Reached Products
  const modalReachedProductsCount = useMemo(() => {
    return calculateReachedProductsCount(selectedCategoryIds);
  }, [selectedCategoryIds, products]);

  // Filtered categories in modal
  const filteredModalCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearchQuery]);

  // Open Group Modal (Create or Edit)
  const openGroupModal = (group?: AccompanimentGroup) => {
    setGroupFormError(null);
    setUnlinkWarningMessage(null);
    setCategorySearchQuery('');

    if (group) {
      setEditingGroup(group);
      setGroupName(group.name);
      setGroupDescription(group.description || '');
      setGroupRequired(group.required);
      setGroupMinSelections(String(group.minSelections ?? 0));
      setGroupMaxSelections(String(group.maxSelections ?? 1));
      setGroupFreeSelections(String(group.freeSelections ?? 0));
      setGroupAllowRepeated(group.allowRepeated ?? false);
      setGroupSortOrder(String(group.sortOrder ?? 1));
      setGroupActive(group.active);
      setGroupIsGlobal(group.scope === 'GLOBAL');

      const existingCatIds = getGroupCategoryIds(group);
      setSelectedCategoryIds(existingCatIds);
    } else {
      setEditingGroup(null);
      setGroupName('');
      setGroupDescription('');
      setGroupRequired(true);
      setGroupMinSelections('1');
      setGroupMaxSelections('1');
      setGroupFreeSelections('0');
      setGroupAllowRepeated(false);
      setGroupSortOrder(String(groups.length + 1));
      setGroupActive(true);
      setGroupIsGlobal(false);
      setSelectedCategoryIds([]);
    }
    setIsGroupModalOpen(true);
  };

  // Select all categories in modal
  const handleSelectAllCategories = () => {
    const allCatIds = filteredModalCategories.map(c => c.id);
    const combined = Array.from(new Set([...selectedCategoryIds, ...allCatIds]));
    setSelectedCategoryIds(combined);
  };

  // Clear category selection in modal
  const handleClearCategorySelection = () => {
    setSelectedCategoryIds([]);
  };

  // Toggle single category
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) {
        return prev.filter(id => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  // Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupFormError(null);

    if (!groupName.trim()) {
      setGroupFormError('Nome do grupo é obrigatório.');
      return;
    }

    // Regra FASE 01 / ETAPA 10.2:
    // Se o grupo NÃO for GLOBAL explícito, deve ter ao menos 1 categoria selecionada.
    if (!groupIsGlobal && selectedCategoryIds.length === 0) {
      setGroupFormError("Selecione pelo menos uma categoria ou marque 'Disponível para todas as categorias'.");
      return;
    }

    const minSel = parseInt(groupMinSelections, 10) || 0;
    const maxSel = parseInt(groupMaxSelections, 10) || 0;
    const freeSel = parseInt(groupFreeSelections, 10) || 0;

    if (maxSel > 0 && minSel > maxSel) {
      setGroupFormError('A seleção mínima não pode ser maior do que a seleção máxima.');
      return;
    }

    const now = new Date().toISOString();
    const groupId = editingGroup ? editingGroup.id : generateLocalId();

    // Check if any category was unlinked
    if (editingGroup && !groupIsGlobal) {
      const oldCatIds = getGroupCategoryIds(editingGroup);
      const unlinked = oldCatIds.filter(id => !selectedCategoryIds.includes(id));
      if (unlinked.length > 0) {
        showToast('Este grupo deixará de aparecer para os produtos desta categoria em novos pedidos.');
      }
    }

    const scope: AccompanimentScope = groupIsGlobal ? 'GLOBAL' : 'CATEGORY';
    const catIdsToSave = groupIsGlobal ? [] : selectedCategoryIds;

    const groupToSave: AccompanimentGroup = {
      id: groupId,
      name: groupName.trim(),
      description: groupDescription.trim() || undefined,
      required: groupRequired,
      minSelections: minSel,
      maxSelections: maxSel,
      freeSelections: freeSel,
      allowRepeated: groupAllowRepeated,
      scope,
      categoryIds: catIdsToSave,
      categoryId: catIdsToSave[0] || undefined,
      sortOrder: parseInt(groupSortOrder, 10) || 1,
      active: groupActive,
      createdAt: editingGroup ? editingGroup.createdAt : now,
      updatedAt: now
    };

    try {
      await accompanimentGroupsRepository.save(groupToSave);
      setIsGroupModalOpen(false);
      setSelectedGroupId(groupId);
      await loadData();
      showToast(editingGroup ? 'Grupo atualizado com sucesso!' : 'Novo grupo criado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar grupo de acompanhamento:', err);
      setGroupFormError('Ocorreu um erro ao salvar o grupo.');
    }
  };

  // Toggle Group Active
  const handleToggleGroupActive = async (group: AccompanimentGroup) => {
    try {
      const updated = { ...group, active: !group.active, updatedAt: new Date().toISOString() };
      await accompanimentGroupsRepository.save(updated);
      await loadData();
      showToast(`Grupo "${group.name}" ${updated.active ? 'ativado' : 'desativado'}.`);
    } catch (err) {
      console.error('Erro ao alterar status do grupo:', err);
    }
  };

  // Delete Group (Soft Delete)
  const handleDeleteGroup = async (group: AccompanimentGroup) => {
    if (!window.confirm(`Tem certeza que deseja desativar/excluir o grupo "${group.name}"? Pedidos antigos não serão afetados.`)) {
      return;
    }

    try {
      await accompanimentGroupsRepository.delete(group.id);
      await loadData();
      showToast(`Grupo "${group.name}" removido. Pedidos históricos preservados.`);
    } catch (err) {
      console.error('Erro ao excluir grupo:', err);
    }
  };

  // Open Item Modal
  const openItemModal = (group: AccompanimentGroup, item?: AccompanimentItem) => {
    setItemFormError(null);
    setTargetGroupId(group.id);

    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemDescription(item.description || '');
      setItemPriceBRL(formatCentsToBRL(item.price).replace('R$', '').trim());
      setItemCostBRL(formatCentsToBRL(item.cost || 0).replace('R$', '').trim());
      setItemMaxQuantity(String(item.maxQuantity ?? 1));
      setItemStation(item.productionStation || 'KITCHEN');
      setItemSortOrder(String(item.sortOrder ?? 1));
      setItemActive(item.active);
      setItemAvailable(item.available);
    } else {
      setEditingItem(null);
      setItemName('');
      setItemDescription('');
      setItemPriceBRL('0,00');
      setItemCostBRL('0,00');
      setItemMaxQuantity('1');
      setItemStation('KITCHEN');
      setItemSortOrder(String(items.filter(i => i.groupId === group.id && !i.deletedAt).length + 1));
      setItemActive(true);
      setItemAvailable(true);
    }
    setIsItemModalOpen(true);
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setItemFormError('Nome do acompanhamento é obrigatório.');
      return;
    }

    const priceCents = parseBRLToCents(itemPriceBRL);
    const costCents = parseBRLToCents(itemCostBRL);
    const now = new Date().toISOString();

    const itemToSave: AccompanimentItem = {
      id: editingItem ? editingItem.id : generateLocalId(),
      groupId: targetGroupId,
      name: itemName.trim(),
      description: itemDescription.trim() || undefined,
      price: priceCents,
      cost: costCents > 0 ? costCents : undefined,
      maxQuantity: parseInt(itemMaxQuantity, 10) || 1,
      productionStation: itemStation,
      sortOrder: parseInt(itemSortOrder, 10) || 1,
      active: itemActive,
      available: itemAvailable,
      createdAt: editingItem ? editingItem.createdAt : now,
      updatedAt: now
    };

    try {
      await accompanimentItemsRepository.save(itemToSave);
      setIsItemModalOpen(false);
      await loadData();
      showToast(editingItem ? 'Acompanhamento atualizado!' : 'Acompanhamento adicionado!');
    } catch (err) {
      console.error('Erro ao salvar item de acompanhamento:', err);
      setItemFormError('Ocorreu um erro ao salvar o item.');
    }
  };

  // Toggle Item Active
  const handleToggleItemActive = async (item: AccompanimentItem) => {
    try {
      const updated = { ...item, active: !item.active, updatedAt: new Date().toISOString() };
      await accompanimentItemsRepository.save(updated);
      await loadData();
    } catch (err) {
      console.error('Erro ao alterar status do item:', err);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: AccompanimentItem) => {
    if (!window.confirm(`Tem certeza que deseja remover "${item.name}"?`)) return;
    try {
      await accompanimentItemsRepository.delete(item.id);
      await loadData();
      showToast(`Item "${item.name}" removido.`);
    } catch (err) {
      console.error('Erro ao remover item:', err);
    }
  };

  // Overall Stats
  const totalCategoryLinksCount = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => {
      getGroupCategoryIds(g).forEach(cId => set.add(cId));
    });
    return set.size;
  }, [groups]);

  const totalImpactedProductsCount = useMemo(() => {
    const set = new Set<string>();
    groups.filter(g => g.active).forEach(g => {
      const cIds = getGroupCategoryIds(g);
      products.filter(p => p.active && cIds.includes(p.categoryId)).forEach(p => set.add(p.id));
    });
    return set.size;
  }, [groups, products]);

  return (
    <div className="flex flex-col gap-6" id="admin-acompanhamentos-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs font-extrabold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        id="admin-accompany-header"
        title="Gerenciar Acompanhamentos por Categoria"
        description="Configure grupos de acompanhamento vinculados a categorias. Novos produtos herdam os grupos automaticamente."
        primaryAction={
          <Button
            id="btn-add-accompany-group"
            onClick={() => openGroupModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Grupo
          </Button>
        }
      />

      {/* Overall Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3 bg-white border border-slate-200">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Grupos Cadastrados</span>
            <span className="text-lg font-black text-slate-900">{groups.length}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-white border border-slate-200">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-700">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Categorias Cobertas</span>
            <span className="text-lg font-black text-slate-900">{totalCategoryLinksCount} / {categories.length}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-white border border-slate-200">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700">
            <Package className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Produtos Alcançados</span>
            <span className="text-lg font-black text-slate-900">{totalImpactedProductsCount} produtos</span>
          </div>
        </Card>
      </div>

      {/* Top Filter Bar */}
      <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-3 bg-white border-slate-200">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-medium focus:border-amber-500 bg-slate-50"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Apenas Inativos</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="GLOBAL">Global (Todas)</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Exibindo {filteredGroups.length} {filteredGroups.length === 1 ? 'grupo' : 'grupos'}
        </span>
      </Card>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Groups List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="p-4 flex flex-col gap-3">
            {/* Groups List */}
            <div className="flex flex-col gap-2 max-h-[650px] overflow-y-auto pr-1">
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold">
                  Nenhum grupo de acompanhamento encontrado.
                </div>
              ) : (
                filteredGroups.map(grp => {
                  const grpItemsCount = items.filter(i => i.groupId === grp.id && !i.deletedAt).length;
                  const isSelected = selectedGroupId === grp.id;
                  const groupCatIds = getGroupCategoryIds(grp);
                  const reachedProds = calculateReachedProductsCount(groupCatIds);

                  const linkedCatNames = groupCatIds
                    .map(id => categories.find(c => c.id === id)?.name)
                    .filter(Boolean);

                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroupId(grp.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-black text-slate-900 truncate">{grp.name}</span>
                          {!grp.active && (
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded uppercase">
                              Inativo
                            </span>
                          )}
                        </div>

                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-amber-600 translate-x-1' : 'text-slate-300'}`} />
                      </div>

                      {/* Rule Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className={`font-bold px-2 py-0.5 rounded-md border ${
                          grp.required
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {grp.required ? `Obrigatório (Mín ${grp.minSelections})` : 'Opcional'}
                        </span>

                        <span className="font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                          Máx: {grp.maxSelections || 'Ilimitado'}
                        </span>

                        {grp.freeSelections !== undefined && grp.freeSelections > 0 && (
                          <span className="font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {grp.freeSelections} Grátis
                          </span>
                        )}

                        <span className="font-extrabold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                          {grpItemsCount} {grpItemsCount === 1 ? 'item' : 'itens'}
                        </span>
                      </div>

                      {/* Category Inheritance Badges */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400 font-bold mr-1">Categorias:</span>
                        {linkedCatNames.length > 0 ? (
                          linkedCatNames.map((cName, idx) => (
                            <span key={idx} className="bg-amber-100/70 text-amber-950 font-bold px-2 py-0.5 rounded-md border border-amber-200/80">
                              {cName}
                            </span>
                          ))
                        ) : (
                          <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                            Global (Todas)
                          </span>
                        )}

                        <span className="ml-auto text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {reachedProds} {reachedProds === 1 ? 'produto' : 'produtos'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Group Details & Items Management */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeGroup ? (
            <Card className="p-6 flex flex-col gap-6">
              {/* Group Header Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{activeGroup.name}</h3>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                      activeGroup.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {activeGroup.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {activeGroup.description && (
                    <p className="text-xs text-slate-500 font-medium">{activeGroup.description}</p>
                  )}

                  {/* Categories Linked Summary */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[11px] font-extrabold text-slate-500">Categorias herdadas:</span>
                    {getGroupCategoryIds(activeGroup).length > 0 ? (
                      getGroupCategoryIds(activeGroup).map(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return (
                          <span key={catId} className="text-[10px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md">
                            {cat?.name || catId}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                        Global (Todas as Categorias)
                      </span>
                    )}

                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md ml-1">
                      {calculateReachedProductsCount(getGroupCategoryIds(activeGroup))} produtos alcançados
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openGroupModal(activeGroup)}
                    className="text-xs font-bold"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Editar Grupo
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openItemModal(activeGroup)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Novo Item
                  </Button>
                </div>
              </div>

              {/* Items List in Active Group */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Acompanhamentos e Adicionais do Grupo ({activeGroupItems.length})
                  </h4>
                </div>

                {activeGroupItems.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center flex flex-col items-center gap-2">
                    <ListPlus className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-bold text-slate-600">Nenhum item cadastrado neste grupo.</span>
                    <Button
                      size="sm"
                      onClick={() => openItemModal(activeGroup)}
                      className="mt-2 bg-amber-600 text-white text-xs font-bold"
                    >
                      Adicionar Primeiro Item
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeGroupItems.map(item => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          !item.active || !item.available
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 shadow-3xs'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-extrabold text-slate-900 truncate">{item.name}</span>
                          {item.description && (
                            <span className="text-[11px] text-slate-500 truncate">{item.description}</span>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-extrabold text-amber-700">
                              {item.price > 0 ? formatCentsToBRL(item.price) : 'Gratuito'}
                            </span>
                            {item.productionStation && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                {item.productionStation === 'KITCHEN' ? '🍳 Cozinha' : item.productionStation === 'BAR' ? '☕ Bar' : '🍦 Sorveteria'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleItemActive(item)}
                            className={`p-1.5 rounded-lg border text-xs ${
                              item.active
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}
                            title={item.active ? 'Inativar Item' : 'Ativar Item'}
                          >
                            {item.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => openItemModal(activeGroup, item)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                            title="Editar Item"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                            title="Excluir Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <Layers className="w-10 h-10 text-slate-300" />
              <span className="text-xs font-bold text-slate-600">Selecione ou crie um grupo para visualizar suas opções.</span>
            </Card>
          )}
        </div>
      </div>

      {/* CREATE / EDIT GROUP MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingGroup ? 'Editar Grupo de Acompanhamento' : 'Criar Grupo de Acompanhamento'}
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGroup} className="p-6 flex flex-col gap-5">
              {groupFormError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{groupFormError}</span>
                </div>
              )}

              {/* Informações Básicas */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Informações</h4>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Nome do Grupo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Escolha seu molho, Ponto da Carne, Turbine seu Lanche..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-semibold focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Descrição / Instrução</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Escolha o molho do seu lanche (1ª opção inclusa gratuitamente)..."
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              {/* Regras de Seleção */}
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Regras de Seleção</h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Mínimo *</label>
                    <input
                      type="number"
                      min="0"
                      value={groupMinSelections}
                      onChange={(e) => setGroupMinSelections(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-bold outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Máximo *</label>
                    <input
                      type="number"
                      min="0"
                      value={groupMaxSelections}
                      onChange={(e) => setGroupMaxSelections(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-bold outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Qtd. Grátis</label>
                    <input
                      type="number"
                      min="0"
                      value={groupFreeSelections}
                      onChange={(e) => setGroupFreeSelections(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={groupRequired}
                      onChange={(e) => setGroupRequired(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">Seleção Obrigatória</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={groupAllowRepeated}
                      onChange={(e) => setGroupAllowRepeated(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">Permitir Repetidos (2x, 3x)</span>
                  </label>
                </div>
              </div>

              {/* Escopo do Grupo */}
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Escopo de Aplicabilidade *</h4>

                <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={groupIsGlobal}
                      onChange={(e) => {
                        const isG = e.target.checked;
                        setGroupIsGlobal(isG);
                        if (isG) {
                          setGroupFormError(null);
                        }
                      }}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span className="text-xs font-black text-amber-950">
                      Disponível para todas as categorias (Grupo Global)
                    </span>
                  </label>
                  <p className="text-[11px] text-amber-800 font-medium leading-normal pl-6">
                    {groupIsGlobal
                      ? "Este grupo estará automaticamente disponível para TODOS os produtos do catálogo (ex: Talheres, Guardanapos)."
                      : "Para restringir este grupo a produtos específicos, mantenha desmarcado e selecione as categorias desejadas abaixo."}
                  </p>
                </div>
              </div>

              {/* Categorias Vinculadas */}
              {!groupIsGlobal && (
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Categorias Vinculadas *</h4>
                      <span className="text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                        Categorias vinculadas: {selectedCategoryIds.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAllCategories}
                        className="text-amber-700 font-bold hover:underline"
                      >
                        Selecionar todas
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleClearCategorySelection}
                        className="text-slate-500 font-bold hover:underline"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  </div>

                {/* Category Search & Multi-select Checkboxes */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar categoria..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none font-medium bg-slate-50"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1.5 bg-slate-50/50">
                    {filteredModalCategories.length === 0 ? (
                      <span className="text-xs text-slate-400 p-2 text-center">Nenhuma categoria encontrada.</span>
                    ) : (
                      filteredModalCategories.map(cat => {
                        const isChecked = selectedCategoryIds.includes(cat.id);
                        const catProdCount = products.filter(p => p.active && p.categoryId === cat.id).length;

                        return (
                          <label
                            key={cat.id}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border select-none ${
                              isChecked
                                ? 'bg-amber-100/60 border-amber-300 text-amber-950 font-bold'
                                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCategory(cat.id)}
                                className="w-4 h-4 accent-amber-600 rounded"
                              />
                              <span className="text-xs">{cat.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                              {catProdCount} {catProdCount === 1 ? 'produto' : 'produtos'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected Category Chips */}
                {selectedCategoryIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {selectedCategoryIds.map(cId => {
                      const cat = categories.find(c => c.id === cId);
                      return (
                        <span
                          key={cId}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300 px-2.5 py-0.5 rounded-lg"
                        >
                          {cat?.name || cId}
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(cId)}
                            className="text-amber-800 hover:text-red-700 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Impact Estimation Callout Box */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-200 rounded-xl flex flex-col gap-2 text-xs text-amber-950">
                  <div className="flex items-center gap-2 font-black text-amber-900">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Visualização do Impacto</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Este grupo será disponibilizado automaticamente para todos os produtos dessas categorias.
                  </p>
                  <div className="flex items-center gap-4 pt-1 font-extrabold text-[11px] text-amber-950">
                    <span>Categorias vinculadas: <strong>{selectedCategoryIds.length} categorias</strong></span>
                    <span>•</span>
                    <span>Produtos alcançados: <strong>{modalReachedProductsCount} produtos</strong></span>
                  </div>
                </div>
              </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsGroupModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  Salvar Grupo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ITEM MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingItem ? 'Editar Acompanhamento' : 'Novo Acompanhamento'}
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 flex flex-col gap-4">
              {itemFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{itemFormError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Nome do Acompanhamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bacon Crocante, Molho Barbecue..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-semibold focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Descrição</label>
                <input
                  type="text"
                  placeholder="Detalhes visíveis no cardápio..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-medium outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Preço Adicional (R$) *</label>
                  <input
                    type="text"
                    required
                    placeholder="3,50"
                    value={itemPriceBRL}
                    onChange={(e) => setItemPriceBRL(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-bold text-slate-900 outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Em centavos: {parseBRLToCents(itemPriceBRL)}¢</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Setor KDS</label>
                  <select
                    value={itemStation}
                    onChange={(e) => setItemStation(e.target.value as ProductionStationType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg font-semibold text-slate-800 outline-none"
                  >
                    <option value="KITCHEN">🍳 Cozinha</option>
                    <option value="BAR">☕ Bar</option>
                    <option value="ICE_CREAM">🍦 Sorveteria</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  Salvar Acompanhamento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
