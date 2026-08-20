/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Plus, Minus, Check, AlertCircle, Sparkles } from 'lucide-react';
import { AccompanimentGroup, AccompanimentItem, OrderItemAccompaniment } from '../../services/storage/types';
import { formatCentsToBRL } from '../../utils/currency';
import {
  calculateGroupFinancials,
  validateAccompanimentSelections,
  buildOrderItemAccompaniments,
  calculateTotalAccompanimentsPrice
} from '../../services/accompanimentService';

export interface AccompanimentGroupWithItems {
  group: AccompanimentGroup;
  items: AccompanimentItem[];
}

export interface AccompanimentSelectorProps {
  groupsWithItems: AccompanimentGroupWithItems[];
  selectedItems: Record<string, Record<string, number>>; // groupId -> (itemId -> quantity)
  onChange: (selectedItems: Record<string, Record<string, number>>) => void;
  showPricing?: boolean;
}

export function AccompanimentSelector({
  groupsWithItems,
  selectedItems,
  onChange,
  showPricing = true,
}: AccompanimentSelectorProps) {
  if (!groupsWithItems || groupsWithItems.length === 0) {
    return null;
  }

  // Handle single item increment
  const handleIncrement = (group: AccompanimentGroup, item: AccompanimentItem) => {
    const currentGroupSelections = selectedItems[group.id] || {};
    const currentItemQty = currentGroupSelections[item.id] || 0;
    const currentTotalGroupQty = Object.values(currentGroupSelections).reduce((a, b) => a + b, 0);

    // If max 1, replacing selection
    if (group.maxSelections === 1) {
      onChange({
        ...selectedItems,
        [group.id]: { [item.id]: 1 },
      });
      return;
    }

    // Check group max limit
    if (group.maxSelections !== undefined && group.maxSelections > 0 && currentTotalGroupQty >= group.maxSelections) {
      return; // Reached group maximum
    }

    // Check item max limit
    const itemMax = item.maxQuantity !== undefined ? item.maxQuantity : (group.allowRepeated ? 99 : 1);
    if (currentItemQty >= itemMax) {
      return;
    }

    onChange({
      ...selectedItems,
      [group.id]: {
        ...currentGroupSelections,
        [item.id]: currentItemQty + 1,
      },
    });
  };

  // Handle item decrement
  const handleDecrement = (group: AccompanimentGroup, item: AccompanimentItem) => {
    const currentGroupSelections = selectedItems[group.id] || {};
    const currentItemQty = currentGroupSelections[item.id] || 0;

    if (currentItemQty <= 0) return;

    const newGroupSelections = { ...currentGroupSelections };
    if (currentItemQty === 1) {
      delete newGroupSelections[item.id];
    } else {
      newGroupSelections[item.id] = currentItemQty - 1;
    }

    onChange({
      ...selectedItems,
      [group.id]: newGroupSelections,
    });
  };

  // Handle radio/single toggle click
  const handleToggleSingle = (group: AccompanimentGroup, item: AccompanimentItem) => {
    const currentGroupSelections = selectedItems[group.id] || {};
    const isSelected = (currentGroupSelections[item.id] || 0) > 0;

    if (group.maxSelections === 1) {
      if (isSelected && !group.required) {
        // Uncheck if optional
        onChange({
          ...selectedItems,
          [group.id]: {},
        });
      } else {
        onChange({
          ...selectedItems,
          [group.id]: { [item.id]: 1 },
        });
      }
    } else if (!group.allowRepeated) {
      // Toggle checkbox mode
      if (isSelected) {
        handleDecrement(group, item);
      } else {
        handleIncrement(group, item);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6" id="accompaniment-selector-container">
      {groupsWithItems.map(({ group, items }) => {
        if (!items || items.length === 0) return null;

        const groupSelections = selectedItems[group.id] || {};
        const totalSelectedQty = Object.values(groupSelections).reduce((a, b) => a + b, 0);

        // Group financials
        const groupFinancials = calculateGroupFinancials(group, items, groupSelections);

        const isSingleChoice = group.maxSelections === 1;
        const minReq = group.minSelections || (group.required ? 1 : 0);
        const maxLimit = group.maxSelections;
        const isSatisfied = totalSelectedQty >= minReq && (maxLimit === undefined || totalSelectedQty <= maxLimit);
        const isMaxReached = maxLimit !== undefined && totalSelectedQty >= maxLimit;

        return (
          <div
            key={group.id}
            id={`accompaniment-group-${group.id}`}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-3.5 transition-all"
          >
            {/* Group Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    {group.name}
                  </h4>

                  {group.required || minReq > 0 ? (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-800 border border-amber-500/20 px-2 py-0.5 rounded-md">
                      Obrigatório {minReq > 1 ? `(Mín ${minReq})` : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      Opcional
                    </span>
                  )}

                  {group.freeSelections !== undefined && group.freeSelections > 0 && (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      {group.freeSelections} {group.freeSelections === 1 ? 'opção grátis' : 'opções grátis'}
                    </span>
                  )}
                </div>

                {group.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {group.description}
                  </p>
                )}
              </div>

              {/* Selection status badge */}
              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                    isSatisfied
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {isSatisfied ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>
                    {totalSelectedQty} {maxLimit !== undefined ? `/ ${maxLimit}` : ''}
                  </span>
                </span>
              </div>
            </div>

            {/* Items List */}
            <div className="flex flex-col gap-2 pt-1">
              {items.map((item) => {
                const itemQty = groupSelections[item.id] || 0;
                const isSelected = itemQty > 0;
                const itemMax = item.maxQuantity !== undefined ? item.maxQuantity : (group.allowRepeated ? 99 : 1);
                const canIncrement = !isMaxReached || isSingleChoice || (isSelected && itemQty < itemMax && !isMaxReached);
                const isItemUnavailable = !item.available || !item.active;

                return (
                  <div
                    key={item.id}
                    id={`accompaniment-item-${item.id}`}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isItemUnavailable
                        ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                        : isSelected
                        ? 'bg-amber-50/60 border-amber-400/80 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200/90 hover:bg-slate-50/70 text-slate-700'
                    }`}
                  >
                    {/* Item Info / Click Target */}
                    <div
                      className={`flex items-center gap-3 flex-1 select-none ${
                        isItemUnavailable ? '' : 'cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isItemUnavailable) {
                          if (isSingleChoice || !group.allowRepeated) {
                            handleToggleSingle(group, item);
                          } else if (itemQty === 0) {
                            handleIncrement(group, item);
                          }
                        }
                      }}
                    >
                      {/* Checkbox / Radio Circle */}
                      <div
                        className={`w-5 h-5 rounded-${isSingleChoice ? 'full' : 'lg'} border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-amber-600 bg-amber-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          isSingleChoice ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          )
                        )}
                      </div>

                      {/* Name & Description */}
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${isSelected ? 'text-slate-950' : 'text-slate-800'}`}>
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="text-[11px] text-slate-500 line-clamp-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price and Counter Controls */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Price Badge */}
                      {showPricing && (
                        <div className="text-right flex flex-col">
                          {item.price > 0 ? (
                            <span className="text-xs font-extrabold text-slate-900">
                              +{formatCentsToBRL(item.price)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700">
                              Incluso
                            </span>
                          )}
                        </div>
                      )}

                      {/* Multi-quantity Counter if group allows repeated items */}
                      {group.allowRepeated && !isSingleChoice && (
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDecrement(group, item);
                            }}
                            disabled={itemQty <= 0 || isItemUnavailable}
                            className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-3xs disabled:opacity-30 hover:bg-slate-50 active:scale-95 transition-transform"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <span className="w-5 text-center text-xs font-black text-slate-900">
                            {itemQty}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleIncrement(group, item);
                            }}
                            disabled={isMaxReached || itemQty >= itemMax || isItemUnavailable}
                            className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-3xs disabled:opacity-30 hover:bg-slate-50 active:scale-95 transition-transform"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Group Subtotal note if any charged items */}
            {showPricing && groupFinancials.totalPriceCents > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Subtotal deste grupo:</span>
                <span className="font-extrabold text-slate-900">
                  +{formatCentsToBRL(groupFinancials.totalPriceCents)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
