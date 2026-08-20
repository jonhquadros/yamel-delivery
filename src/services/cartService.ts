/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrderItemAccompaniment } from './storage/types';

export interface CartItemOption {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  additionalPrice: number; // In cents
}

export interface CartItemAddon {
  addonId: string;
  addonName: string;
  price: number; // In cents
  quantity: number;
}

export interface CartItem {
  id: string; // Unique cart item ID
  productId: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number; // In cents (base product price in cents)
  quantity: number;
  notes?: string;
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: CartItemOption[];
  selectedAddons?: CartItemAddon[];
  subtotal: number; // In cents ( (unitPriceSnapshot + accompaniments/options/addons) * quantity )
}

export interface CartState {
  items: CartItem[];
  subtotal: number; // In cents
  deliveryFee: number; // In cents
  total: number; // In cents
  updatedAt: string;
}

const CART_STORAGE_KEY = 'yamel_digital_cart_v1';

const listeners: Set<() => void> = new Set();

function calculateItemSubtotal(item: Omit<CartItem, 'id' | 'subtotal'>): number {
  let unitTotal = item.unitPriceSnapshot;
  if (item.selectedAccompaniments) {
    for (const acc of item.selectedAccompaniments) {
      unitTotal += (acc.subtotal !== undefined ? acc.subtotal : (acc.priceSnapshot * acc.quantity));
    }
  }
  if (item.selectedOptions) {
    for (const opt of item.selectedOptions) {
      unitTotal += opt.additionalPrice || 0;
    }
  }
  if (item.selectedAddons) {
    for (const add of item.selectedAddons) {
      unitTotal += (add.price || 0) * (add.quantity || 1);
    }
  }
  return unitTotal * item.quantity;
}

function loadCartFromStorage(): CartState {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CartState;
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading cart from storage:', e);
  }
  return {
    items: [],
    subtotal: 0,
    deliveryFee: 700, // R$ 7,00 default delivery fee
    total: 0,
    updatedAt: new Date().toISOString()
  };
}

function saveCartToStorage(state: CartState): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving cart to storage:', e);
  }
  listeners.forEach(fn => fn());
}

export const cartService = {
  getCart(): CartState {
    const cart = loadCartFromStorage();
    // Recalculate totals
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += item.subtotal;
    }
    cart.subtotal = subtotal;
    cart.total = subtotal + (cart.items.length > 0 ? cart.deliveryFee : 0);
    return cart;
  },

  addItem(newItem: Omit<CartItem, 'id' | 'subtotal'>): CartItem {
    const cart = this.getCart();
    
    // Generate deterministic ID or find existing matching item
    const accompanimentsKey = (newItem.selectedAccompaniments || [])
      .map(a => `${a.groupId}:${a.itemId}:${a.quantity}`)
      .sort()
      .join('|');
    const optionsKey = (newItem.selectedOptions || [])
      .map(o => `${o.optionId}:${o.choiceId}`)
      .sort()
      .join('|');
    const addonsKey = (newItem.selectedAddons || [])
      .map(a => `${a.addonId}:${a.quantity}`)
      .sort()
      .join('|');
    
    const signature = `${newItem.productId}_${accompanimentsKey}_${optionsKey}_${addonsKey}_${newItem.notes || ''}`;

    const existingIndex = cart.items.findIndex(i => i.id === signature);

    let updatedItem: CartItem;

    if (existingIndex >= 0) {
      const existing = cart.items[existingIndex];
      const newQty = existing.quantity + newItem.quantity;
      updatedItem = {
        ...existing,
        quantity: newQty,
        subtotal: calculateItemSubtotal({ ...existing, quantity: newQty })
      };
      cart.items[existingIndex] = updatedItem;
    } else {
      updatedItem = {
        ...newItem,
        id: signature,
        subtotal: calculateItemSubtotal(newItem)
      };
      cart.items.push(updatedItem);
    }

    cart.updatedAt = new Date().toISOString();
    saveCartToStorage(cart);
    return updatedItem;
  },

  updateQuantity(itemId: string, delta: number): void {
    const cart = this.getCart();
    const index = cart.items.findIndex(i => i.id === itemId);
    if (index >= 0) {
      const item = cart.items[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        cart.items.splice(index, 1);
      } else {
        item.quantity = newQty;
        item.subtotal = calculateItemSubtotal(item);
      }
      cart.updatedAt = new Date().toISOString();
      saveCartToStorage(cart);
    }
  },

  updateNotes(itemId: string, notes: string): void {
    const cart = this.getCart();
    const item = cart.items.find(i => i.id === itemId);
    if (item) {
      item.notes = notes;
      cart.updatedAt = new Date().toISOString();
      saveCartToStorage(cart);
    }
  },

  removeItem(itemId: string): void {
    const cart = this.getCart();
    cart.items = cart.items.filter(i => i.id !== itemId);
    cart.updatedAt = new Date().toISOString();
    saveCartToStorage(cart);
  },

  clearCart(): void {
    const cart = this.getCart();
    cart.items = [];
    cart.updatedAt = new Date().toISOString();
    saveCartToStorage(cart);
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
