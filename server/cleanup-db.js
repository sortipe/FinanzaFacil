const db = require('./db');

const COUNT_TABLES = ['users', 'companies', 'tax_documents', 'pending_invoices', 'correlativos', 'expenses', 'user_products', 'complaints', 'subscription_history', 'notifications', 'packages'];

const counts = async () => {
  const out = {};
  for (const t of COUNT_TABLES) {
    const rows = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
    out[t] = rows[0].n;
  }
  return out;
};

(async () => {
  console.log('ANTES:', JSON.stringify(await counts()));

  // 1. Tablas sin FK o hijas directas
  await db.query('DELETE FROM pending_invoices');
  await db.query('DELETE FROM notifications');
  await db.query('DELETE FROM correlativos');
  await db.query('DELETE FROM user_products');
  await db.query('DELETE FROM complaints');
  await db.query('DELETE FROM subscription_history');
  await db.query('DELETE FROM expenses');
  await db.query('DELETE FROM tax_documents');
  await db.query('DELETE FROM companies');

  // 2. Usuarios: se conserva únicamente el admin (u1)
  const delUsers = await db.query("DELETE FROM users WHERE id <> 'u1'");
  console.log('USUARIOS ELIMINADOS:', delUsers.affectedRows);

  // 3. Paquete basura de prueba
  const delPkg = await db.query("DELETE FROM packages WHERE id = 'pkg-1786035880951'");
  console.log('PAQUETES ELIMINADOS:', delPkg.affectedRows);

  console.log('DESPUES:', JSON.stringify(await counts()));
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
