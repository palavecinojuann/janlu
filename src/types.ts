export type UserRole = 'admin' | 'collaborator' | 'customer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  level: 'bronce' | 'plata' | 'oro' | 'platino';
  referralCode: string;
  referralPoints: number;
  joinedAt: string;
  isAcademyStudent?: boolean;
  academyJoinDate?: string;
  starterKitPurchased?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  discount: number;
  expiresAt: string;
  isActive: boolean;
}

export type OfferType = 'discount' | 'combo' | 'bogo';

export interface Offer {
  id: string;
  title: string;
  description: string;
  type: OfferType;
  discountPercentage?: number;
  fixedPrice?: number;
  productIds: string[]; // Products included in the offer/combo
  imageUrl?: string;
  expiresAt?: string;
  validDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  startTime?: string; // "HH:mm" format
  endTime?: string; // "HH:mm" format
  isActive: boolean;
}

export interface RecipeItem {
  id: string;
  rawMaterialId: string;
  quantity: number;
  unit?: string; // e.g., 'g', 'ml', 'cm', 'm'
}

export interface KitItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface Variant {
  id: string;
  name: string;
  stock: number;
  cost: number;
  margin: number;
  price: number;
  sku: string;
  wholesalePrice?: number; // B2B Wholesale price
  recipe?: RecipeItem[];
  wastePercentage?: number; // Technical waste (e.g., 3%)
  laborTimeMinutes?: number; // Time to produce one unit
  laborRatePerHour?: number; // Hourly rate for labor
  isFinishedGood?: boolean; // If true, it has its own stock. If false/undefined, it might be a fractionated material.
  isKit?: boolean; // If true, it's a combo/kit
  kitItems?: KitItem[]; // Items included in the kit
  barcode?: string;
  unit?: string;
  costPerUnit?: number;
  minStock?: number;
  dimension?: string;
  baseUnit?: string;
  photoUrl?: string;
}

export interface ProductionOrder {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
  createdAt: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string; // The purchase/display unit (e.g., 'm', 'l', 'kg')
  dimension?: string; // 'weight' | 'volume' | 'length' | 'units'
  baseUnit?: string; // The UMB (e.g., 'g', 'ml', 'mm', 'u')
  stock: number; // Stored in UMB
  costPerUnit: number; // Cost per UMB
  minStock: number; // Stored in UMB
  createdAt: string;
  updatedAt: string;
  barcode?: string;
  price?: number;
  category?: string;
  description?: string;
  photoUrl?: string;
  sellAsProduct?: boolean;
  linkedProductId?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  photoUrl: string;
  variants: Variant[];
  showInCatalog?: boolean;
  isCustom?: boolean; // If true, requires custom manufacturing
  sortOrder?: number; // Optional order for catalog display
  customNote?: string; // Optional custom note to override global product modal notice
  createdAt: string;
  updatedAt: string;
}

export interface AssignedOffer {
  id: string;
  offerId: string;
  title: string;
  assignedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  surname?: string;
  email: string;
  phone: string;
  address?: string;
  instagram?: string;
  customerType?: 'retail' | 'wholesale';
  birthDate?: string;
  lastPurchaseDate?: string;
  createdAt: string;
  // New fields for registration and rewards
  customerNumber?: string;
  registeredAt?: string;
  discountExpiresAt?: string;
  welcomeDiscountUsed?: boolean;
  discountPercentage?: number;
  assignedOffers?: AssignedOffer[];
}

export interface SaleItem {
  id: string;
  productId?: string;
  variantId?: string;
  productName: string;
  variantName: string;
  quantity: number;
  price: number;
  total?: number;
  isCourse?: boolean;
  courseId?: string;
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'transfer_full' | 'transfer_partial' | 'on_pickup' | 'mixto' | 'mercadopago' | 'acordar';

export type SaleStatus = 'nuevo' | 'presupuesto' | 'en_preparacion' | 'listo_para_entregar' | 'entregado' | 'cancelado';

export interface PriceModifier {
  type: 'percentage' | 'fixed';
  value: number;
  isDiscount: boolean;
}

export interface QuoteItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  modifier?: PriceModifier;
  finalPrice: number;
}

export interface Quote {
  id: string;
  quoteNumber?: number;
  customerId: string;
  customerName: string;
  items: QuoteItem[];
  subtotal: number;
  globalModifier?: PriceModifier;
  totalAmount: number;
  date: string;
  validUntil: string;
}

export interface PaymentHistoryEntry {
  date: string;
  amount: number;
  method: PaymentMethod;
  status: string;
  notes?: string;
}

export interface Sale {
  id: string;
  orderNumber?: number;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  amountPaid: number;
  paymentPercentage: number;
  paymentMethod: PaymentMethod;
  date: string;
  status?: SaleStatus;
  paymentStatus?: 'pending' | 'verified' | 'rejected' | 'pending_at_pickup' | 'partial_paid';
  depositAmount?: number;
  balanceDue?: number;
  rejectionReason?: string;
  deliveryDate?: string;
  deliveryTimeRange?: string;
  packagingCost?: number;
  shippingCost?: number;
  laborCost?: number;
  paymentGatewayFee?: number;
  materialsDeducted?: boolean;
  receiptUrl?: string;
  customerEmail?: string;
  deliveryMethod?: 'retiro' | 'envio';
  paymentNotes?: string;
  paymentHistory?: PaymentHistoryEntry[];
  customerPhone?: string;
  shippingAddress?: string;
  generatedCouponCode?: string;
  appliedCouponCode?: string;
  isRegistering?: boolean;
  discount?: number;
  registrationData?: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    birthDate: string;
  };
}

export interface FinancialDocument {
  id: string;
  transactionId: string;
  type: 'sale' | 'purchase';
  amount: number;
  url: string;
  date: string;
  note?: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: 'inventory' | 'quote' | 'delivery' | 'other';
  status: 'pending' | 'completed';
  createdAt: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalStock: number;
  totalValueCost: number;
  totalValuePrice: number;
  stockProfit: number;
  lowStockItems: number;
  totalSales: number;
  totalRevenue: number;
  totalPendingPayment: number;
  projectedRevenue: number;
  grossProfit: number;
  netProfit: number;
  revenueByMethod: {
    efectivo: number;
    transferencia: number;
    tarjeta: number;
    mixto: number;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  collection: string;
  documentId: string;
  timestamp: string;
  newData?: unknown;
  previousData?: unknown;
}

export interface PreAuthorizedAdmin {
  id: string;
  email: string;
  addedAt?: string;
  addedBy?: string;
  role?: UserRole;
}

export interface SimulationItem {
  id: string;
  rawMaterialId: string;
  quantity: number;
  unit: string;
}

export interface Simulation {
  id: string;
  name: string;
  items: SimulationItem[];
  totalCost: number;
  createdAt: string;
  wastePercentage?: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercentage: number;
  expiresAt: string;
  customerId?: string;
  isUsed: boolean;
  usedBySaleId?: string;
  usedAt?: string;
  createdAt: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  buttonLink?: string;
}

export interface StoreSettings {
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl?: string;
  email?: string;
  workshopAddress?: string;
  discountStackingPolicy?: 'stack' | 'best_offer';
  installmentsCount?: number;
  installmentsWithoutInterest?: boolean;
  topBarText?: string;
  heroSlides?: HeroSlide[];
  shippingInfo?: string;
  returnsInfo?: string;
  wholesaleInfo?: string;
  transferDiscountPercentage?: number;
  cashDiscountPercentage?: number;
  productModalNotice?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  date: string; // Fecha y hora del dictado
  price: number;
  maxQuota: number; // Cupo máximo
  enrolledCount: number; // Cantidad de inscriptos
  imageUrl?: string;
  location?: string; // Modalidad/Lugar
  isActive: boolean;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
  name?: string;
  level?: string;
  referralCode?: string;
  referralPoints?: number;
  joinedAt?: string;
}
