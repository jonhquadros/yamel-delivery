/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  FolderTree,
  ArrowUpDown
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';
import {
  categoriesRepository,
  productsRepository
} from '../services/storage';
import { Category, Product } from '../services/storage/types';

export function AdminCategoriasView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('1');
  const [formActive, setFormActive] = useState(true);

  // Error state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        categoriesRepository.getAll(),
        productsRepository.getAll()
      ]);

      // Sort categories by sortOrder ascending
      cats.sort((a, b) => a.sortOrder - b.sortOrder);

      setCategories(cats);
      setProducts(prods);
    } catch (e) {
      console.error('Error loading categories:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate product counts per category
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      if (p.categoryId) {
        const current = map.get(p.categoryId) || 0;
        map.set(p.categoryId, current + 1);
      }
    });
    return map;
  }, [products]);

  const openModal = (category?: Category) => {
    setFormError(null);
    if (category) {
      setEditingCategory(category);
      setFormName(category.name);
      setFormDescription(category.description || '');
      setFormImage(category.image || '');
      setFormSortOrder(String(category.sortOrder || 1));
      setFormActive(category.active);
    } else {
      setEditingCategory(null);
      setFormName('');
      setFormDescription('');
      setFormImage('');
      setFormSortOrder(String(categories.length + 1));
      setFormActive(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormError(null);
  };

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('O nome da categoria é obrigatório.');
      return;
    }

    const sortOrderNum = parseInt(formSortOrder, 10);
    if (isNaN(sortOrderNum) || sortOrderNum < 0) {
      setFormError('A ordem deve ser um número válido (maior ou igual a 0).');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const catId = editingCategory ? editingCategory.id : 'cat-' + Date.now();

      const categoryToSave: Category = {
        id: catId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        image: formImage.trim() || undefined,
        sortOrder: sortOrderNum,
        active: formActive,
        createdAt: editingCategory ? editingCategory.createdAt : now,
        updatedAt: now
      };

      await categoriesRepository.save(categoryToSave);
      await loadData();
      closeModal();
    } catch (err) {
      console.error('Failed to save category:', err);
      setFormError('Ocorreu um erro ao salvar a categoria no IndexedDB.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const updated = { ...category, active: !category.active };
      await categoriesRepository.save(updated);
      await loadData();
    } catch (err) {
      console.error('Error toggling category status:', err);
    }
  };

  const handleAttemptDelete = (category: Category) => {
    setDeleteCategory(category);
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategory) return;
    try {
      await categoriesRepository.delete(deleteCategory.id);
      setDeleteCategory(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gestão de Categorias"
        description="Organização das seções de exibição de produtos no cardápio digital."
        id="admin-categorias-header"
        primaryAction={
          <Button id="btn-new-category" size="sm" onClick={() => openModal()} className="gap-1.5 font-bold">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        }
      />

      {loading ? (
        <Card id="loading-categories-card" className="p-12 text-center flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Carregando categorias do IndexedDB...</p>
        </Card>
      ) : categories.length === 0 ? (
        <Card id="empty-categories-card" className="p-12 text-center flex flex-col items-center justify-center border border-dashed border-slate-200">
          <FolderTree className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="text-base font-bold text-slate-800">Nenhuma categoria cadastrada</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Crie categorias para estruturar o cardápio (ex: Hambúrgueres, Bebidas, Sobremesas).
          </p>
          <Button id="btn-empty-add-cat" size="sm" onClick={() => openModal()} className="gap-1 font-bold">
            <Plus className="w-4 h-4" /> Criar Primeira Categoria
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const linkedProductsCount = productCountMap.get(cat.id) || 0;

            return (
              <Card
                key={cat.id}
                id={`cat-card-${cat.id}`}
                className={`flex flex-col justify-between border transition-all ${
                  !cat.active
                    ? 'border-slate-200 bg-slate-50/70 opacity-65'
                    : 'border-slate-200 hover:border-amber-400 bg-white shadow-3xs'
                }`}
              >
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl font-bold text-lg select-none">
                        {cat.image || '📁'}
                      </span>
                      <div className="flex flex-col">
                        <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                          <ArrowUpDown className="w-3 h-3" /> Ordem: #{cat.sortOrder}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${
                        cat.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                    {cat.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px]">
                    {linkedProductsCount} {linkedProductsCount === 1 ? 'produto vinculado' : 'produtos vinculados'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className={`px-2 py-1 text-[10px] font-extrabold rounded transition-colors ${
                        cat.active
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {cat.active ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      onClick={() => openModal(cat)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Editar Categoria"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleAttemptDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir Categoria"
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

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 select-none">
                  Nome da Categoria <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 🍔 Hambúrgueres Artesanais"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-semibold focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 select-none">Descrição Curta</label>
                <textarea
                  rows={2}
                  placeholder="Descrição da seção para exibição no topo da categoria..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium text-slate-800 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Ícone / Emoji / URL</label>
                  <input
                    type="text"
                    placeholder="🍔"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium text-slate-800"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 select-none">Ordem no Cardápio</label>
                  <input
                    type="number"
                    min="0"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-bold text-slate-800"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 pt-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span>Categoria Ativa no Cardápio</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <Button id="btn-cancel-category" type="button" variant="outline" size="sm" onClick={closeModal} className="font-bold">
                  Cancelar
                </Button>
                <Button id="btn-save-category" type="submit" size="sm" disabled={isSaving} className="gap-1.5 font-bold">
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEPENDENCY CHECK MODAL */}
      {deleteCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 flex flex-col gap-4">
            {(productCountMap.get(deleteCategory.id) || 0) > 0 ? (
              /* DEPENDENCY WARNING: Cannot delete because active products are linked */
              <>
                <div className="flex items-center gap-3 text-amber-600">
                  <div className="p-2.5 bg-amber-100 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Não é possível excluir</h4>
                    <p className="text-xs text-amber-800 font-semibold">Categoria com produtos vinculados</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                  A categoria <strong>"{deleteCategory.name}"</strong> possui{' '}
                  <span className="font-bold text-amber-900">
                    {productCountMap.get(deleteCategory.id)} produto(s) ativo(s)
                  </span>{' '}
                  vinculado(s). Remova ou altere a categoria desses produtos antes de excluí-la.
                </p>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button id="btn-dismiss-cat-dep" size="sm" onClick={() => setDeleteCategory(null)} className="font-bold">
                    Entendido
                  </Button>
                </div>
              </>
            ) : (
              /* REGULAR DELETE CONFIRMATION */
              <>
                <div className="flex items-center gap-3 text-red-600">
                  <div className="p-2.5 bg-red-100 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Confirmar Exclusão</h4>
                    <p className="text-xs text-slate-500">Soft Delete da categoria "{deleteCategory.name}"</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  A categoria será marcada como excluída no banco de dados local (IndexedDB) e enfileirada no Outbox.
                </p>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <Button id="btn-cancel-delete-cat" variant="outline" size="sm" onClick={() => setDeleteCategory(null)} className="font-bold">
                    Cancelar
                  </Button>
                  <Button
                    id="btn-confirm-delete-cat"
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
                    onClick={confirmDeleteCategory}
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Categoria
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
