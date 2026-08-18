
export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  USER = 'USER',
  CONTADOR = 'CONTADOR',
  EMPRESARIO = 'EMPRESARIO',
  PERSONA_NATURAL = 'PERSONA_NATURAL',
  SUB_USER = 'SUB_USER',
}

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export interface Company {
  id: string;
  ownerUserId: string;
  name: string;
  ruc?: string;
  businessName?: string;
  taxAddress?: string;
  dni?: string;
  isPersonaNatural?: boolean;
  solUser?: string;
  solPass?: string;
  sunatToken?: string;
  sunatApiUrl?: string;
  certBase64?: string;
  certPass?: string;
  serieFactura?: string;
  serieBoleta?: string;
  sunatEnv?: 'SANDBOX' | 'PRODUCTION';
  assignedAccountantId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  mustChangePassword?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  phone?: string;
  profilePicture?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  parentId?: string;
  // Credenciales SOL del empleado (para RH emitido desde Portal Web SOL)
  ruc?: string;
  solUser?: string;
  solPass?: string;
  isVerified?: boolean;
  verificationToken?: string;
  verificationExpires?: string;
}

export interface SavedAccount {
  userId: string;
  subUserId?: string;
  name: string;
  email: string;
  role: UserRole;
  profilePicture?: string;
  accountTypeLabel?: string;
  lastActive: number;
}

export interface TaxDocument {
  id: string;
  userId: string;
  companyId?: string;
  accountantId: string;
  name: string;
  fileUrl: string; // Base64 representation
  mimeType: string;
  folderPath?: string; // Carpeta virtual: 'pdt/2026-06'
  uploadDate: string;
  periodMonth: string;
  periodYear: number;
  sunatStatus?: 'PENDING' | 'SENT' | 'REJECTED' | 'INTERNO' | 'BORRADO';
  sunatHash?: string;
  documentType?: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito' | 'rh' | 'ticket' | 'nota_venta' | 'guia_remision' | 'guia_transportista' | 'liquidacion_compra' | 'proforma' | 'cotizacion' | 'orden_pago';
  originalDocumentId?: string;
  // Origen del documento: 'ACCOUNTANT' (subido por el contador) | 'USER' (emitido/archivado por el usuario)
  uploadedBy?: 'ACCOUNTANT' | 'USER';
  pdfUrl?: string;
  xmlUrl?: string;
  cdrUrl?: string;
  xmlContent?: string;
  cdrBase64?: string;
  convertedToDocId?: string;
  convertedDocType?: string;
  // Metadata for receipts emitted by the app
  metadata?: {
    recipientName: string;
    recipientRuc: string;
    recipientPhone?: string;
    description: string;
    amount: number;
    retention: number;
    netAmount: number;
    date: string;
    items?: InvoiceItem[];
    convertedToDocId?: string;
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
  companyId?: string;
  description: string;
  unit: string;
  unitPrice: number;
  lastUsed: string;
}

export interface PendingInvoice {
  id: string;
  userId: string;
  companyId?: string;
  serie: string;
  correlative: number;
  documentType: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito';
  originalDocumentId?: string;
  payload: any;
  customerDocType: string;
  customerDocNumber: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  createdAt: string;
  lastAttempt: string;
  attemptCount: number;
  status: 'PENDIENTE' | 'ENVIANDO' | 'ACEPTADO' | 'RECHAZADO';
  lastError?: string;
}

export const NC_MOTIVOS: Record<string, string> = {
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción',
  '04': 'Descuento global',
  '05': 'Descuento por ítem',
  '06': 'Devolución total',
  '07': 'Devolución por ítem',
  '08': 'Bonificación',
  '09': 'Disminución en el valor',
  '10': 'Otros conceptos',
  '13': 'Ajuste de operaciones de exportación',
};

export const ND_MOTIVOS: Record<string, string> = {
  '01': 'Intereses por mora',
  '02': 'Aumento del valor del bien o servicio',
  '03': 'Penalidades / Otros conceptos al alza',
};

export type NcNdMotivo = keyof typeof NC_MOTIVOS;

export interface Expense {
  id: string;
  userId: string;
  companyId?: string;
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
  type?: 'CLIENT' | 'ACCOUNTANT';
  limits?: Record<string, Record<string, number>>;
  isFree?: boolean;
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
  companyId?: string;
  userName: string;
  userEmail: string;
  date: string;
  time: string;
  type: 'RECLAMO' | 'QUEJA';
  description: string;
  detail: string;
  status: 'PENDIENTE' | 'ATENDIDO';
}

export type PaymentAlertCategory = 'LUZ' | 'AGUA' | 'INTERNET' | 'PRESTAMO' | 'ALQUILER' | 'TARJETA' | 'IMPUESTOS' | 'OTRO';
export type PaymentAlertFrequency = 'MENSUAL' | 'QUINCENAL' | 'ANUAL' | 'UNICO';
export type PaymentAlertStatus = 'PENDIENTE' | 'PAGADO' | 'VENCIDO';

export interface PaymentAlert {
  id: string;
  userId: string;
  companyId?: string;
  title: string;
  category: PaymentAlertCategory;
  amount: number;
  currency: string;
  dueDate: string;
  frequency: PaymentAlertFrequency;
  reminderDaysBefore: number;
  status: PaymentAlertStatus;
  notes?: string;
  lastPaidDate?: string;
  createdAt?: string;
}

export type PersonalExpenseCategory = 
  | 'ALIMENTACION' 
  | 'SERVICIOS_HOGAR' 
  | 'VIVIENDA' 
  | 'SALUD' 
  | 'EDUCACION' 
  | 'ENTRETENIMIENTO' 
  | 'TRANSPORTE' 
  | 'OTROS_PERSONALES';

export interface PersonalExpense {
  id: string;
  userId: string;
  concept: PersonalExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  date: string;
  voucherUrl?: string;
  merchantName?: string;
  notes?: string;
  createdAt?: string;
}
