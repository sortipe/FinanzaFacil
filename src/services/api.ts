const API_BASE = '/api';

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

const buildQuery = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? '?' + new URLSearchParams(entries as [string, string][]).toString() : '';
};

// Users
export const fetchUsers = (): Promise<any> => request('/users');
export const fetchUser = (id: string): Promise<any> => request(`/users/${id}`);
export const createUser = (user: any): Promise<any> => request('/users', { method: 'POST', body: JSON.stringify(user) });
export const verifyCredentials = (email: string, password: string): Promise<any> =>
  request('/verify-credentials', { method: 'POST', body: JSON.stringify({ email, password }) });
export const updateUser = (id: string, data: any): Promise<any> => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const resetUserPassword = (id: string, data: { password: string; mustChangePassword?: boolean }): Promise<any> =>
  request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) });
export const deleteUser = (id: string): Promise<any> => request(`/users/${id}`, { method: 'DELETE' });
export const sendPasswordResetEmail = (payload: { email: string; name: string; password: string }): Promise<any> =>
  request('/send-password-reset-email', { method: 'POST', body: JSON.stringify(payload) });
export const forgotPassword = (email: string): Promise<any> =>
  request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
export const verifyEmailToken = (token: string): Promise<any> =>
  request('/auth/verify-token', { method: 'POST', body: JSON.stringify({ token }) });
export const resendVerificationEmail = (email: string): Promise<any> =>
  request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });

// Companies
export const fetchCompanies = (userId?: string): Promise<any> => request(`/companies${buildQuery({ userId })}`);
export const fetchCompany = (id: string): Promise<any> => request(`/companies/${id}`);
export const createCompany = (company: any): Promise<any> => request('/companies', { method: 'POST', body: JSON.stringify(company) });
export const updateCompany = (id: string, data: any): Promise<any> => request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCompany = (id: string): Promise<any> => request(`/companies/${id}`, { method: 'DELETE' });

// Expenses
export const fetchExpenses = (userId?: string, companyId?: string): Promise<any> => request(`/expenses${buildQuery({ userId, companyId })}`);
export const createExpense = (expense: any): Promise<any> => request('/expenses', { method: 'POST', body: JSON.stringify(expense) });
export const createBatchExpenses = (expensesList: any[]): Promise<any> => request('/expenses/batch', { method: 'POST', body: JSON.stringify(expensesList) });
export const deleteExpense = (id: string): Promise<any> => request(`/expenses/${id}`, { method: 'DELETE' });

// Tax Documents
export const fetchTaxDocuments = (userId?: string, companyId?: string): Promise<any> => request(`/tax-documents${buildQuery({ userId, companyId })}`);
export const createTaxDocument = (doc: any): Promise<any> => request('/tax-documents', { method: 'POST', body: JSON.stringify(doc) });
export const deleteTaxDocument = (id: string): Promise<any> => request(`/tax-documents/${id}`, { method: 'DELETE' });

// Packages
export const fetchPackages = (type?: string): Promise<any> => request(`/packages${buildQuery({ type })}`);
export const createPackage = (pkg: any): Promise<any> => request('/packages', { method: 'POST', body: JSON.stringify(pkg) });
export const updatePackage = (id: string, data: any): Promise<any> => request(`/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePackage = (id: string): Promise<any> => request(`/packages/${id}`, { method: 'DELETE' });

// Payment Methods
export const fetchPaymentMethods = (): Promise<any> => request('/payment-methods');
export const createPaymentMethod = (pm: any): Promise<any> => request('/payment-methods', { method: 'POST', body: JSON.stringify(pm) });
export const updatePaymentMethod = (id: string, data: any): Promise<any> => request(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Subscription History
export const fetchSubscriptionHistory = (userId?: string): Promise<any> => request(`/subscription-history${buildQuery({ userId })}`);
export const createSubscriptionRecord = (record: any): Promise<any> => request('/subscription-history', { method: 'POST', body: JSON.stringify(record) });
export const updateSubscriptionRecord = (id: string, record: any): Promise<any> => request(`/subscription-history/${id}`, { method: 'PUT', body: JSON.stringify(record) });

// Complaints
export const fetchComplaints = (companyId?: string): Promise<any> => request(`/complaints${buildQuery({ companyId })}`);
export const createComplaint = (complaint: any): Promise<any> => request('/complaints', { method: 'POST', body: JSON.stringify(complaint) });
export const updateComplaintStatus = (id: string, status: string): Promise<any> => request(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });

// User Products
export const fetchUserProducts = (userId?: string, companyId?: string): Promise<any> => request(`/user-products${buildQuery({ userId, companyId })}`);
export const createUserProduct = (product: any): Promise<any> => request('/user-products', { method: 'POST', body: JSON.stringify(product) });
export const updateUserProduct = (id: string, data: any): Promise<any> => request(`/user-products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUserProduct = (id: string): Promise<any> => request(`/user-products/${id}`, { method: 'DELETE' });

// Pending Invoices
export const fetchPendingInvoices = (userId?: string, companyId?: string): Promise<any> => request(`/pending-invoices${buildQuery({ userId, companyId })}`);
export const createPendingInvoice = (invoice: any): Promise<any> => request('/pending-invoices', { method: 'POST', body: JSON.stringify(invoice) });
export const updatePendingInvoice = (id: string, data: any): Promise<any> => request(`/pending-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePendingInvoice = (id: string): Promise<any> => request(`/pending-invoices/${id}`, { method: 'DELETE' });

// Correlativos (compartidos por empresa + serie en la BD)
export const getNextCorrelative = (companyId: string, serie: string): Promise<any> =>
  request(`/next-correlative${buildQuery({ companyId, serie })}`);
export const allocateNextCorrelative = (companyId: string, serie: string, requested?: number): Promise<any> =>
  request('/next-correlative', { method: 'POST', body: JSON.stringify({ companyId, serie, requested }) });
export const setCorrelativoBaseline = (companyId: string, serie: string, lastUsed: number): Promise<any> =>
  request('/correlativos', { method: 'POST', body: JSON.stringify({ companyId, serie, lastUsed }) });

// Sunat Config
export const fetchSunatConfig = (): Promise<any> => request('/sunat-config');
export const updateSunatConfig = (config: any): Promise<any> => request('/sunat-config', { method: 'PUT', body: JSON.stringify(config) });

// Notifications
export const fetchNotifications = (): Promise<any> => request('/notifications');
export const createNotification = (notification: any): Promise<any> => request('/notifications', { method: 'POST', body: JSON.stringify(notification) });
export const deleteNotification = (id: string): Promise<any> => request(`/notifications/${id}`, { method: 'DELETE' });

// Payment Alerts
export const fetchPaymentAlerts = (params?: { userId?: string; companyId?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.userId) query.append('userId', params.userId);
  if (params?.companyId) query.append('companyId', params.companyId);
  return request(`/payment-alerts?${query.toString()}`);
};
export const createPaymentAlert = (alert: any): Promise<any> => request('/payment-alerts', { method: 'POST', body: JSON.stringify(alert) });
export const updatePaymentAlert = (id: string, alert: any): Promise<any> => request(`/payment-alerts/${id}`, { method: 'PUT', body: JSON.stringify(alert) });
export const deletePaymentAlert = (id: string): Promise<any> => request(`/payment-alerts/${id}`, { method: 'DELETE' });

// Personal Expenses
export const fetchPersonalExpenses = (params?: { userId?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.userId) query.append('userId', params.userId);
  return request(`/personal-expenses?${query.toString()}`);
};
export const createPersonalExpense = (expense: any): Promise<any> => request('/personal-expenses', { method: 'POST', body: JSON.stringify(expense) });
export const updatePersonalExpense = (id: string, expense: any): Promise<any> => request(`/personal-expenses/${id}`, { method: 'PUT', body: JSON.stringify(expense) });
export const deletePersonalExpense = (id: string): Promise<any> => request(`/personal-expenses/${id}`, { method: 'DELETE' });

// SIRE (Sistema Integrado de Registros Electrónicos)
export const fetchSireRegistros = (companyId: string, periodo?: string): Promise<any> => request(`/sire/registros${buildQuery({ companyId, periodo })}`);
export const fetchSireComprobantes = (companyId: string, periodo: string, tipo: string): Promise<any> => request(`/sire/comprobantes${buildQuery({ companyId, periodo, tipo })}`);
export const generarSireLocal = (data: { companyId: string; periodo: string; tipo: string }): Promise<any> => request('/sire/generar', { method: 'POST', body: JSON.stringify(data) });
export const aceptarSirePropuesta = (data: { companyId: string; periodo: string; tipo: string }): Promise<any> => request('/sire/aceptar', { method: 'POST', body: JSON.stringify(data) });
export const exportarSireTxt = (companyId: string, periodo: string, tipo: string): Promise<any> => request(`/sire/exportar-txt${buildQuery({ companyId, periodo, tipo })}`);

// SIRE Direct API SUNAT OAuth2
export const conectarSireSunatOAuth2 = (companyId: string): Promise<any> => request('/sire/sunat/conectar', { method: 'POST', body: JSON.stringify({ companyId }) });
export const consultarPropuestaSunatOAuth2 = (data: { companyId: string; periodo: string; tipo: string }): Promise<any> => request('/sire/sunat/propuesta', { method: 'POST', body: JSON.stringify(data) });
export const aceptarPropuestaSunatOAuth2 = (data: { companyId: string; periodo: string; tipo: string }): Promise<any> => request('/sire/sunat/aceptar', { method: 'POST', body: JSON.stringify(data) });
