const db = require('./db');

const HARDEN_CHECKS = [
  { desc: 'CHECK serie factura', sql: `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='companies' AND CONSTRAINT_NAME='chk_serie_factura'` },
  { desc: 'CHECK serie boleta', sql: `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='companies' AND CONSTRAINT_NAME='chk_serie_boleta'` },
  { desc: 'CHECK serie pendings', sql: `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='pending_invoices' AND CONSTRAINT_NAME='chk_pi_serie'` },
  { desc: 'UNIQUE RUC companies', sql: `SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='companies' AND INDEX_NAME='uq_companies_ruc'` },
  { desc: 'NOT NULL tax_documents.company_id', sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='tax_documents' AND COLUMN_NAME='company_id' AND IS_NULLABLE='NO'` },
  { desc: 'NOT NULL pending_invoices.company_id', sql: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='pending_invoices' AND COLUMN_NAME='company_id' AND IS_NULLABLE='NO'` },
  { desc: 'FK CASCADE tax_documents->companies', sql: `SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON rc.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND rc.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='tax_documents' AND k.COLUMN_NAME='company_id' AND rc.DELETE_RULE='CASCADE'` },
  { desc: 'FK CASCADE pending_invoices->companies', sql: `SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON rc.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND rc.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='pending_invoices' AND k.COLUMN_NAME='company_id' AND rc.DELETE_RULE='CASCADE'` },
];

(async () => {
  const failures = [];
  for (const c of HARDEN_CHECKS) {
    const r = await db.query(c.sql);
    const ok = r[0].n > 0;
    console.log(`${ok ? 'OK ' : 'FALTA'} ${c.desc}`);
    if (!ok) failures.push(c.desc);
  }

  const tables = ['users', 'companies', 'tax_documents', 'pending_invoices', 'correlativos', 'expenses', 'user_products', 'complaints', 'subscription_history', 'notifications'];
  const rows = await db.query(`SELECT '${tables.join("' AS t UNION ALL SELECT '")}'`);
  const counts = {};
  for (const t of tables) {
    const r = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = r[0].n;
  }
  console.log('CONTEOS:', JSON.stringify(counts));

  const badSeries = await db.query(`SELECT COUNT(*) AS n FROM pending_invoices WHERE serie IS NOT NULL AND serie NOT REGEXP '^[FB][0-9]{3}$'`);
  if (badSeries[0].n > 0) failures.push('pendings con serie inválida');
  console.log(`${badSeries[0].n === 0 ? 'OK ' : 'FALLA'} sin pendings con serie inválida`);

  const orphans = await db.query(`SELECT COUNT(*) AS n FROM tax_documents t LEFT JOIN companies c ON t.company_id=c.id WHERE c.id IS NULL`);
  if (orphans[0].n > 0) failures.push('tax_documents huérfanos');
  console.log(`${orphans[0].n === 0 ? 'OK ' : 'FALLA'} sin tax_documents huérfanos`);

  const users = await db.query(`SELECT id, email, role FROM users ORDER BY id`);
  console.log('USERS:', JSON.stringify(users));

  if (failures.length) { console.error('RESULTADO: FALLA ->', failures.join('; ')); process.exit(1); }
  console.log('RESULTADO: OK');
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
