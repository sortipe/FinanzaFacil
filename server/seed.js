const db = require('./db');

const SEED_USERS = [
  { id: 'u1', name: 'Admin FinanzaFacil', email: 'admin@app.com', role: 'ADMIN', password: '123', must_change_password: 0 },
  { id: 'u2', name: 'Contador Carlos Ruiz', email: 'carlos@contador.com', role: 'ACCOUNTANT', password: '123', must_change_password: 0 },
  { id: 'u4', name: 'Contadora Maria Paz', email: 'maria@contador.com', role: 'ACCOUNTANT', password: '123', must_change_password: 0 },
  { id: 'u3', name: 'Juan Pérez - Demo', email: 'user@demo.com', role: 'USER', password: '123', subscription_status: 'ACTIVE', subscription_start_date: '2026-01-01', subscription_end_date: '2027-01-01', assigned_accountant_id: 'u2', ruc: '10456789123', dni: '45678912', business_name: 'JUAN PEREZ EIRL', tax_address: 'Av. Larco 456, Miraflores, Lima' },
  { id: 'u5', name: 'Elena Garcia', email: 'elena@gmail.com', role: 'USER', password: '123', must_change_password: 1, subscription_status: 'PENDING', assigned_accountant_id: 'u2' },
];

const SEED_PACKAGES = [
  { id: 'p1', name: 'Plan Mensual Emprendedor', price: 49.00, duration_months: 1, features: JSON.stringify(['Escaneo ilimitado AI', 'Asesoría Contable básica', 'Buzón tributario 24/7']) },
  { id: 'p2', name: 'Plan Anual Pro', price: 490.00, duration_months: 12, features: JSON.stringify(['Todo lo del plan mensual', '2 meses de regalo', 'Soporte prioritario WhatsApp']) },
];

const DEMO_QR = "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIEAIAAACv9n9iAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9H66AAADeUlEQVR42u3c0XLjMAwEUP//6S0zdR0nImFIIAnuOedpmsZAsYtEiqvX63UBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL7T398f/+X1en19ffG7wY093uR0V9pX8W/y7X839njP70N3pX0V98V0T/90Y8897z50V9pXcR/M9390Y8877z50V9pXcR/U9z90Y8+Xn/89777Xvop7ofv6f6fV76O/ybe73vX6P6eXfB90X/961+v/nF7yfdB9/etdr/9zesn3Qff1r3e9/s/pJR8AAMD3uV6vz7+n9/Y7CIsVvN75rXn++W683vktfP75Lrz++S283vktvP7vIywAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOD/5S8AAP//AwCHfK5Lz8Y/LAAAAABJRU5ErkJggg==";

const SEED_PAYMENT_METHODS = [
  { id: 'pm1', name: 'Yape / Plin', details: '987 654 321 - FinanzaFacil SAC', is_active: 1, qr_image: DEMO_QR },
  { id: 'pm2', name: 'Transferencia BCP', details: '191-99887766-0-12 (CCI: 002191199887766012)', is_active: 1 },
];

const SEED_EXPENSES = [
  { id: 'e1', user_id: 'u3', amount: 150.50, currency: 'PEN', description: 'Restaurante Tanta', date: new Date().toISOString().split('T')[0], category: 'Alimentación', ruc: '20100012341' },
];

const SEED_DOCS = [
  { id: 'RH-1001', user_id: 'u3', accountant_id: 'u2', name: 'R. Honorarios E001-45', file_url: '', mime_type: 'application/pdf', upload_date: '2024-05-01', period_month: 'Mayo', period_year: 2024, sunat_status: 'SENT', sunat_hash: 'abc123456789xyz', metadata: JSON.stringify({ recipientName: 'EMPRESA TECH SAC', recipientRuc: '20600011122', description: 'Asesoría en Desarrollo de Software', amount: 5000, retention: 400, netAmount: 4600, date: '2024-05-01' }) },
];

const seed = async () => {
  const existing = await db.query('SELECT COUNT(*) as cnt FROM users');
  if (existing[0].cnt > 0) {
    console.log('Database already has data, skipping seed.');
    return;
  }

  console.log('Seeding initial data...');

  for (const u of SEED_USERS) {
    await db.query('INSERT INTO users (id, name, email, role, password, must_change_password, subscription_status, assigned_accountant_id, subscription_start_date, subscription_end_date, ruc, dni, business_name, tax_address) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [u.id, u.name, u.email, u.role, u.password, u.must_change_password ?? 0, u.subscription_status || 'PENDING', u.assigned_accountant_id || null, u.subscription_start_date || null, u.subscription_end_date || null, u.ruc || null, u.dni || null, u.business_name || null, u.tax_address || null]);
  }

  for (const p of SEED_PACKAGES) {
    await db.query('INSERT INTO packages (id, name, price, duration_months, features) VALUES (?,?,?,?,?)',
      [p.id, p.name, p.price, p.duration_months, p.features]);
  }

  for (const pm of SEED_PAYMENT_METHODS) {
    await db.query('INSERT INTO payment_methods (id, name, details, is_active, qr_image) VALUES (?,?,?,?,?)',
      [pm.id, pm.name, pm.details, pm.is_active, pm.qr_image || null]);
  }

  for (const e of SEED_EXPENSES) {
    await db.query('INSERT INTO expenses (id, user_id, amount, currency, description, date, category, ruc) VALUES (?,?,?,?,?,?,?,?)',
      [e.id, e.user_id, e.amount, e.currency, e.description, e.date, e.category, e.ruc]);
  }

  for (const d of SEED_DOCS) {
    await db.query('INSERT INTO tax_documents (id, user_id, accountant_id, name, file_url, mime_type, upload_date, period_month, period_year, sunat_status, sunat_hash, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [d.id, d.user_id, d.accountant_id, d.name, d.file_url, d.mime_type, d.upload_date, d.period_month, d.period_year, d.sunat_status, d.sunat_hash, d.metadata]);
  }

  console.log('Seed complete.');
};

module.exports = { seed };

// Allow running standalone: node seed.js
if (require.main === module) {
  seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
}
