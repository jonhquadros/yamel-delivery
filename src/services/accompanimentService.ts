/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AccompanimentGroup,
  AccompanimentItem,
  OrderItemAccompaniment,
  ProductionStationType
} from './storage/types';

export interface GroupSelectionInput {
  groupId: string;
  items: {
    itemId: string;
    quantity: number;
  }[];
}

export interface GroupSelectionValidation {
  groupId: string;
  groupName: string;
  isValid: boolean;
  currentCount: number;
  minSelections: number;
  maxSelections: number;
  errorMessage?: string;
}

export interface AccompanimentGroupWithItems {
  group: AccompanimentGroup;
  items: AccompanimentItem[];
}

export interface GroupFinancialsResult {
  totalCents: number;
  totalPriceCents: number; // Compatibility alias
  totalQuantity: number;
  breakdown: {
    item: AccompanimentItem;
    quantity: number;
    freeQuantity: number;
    chargedQuantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
}

/**
 * Calculates the total cost in cents and detailed breakdown for a group's selected items,
 * taking into account free selections (free items allowance) and unit prices.
 */
export function calculateGroupFinancials(
  group: AccompanimentGroup,
  selectedItemsOrItems: { itemId: string; quantity: number }[] | AccompanimentItem[],
  itemsMapOrSelections: Map<string, AccompanimentItem> | Record<string, number>
): GroupFinancialsResult {
  let selectedItems: { itemId: string; quantity: number }[] = [];
  let itemsMap: Map<string, AccompanimentItem>;

  if (itemsMapOrSelections instanceof Map) {
    selectedItems = (selectedItemsOrItems as { itemId: string; quantity: number }[]) || [];
    itemsMap = itemsMapOrSelections;
  } else {
    const items = (selectedItemsOrItems as AccompanimentItem[]) || [];
    const selections = (itemsMapOrSelections as Record<string, number>) || {};
    itemsMap = new Map(items.map(i => [i.id, i]));
    selectedItems = Object.entries(selections)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  const breakdown: {
    item: AccompanimentItem;
    quantity: number;
    freeQuantity: number;
    chargedQuantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];

  let totalQty = 0;
  // Expand selections into individual unit instances to correctly allocate free allowances
  const instances: { item: AccompanimentItem; price: number }[] = [];

  for (const sel of selectedItems) {
    if (sel.quantity <= 0) continue;
    const item = itemsMap.get(sel.itemId);
    if (!item) continue;

    totalQty += sel.quantity;
    for (let i = 0; i < sel.quantity; i++) {
      instances.push({ item, price: item.price || 0 });
    }
  }

  // Free selections logic:
  // If freeSelections is defined (e.g. 2 gratis), the cheapest instances are considered free first
  const freeAllowance = group.freeSelections && group.freeSelections > 0 ? group.freeSelections : 0;
  
  // Sort instances by price ascending so free allowances cover units correctly
  instances.sort((a, b) => a.price - b.price);

  let remainingFree = freeAllowance;
  let totalCents = 0;

  // Group items back by item ID for breakdown
  const itemInstancesMap = new Map<string, { item: AccompanimentItem; freeCount: number; chargedCount: number; unitPrice: number }>();

  for (let idx = 0; idx < instances.length; idx++) {
    const inst = instances[idx];
    const isFree = remainingFree > 0;
    if (isFree) {
      remainingFree--;
    }

    if (!itemInstancesMap.has(inst.item.id)) {
      itemInstancesMap.set(inst.item.id, {
        item: inst.item,
        freeCount: 0,
        chargedCount: 0,
        unitPrice: inst.price
      });
    }

    const rec = itemInstancesMap.get(inst.item.id)!;
    if (isFree) {
      rec.freeCount++;
    } else {
      rec.chargedCount++;
      totalCents += inst.price;
    }
  }

  for (const rec of itemInstancesMap.values()) {
    const qty = rec.freeCount + rec.chargedCount;
    const subtotal = rec.chargedCount * rec.unitPrice;
    breakdown.push({
      item: rec.item,
      quantity: qty,
      freeQuantity: rec.freeCount,
      chargedQuantity: rec.chargedCount,
      unitPrice: rec.unitPrice,
      subtotal
    });
  }

  return {
    totalCents,
    totalPriceCents: totalCents,
    totalQuantity: totalQty,
    breakdown
  };
}

/**
 * Validates user selections across all assigned accompaniment groups for a product.
 */
export interface AccompanimentValidationError {
  groupId?: string;
  message: string;
  toString(): string;
}

export interface AccompanimentValidationResult {
  isValid: boolean;
  valid: boolean; // Alias for compatibility
  groupValidations: Record<string, GroupSelectionValidation>;
  errors: AccompanimentValidationError[];
}

function normalizeGroupsInput(
  arg1: AccompanimentGroupWithItems[] | AccompanimentGroup[],
  arg2?: AccompanimentItem[] | Record<string, Record<string, number>>,
  arg3?: Record<string, Record<string, number>>
): {
  groupsWithItems: AccompanimentGroupWithItems[];
  selections: Record<string, Record<string, number>>;
} {
  if (Array.isArray(arg1) && (arg1.length === 0 || (arg1[0] && 'group' in arg1[0]))) {
    return {
      groupsWithItems: arg1 as AccompanimentGroupWithItems[],
      selections: (arg2 as Record<string, Record<string, number>>) || {},
    };
  }

  const groups = (arg1 as AccompanimentGroup[]) || [];
  const items = Array.isArray(arg2) ? (arg2 as AccompanimentItem[]) : [];
  const selections = (arg3 || (!Array.isArray(arg2) ? arg2 : {})) as Record<string, Record<string, number>>;

  const itemsByGroup = new Map<string, AccompanimentItem[]>();
  for (const item of items) {
    if (!itemsByGroup.has(item.groupId)) {
      itemsByGroup.set(item.groupId, []);
    }
    itemsByGroup.get(item.groupId)!.push(item);
  }

  const groupsWithItems: AccompanimentGroupWithItems[] = groups.map(group => ({
    group,
    items: itemsByGroup.get(group.id) || [],
  }));

  return { groupsWithItems, selections };
}

/**
 * Validates accompaniment selections against min/max rules and required flags.
 * Supports both:
 *   validateAccompanimentSelections(groupsWithItems, selections)
 * and
 *   validateAccompanimentSelections(groups, items, selections)
 */
export function validateAccompanimentSelections(
  groupsOrGroupsWithItems: AccompanimentGroupWithItems[] | AccompanimentGroup[],
  itemsOrSelections?: AccompanimentItem[] | Record<string, Record<string, number>>,
  maybeSelections?: Record<string, Record<string, number>>
): AccompanimentValidationResult {
  const { groupsWithItems, selections } = normalizeGroupsInput(
    groupsOrGroupsWithItems,
    itemsOrSelections,
    maybeSelections
  );

  const groupValidations: Record<string, GroupSelectionValidation> = {};
  const errors: AccompanimentValidationError[] = [];
  let allValid = true;

  for (const { group } of groupsWithItems) {
    const groupSel = selections[group.id] || {};
    let count = 0;

    for (const [_, qty] of Object.entries(groupSel)) {
      if (qty > 0) {
        count += qty;
      }
    }

    let isValid = true;
    let errorMessage: string | undefined;

    // 1. Min / Required Check
    if (group.required && count < group.minSelections) {
      isValid = false;
      if (group.minSelections === 1 && group.maxSelections === 1) {
        errorMessage = `Selecione uma opção obrigatória em "${group.name}".`;
      } else {
        errorMessage = `Selecione no mínimo ${group.minSelections} ${group.minSelections === 1 ? 'opção' : 'opções'} em "${group.name}".`;
      }
    } else if (!group.required && group.minSelections > 0 && count > 0 && count < group.minSelections) {
      isValid = false;
      errorMessage = `Caso selecione "${group.name}", escolha no mínimo ${group.minSelections} opções.`;
    }

    // 2. Max Check
    if (group.maxSelections > 0 && count > group.maxSelections) {
      isValid = false;
      errorMessage = `O limite máximo para "${group.name}" é de ${group.maxSelections} ${group.maxSelections === 1 ? 'opção' : 'opções'}.`;
    }

    if (!isValid && errorMessage) {
      allValid = false;
      const errObj: AccompanimentValidationError = {
        groupId: group.id,
        message: errorMessage,
        toString() {
          return this.message;
        }
      };
      errors.push(errObj);
    }

    groupValidations[group.id] = {
      groupId: group.id,
      groupName: group.name,
      isValid,
      currentCount: count,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      errorMessage
    };
  }

  return {
    isValid: allValid,
    valid: allValid,
    groupValidations,
    errors
  };
}

/**
 * Builds frozen OrderItemAccompaniment snapshots with calculated subtotals for order persistence.
 * Supports both:
 *   buildOrderItemAccompaniments(groupsWithItems, selections)
 * and
 *   buildOrderItemAccompaniments(groups, items, selections)
 */
export function buildOrderItemAccompaniments(
  groupsOrGroupsWithItems: AccompanimentGroupWithItems[] | AccompanimentGroup[],
  itemsOrSelections?: AccompanimentItem[] | Record<string, Record<string, number>>,
  maybeSelections?: Record<string, Record<string, number>>
): OrderItemAccompaniment[] {
  const { groupsWithItems, selections } = normalizeGroupsInput(
    groupsOrGroupsWithItems,
    itemsOrSelections,
    maybeSelections
  );

  const result: OrderItemAccompaniment[] = [];

  for (const { group, items } of groupsWithItems) {
    const groupSel = selections[group.id] || {};
    const selectedList: { itemId: string; quantity: number }[] = [];

    for (const [itemId, qty] of Object.entries(groupSel)) {
      if (qty > 0) {
        selectedList.push({ itemId, quantity: qty });
      }
    }

    if (selectedList.length === 0) continue;

    const itemsMap = new Map<string, AccompanimentItem>(items.map(i => [i.id, i]));
    const financials = calculateGroupFinancials(group, selectedList, itemsMap);

    for (const itemBreakdown of financials.breakdown) {
      result.push({
        groupId: group.id,
        groupNameSnapshot: group.name,
        itemId: itemBreakdown.item.id,
        itemNameSnapshot: itemBreakdown.item.name,
        priceSnapshot: itemBreakdown.unitPrice,
        quantity: itemBreakdown.quantity,
        subtotal: itemBreakdown.subtotal,
        productionStation: itemBreakdown.item.productionStation
      });
    }
  }

  return result;
}

/**
 * Computes total accompaniment additional price in cents for a set of selections.
 * Supports both:
 *   calculateTotalAccompanimentsPrice(groupsWithItems, selections)
 * and
 *   calculateTotalAccompanimentsPrice(groups, items, selections)
 */
export function calculateTotalAccompanimentsPrice(
  groupsOrGroupsWithItems: AccompanimentGroupWithItems[] | AccompanimentGroup[],
  itemsOrSelections?: AccompanimentItem[] | Record<string, Record<string, number>>,
  maybeSelections?: Record<string, Record<string, number>>
): number {
  const { groupsWithItems, selections } = normalizeGroupsInput(
    groupsOrGroupsWithItems,
    itemsOrSelections,
    maybeSelections
  );

  let totalCents = 0;

  for (const { group, items } of groupsWithItems) {
    const groupSel = selections[group.id] || {};
    const selectedList: { itemId: string; quantity: number }[] = [];

    for (const [itemId, qty] of Object.entries(groupSel)) {
      if (qty > 0) {
        selectedList.push({ itemId, quantity: qty });
      }
    }

    if (selectedList.length === 0) continue;

    const itemsMap = new Map<string, AccompanimentItem>(items.map(i => [i.id, i]));
    const financials = calculateGroupFinancials(group, selectedList, itemsMap);
    totalCents += financials.totalCents;
  }

  return totalCents;
}
