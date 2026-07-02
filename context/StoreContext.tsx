
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Expense, SubscriptionPackage, PaymentMethod, UserRole, SubscriptionStatus, SubscriptionRecord, AdminNotification, TaxDocument, Complaint } from '../types';

interface StoreContextType {
  currentUser: User | null;
  users: User[];
  expenses: Expense[];
  taxDocuments: TaxDocument[];
  packages: SubscriptionPackage[];
  paymentMethods: PaymentMethod[];
  subscriptionHistory: SubscriptionRecord[];
  notifications: AdminNotification[];
  complaints: Complaint[];
  
  // Actions
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  registerUser: (user: User) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  updateUserStatus: (userId: string, status: SubscriptionStatus) => void;
  addExpense: (expense: Expense) => void;
  addTaxDocument: (doc: TaxDocument) => void;
  deleteTaxDocument: (id: string) => void;
  
  // Admin Actions
  deleteUser: (userId: string) => void;
  updatePaymentMethod: (id: string, details: Partial<PaymentMethod>) => void;
  updatePackage: (id: string, details: Partial<SubscriptionPackage>) => void;
  assignAccountant: (userId: string, accountantId: string) => void;
  addSubscriptionRecord: (record: SubscriptionRecord) => void;
  addComplaint: (complaint: Complaint) => void;
  updateComplaintStatus: (id: string, status: 'PENDIENTE' | 'ATENDIDO') => void;
  
  // Notification Actions
  addNotification: (notification: AdminNotification) => void;
  markNotificationAsRead: (id: string) => void;
  sunatGlobalConfig: { sunatToken: string; sunatApiUrl: string };
  updateSunatGlobalConfig: (config: { sunatToken?: string; sunatApiUrl?: string }) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEMO_QR = "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIEAIAAACv9n9iAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9H66AAADeUlEQVR42u3c0XLjMAwEUP//6S0zdR0nImFIIAnuOedpmsZAsYtEiqvX63UBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL7T398f/+X1en19ffG7wY093uR0V9pX8W/y7X839njP70N3pX0V98V0T/90Y8897z50V9pXcR/M9390Y8877z50V9pXcR/U9z90Y8+Xn/89777Xvop7ofv6f6fV76O/ybe73vX6P6eXfB90X/961+v/nF7yfdB9/etdr/9zesn3Qff1r3e9/s/pJR8AAMD3uV6vz7+n9/Y7CIsVvN75rXn++W683vktfP75Lrz++S283vktvP7vIywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOD/5S8AAP//AwCHfK5Lz8Y/LAAAAABJRU5ErkJggg==";

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Admin FinanzaFacil', email: 'admin@app.com', role: UserRole.ADMIN },
  { id: 'u2', name: 'Contador Carlos Ruiz', email: 'carlos@contador.com', role: UserRole.ACCOUNTANT },
  { id: 'u4', name: 'Contadora Maria Paz', email: 'maria@contador.com', role: UserRole.ACCOUNTANT },
  { 
    id: 'u3', 
    name: 'Juan Pérez - Demo', 
    email: 'user@demo.com', 
    role: UserRole.USER, 
    subscriptionStatus: SubscriptionStatus.ACTIVE, 
    assignedAccountantId: 'u2',
    ruc: '10456789123',
    dni: '45678912',
    businessName: 'JUAN PEREZ EIRL',
    taxAddress: 'Av. Larco 456, Miraflores, Lima'
  },
  { 
    id: 'u5', 
    name: 'Elena Garcia', 
    email: 'elena@gmail.com', 
    role: UserRole.USER, 
    subscriptionStatus: SubscriptionStatus.PENDING,
    assignedAccountantId: 'u2'
  }
];

const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', userId: 'u3', amount: 150.50, currency: 'PEN', description: 'Restaurante Tanta', date: new Date().toISOString().split('T')[0], category: 'Alimentación', ruc: '20100012341' },
];

const INITIAL_DOCS: TaxDocument[] = [
  { 
    id: 'RH-1001', 
    userId: 'u3', 
    accountantId: 'u2', 
    name: 'R. Honorarios E001-45', 
    fileUrl: '', 
    mimeType: 'application/pdf', 
    uploadDate: '2024-05-01', 
    periodMonth: 'Mayo', 
    periodYear: 2024, 
    sunatStatus: 'SENT', 
    sunatHash: 'abc123456789xyz',
    metadata: {
      recipientName: 'EMPRESA TECH SAC',
      recipientRuc: '20600011122',
      description: 'Asesoría en Desarrollo de Software',
      amount: 5000,
      retention: 400,
      netAmount: 4600,
      date: '2024-05-01'
    }
  },
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ff_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ff_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('ff_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [taxDocuments, setTaxDocuments] = useState<TaxDocument[]>(() => {
    const saved = localStorage.getItem('ff_tax_docs');
    return saved ? JSON.parse(saved) : INITIAL_DOCS;
  });

  const [packages, setPackages] = useState<SubscriptionPackage[]>(() => {
    const saved = localStorage.getItem('ff_packages');
    return saved ? JSON.parse(saved) : [
      { id: 'p1', name: 'Plan Mensual Emprendedor', price: 49.00, durationMonths: 1, features: ['Escaneo ilimitado AI', 'Asesoría Contable básica', 'Buzón tributario 24/7'] },
      { id: 'p2', name: 'Plan Anual Pro', price: 490.00, durationMonths: 12, features: ['Todo lo del plan mensual', '2 meses de regalo', 'Soporte prioritario WhatsApp'] }
    ];
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    const saved = localStorage.getItem('ff_payment_methods');
    return saved ? JSON.parse(saved) : [
      { id: 'pm1', name: 'Yape / Plin', details: '987 654 321 - FinanzaFacil SAC', isActive: true, qrImage: DEMO_QR },
      { id: 'pm2', name: 'Transferencia BCP', details: '191-99887766-0-12 (CCI: 002191199887766012)', isActive: true }
    ];
  });

  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionRecord[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    const saved = localStorage.getItem('ff_complaints');
    return saved ? JSON.parse(saved) : [];
  });
  const [sunatGlobalConfig, setSunatGlobalConfig] = useState(() => {
    const saved = localStorage.getItem('ff_sunat_global');
    return saved ? JSON.parse(saved) : { sunatToken: '', sunatApiUrl: 'http://localhost:5555' };
  });

  useEffect(() => localStorage.setItem('ff_users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('ff_current_user', JSON.stringify(currentUser)), [currentUser]);
  useEffect(() => localStorage.setItem('ff_expenses', JSON.stringify(expenses)), [expenses]);
  useEffect(() => localStorage.setItem('ff_tax_docs', JSON.stringify(taxDocuments)), [taxDocuments]);
  useEffect(() => localStorage.setItem('ff_packages', JSON.stringify(packages)), [packages]);
  useEffect(() => localStorage.setItem('ff_payment_methods', JSON.stringify(paymentMethods)), [paymentMethods]);
  useEffect(() => localStorage.setItem('ff_sunat_global', JSON.stringify(sunatGlobalConfig)), [sunatGlobalConfig]);
  useEffect(() => localStorage.setItem('ff_complaints', JSON.stringify(complaints)), [complaints]);

  const login = (email: string, role: UserRole) => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    if (user) setCurrentUser(user);
    else alert("Credenciales incorrectas.");
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ff_current_user');
  };

  const registerUser = (user: User) => setUsers(prev => [...prev, user]);
  const updateUser = (userId: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
    if (currentUser?.id === userId) setCurrentUser(prev => prev ? { ...prev, ...data } : null);
  };

  const updateUserStatus = (userId: string, status: SubscriptionStatus) => updateUser(userId, { subscriptionStatus: status });
  const addExpense = (expense: Expense) => setExpenses(prev => [...prev, expense]);
  const addTaxDocument = (doc: TaxDocument) => setTaxDocuments(prev => [...prev, doc]);
  const deleteTaxDocument = (id: string) => setTaxDocuments(prev => prev.filter(d => d.id !== id));
  const deleteUser = (userId: string) => setUsers(prev => prev.filter(u => u.id !== userId));
  
  const updatePaymentMethod = (id: string, details: Partial<PaymentMethod>) => {
    setPaymentMethods(prev => prev.map(pm => pm.id === id ? { ...pm, ...details } : pm));
  };
  
  const updatePackage = (id: string, details: Partial<SubscriptionPackage>) => {
    setPackages(prev => prev.map(pkg => pkg.id === id ? { ...pkg, ...details } : pkg));
  };

  const assignAccountant = (userId: string, accountantId: string) => updateUser(userId, { assignedAccountantId: accountantId });
  const addSubscriptionRecord = (record: SubscriptionRecord) => setSubscriptionHistory(prev => [record, ...prev]);
  const addNotification = (notification: AdminNotification) => setNotifications(prev => [notification, ...prev]);
  const markNotificationAsRead = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  
  const addComplaint = (complaint: Complaint) => setComplaints(prev => [complaint, ...prev]);
  const updateComplaintStatus = (id: string, status: 'PENDIENTE' | 'ATENDIDO') => {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const updateSunatGlobalConfig = (config: { sunatToken?: string; sunatApiUrl?: string }) => {
    setSunatGlobalConfig(prev => ({ ...prev, ...config }));
  };

  return (
    <StoreContext.Provider value={{
      currentUser, users, expenses, taxDocuments, packages, paymentMethods, subscriptionHistory, notifications, complaints, sunatGlobalConfig,
      login, logout, registerUser, updateUser, updateUserStatus, addExpense, addTaxDocument, deleteTaxDocument,
      deleteUser, updatePaymentMethod, updatePackage, assignAccountant, addSubscriptionRecord,
      addNotification, markNotificationAsRead, addComplaint, updateComplaintStatus, updateSunatGlobalConfig
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
