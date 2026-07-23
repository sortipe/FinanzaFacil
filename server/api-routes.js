const express = require('express');
const router = express.Router();
const db = require('./db');

// Helper: map DB snake_case row to frontend camelCase
const mapRow = (row, fields) => {
  const obj = {};
  for (const [from, to] of Object.entries(fields)) {
    obj[to] = row[from] ?? null;
  }
  return obj;
};

const USER_FIELDS = {
  id: 'id', name: 'name', email: 'email', role: 'role', password: 'password',
  must_change_password: 'mustChangePassword', subscription_status: 'subscriptionStatus',
  assigned_accountant_id: 'assignedAccountantId', profile_picture: 'profilePicture',
  subscription_start_date: 'subscriptionStartDate', subscription_end_date: 'subscriptionEndDate',
  ruc: 'ruc', dni: 'dni', business_name: 'businessName', tax_address: 'taxAddress',
  sol_user: 'solUser', sol_pass: 'solPass', sunat_token: 'sunatToken', sunat_api_url: 'sunatApiUrl',
  cert_base64: 'certBase64', cert_pass: 'certPass', serie_factura: 'serieFactura',
  serie_boleta: 'serieBoleta', sunat_env: 'sunatEnv', created_at: 'createdAt', updated_at: 'updatedAt'
};

const EXPENSE_FIELDS = {
  id: 'id', user_id: 'userId', amount: 'amount', currency: 'currency',
  description: 'description', date: 'date', category: 'category',
  internal_voucher_url: 'internalVoucherUrl', accountant_voucher_url: 'accountantVoucherUrl',
  invoice_number: 'invoiceNumber', ruc: 'ruc', subtotal: 'subtotal', igv: 'igv',
  is_private: 'isPrivate', created_at: 'createdAt'
};

const TAXDOC_FIELDS = {
  id: 'id', user_id: 'userId', accountant_id: 'accountantId', name: 'name',
  file_url: 'fileUrl', mime_type: 'mimeType', upload_date: 'uploadDate',
  period_month: 'periodMonth', period_year: 'periodYear', sunat_status: 'sunatStatus',
  sunat_hash: 'sunatHash', uploaded_by: 'uploadedBy', pdf_url: 'pdfUrl',
  xml_url: 'xmlUrl', cdr_url: 'cdrUrl', xml_content: 'xmlContent',
  cdr_base64: 'cdrBase64', created_at: 'createdAt'
};

const PACKAGE_FIELDS = {
  id: 'id', name: 'name', price: 'price', duration_months: 'durationMonths',
  features: 'features', created_at: 'createdAt'
};

const PAYMENT_METHOD_FIELDS = {
  id: 'id', name: 'name', details: 'details', qr_image: 'qrImage',
  is_active: 'isActive', created_at: 'createdAt'
};

const SUBSCRIPTION_FIELDS = {
  id: 'id', user_id: 'userId', package_name: 'packageName', amount: 'amount',
  date: 'date', start_date: 'startDate', end_date: 'endDate', status: 'status',
  payment_details: 'paymentDetails', voucher_image: 'voucherImage', created_at: 'createdAt'
};

const COMPLAINT_FIELDS = {
  id: 'id', user_id: 'userId', user_name: 'userName', user_email: 'userEmail',
  date: 'date', time: 'time', type: 'type', description: 'description',
  detail: 'detail', status: 'status', created_at: 'createdAt'
};

const USERPRODUCT_FIELDS = {
  id: 'id', user_id: 'userId', description: 'description', unit: 'unit',
  unit_price: 'unitPrice', last_used: 'lastUsed', created_at: 'createdAt'
};

const PENDINGINV_FIELDS = {
  id: 'id', user_id: 'userId', serie: 'serie', correlative: 'correlative',
  document_type: 'documentType', customer_doc_type: 'customerDocType',
  customer_doc_number: 'customerDocNumber', customer_name: 'customerName',
  amount: 'amount', created_at: 'createdAt', last_attempt: 'lastAttempt',
  attempt_count: 'attemptCount', status: 'status', last_error: 'lastError'
};

const SUNATCONFIG_FIELDS = { sunat_token: 'sunatToken', sunat_api_url: 'sunatApiUrl', updated_at: 'updatedAt' };

const NOTIFICATION_FIELDS = {
  id: 'id', user_id: 'userId', message: 'message', date: 'date',
  is_read: 'isRead', type: 'type', created_at: 'createdAt'
};

// --- USERS ---
router.get('/users', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(r => ({ ...r, ...mapRow(r, USER_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const [row] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(row ? { ...row, ...mapRow(row, USER_FIELDS) } : { error: 'User not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const user = req.body;
    await db.query(`INSERT INTO users (id, name, email, role, password, must_change_password, subscription_status, assigned_accountant_id, phone, profile_picture, subscription_start_date, subscription_end_date, ruc, dni, business_name, tax_address, sol_user, sol_pass, sunat_token, sunat_api_url, cert_base64, cert_pass, serie_factura, serie_boleta, sunat_env) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      user.id, user.name, user.email, user.role || 'USER', user.password || null, user.mustChangePassword ? 1 : 0,
      user.subscriptionStatus || 'PENDING', user.assignedAccountantId || null, user.phone || null, user.profilePicture || null,
      user.subscriptionStartDate || null, user.subscriptionEndDate || null, user.ruc || null, user.dni || null,
      user.businessName || null, user.taxAddress || null, user.solUser || null, user.solPass || null,
      user.sunatToken || null, user.sunatApiUrl || null, user.certBase64 || null, user.certPass || null,
      user.serieFactura || null, user.serieBoleta || null, user.sunatEnv || 'PRODUCTION'
    ]);
    res.json({ success: true, user });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const data = req.body;
    const fields = [];
    const values = [];
    const map = {
      name: 'name', email: 'email', role: 'role', password: 'password',
      mustChangePassword: 'must_change_password', subscriptionStatus: 'subscription_status',
      assignedAccountantId: 'assigned_accountant_id', phone: 'phone', profilePicture: 'profile_picture',
      subscriptionStartDate: 'subscription_start_date', subscriptionEndDate: 'subscription_end_date',
      ruc: 'ruc', dni: 'dni', businessName: 'business_name', taxAddress: 'tax_address',
      solUser: 'sol_user', solPass: 'sol_pass', sunatToken: 'sunat_token', sunatApiUrl: 'sunat_api_url',
      certBase64: 'cert_base64', certPass: 'cert_pass', serieFactura: 'serie_factura',
      serieBoleta: 'serie_boleta', sunatEnv: 'sunat_env'
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col}=?`);
        values.push(key === 'mustChangePassword' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (fields.length === 0) return res.json({ success: true });
    values.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);
    const [updated] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, user: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- EXPENSES ---
router.get('/expenses', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC' : 'SELECT * FROM expenses ORDER BY created_at DESC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => {
      const mapped = numFields({ ...r, ...mapRow(r, EXPENSE_FIELDS) }, ['amount', 'subtotal', 'igv']);
      mapped.isPrivate = !!r.is_private;
      return mapped;
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/expenses', async (req, res) => {
  try {
    const e = req.body;
    await db.query(`INSERT INTO expenses (id, user_id, amount, currency, description, date, category, internal_voucher_url, accountant_voucher_url, invoice_number, ruc, subtotal, igv, is_private) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      e.id, e.userId, e.amount, e.currency || 'PEN', e.description || null, e.date || null,
      e.category || null, e.internalVoucherUrl || null, e.accountantVoucherUrl || null,
      e.invoiceNumber || null, e.ruc || null, e.subtotal || null, e.igv || null, e.isPrivate ? 1 : 0
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TAX DOCUMENTS ---
router.get('/tax-documents', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM tax_documents WHERE user_id = ? ORDER BY created_at DESC' : 'SELECT * FROM tax_documents ORDER BY created_at DESC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => ({
      ...r, ...mapRow(r, TAXDOC_FIELDS),
      metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tax-documents', async (req, res) => {
  try {
    const d = req.body;
    await db.query(`INSERT INTO tax_documents (id, user_id, accountant_id, name, file_url, mime_type, upload_date, period_month, period_year, sunat_status, sunat_hash, uploaded_by, pdf_url, xml_url, cdr_url, xml_content, cdr_base64, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      d.id, d.userId, d.accountantId || null, d.name || null, d.fileUrl || null, d.mimeType || null,
      d.uploadDate || null, d.periodMonth || null, d.periodYear || null, d.sunatStatus || null,
      d.sunatHash || null, d.uploadedBy || null, d.pdfUrl || null, d.xmlUrl || null, d.cdrUrl || null,
      d.xmlContent || null, d.cdrBase64 || null, d.metadata ? JSON.stringify(d.metadata) : null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tax-documents/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tax_documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PACKAGES ---
router.get('/packages', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM packages ORDER BY created_at ASC');
    res.json(rows.map(r => ({
      ...r, ...mapRow(r, PACKAGE_FIELDS),
      features: r.features ? (typeof r.features === 'string' ? JSON.parse(r.features) : r.features) : []
    })).map(r => numFields(r, ['price', 'durationMonths'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/packages', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`INSERT INTO packages (id, name, price, duration_months, features) VALUES (?,?,?,?,?)`, [
      p.id, p.name, p.price, p.durationMonths, p.features ? JSON.stringify(p.features) : '[]'
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`UPDATE packages SET name=?, price=?, duration_months=?, features=? WHERE id=?`, [
      p.name, p.price, p.durationMonths, p.features ? JSON.stringify(p.features) : '[]', req.params.id
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/packages/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM packages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PAYMENT METHODS ---
router.get('/payment-methods', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM payment_methods ORDER BY created_at ASC');
    res.json(rows.map(r => ({ ...r, isActive: !!r.is_active, qrImage: r.qr_image })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payment-methods', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`INSERT INTO payment_methods (id, name, details, qr_image, is_active) VALUES (?,?,?,?,?)`, [
      p.id, p.name, p.details || null, p.qrImage || null, p.isActive ? 1 : 0
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/payment-methods/:id', async (req, res) => {
  try {
    const p = req.body;
    const fields = [];
    const values = [];
    if (p.name !== undefined) { fields.push('name=?'); values.push(p.name); }
    if (p.details !== undefined) { fields.push('details=?'); values.push(p.details); }
    if (p.qrImage !== undefined) { fields.push('qr_image=?'); values.push(p.qrImage); }
    if (p.isActive !== undefined) { fields.push('is_active=?'); values.push(p.isActive ? 1 : 0); }
    if (fields.length) {
      values.push(req.params.id);
      await db.query(`UPDATE payment_methods SET ${fields.join(',')} WHERE id=?`, values);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUBSCRIPTION HISTORY ---
router.get('/subscription-history', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC' : 'SELECT * FROM subscription_history ORDER BY created_at DESC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => numFields({ ...r, ...mapRow(r, SUBSCRIPTION_FIELDS) }, ['amount'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subscription-history', async (req, res) => {
  try {
    const s = req.body;
    await db.query(`INSERT INTO subscription_history (id, user_id, package_name, amount, date, start_date, end_date, status, payment_details, voucher_image) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      s.id, s.userId, s.packageName || null, s.amount || null, s.date || null,
      s.startDate || null, s.endDate || null, s.status || 'PAID', s.paymentDetails || null, s.voucherImage || null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/subscription-history/:id', async (req, res) => {
  try {
    const s = req.body;
    await db.query(`UPDATE subscription_history SET status = ?, start_date = ?, end_date = ? WHERE id = ?`, [
      s.status, s.startDate || null, s.endDate || null, req.params.id
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMPLAINTS ---
router.get('/complaints', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM complaints ORDER BY created_at DESC');
    res.json(rows.map(r => ({ ...r, ...mapRow(r, COMPLAINT_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/complaints', async (req, res) => {
  try {
    const c = req.body;
    await db.query(`INSERT INTO complaints (id, user_id, user_name, user_email, date, time, type, description, detail, status) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      c.id, c.userId, c.userName || null, c.userEmail || null, c.date || null,
      c.time || null, c.type || null, c.description || null, c.detail || null, c.status || 'PENDIENTE'
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/complaints/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE complaints SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- USER PRODUCTS ---
router.get('/user-products', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM user_products WHERE user_id = ? ORDER BY last_used DESC' : 'SELECT * FROM user_products ORDER BY last_used DESC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => numFields({ ...r, ...mapRow(r, USERPRODUCT_FIELDS) }, ['unitPrice'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/user-products', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`INSERT INTO user_products (id, user_id, description, unit, unit_price, last_used) VALUES (?,?,?,?,?,?)`, [
      p.id, p.userId, p.description || null, p.unit || null, p.unitPrice || 0, p.lastUsed || null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/user-products/:id', async (req, res) => {
  try {
    const p = req.body;
    const fields = [];
    const values = [];
    if (p.description !== undefined) { fields.push('description=?'); values.push(p.description); }
    if (p.unit !== undefined) { fields.push('unit=?'); values.push(p.unit); }
    if (p.unitPrice !== undefined) { fields.push('unit_price=?'); values.push(p.unitPrice); }
    if (p.lastUsed !== undefined) { fields.push('last_used=?'); values.push(p.lastUsed); }
    if (fields.length) {
      values.push(req.params.id);
      await db.query(`UPDATE user_products SET ${fields.join(',')} WHERE id=?`, values);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/user-products/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM user_products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PENDING INVOICES ---
router.get('/pending-invoices', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM pending_invoices WHERE user_id = ? ORDER BY created_at DESC' : 'SELECT * FROM pending_invoices ORDER BY created_at DESC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => numFields({
      ...r, ...mapRow(r, PENDINGINV_FIELDS),
      payload: r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : null
    }, ['amount', 'attemptCount'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pending-invoices', async (req, res) => {
  try {
    const inv = req.body;
    await db.query(`INSERT INTO pending_invoices (id, user_id, serie, correlative, document_type, payload, customer_doc_type, customer_doc_number, customer_name, amount, created_at, last_attempt, attempt_count, status, last_error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      inv.id, inv.userId, inv.serie || null, inv.correlative || null, inv.documentType || null,
      inv.payload ? JSON.stringify(inv.payload) : null, inv.customerDocType || null,
      inv.customerDocNumber || null, inv.customerName || null, inv.amount || 0,
      inv.createdAt || null, inv.lastAttempt || null, inv.attemptCount || 0, inv.status || 'PENDIENTE', inv.lastError || null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pending-invoices/:id', async (req, res) => {
  try {
    const data = req.body;
    const fields = [];
    const values = [];
    if (data.status !== undefined) { fields.push('status=?'); values.push(data.status); }
    if (data.lastAttempt !== undefined) { fields.push('last_attempt=?'); values.push(data.lastAttempt); }
    if (data.attemptCount !== undefined) { fields.push('attempt_count=?'); values.push(data.attemptCount); }
    if (data.lastError !== undefined) { fields.push('last_error=?'); values.push(data.lastError); }
    if (fields.length) {
      values.push(req.params.id);
      await db.query(`UPDATE pending_invoices SET ${fields.join(',')} WHERE id=?`, values);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/pending-invoices/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pending_invoices WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUNAT GLOBAL CONFIG ---
router.get('/sunat-config', async (req, res) => {
  try {
    const [row] = await db.query('SELECT * FROM sunat_global_config WHERE id = 1');
    res.json(row ? { ...row, ...mapRow(row, SUNATCONFIG_FIELDS) } : { sunatToken: '', sunatApiUrl: '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/sunat-config', async (req, res) => {
  try {
    const { sunatToken, sunatApiUrl } = req.body;
    await db.query('INSERT INTO sunat_global_config (id, sunat_token, sunat_api_url) VALUES (1,?,?) ON DUPLICATE KEY UPDATE sunat_token=VALUES(sunat_token), sunat_api_url=VALUES(sunat_api_url)', [sunatToken || null, sunatApiUrl || null]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NOTIFICATIONS ---
router.get('/notifications', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(rows.map(r => ({ ...r, ...mapRow(r, NOTIFICATION_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/notifications', async (req, res) => {
  try {
    const n = req.body;
    await db.query(`INSERT INTO notifications (id, user_id, message, date, is_read, type) VALUES (?,?,?,?,?,?)`, [
      n.id, n.userId || null, n.message || null, n.date || null, n.isRead ? 1 : 0, n.type || 'SYSTEM'
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Helper: convert specified fields from string to Number
const numFields = (obj, fields) => {
  for (const f of fields) {
    if (obj[f] != null) obj[f] = Number(obj[f]);
  }
  return obj;
};

module.exports = router;
