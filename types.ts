
export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  USER = 'USER',
}

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  mustChangePassword?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  assignedAccountantId?: string | null;
  phone?: string;
  profilePicture?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  // Campos fiscales adicionales
  ruc?: string;
  dni?: string;
  businessName?: string;
  taxAddress?: string;

  // Credenciales SUNAT
  solUser?: string;
  solPass?: string;
  sunatToken?: string;
  sunatApiUrl?: string; // Para alternar entre Sandbox y Producción
  certBase64?: string; // Certificado PFX en Base64
  certPass?: string;   // Contraseña del certificado
  serieFactura?: string; // Serie para facturas (ej: F001)
  serieBoleta?: string;  // Serie para boletas (ej: B001)
}

export interface TaxDocument {
  id: string;
  userId: string;
  accountantId: string;
  name: string;
  fileUrl: string; // Base64 representation
  mimeType: string;
  uploadDate: string;
  periodMonth: string;
  periodYear: number;
  sunatStatus?: 'PENDING' | 'SENT' | 'REJECTED' | 'INTERNO';
  sunatHash?: string;
  // Origen del documento: 'ACCOUNTANT' (subido por el contador) | 'USER' (emitido/archivado por el usuario)
  uploadedBy?: 'ACCOUNTANT' | 'USER';
  pdfUrl?: string;
  xmlUrl?: string;
  cdrUrl?: string;
  xmlContent?: string;
  cdrBase64?: string;
  // Metadata for receipts emitted by the app
  metadata?: {
    recipientName: string;
    recipientRuc: string;
    description: string;
    amount: number;
    retention: number;
    netAmount: number;
    date: string;
  };
}

export interface InvoiceItem {
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number | string;
  total: number;
}

export interface UserProduct {
  id: string;
  userId: string;
  description: string;
  unit: string;
  unitPrice: number;
  lastUsed: string;
}

export interface PendingInvoice {
  id: string;
  userId: string;
  serie: string;
  correlative: number;
  documentType: 'factura' | 'boleta';
  payload: any;
  customerDocType: string;
  customerDocNumber: string;
  customerName: string;
  amount: number;
  createdAt: string;
  lastAttempt: string;
  attemptCount: number;
  status: 'PENDIENTE' | 'ENVIANDO' | 'ACEPTADO' | 'RECHAZADO';
  lastError?: string;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  category: string;
  internalVoucherUrl?: string;
  accountantVoucherUrl?: string;
  invoiceNumber?: string;
  ruc?: string;
  subtotal?: number;
  igv?: number;
  isPrivate?: boolean; // Nuevo campo para privacidad
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  details: string;
  qrImage?: string;
  isActive: boolean;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  packageName: string;
  amount: number;
  date: string;
  startDate?: string;
  endDate?: string;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  paymentDetails?: string;
  voucherImage?: string;
}

export interface AdminNotification {
  id: string;
  userId?: string;
  message: string;
  date: string;
  isRead: boolean;
  type: 'SUBSCRIPTION' | 'SYSTEM' | 'ACCOUNTANT_DOC';
}
export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  time: string;
  type: 'RECLAMO' | 'QUEJA';
  description: string;
  detail: string;
  status: 'PENDIENTE' | 'ATENDIDO';
}
