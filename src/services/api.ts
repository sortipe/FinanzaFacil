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

// Users
export const fetchUsers = (): Promise<any> => request('/users');
export const fetchUser = (id: string): Promise<any> => request(`/users/${id}`);
export const createUser = (user: any): Promise<any> => request('/users', { method: 'POST', body: JSON.stringify(user) });
export const updateUser = (id: string, data: any): Promise<any> => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUser = (id: string): Promise<any> => request(`/users/${id}`, { method: 'DELETE' });

// Expenses
export const fetchExpenses = (userId?: string): Promise<any> => request(`/expenses${userId ? `?userId=${userId}` : ''}`);
export const createExpense = (expense: any): Promise<any> => request('/expenses', { method: 'POST', body: JSON.stringify(expense) });
export const deleteExpense = (id: string): Promise<any> => request(`/expenses/${id}`, { method: 'DELETE' });

// Tax Documents
export const fetchTaxDocuments = (userId?: string): Promise<any> => request(`/tax-documents${userId ? `?userId=${userId}` : ''}`);
export const createTaxDocument = (doc: any): Promise<any> => request('/tax-documents', { method: 'POST', body: JSON.stringify(doc) });
export const deleteTaxDocument = (id: string): Promise<any> => request(`/tax-documents/${id}`, { method: 'DELETE' });

// Packages
export const fetchPackages = (): Promise<any> => request('/packages');
export const createPackage = (pkg: any): Promise<any> => request('/packages', { method: 'POST', body: JSON.stringify(pkg) });
export const updatePackage = (id: string, data: any): Promise<any> => request(`/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePackage = (id: string): Promise<any> => request(`/packages/${id}`, { method: 'DELETE' });

// Payment Methods
export const fetchPaymentMethods = (): Promise<any> => request('/payment-methods');
export const createPaymentMethod = (pm: any): Promise<any> => request('/payment-methods', { method: 'POST', body: JSON.stringify(pm) });
export const updatePaymentMethod = (id: string, data: any): Promise<any> => request(`/payment-methods/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Subscription History
export const fetchSubscriptionHistory = (userId?: string): Promise<any> => request(`/subscription-history${userId ? `?userId=${userId}` : ''}`);
export const createSubscriptionRecord = (record: any): Promise<any> => request('/subscription-history', { method: 'POST', body: JSON.stringify(record) });
export const updateSubscriptionRecord = (id: string, record: any): Promise<any> => request(`/subscription-history/${id}`, { method: 'PUT', body: JSON.stringify(record) });

// Complaints
export const fetchComplaints = (): Promise<any> => request('/complaints');
export const createComplaint = (complaint: any): Promise<any> => request('/complaints', { method: 'POST', body: JSON.stringify(complaint) });
export const updateComplaintStatus = (id: string, status: string): Promise<any> => request(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });

// User Products
export const fetchUserProducts = (userId?: string): Promise<any> => request(`/user-products${userId ? `?userId=${userId}` : ''}`);
export const createUserProduct = (product: any): Promise<any> => request('/user-products', { method: 'POST', body: JSON.stringify(product) });
export const updateUserProduct = (id: string, data: any): Promise<any> => request(`/user-products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUserProduct = (id: string): Promise<any> => request(`/user-products/${id}`, { method: 'DELETE' });

// Pending Invoices
export const fetchPendingInvoices = (userId?: string): Promise<any> => request(`/pending-invoices${userId ? `?userId=${userId}` : ''}`);
export const createPendingInvoice = (invoice: any): Promise<any> => request('/pending-invoices', { method: 'POST', body: JSON.stringify(invoice) });
export const updatePendingInvoice = (id: string, data: any): Promise<any> => request(`/pending-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePendingInvoice = (id: string): Promise<any> => request(`/pending-invoices/${id}`, { method: 'DELETE' });

// Sunat Config
export const fetchSunatConfig = (): Promise<any> => request('/sunat-config');
export const updateSunatConfig = (config: any): Promise<any> => request('/sunat-config', { method: 'PUT', body: JSON.stringify(config) });

// Notifications
export const fetchNotifications = (): Promise<any> => request('/notifications');
export const createNotification = (notification: any): Promise<any> => request('/notifications', { method: 'POST', body: JSON.stringify(notification) });
export const deleteNotification = (id: string): Promise<any> => request(`/notifications/${id}`, { method: 'DELETE' });
