
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Expense, SubscriptionPackage, PaymentMethod, UserRole, SubscriptionStatus, SubscriptionRecord, AdminNotification, TaxDocument, Complaint, UserProduct, PendingInvoice } from '../types';
import * as api from '../src/services/api';

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
  userProducts: UserProduct[];
  pendingInvoices: PendingInvoice[];
  loading: boolean;

  login: (email: string, password: string) => boolean;
  logout: () => void;
  registerUser: (user: User) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  changePassword: (userId: string, currentPassword: string, newPassword: string) => boolean;
  generatePassword: (length?: number) => string;
  updateUserStatus: (userId: string, status: SubscriptionStatus) => void;
  addExpense: (expense: Expense) => void;
  addTaxDocument: (doc: TaxDocument) => void;
  deleteTaxDocument: (id: string) => void;
  addUserProduct: (product: Omit<UserProduct, 'id' | 'userId' | 'lastUsed'>) => void;
  removeUserProduct: (id: string) => void;
  addPendingInvoice: (invoice: PendingInvoice) => void;
  removePendingInvoice: (id: string) => void;
  updatePendingInvoiceStatus: (id: string, status: PendingInvoice['status'], lastError?: string) => void;

  deleteUser: (userId: string) => void;
  updatePaymentMethod: (id: string, details: Partial<PaymentMethod>) => void;
  updatePackage: (id: string, details: Partial<SubscriptionPackage>) => void;
  assignAccountant: (userId: string, accountantId: string) => void;
  addSubscriptionRecord: (record: SubscriptionRecord) => void;
  addComplaint: (complaint: Complaint) => void;
  updateComplaintStatus: (id: string, status: 'PENDIENTE' | 'ATENDIDO') => void;

  addNotification: (notification: AdminNotification) => void;
  markNotificationAsRead: (id: string) => void;
  sunatGlobalConfig: { sunatToken: string; sunatApiUrl: string };
  updateSunatGlobalConfig: (config: { sunatToken?: string; sunatApiUrl?: string }) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEMO_QR = "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIEAIAAACv9n9iAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9H66AAADeUlEQVR42u3c0XLjMAwEUP//6S0zdR0nImFIIAnuOedpmsZAsYtEiqvX63UBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL7T398f/+X1en19ffG7wY093uR0V9pX8W/y7X839njP70N3pX0V98V0T/90Y8897z50V9pXcR/M9390Y8877z50V9pXcR/U9z90Y8+Xn/89777Xvop7ofv6f6fV76O/ybe73vX6P6eXfB90X/961+v/nF7yfdB9/etdr/9zesn3Qff1r3e9/s/pJR8AAMD3uV6vz7+n9/Y7CIsVvN75rXn++W683vktfP75Lrz++S283vktvP7vIywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOD/5S8AAP//AwCHfK5Lz8Y/LAAAAABJRU5ErkJggg==";

const LS_KEYS = ['ff_users','ff_current_user','ff_expenses','ff_tax_docs','ff_packages','ff_payment_methods','ff_subscription_history','ff_complaints','ff_sunat_global','ff_user_products','ff_pending_invoices'];

const loadFromLS = (key: string, fallback: any) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>(() => loadFromLS('ff_users', []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromLS('ff_current_user', null));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromLS('ff_expenses', []));
  const [taxDocuments, setTaxDocuments] = useState<TaxDocument[]>(() => loadFromLS('ff_tax_docs', []));
  const [packages, setPackages] = useState<SubscriptionPackage[]>(() => loadFromLS('ff_packages', []));
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => loadFromLS('ff_payment_methods', []));
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionRecord[]>(() => loadFromLS('ff_subscription_history', []));
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>(() => loadFromLS('ff_complaints', []));
  const [sunatGlobalConfig, setSunatGlobalConfig] = useState(() => loadFromLS('ff_sunat_global', { sunatToken: '', sunatApiUrl: '' }));
  const [userProducts, setUserProducts] = useState<UserProduct[]>(() => loadFromLS('ff_user_products', []));
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);

  // Fetch initial data from API with localStorage fallback
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const [u, e, td, pkg, pm, sh, cp, up, pi, sc, n] = await Promise.all([
          api.fetchUsers().catch(() => loadFromLS('ff_users', [])),
          api.fetchExpenses().catch(() => loadFromLS('ff_expenses', [])),
          api.fetchTaxDocuments().catch(() => loadFromLS('ff_tax_docs', [])),
          api.fetchPackages().catch(() => loadFromLS('ff_packages', [])),
          api.fetchPaymentMethods().catch(() => loadFromLS('ff_payment_methods', [])),
          api.fetchSubscriptionHistory().catch(() => loadFromLS('ff_subscription_history', [])),
          api.fetchComplaints().catch(() => loadFromLS('ff_complaints', [])),
          api.fetchUserProducts().catch(() => loadFromLS('ff_user_products', [])),
          api.fetchPendingInvoices().catch(() => []),
          api.fetchSunatConfig().catch(() => loadFromLS('ff_sunat_global', { sunatToken: '', sunatApiUrl: '' })),
          api.fetchNotifications().catch(() => []),
        ]);
        if (cancelled) return;
        setUsers(u);
        setExpenses(e);
        setTaxDocuments(td);
        setPackages(pkg);
        setPaymentMethods(pm);
        setSubscriptionHistory(sh);
        setComplaints(cp);
        setUserProducts(up);
        setPendingInvoices(pi);
        setSunatGlobalConfig(sc);
        setNotifications(n);
      } catch {
        // All fallbacks handled above
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Fallback: sync to localStorage as cache
  useEffect(() => { localStorage.setItem('ff_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { if (currentUser) localStorage.setItem('ff_current_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem('ff_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('ff_tax_docs', JSON.stringify(taxDocuments)); }, [taxDocuments]);
  useEffect(() => { localStorage.setItem('ff_packages', JSON.stringify(packages)); }, [packages]);
  useEffect(() => { localStorage.setItem('ff_payment_methods', JSON.stringify(paymentMethods)); }, [paymentMethods]);
  useEffect(() => { localStorage.setItem('ff_subscription_history', JSON.stringify(subscriptionHistory)); }, [subscriptionHistory]);
  useEffect(() => { localStorage.setItem('ff_complaints', JSON.stringify(complaints)); }, [complaints]);
  useEffect(() => { localStorage.setItem('ff_sunat_global', JSON.stringify(sunatGlobalConfig)); }, [sunatGlobalConfig]);
  useEffect(() => { localStorage.setItem('ff_user_products', JSON.stringify(userProducts)); }, [userProducts]);
  useEffect(() => { localStorage.setItem('ff_pending_invoices', JSON.stringify(pendingInvoices)); }, [pendingInvoices]);

  const login = (email: string, password: string): boolean => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) { alert("Credenciales incorrectas."); return false; }
    if (user.password && user.password !== password) { alert("Credenciales incorrectas."); return false; }
    setCurrentUser(user);
    localStorage.setItem('ff_current_user', JSON.stringify(user));
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ff_current_user');
  };

  const registerUser = (user: User) => {
    api.createUser(user).catch(() => {});
    setUsers(prev => [...prev, user]);
  };

  const updateUser = (userId: string, data: Partial<User>) => {
    api.updateUser(userId, data).catch(() => {});
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
    if (currentUser?.id === userId) setCurrentUser(prev => prev ? { ...prev, ...data } : null);
  };

  const changePassword = (userId: string, currentPassword: string, newPassword: string): boolean => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    if (user.password && user.password !== currentPassword) return false;
    updateUser(userId, { password: newPassword, mustChangePassword: false });
    return true;
  };

  const generatePassword = (length = 10): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  };

  const updateUserStatus = (userId: string, status: SubscriptionStatus) => updateUser(userId, { subscriptionStatus: status });

  const addExpense = (expense: Expense) => {
    api.createExpense(expense).catch(() => {});
    setExpenses(prev => [...prev, expense]);
  };

  const addTaxDocument = (doc: TaxDocument) => {
    api.createTaxDocument(doc).catch(() => {});
    setTaxDocuments(prev => [...prev, doc]);
  };

  const deleteTaxDocument = (id: string) => {
    api.deleteTaxDocument(id).catch(() => {});
    setTaxDocuments(prev => prev.filter(d => d.id !== id));
  };

  const deleteUser = (userId: string) => {
    api.deleteUser(userId).catch(() => {});
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const updatePaymentMethod = (id: string, details: Partial<PaymentMethod>) => {
    api.updatePaymentMethod(id, details).catch(() => {});
    setPaymentMethods(prev => prev.map(pm => pm.id === id ? { ...pm, ...details } : pm));
  };

  const updatePackage = (id: string, details: Partial<SubscriptionPackage>) => {
    const pkg = packages.find(p => p.id === id);
    if (pkg) {
      api.updatePackage(id, { ...pkg, ...details }).catch(() => {});
    }
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...details } : p));
  };

  const assignAccountant = (userId: string, accountantId: string) => updateUser(userId, { assignedAccountantId: accountantId });

  const addSubscriptionRecord = (record: SubscriptionRecord) => {
    api.createSubscriptionRecord(record).catch(() => {});
    setSubscriptionHistory(prev => [record, ...prev]);
  };

  const addNotification = (notification: AdminNotification) => {
    api.createNotification(notification).catch(() => {});
    setNotifications(prev => [notification, ...prev]);
  };
  const markNotificationAsRead = (id: string) => {
    api.deleteNotification(id).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addComplaint = (complaint: Complaint) => {
    api.createComplaint(complaint).catch(() => {});
    setComplaints(prev => [complaint, ...prev]);
  };

  const updateComplaintStatus = (id: string, status: 'PENDIENTE' | 'ATENDIDO') => {
    api.updateComplaintStatus(id, status).catch(() => {});
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const updateSunatGlobalConfig = (config: { sunatToken?: string; sunatApiUrl?: string }) => {
    const next = { ...sunatGlobalConfig, ...config };
    api.updateSunatConfig(next).catch(() => {});
    setSunatGlobalConfig(next);
  };

  const addUserProduct = (product: Omit<UserProduct, 'id' | 'userId' | 'lastUsed'>) => {
    if (!currentUser) return;
    setUserProducts(prev => {
      const existing = prev.findIndex(p => p.userId === currentUser.id && p.description.toLowerCase() === product.description.toLowerCase());
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], unit: product.unit, unitPrice: product.unitPrice, lastUsed: new Date().toISOString().split('T')[0] };
        api.updateUserProduct(updated[existing].id, { unit: product.unit, unitPrice: product.unitPrice, lastUsed: new Date().toISOString().split('T')[0] }).catch(() => {});
        return updated;
      }
      const newProd: UserProduct = { ...product, id: `prod-${Date.now()}`, userId: currentUser.id, lastUsed: new Date().toISOString().split('T')[0] };
      api.createUserProduct(newProd).catch(() => {});
      return [...prev, newProd];
    });
  };

  const removeUserProduct = (id: string) => {
    api.deleteUserProduct(id).catch(() => {});
    setUserProducts(prev => prev.filter(p => p.id !== id));
  };

  const addPendingInvoice = (invoice: PendingInvoice) => {
    api.createPendingInvoice(invoice).catch(() => {});
    setPendingInvoices(prev => [invoice, ...prev]);
  };

  const removePendingInvoice = (id: string) => {
    api.deletePendingInvoice(id).catch(() => {});
    setPendingInvoices(prev => prev.filter(p => p.id !== id));
  };

  const updatePendingInvoiceStatus = (id: string, status: PendingInvoice['status'], lastError?: string) => {
    api.updatePendingInvoice(id, { status, lastAttempt: new Date().toISOString().split('T')[0], attemptCount: 0, lastError }).catch(() => {});
    setPendingInvoices(prev => prev.map(p => p.id === id ? { ...p, status, lastAttempt: new Date().toISOString().split('T')[0], lastError } : p));
  };

  return (
    <StoreContext.Provider value={{
      currentUser, users, expenses, taxDocuments, packages, paymentMethods, subscriptionHistory, notifications, complaints, sunatGlobalConfig, userProducts, pendingInvoices, loading,
      login, logout, registerUser, updateUser, updateUserStatus, addExpense, addTaxDocument, deleteTaxDocument, changePassword, generatePassword,
      deleteUser, updatePaymentMethod, updatePackage, assignAccountant, addSubscriptionRecord,
      addNotification, markNotificationAsRead, addComplaint, updateComplaintStatus, updateSunatGlobalConfig, addUserProduct, removeUserProduct,
      addPendingInvoice, removePendingInvoice, updatePendingInvoiceStatus
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
