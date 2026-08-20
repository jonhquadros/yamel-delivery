/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- GLOBAL SYNCRONISATION STATES ---
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityName = 
  | 'company'
  | 'user'
  | 'category'
  | 'product'
  | 'accompaniment_group'
  | 'accompaniment_item'
  | 'product_accompaniment_link'
  | 'table'
  | 'customer'
  | 'order'
  | 'cash_register'
  | 'cash_movement'
  | 'delivery'
  | 'device'
  | 'production_ticket';

export interface SyncQueueItem {
  id: string; // Generated local UUID
  entity: SyncEntityName;
  entityId: string;
  operation: SyncOperationType;
  payload: any; // Raw JSON payload of the action
  status: SyncStatus;
  attempts: number;
  createdAt: string; // ISO-8601 String representation
  updatedAt: string; // ISO-8601 String representation
  lastAttemptAt?: string;
  error?: string;
  deviceId: string;
}

// --- ROLES & PERMISSIONS ---
export type Role = 
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'WAITER'
  | 'KITCHEN'
  | 'DELIVERY'
  | 'CUSTOMER';

// --- AUDITABLE FIELDS PATTERN ---
export interface Auditable {
  createdAt: string; // ISO-8601 string
  updatedAt: string; // ISO-8601 string
  deletedAt?: string; // ISO-8601 string, if set -> Soft Deleted
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

// --- 1. COMPANY ---
export interface Company extends Auditable {
  id: string; // UUID
  name: string;
  tradeName: string;
  document: string; // CNPJ / CPF
  phone: string;
  whatsapp?: string;
  email: string;
  address: string;
  logo?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// --- 2. USER ---
export interface User extends Auditable {
  id: string; // UUID
  name: string;
  email: string;
  phone?: string;
  roleId: Role;
  status: 'ACTIVE' | 'INACTIVE';
  deviceId?: string;
}

// --- 3. CATEGORY ---
export interface Category extends Auditable {
  id: string; // UUID
  name: string;
  description?: string;
  image?: string;
  sortOrder: number;
  active: boolean;
}

// --- 4. PRODUCT ---
export type ProductionStationType = 'KITCHEN' | 'BAR' | 'ICE_CREAM' | 'OTHER';

export interface Product extends Auditable {
  id: string; // UUID
  name: string;
  description?: string;
  categoryId: string; // Link to Category
  image?: string;
  price: number; // Integer representing CENTS (e.g., R$ 10,50 -> 1050)
  cost?: number; // Integer representing CENTS
  active: boolean;
  available: boolean;
  featured: boolean;
  sortOrder: number;
  preparationTime?: number; // In minutes
  sku?: string;
  productionStation?: ProductionStationType; // Assigned production station (KITCHEN, BAR, ICE_CREAM, etc.)
  
  // Local-first synchronization tracking fields
  syncStatus: SyncStatus;
  localId: string;
  serverId?: string;
  deviceId: string;
}

// --- 5. ACCOMPANIMENTS & MODIFIERS (MÓDULO CENTRAL DE ACOMPANHAMENTOS) ---
export type AccompanimentScope = 'GLOBAL' | 'PRODUCT' | 'CATEGORY';

export interface AccompanimentGroup extends Auditable {
  id: string; // UUID
  name: string; // e.g. "Ponto da Carne", "Turbine seu Hambúrguer", "Molhos Especiais", "Tamanho"
  description?: string;
  minSelections: number; // 0 for optional, >= 1 for required
  maxSelections: number; // Max allowed items selected in total in this group
  freeSelections?: number; // Number of items that can be chosen for free before charging
  required: boolean;
  allowRepeated: boolean; // Allow selecting multiple of the same item (e.g., 2x Queijo Extra)
  active: boolean;
  sortOrder: number;
  scope: AccompanimentScope; // GLOBAL, PRODUCT, CATEGORY
  categoryId?: string; // Linked category if scope === 'CATEGORY' (Primary/Fallback)
  categoryIds?: string[]; // Array of linked category IDs for multi-category inheritance
  companyId?: string;
}

export interface AccompanimentItem extends Auditable {
  id: string; // UUID
  groupId: string; // Refers to AccompanimentGroup.id
  name: string; // e.g. "Bacon Crocante", "Queijo Cheddar", "Ao Ponto"
  description?: string;
  price: number; // Integer representing CENTS (e.g. 350 -> R$ 3,50, 0 if free)
  cost?: number; // Integer representing CENTS
  maxQuantity?: number; // Max units of this specific item allowed (if allowRepeated)
  active: boolean;
  available: boolean;
  sortOrder: number;
  productionStation?: ProductionStationType;
}

export interface ProductAccompanimentLink {
  id: string; // UUID
  productId: string;
  groupId: string;
  sortOrder: number;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- BACKWARD COMPATIBILITY ALIASES FOR OPTIONS & ADDONS ---
// Flexibility for legacy code referencing ProductOption and ProductAddon
export interface ProductOption {
  id: string;
  productId: string;
  name: string; // e.g., "Tamanho", "Ponto da Carne"
  required: boolean;
  minSelections: number;
  maxSelections: number;
  choices: {
    id: string;
    name: string; // e.g., "Média", "Ao Ponto"
    additionalPrice: number; // Integer representing CENTS (0 if free)
  }[];
}

export interface ProductAddon {
  id: string;
  productId: string;
  name: string; // e.g., "Queijo Cheddar", "Bacon Crocante"
  price: number; // Integer representing CENTS
  active: boolean;
}

// --- 6. TABLE ---
export type TableStatus = 'FREE' | 'OCCUPIED' | 'WAITING_PAYMENT' | 'BLOCKED';

export interface Table extends Auditable {
  id: string; // UUID
  number: number;
  name: string; // e.g., "Mesa 01", "Varanda 05"
  capacity: number;
  status: TableStatus;
  active: boolean;
  currentOrderId?: string; // ID of active order, if OCCUPIED or WAITING_PAYMENT
}

// --- 7. CUSTOMER ---
export interface Customer extends Auditable {
  id: string; // UUID
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
}

// --- 8. ORDER & ORDER ITEMS ---
export type OrderOrigin = 'TABLE' | 'COUNTER' | 'CATALOG' | 'DELIVERY' | 'WHATSAPP' | 'INTERNAL';

export type OrderStatus = 
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MEAL_VOUCHER' | 'OTHER';

export interface OrderItemAccompaniment {
  groupId: string;
  groupNameSnapshot: string;
  itemId: string;
  itemNameSnapshot: string;
  priceSnapshot: number; // Integer in CENTS
  quantity: number;
  subtotal: number; // Integer in CENTS (priceSnapshot * quantity or excess price calculation)
  productionStation?: ProductionStationType;
}

export interface OrderItemOption {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  additionalPrice: number; // Integer in CENTS
}

export interface OrderItemAddon {
  addonId: string;
  addonName: string;
  price: number; // Integer in CENTS
  quantity: number;
}

export interface OrderItem {
  id: string; // UUID
  orderId: string;
  productId: string;
  productNameSnapshot: string; // Frozen snapshot of the product's name
  unitPrice: number; // Frozen price in CENTS
  quantity: number;
  subtotal: number; // Frozen item total in CENTS (unitPrice * quantity + addons/options/accompaniments)
  notes?: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: OrderItemOption[];
  selectedAddons?: OrderItemAddon[];
  roundNumber?: number; // Sequential batch/round number (e.g. 1, 2, 3)
  roundId?: string; // Round identifier (e.g. 'R001', 'R002')
  createdAt: string;
  updatedAt: string;
}

export interface OrderCustomerSnapshot {
  name: string;
  phone: string;
  address?: string;
}

export interface OrderDeliverySnapshot {
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
  city: string;
  state: string;
  postalCode: string;
  deliveryFee: number; // Integer in CENTS
  driverId?: string;
  status: 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
}

export interface Order extends Auditable {
  id: string; // UUID
  localId: string; // Unique, sequential visual code (e.g. YML-1002)
  serverId?: string;
  orderNumber: number; // Integer sequential
  companyId: string;
  customerId?: string;
  tableId?: string;
  waiterId?: string;
  cashierId?: string;
  deviceId: string;
  origin: OrderOrigin;
  status: OrderStatus;
  syncStatus: SyncStatus;
  items: OrderItem[];
  
  // Financial summaries in CENTS
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  
  customerSnapshot?: OrderCustomerSnapshot;
  deliverySnapshot?: OrderDeliverySnapshot;
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
  changeFor?: number; // Integer in CENTS (for cash payment change)
  
  completedAt?: string;
  cancelledAt?: string;
}

// --- 9. DELIVERY LOGISTICS LOGS ---
export interface Delivery extends Auditable {
  id: string; // UUID
  orderId: string;
  customerId?: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
  city: string;
  state: string;
  postalCode: string;
  deliveryFee: number; // Integer in CENTS
  status: 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
  driverId?: string;
}

// --- 10. CASH REGISTER & MOVEMENTS ---
export interface CashRegisterClosingCounts {
  cash?: number; // Integer in CENTS
  pix?: number; // Integer in CENTS
  creditCard?: number; // Integer in CENTS
  debitCard?: number; // Integer in CENTS
  mealVoucher?: number; // Integer in CENTS
  other?: number; // Integer in CENTS
}

export interface CashRegister extends Auditable {
  id: string; // UUID
  localId?: string; // Sequential visual code e.g. CX-1001
  companyId: string;
  openedBy: string; // User ID
  openedByName?: string; // Operator display name
  closedBy?: string; // User ID
  closedByName?: string; // Operator display name
  deviceId: string;
  openingAmount: number; // Integer in CENTS
  closingAmount?: number; // Integer in CENTS
  expectedAmount?: number; // Integer in CENTS (opening + sales + deposits - withdrawals)
  difference?: number; // Integer in CENTS
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  notes?: string;
  closingNotes?: string;
  closingCounts?: CashRegisterClosingCounts;
}

export type CashMovementType = 'SALE' | 'REFUND' | 'WITHDRAWAL' | 'DEPOSIT' | 'ADJUSTMENT';

export interface CashMovement {
  id: string; // UUID
  cashRegisterId: string;
  orderId?: string;
  orderLocalId?: string;
  type: CashMovementType;
  amount: number; // Integer in CENTS (positive for income/deposits, positive/negative for withdrawals/refunds)
  paymentMethod: PaymentMethod;
  description: string;
  userId: string;
  userName?: string;
  deviceId?: string;
  createdAt: string;
  updatedAt?: string;
}

// --- 11. REGISTERED DEVICE ---
export type DeviceType = 
  | 'WAITER'
  | 'CASHIER'
  | 'KITCHEN'
  | 'ADMIN'
  | 'CUSTOMER'
  | 'DESKTOP'
  | 'TABLET'
  | 'MOBILE';

export interface Device {
  id: string; // UUID (usually client deviceId)
  name: string;
  type: DeviceType;
  userId?: string; // Associated logged user (if assigned)
  lastSeen: string; // ISO string
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

// --- BACKWARD COMPATIBILITY ALIASES FOR UI STABILITY ---
export type LocalCategory = Category;
export type LocalProduct = Product;
export type LocalTable = Table;
export type LocalCashRegister = CashRegister;

export interface DeviceConfig {
  deviceId: string;
  deviceName: string;
  deviceType: 'GARCOM' | 'CAIXA' | 'COZINHA' | 'CLIENTE';
  lastSeen: string;
}

export interface OrderTotals {
  subtotal: number;
  fee: number;
  discount: number;
  total: number;
}

export interface OrderCustomer {
  name: string;
  phone?: string;
  address?: string;
}

// --- 12. PRODUCTION TICKETS & KDS ---
export type ProductionStatus = 'PENDING' | 'PREPARING' | 'READY' | 'CANCELLED';

export interface ProductionItem {
  id: string; // UUID
  orderItemId: string; // Refers to OrderItem.id
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  notes?: string;
  status: ProductionStatus;
  selectedAccompaniments?: OrderItemAccompaniment[];
  selectedOptions?: OrderItemOption[];
  selectedAddons?: OrderItemAddon[];
  roundNumber?: number;
  roundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionTicket extends Auditable {
  id: string; // UUID (e.g. ticket-orderId-roundId-station)
  orderId: string;
  orderLocalId: string; // e.g. YML-1048
  orderOrigin: OrderOrigin;
  station: ProductionStationType;
  roundNumber: number; // Sequential round number (e.g. 1, 2, 3)
  roundId: string; // Round visual code (e.g. 'R001', 'R002')
  tableNumber?: number;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryType?: 'DELIVERY' | 'PICKUP';
  status: ProductionStatus;
  items: ProductionItem[];
  notes?: string;
  syncStatus: SyncStatus;
  deviceId: string;
}

