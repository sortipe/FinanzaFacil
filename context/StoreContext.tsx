
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Expense, SubscriptionPackage, PaymentMethod, UserRole, SubscriptionStatus, SubscriptionRecord, AdminNotification, TaxDocument, Complaint, UserProduct, PendingInvoice, Company, SavedAccount, PaymentAlert, PersonalExpense } from '../types';
import * as api from '../src/services/api';

const normalizeRole = (role: UserRole): UserRole => {
  switch (role) {
    case UserRole.EMPRESARIO:
      return UserRole.USER;
    case UserRole.CONTADOR:
      return UserRole.ACCOUNTANT;
    default:
      return role;
  }
};

const getAccountTypeLabel = (user: User, isSubUser?: boolean): string => {
  if (isSubUser || user.role === UserRole.SUB_USER) return 'Empresario Dependiente';
  if (user.role === UserRole.PERSONA_NATURAL) return 'Persona Natural';
  if (user.role === UserRole.ACCOUNTANT || user.role === UserRole.CONTADOR) return 'Contador';
  if (user.role === UserRole.ADMIN) return 'Administrador';
  if (user.parentId) return 'Empresario (Creado)';
  return 'Empresario Titular';
};

interface StoreContextType {
  currentUser: User | null;
  currentSubUser: User | null;
  isSubUser: boolean;
  savedAccounts: SavedAccount[];
  users: User[];
  companies: Company[];
  selectedCompanyId: string | null;
  expenses: Expense[];
  taxDocuments: TaxDocument[];
  packages: SubscriptionPackage[];
  accountantPackages: SubscriptionPackage[];
  paymentMethods: PaymentMethod[];
  subscriptionHistory: SubscriptionRecord[];
  notifications: AdminNotification[];
  complaints: Complaint[];
  userProducts: UserProduct[];
  pendingInvoices: PendingInvoice[];
  loading: boolean;

  login: (email: string, password: string) => boolean;
  switchAccount: (userId: string, subUserId?: string) => void;
  removeSavedAccount: (userId: string, subUserId?: string) => void;
  logout: () => void;
  registerUser: (user: User) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
   changePassword: (userId: string, currentPassword: string, newPassword: string) => boolean;
   resetUserPassword: (userId: string) => Promise<string | null>;
   forgotPassword: (email: string) => Promise<boolean>;
   generatePassword: (length?: number) => string;
  updateUserStatus: (userId: string, status: SubscriptionStatus) => void;
  addExpense: (expense: Expense) => void;
  addBatchExpenses: (expenseList: Expense[]) => void;
  addTaxDocument: (doc: TaxDocument) => void;
  deleteTaxDocument: (id: string) => void;
  addUserProduct: (product: Omit<UserProduct, 'id' | 'userId' | 'companyId' | 'lastUsed'>) => void;
  removeUserProduct: (id: string) => void;
  addPendingInvoice: (invoice: PendingInvoice) => void;
  removePendingInvoice: (id: string) => void;
  updatePendingInvoiceStatus: (id: string, status: PendingInvoice['status'], lastError?: string) => void;

  deleteUser: (userId: string) => void;
  addSubUser: (subUser: User) => Promise<void>;
  deleteSubUser: (userId: string) => void;
  updatePaymentMethod: (id: string, details: Partial<PaymentMethod>) => void;
updatePackage: (id: string, details: Partial<SubscriptionPackage>) => void;
   updateAccountantPackage: (id: string, details: Partial<SubscriptionPackage>) => void;
   createPackage: (pkg: SubscriptionPackage) => void;
   deletePackage: (id: string) => void;
   assignAccountant: (companyId: string, accountantId: string) => void;
  addSubscriptionRecord: (record: SubscriptionRecord) => void;
  updateSubscriptionRecord: (id: string, details: Partial<SubscriptionRecord>) => void;
  addComplaint: (complaint: Complaint) => void;
  updateComplaintStatus: (id: string, status: 'PENDIENTE' | 'ATENDIDO') => void;

  addNotification: (notification: AdminNotification) => void;
  markNotificationAsRead: (id: string) => void;
  sunatGlobalConfig: { sunatToken: string; sunatApiUrl: string; supportPhone?: string };
  updateSunatGlobalConfig: (config: { sunatToken?: string; sunatApiUrl?: string; supportPhone?: string }) => void;

  paymentAlerts: PaymentAlert[];
  addPaymentAlert: (alert: PaymentAlert) => void;
  updatePaymentAlert: (id: string, data: Partial<PaymentAlert>) => void;
  deletePaymentAlert: (id: string) => void;
  markPaymentAlertPaid: (id: string, recordAsExpense?: boolean) => void;

  personalExpenses: PersonalExpense[];
  addPersonalExpense: (expense: PersonalExpense) => void;
  updatePersonalExpense: (id: string, data: Partial<PersonalExpense>) => void;
  deletePersonalExpense: (id: string) => void;

  addCompany: (company: Company) => void;
  updateCompany: (id: string, data: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  selectCompany: (id: string | null) => void;
  selectedCompany: Company | null;

  refreshData: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEMO_QR = "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIEAIAAACv9n9iAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9H66AAADeUlEQVR42u3c0XLjMAwEUP//6S0zdR0nImFIIAnuOedpmsZAsYtEiqvX63UBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL7T398f/+X1en19ffG7wY093uR0V9pX8W/y7X839njP70N3pX0V98V0T/90Y8897z50V9pXcR/M9390Y8877z50V9pXcR/U9z90Y8+Xn/89777Xvop7ofv6f6fV76O/ybe73vX6P6eXfB90X/961+v/nF7yfdB9/etdr/9zesn3Qff1r3e9/s/pJR8AAMD3uV6vz7+n9/Y7CIsVvN75rXn++W683vktfP75Lrz++S283vktvP7vIywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOD/5S8AAP//AwCHfK5Lz8Y/LAAAAABJRU5ErkJggg==";

const LS_KEYS = ['ff_users','ff_current_user','ff_expenses','ff_tax_docs','ff_packages','ff_payment_methods','ff_subscription_history','ff_complaints','ff_sunat_global','ff_user_products','ff_pending_invoices','ff_companies','ff_selected_company_id'];

const DEFAULT_FREE_CLIENT_PACKAGE: SubscriptionPackage = {
  id: 'pkg-free-client',
  name: 'Plan Gratis',
  price: 0,
  durationMonths: 12,
  features: ['Funciones básicas', '1 Empresa', '10 Comprobantes al mes'],
  type: 'CLIENT',
  isFree: true,
  limits: { maxCompanies: { USER: 1, PERSONA_NATURAL: 1 }, maxTaxDocuments: { USER: 10, PERSONA_NATURAL: 10 } }
};

const DEFAULT_FREE_ACCOUNTANT_PACKAGE: SubscriptionPackage = {
  id: 'pkg-free-accountant',
  name: 'Plan Gratis',
  price: 0,
  durationMonths: 12,
  features: ['Gestión básica de contador', 'Hasta 2 empresas gestionadas'],
  type: 'ACCOUNTANT',
  isFree: true,
  limits: { maxManagedCompanies: { ACCOUNTANT: 2 }, maxTaxDocuments: { ACCOUNTANT: 20 } }
};

const ensureFreePackage = (list: SubscriptionPackage[], defaultFree: SubscriptionPackage) => {
  const arr = Array.isArray(list) ? list : [];
  const hasFree = arr.some(p => p.isFree || p.id === defaultFree.id);
  if (!hasFree) {
    return [defaultFree, ...arr];
  }
  return arr;
};

const loadFromLS = (key: string, fallback: any) => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>(() => loadFromLS('ff_users', []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromLS('ff_current_user', null));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromLS('ff_expenses', []));
  const [taxDocuments, setTaxDocuments] = useState<TaxDocument[]>(() => loadFromLS('ff_tax_docs', []));
  const [packages, setPackages] = useState<SubscriptionPackage[]>(() => ensureFreePackage(loadFromLS('ff_packages', []), DEFAULT_FREE_CLIENT_PACKAGE));
  const [accountantPackages, setAccountantPackages] = useState<SubscriptionPackage[]>(() => ensureFreePackage(loadFromLS('ff_accountant_packages', []), DEFAULT_FREE_ACCOUNTANT_PACKAGE));
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => loadFromLS('ff_payment_methods', []));
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionRecord[]>(() => loadFromLS('ff_subscription_history', []));
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>(() => loadFromLS('ff_complaints', []));
  const [sunatGlobalConfig, setSunatGlobalConfig] = useState(() => loadFromLS('ff_sunat_global', { sunatToken: '', sunatApiUrl: '', supportPhone: '999888777' }));
  const [userProducts, setUserProducts] = useState<UserProduct[]>(() => loadFromLS('ff_user_products', []));
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>(() => loadFromLS('ff_companies', []));
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => loadFromLS('ff_selected_company_id', null));
  const [currentSubUser, setCurrentSubUser] = useState<User | null>(() => loadFromLS('ff_current_sub_user', null));
  const isSubUser = currentSubUser !== null && currentUser !== null && currentSubUser.id !== currentUser.id;
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => loadFromLS('ff_saved_accounts', []));
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>(() => loadFromLS('ff_payment_alerts', []));
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>(() => loadFromLS('ff_personal_expenses', []));

  useEffect(() => { safeSetItem('ff_payment_alerts', JSON.stringify(paymentAlerts)); }, [paymentAlerts]);
  useEffect(() => { safeSetItem('ff_personal_expenses', JSON.stringify(personalExpenses)); }, [personalExpenses]);

  // Fetch initial data from API with localStorage fallback
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const [u, comp, e, td, pkg, apkg, pm, sh, cp, up, pi, sc, n, pa, pe] = await Promise.all([
          api.fetchUsers().catch(() => loadFromLS('ff_users', [])),
          api.fetchCompanies().catch(() => loadFromLS('ff_companies', [])),
          api.fetchExpenses().catch(() => loadFromLS('ff_expenses', [])),
          api.fetchTaxDocuments().catch(() => loadFromLS('ff_tax_docs', [])),
          api.fetchPackages('CLIENT').catch(() => loadFromLS('ff_packages', [])),
          api.fetchPackages('ACCOUNTANT').catch(() => loadFromLS('ff_accountant_packages', [])),
          api.fetchPaymentMethods().catch(() => loadFromLS('ff_payment_methods', [])),
          api.fetchSubscriptionHistory().catch(() => loadFromLS('ff_subscription_history', [])),
          api.fetchComplaints().catch(() => loadFromLS('ff_complaints', [])),
          api.fetchUserProducts().catch(() => loadFromLS('ff_user_products', [])),
          api.fetchPendingInvoices().catch(() => []),
          api.fetchSunatConfig().catch(() => loadFromLS('ff_sunat_global', { sunatToken: '', sunatApiUrl: '' })),
          api.fetchNotifications().catch(() => []),
          api.fetchPaymentAlerts().catch(() => loadFromLS('ff_payment_alerts', [])),
          api.fetchPersonalExpenses().catch(() => loadFromLS('ff_personal_expenses', [])),
        ]);
        if (cancelled) return;
        setUsers(u);
        setCompanies(comp);
        if (Array.isArray(pa)) setPaymentAlerts(pa);
        if (Array.isArray(pe)) setPersonalExpenses(pe);
        setCurrentUser(prev => {
          if (!prev) return null;
          const fresh = u.find((usr: User) => usr.id === prev.id);
          const updated = fresh || prev;
          localStorage.setItem('ff_current_user', JSON.stringify(updated));
          return updated;
        });
        // Merge local expenses that may not be on the server yet (offline / pending sync recovery)
        const localExpenses: Expense[] = loadFromLS('ff_expenses', []);
        const serverExpenseIds = new Set((Array.isArray(e) ? e : []).map((item: Expense) => item.id));
        const unsyncedExpenses = localExpenses.filter((item: Expense) => item && item.id && !serverExpenseIds.has(item.id));
        const mergedExpenses = [...(Array.isArray(e) ? e : []), ...unsyncedExpenses];
        setExpenses(mergedExpenses);

        if (unsyncedExpenses.length > 0) {
          api.createBatchExpenses(unsyncedExpenses).catch(err => console.warn('Could not sync local expenses to server:', err));
        }

        // Merge local tax documents if any were not yet synced
        const localDocs: TaxDocument[] = loadFromLS('ff_tax_docs', []);
        const serverDocIds = new Set((Array.isArray(td) ? td : []).map((item: TaxDocument) => item.id));
        const unsyncedDocs = localDocs.filter((item: TaxDocument) => item && item.id && !serverDocIds.has(item.id));
        const mergedDocs = [...(Array.isArray(td) ? td : []), ...unsyncedDocs];
        setTaxDocuments(mergedDocs);
        setPackages(ensureFreePackage(pkg, DEFAULT_FREE_CLIENT_PACKAGE));
        setAccountantPackages(ensureFreePackage(apkg, DEFAULT_FREE_ACCOUNTANT_PACKAGE));
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

  // Fallback: sync to localStorage as cache.
  // Wrap writes in try/catch so a single oversized item (e.g. a payment method
  // with an embedded QR image) hitting the localStorage quota does not abort the
  // remaining writes, which include the current-user session.
  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`No se pudo persistir "${key}" en localStorage (límite de cuota).`, e);
    }
  };

  useEffect(() => { safeSetItem('ff_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { if (currentUser) safeSetItem('ff_current_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { safeSetItem('ff_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { safeSetItem('ff_tax_docs', JSON.stringify(taxDocuments)); }, [taxDocuments]);
  useEffect(() => { safeSetItem('ff_packages', JSON.stringify(packages)); }, [packages]);
  useEffect(() => { safeSetItem('ff_accountant_packages', JSON.stringify(accountantPackages)); }, [accountantPackages]);
  useEffect(() => { safeSetItem('ff_payment_methods', JSON.stringify(paymentMethods)); }, [paymentMethods]);
  useEffect(() => { safeSetItem('ff_subscription_history', JSON.stringify(subscriptionHistory)); }, [subscriptionHistory]);
  useEffect(() => { safeSetItem('ff_complaints', JSON.stringify(complaints)); }, [complaints]);
  useEffect(() => { safeSetItem('ff_sunat_global', JSON.stringify(sunatGlobalConfig)); }, [sunatGlobalConfig]);
  useEffect(() => { safeSetItem('ff_user_products', JSON.stringify(userProducts)); }, [userProducts]);
  useEffect(() => { safeSetItem('ff_pending_invoices', JSON.stringify(pendingInvoices)); }, [pendingInvoices]);
  useEffect(() => { safeSetItem('ff_companies', JSON.stringify(companies)); }, [companies]);
  useEffect(() => { safeSetItem('ff_selected_company_id', JSON.stringify(selectedCompanyId)); }, [selectedCompanyId]);

  const addOrUpdateSavedAccount = (user: User, subUser?: User | null) => {
    setSavedAccounts(prev => {
      const activeUser = subUser || user;
      const label = getAccountTypeLabel(activeUser, !!subUser);
      const newEntry: SavedAccount = {
        userId: user.id,
        subUserId: subUser ? subUser.id : undefined,
        name: activeUser.name,
        email: activeUser.email,
        role: activeUser.role,
        profilePicture: activeUser.profilePicture,
        accountTypeLabel: label,
        lastActive: Date.now()
      };
      const filtered = prev.filter(a => !(a.userId === user.id && (a.subUserId || '') === (subUser ? subUser.id : '')));
      const updated = [newEntry, ...filtered];
      safeSetItem('ff_saved_accounts', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (currentUser) {
      addOrUpdateSavedAccount(currentUser, currentSubUser);
    }
  }, [currentUser?.id, currentSubUser?.id]);

  const switchAccount = (userId: string, subUserId?: string) => {
    // SECURITY CHECK: Ensure user is in savedAccounts
    const isSaved = savedAccounts.some(a => a.userId === userId && (a.subUserId || '') === (subUserId || ''));
    if (!isSaved) {
      console.warn('Intento no autorizado de cambiar a una cuenta no guardada:', userId);
      return;
    }

    const mainUser = users.find(u => u.id === userId);
    if (!mainUser) return;

    let subUser: User | null = null;
    if (subUserId) {
      subUser = users.find(u => u.id === subUserId) || null;
    }

    if (subUser) {
      setCurrentUser(mainUser);
      setCurrentSubUser(subUser);
      safeSetItem('ff_current_user', JSON.stringify(mainUser));
      safeSetItem('ff_current_sub_user', JSON.stringify(subUser));
    } else {
      setCurrentUser(mainUser);
      setCurrentSubUser(null);
      safeSetItem('ff_current_user', JSON.stringify(mainUser));
      localStorage.removeItem('ff_current_sub_user');
    }

    const effectiveUser = subUser || mainUser;
    const targetUserId = effectiveUser.id;
    const userCompanies = companies.filter(c =>
      c.ownerUserId === targetUserId ||
      c.ownerUserId === mainUser.id ||
      c.assignedAccountantId === mainUser.id ||
      (subUser && c.ownerUserId === subUser.parentId) ||
      (mainUser.parentId && c.ownerUserId === mainUser.parentId)
    );

    if (userCompanies.length > 0) {
      setSelectedCompanyId(userCompanies[0].id);
      safeSetItem('ff_selected_company_id', JSON.stringify(userCompanies[0].id));
    } else {
      setSelectedCompanyId(null);
      localStorage.removeItem('ff_selected_company_id');
    }

    addOrUpdateSavedAccount(mainUser, subUser);
  };

  const removeSavedAccount = (userId: string, subUserId?: string) => {
    const isCurrentActive = currentUser && currentUser.id === userId && (currentSubUser?.id || '') === (subUserId || '');

    const updated = savedAccounts.filter(a => !(a.userId === userId && (a.subUserId || '') === (subUserId || '')));
    setSavedAccounts(updated);
    safeSetItem('ff_saved_accounts', JSON.stringify(updated));

    // If removing the active user, switch cleanly to remaining account or purge session completely!
    if (isCurrentActive) {
      if (updated.length > 0) {
        const nextAcc = updated[0];
        const mainUser = users.find(u => u.id === nextAcc.userId);
        if (mainUser) {
          const subUser = nextAcc.subUserId ? users.find(u => u.id === nextAcc.subUserId) || null : null;
          setCurrentUser(mainUser);
          setCurrentSubUser(subUser);
          safeSetItem('ff_current_user', JSON.stringify(mainUser));
          if (subUser) safeSetItem('ff_current_sub_user', JSON.stringify(subUser));
          else localStorage.removeItem('ff_current_sub_user');

          const targetUserId = subUser ? subUser.id : mainUser.id;
          const userCompanies = companies.filter(c =>
            c.ownerUserId === targetUserId ||
            c.ownerUserId === mainUser.id ||
            c.assignedAccountantId === mainUser.id ||
            (subUser && c.ownerUserId === subUser.parentId) ||
            (mainUser.parentId && c.ownerUserId === mainUser.parentId)
          );

          if (userCompanies.length > 0) {
            setSelectedCompanyId(userCompanies[0].id);
            safeSetItem('ff_selected_company_id', JSON.stringify(userCompanies[0].id));
          } else {
            setSelectedCompanyId(null);
            localStorage.removeItem('ff_selected_company_id');
          }
        } else {
          setCurrentUser(null);
          setCurrentSubUser(null);
          setSelectedCompanyId(null);
          localStorage.removeItem('ff_current_user');
          localStorage.removeItem('ff_current_sub_user');
          localStorage.removeItem('ff_selected_company_id');
        }
      } else {
        setCurrentUser(null);
        setCurrentSubUser(null);
        setSelectedCompanyId(null);
        localStorage.removeItem('ff_current_user');
        localStorage.removeItem('ff_current_sub_user');
        localStorage.removeItem('ff_selected_company_id');
      }
    }
  };

  useEffect(() => {
    if (!currentUser) {
      if (selectedCompanyId) {
        setSelectedCompanyId(null);
        localStorage.removeItem('ff_selected_company_id');
      }
      return;
    }
    const targetUserId = currentSubUser ? currentSubUser.id : currentUser.id;
    const userCompanies = companies.filter(c =>
      c.ownerUserId === targetUserId ||
      c.ownerUserId === currentUser.id ||
      c.assignedAccountantId === currentUser.id ||
      (currentSubUser && c.ownerUserId === currentSubUser.parentId) ||
      (currentUser.parentId && c.ownerUserId === currentUser.parentId)
    );

    const validSelected = userCompanies.find(c => c.id === selectedCompanyId);
    if (!validSelected) {
      if (userCompanies.length > 0) {
        setSelectedCompanyId(userCompanies[0].id);
        safeSetItem('ff_selected_company_id', JSON.stringify(userCompanies[0].id));
      } else {
        setSelectedCompanyId(null);
        localStorage.removeItem('ff_selected_company_id');
      }
    }
  }, [currentUser?.id, currentSubUser?.id, companies, selectedCompanyId]);

  const login = (email: string, password: string): boolean => {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) { alert("Credenciales incorrectas."); return false; }
    if (user.password && user.password !== password) { alert("Credenciales incorrectas."); return false; }

    if (user.isVerified === false || (user as any).is_verified === 0) {
      alert("Debes activar tu cuenta desde el enlace enviado a tu correo antes de ingresar.");
      return false;
    }
    
    if (user.role === UserRole.SUB_USER && user.parentId) {
      const parent = users.find(u => u.id === user.parentId);
      if (!parent) { alert("Cuenta principal no encontrada."); return false; }
      setCurrentUser(parent);
      setCurrentSubUser(user);
      localStorage.setItem('ff_current_user', JSON.stringify(parent));
      localStorage.setItem('ff_current_sub_user', JSON.stringify(user));
      addOrUpdateSavedAccount(parent, user);
    } else {
      setCurrentUser(user);
      setCurrentSubUser(null);
      localStorage.setItem('ff_current_user', JSON.stringify(user));
      localStorage.removeItem('ff_current_sub_user');
      addOrUpdateSavedAccount(user, null);
    }
    return true;
  };

  const logout = () => {
    if (!currentUser) {
      setCurrentUser(null);
      setCurrentSubUser(null);
      localStorage.removeItem('ff_current_user');
      localStorage.removeItem('ff_current_sub_user');
      return;
    }

    const currentUserId = currentUser.id;
    const currentSubUserId = currentSubUser?.id;

    const remaining = savedAccounts.filter(
      a => !(a.userId === currentUserId && (a.subUserId || '') === (currentSubUserId || ''))
    );

    setSavedAccounts(remaining);
    safeSetItem('ff_saved_accounts', JSON.stringify(remaining));

    if (remaining.length > 0) {
      const nextAcc = remaining[0];
      switchAccount(nextAcc.userId, nextAcc.subUserId);
    } else {
      setCurrentUser(null);
      setCurrentSubUser(null);
      localStorage.removeItem('ff_current_user');
      localStorage.removeItem('ff_current_sub_user');
    }
  };

  const registerUser = async (user: User) => {
    const normalized = { ...user, role: normalizeRole(user.role) };
    try {
      await api.createUser(normalized);
    } catch (e: any) {
      console.error('Error al registrar usuario:', e);
      throw e;
    }
    setUsers(prev => [...prev, normalized]);
  };

  const updateUser = async (userId: string, data: Partial<User>) => {
    try {
      await api.updateUser(userId, data);
    } catch (e: any) {
      console.error('Error al actualizar usuario:', e);
      throw e;
    }
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

  const generatePassword = (length = 12): string => {
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*()_+-=';
    const allChars = uppers + lowers + numbers + specials;

    const getRandomChar = (set: string) => {
      const array = new Uint8Array(1);
      crypto.getRandomValues(array);
      return set[array[0] % set.length];
    };

    // Guarantee at least one of each required type
    const passArr = [
      getRandomChar(uppers),
      getRandomChar(lowers),
      getRandomChar(numbers),
      getRandomChar(specials)
    ];

    // Fill the rest with random characters from all sets
    for (let i = passArr.length; i < Math.max(8, length); i++) {
      passArr.push(getRandomChar(allChars));
    }

    // Shuffle the array
    for (let i = passArr.length - 1; i > 0; i--) {
      const randArr = new Uint8Array(1);
      crypto.getRandomValues(randArr);
      const j = randArr[0] % (i + 1);
      [passArr[i], passArr[j]] = [passArr[j], passArr[i]];
    }

    return passArr.join('');
  };

  const resetUserPassword = async (userId: string): Promise<string | null> => {
    const user = users.find(u => u.id === userId);
    if (!user) return null;

    const newPassword = generatePassword();
    try {
      await api.resetUserPassword(userId, { password: newPassword, mustChangePassword: true });
    } catch {
      try {
        await api.updateUser(userId, { password: newPassword, mustChangePassword: true });
      } catch (err: any) {
        console.error('Error al resetear contraseña:', err);
        return null;
      }
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPassword, mustChangePassword: true } : u));

    fetch('/api/send-password-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, name: user.name, password: newPassword })
    }).catch(() => {});

    return newPassword;
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    try {
      await api.forgotPassword(email);
      return true;
    } catch (e) {
      console.error('Error en recuperación de contraseña:', e);
      return false;
    }
  };

  const updateUserStatus = (userId: string, status: SubscriptionStatus) => updateUser(userId, { subscriptionStatus: status });

  const addExpense = (expense: Expense) => {
    setExpenses(prev => [expense, ...prev.filter(x => x.id !== expense.id)]);
    api.createExpense(expense).catch(err => {
      console.warn('Error saving expense to server, retained locally:', err);
    });
  };

  const addBatchExpenses = (expenseList: Expense[]) => {
    const incomingIds = new Set(expenseList.map(x => x.id));
    setExpenses(prev => [...expenseList, ...prev.filter(x => !incomingIds.has(x.id))]);
    api.createBatchExpenses(expenseList).catch(err => {
      console.warn('Error saving batch expenses to server, retained locally:', err);
    });
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

  const addSubUser = async (subUser: User) => {
    try {
      await api.createUser(subUser);
    } catch (e: any) {
      console.error('Error al crear sub-usuario:', e);
      throw e;
    }
    setUsers(prev => [...prev, subUser]);
  };

  const deleteSubUser = (userId: string) => {
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

const updateAccountantPackage = (id: string, details: Partial<SubscriptionPackage>) => {
   const pkg = accountantPackages.find(p => p.id === id);
   if (pkg) {
     api.updatePackage(id, { ...pkg, ...details }).catch(() => {});
   }
   setAccountantPackages(prev => prev.map(p => p.id === id ? { ...p, ...details } : p));
 };

   const createPackage = (pkg: SubscriptionPackage) => {
   api.createPackage(pkg).catch(() => {});
   if (pkg.type === 'ACCOUNTANT') {
     setAccountantPackages(prev => [...prev, pkg]);
   } else {
     setPackages(prev => [...prev, pkg]);
   }
 };

   const deletePackage = (id: string) => {
   api.deletePackage(id).catch(() => {});
   setPackages(prev => prev.filter(p => p.id !== id));
   setAccountantPackages(prev => prev.filter(p => p.id !== id));
 };

   const assignAccountant = (companyId: string, accountantId: string) => {
    api.updateCompany(companyId, { assignedAccountantId: accountantId }).catch(() => {});
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, assignedAccountantId: accountantId } : c));
  };

  const addSubscriptionRecord = (record: SubscriptionRecord) => {
    api.createSubscriptionRecord(record).catch((err) => {
      console.error("Error creating subscription record:", err);
      alert("Error al registrar el pago en el servidor: " + (err.message || err));
    });
    setSubscriptionHistory(prev => [record, ...prev]);
  };

  const updateSubscriptionRecord = (id: string, details: Partial<SubscriptionRecord>) => {
    api.updateSubscriptionRecord(id, details).catch((err) => {
      console.error("Error updating subscription record:", err);
      alert("Error al actualizar la suscripción en el servidor: " + (err.message || err));
    });
    setSubscriptionHistory(prev => prev.map(s => s.id === id ? { ...s, ...details } : s));
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

  const addPaymentAlert = (alert: PaymentAlert) => {
    api.createPaymentAlert(alert).catch(() => {});
    setPaymentAlerts(prev => [alert, ...prev]);
  };

  const updatePaymentAlert = (id: string, data: Partial<PaymentAlert>) => {
    api.updatePaymentAlert(id, data).catch(() => {});
    setPaymentAlerts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  };

  const deletePaymentAlert = (id: string) => {
    api.deletePaymentAlert(id).catch(() => {});
    setPaymentAlerts(prev => prev.filter(a => a.id !== id));
  };

  const addPersonalExpense = (expense: PersonalExpense) => {
    api.createPersonalExpense(expense).catch(() => {});
    setPersonalExpenses(prev => [expense, ...prev]);
  };

  const updatePersonalExpense = (id: string, data: Partial<PersonalExpense>) => {
    api.updatePersonalExpense(id, data).catch(() => {});
    setPersonalExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const deletePersonalExpense = (id: string) => {
    api.deletePersonalExpense(id).catch(() => {});
    setPersonalExpenses(prev => prev.filter(e => e.id !== id));
  };

  const markPaymentAlertPaid = (id: string, recordAsExpense?: boolean) => {
    const alert = paymentAlerts.find(a => a.id === id);
    if (!alert) return;
    const today = new Date().toISOString().split('T')[0];

    let nextDueDate = alert.dueDate;
    if (alert.frequency === 'MENSUAL') {
      const d = new Date(alert.dueDate);
      d.setMonth(d.getMonth() + 1);
      nextDueDate = d.toISOString().split('T')[0];
    } else if (alert.frequency === 'QUINCENAL') {
      const d = new Date(alert.dueDate);
      d.setDate(d.getDate() + 15);
      nextDueDate = d.toISOString().split('T')[0];
    } else if (alert.frequency === 'ANUAL') {
      const d = new Date(alert.dueDate);
      d.setFullYear(d.getFullYear() + 1);
      nextDueDate = d.toISOString().split('T')[0];
    }

    const nextStatus = alert.frequency === 'UNICO' ? 'PAGADO' : 'PENDIENTE';
    const updates: Partial<PaymentAlert> = {
      status: nextStatus,
      dueDate: nextDueDate,
      lastPaidDate: today,
    };

    updatePaymentAlert(id, updates);

    if (recordAsExpense && currentUser) {
      addExpense({
        id: `exp-alert-${Date.now()}`,
        userId: currentUser.id,
        companyId: alert.companyId || selectedCompanyId || undefined,
        amount: alert.amount,
        currency: alert.currency,
        description: `Pago: ${alert.title}`,
        date: today,
        category: alert.category === 'LUZ' || alert.category === 'AGUA' || alert.category === 'INTERNET' ? 'Servicios Básicos' : alert.category === 'PRESTAMO' ? 'Financiero' : alert.category === 'ALQUILER' ? 'Alquileres' : 'Servicios',
      });
    }
  };

  const updatePendingInvoiceStatus = (id: string, status: PendingInvoice['status'], lastError?: string) => {
    setPendingInvoices(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newAttempts = status === 'PENDIENTE' ? (p.attemptCount || 0) + 1 : p.attemptCount;
      const lastAttemptAt = new Date().toISOString();
      const updated = { ...p, status, lastAttempt: lastAttemptAt.split('T')[0], lastAttemptAt, attemptCount: newAttempts, lastError };
      api.updatePendingInvoice(id, { status, lastAttempt: updated.lastAttempt, lastAttemptAt, attemptCount: newAttempts, lastError }).catch(() => {});
      return updated;
    }));
  };

  const addCompany = (company: Company) => {
    api.createCompany(company).catch(() => {});
    setCompanies(prev => [...prev, company]);
  };

  const updateCompany = (id: string, data: Partial<Company>) => {
    api.updateCompany(id, data).catch(() => {});
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCompany = (id: string) => {
    api.deleteCompany(id).catch(() => {});
    setCompanies(prev => prev.filter(c => c.id !== id));
    setTaxDocuments(prev => prev.filter(d => d.companyId !== id));
    setExpenses(prev => prev.filter(e => e.companyId !== id));
    setUserProducts(prev => prev.filter(p => p.companyId !== id));
    setPendingInvoices(prev => prev.filter(p => p.companyId !== id));
    if (selectedCompanyId === id) setSelectedCompanyId(null);
    Object.keys(localStorage).forEach(k => { if (k.startsWith(`ff_corr_${id}_`)) localStorage.removeItem(k); });
  };

  const selectCompany = (id: string | null) => {
    setSelectedCompanyId(id);
  };

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId || !currentUser) return null;
    const targetUserId = currentSubUser ? currentSubUser.id : currentUser.id;
    return companies.find(c =>
      c.id === selectedCompanyId &&
      (c.ownerUserId === targetUserId ||
       c.ownerUserId === currentUser.id ||
       c.assignedAccountantId === currentUser.id ||
       (currentSubUser && c.ownerUserId === currentSubUser.parentId) ||
       (currentUser.parentId && c.ownerUserId === currentUser.parentId))
    ) || null;
  }, [companies, selectedCompanyId, currentUser, currentSubUser]);

  const refreshData = async () => {
    try {
      // Empresas a las que el usuario puede acceder (dueño, contador asignado o sub-usuario del dueño).
      // Los comprobantes se comparten por empresa: todos sus usuarios ven los mismos documentos.
      const accessibleCompanyIds = companies
        .filter(c =>
          c.ownerUserId === currentUser?.id ||
          c.assignedAccountantId === currentUser?.id ||
          (currentUser?.parentId && c.ownerUserId === currentUser.parentId)
        )
        .map(c => c.id)
        .filter(Boolean);
      const companyQuery = accessibleCompanyIds.length ? accessibleCompanyIds.join(',') : undefined;
      const [u, comp, e, td, pkg, apkg, pm, sh, cp, up, pi, sc, n] = await Promise.all([
        api.fetchUsers().catch(() => users),
        api.fetchCompanies().catch(() => companies),
        api.fetchExpenses().catch(() => expenses),
        api.fetchTaxDocuments(undefined, companyQuery).catch(() => taxDocuments),
        api.fetchPackages('CLIENT').catch(() => packages),
        api.fetchPackages('ACCOUNTANT').catch(() => accountantPackages),
        api.fetchPaymentMethods().catch(() => paymentMethods),
        api.fetchSubscriptionHistory().catch(() => subscriptionHistory),
        api.fetchComplaints().catch(() => complaints),
        api.fetchUserProducts().catch(() => userProducts),
        api.fetchPendingInvoices(undefined, companyQuery).catch(() => pendingInvoices),
        api.fetchSunatConfig().catch(() => sunatGlobalConfig),
        api.fetchNotifications().catch(() => notifications),
      ]);
      setUsers(u);
      setCompanies(comp);
      setExpenses(e);
      setTaxDocuments(td);
      setPackages(pkg);
      setAccountantPackages(apkg);
      setPaymentMethods(pm);
      setSubscriptionHistory(sh);
      setComplaints(cp);
      setUserProducts(up);
      setPendingInvoices(pi);
      setSunatGlobalConfig(sc);
      setNotifications(n);
    } catch (err) {
      console.error('Error refreshing store:', err);
    }
  };

  // Refresco ligero de pendientes SUNAT: el worker del servidor puede emitirlos o
  // borrarlos en cualquier momento; así la UI refleja esos cambios sin recargar.
  useEffect(() => {
    if (!currentUser) return;
    const refreshPendings = async () => {
      try {
        const accessibleCompanyIds = companies
          .filter(c =>
            c.ownerUserId === currentUser.id ||
            c.assignedAccountantId === currentUser.id ||
            (currentUser.parentId && c.ownerUserId === currentUser.parentId)
          )
          .map(c => c.id)
          .filter(Boolean);
        const companyQuery = accessibleCompanyIds.length ? accessibleCompanyIds.join(',') : undefined;
        const pi = await api.fetchPendingInvoices(undefined, companyQuery).catch(() => null);
        if (pi) setPendingInvoices(pi);
      } catch {}
    };
    const iv = setInterval(refreshPendings, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [currentUser?.id, companies]);


  return (
    <StoreContext.Provider value={{
      currentUser, currentSubUser, isSubUser, savedAccounts, users, companies, selectedCompanyId, selectedCompany, expenses, taxDocuments, packages, accountantPackages, paymentMethods, subscriptionHistory, notifications, complaints, sunatGlobalConfig, userProducts, pendingInvoices, loading, paymentAlerts, personalExpenses,
      login, switchAccount, removeSavedAccount, logout, registerUser, updateUser, updateUserStatus, addExpense, addBatchExpenses, addTaxDocument, deleteTaxDocument, changePassword, resetUserPassword, forgotPassword, generatePassword,
      deleteUser, addSubUser, deleteSubUser, updatePaymentMethod, updatePackage, updateAccountantPackage, createPackage, deletePackage, assignAccountant, addSubscriptionRecord, updateSubscriptionRecord,
      addNotification, markNotificationAsRead, addComplaint, updateComplaintStatus, updateSunatGlobalConfig, addUserProduct, removeUserProduct,
      addPendingInvoice, removePendingInvoice, updatePendingInvoiceStatus,
      addCompany, updateCompany, deleteCompany, selectCompany,
      addPaymentAlert, updatePaymentAlert, deletePaymentAlert, markPaymentAlertPaid,
      addPersonalExpense, updatePersonalExpense, deletePersonalExpense,
      refreshData
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
