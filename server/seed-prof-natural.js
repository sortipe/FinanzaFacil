const db = require('./db');

const columnExists = async (table, column) => {
  const rows = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
  return rows.length > 0;
};

const upsert = async () => {
  // Ensure is_persona_natural column exists on companies (idempotent)
  if (!(await columnExists('companies', 'is_persona_natural'))) {
    await db.query("ALTER TABLE companies ADD COLUMN is_persona_natural TINYINT(1) DEFAULT 0").catch(() => {});
    console.log('Added is_persona_natural to companies.');
  }
  // Ensure sol_user/sol_pass columns exist on users (idempotent)
  for (const col of ['sol_user', 'sol_pass']) {
    if (!(await columnExists('users', col))) {
      await db.query(`ALTER TABLE users ADD COLUMN ${col} VARCHAR(255)`).catch(() => {});
      console.log(`Added ${col} to users.`);
    }
  }

  // Upsert the Persona Natural user (profesional emisor). NOTA: users table only
  // stores ruc/sol_user/sol_pass; dni/business_name/etc. viven en companies.
  await db.query(
    `INSERT INTO users (id, name, email, role, password, must_change_password, subscription_status, subscription_start_date, subscription_end_date, ruc, sol_user, sol_pass)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), subscription_status=VALUES(subscription_status), ruc=VALUES(ruc), sol_user=VALUES(sol_user), sol_pass=VALUES(sol_pass)`,
    [
      'u6', 'Carlos Profesional', 'prof@demo.com', 'USER', 'Prof123', 0, 'ACTIVE',
      '2026-01-01', '2027-01-01', '20451236543', 'PROF_NATURAL', 'demo123'
    ]
  );
  console.log('Upserted user u6 (Carlos Profesional - Persona Natural).');

  // Upsert its company (emisor)
  await db.query(
    `INSERT INTO companies (id, owner_user_id, name, ruc, business_name, tax_address, dni, is_persona_natural, sol_user, sol_pass, serie_factura, serie_boleta, sunat_env, assigned_accountant_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), ruc=VALUES(ruc), business_name=VALUES(business_name), dni=VALUES(dni), is_persona_natural=VALUES(is_persona_natural), sol_user=VALUES(sol_user), sol_pass=VALUES(sol_pass), serie_factura=VALUES(serie_factura), serie_boleta=VALUES(serie_boleta), assigned_accountant_id=VALUES(assigned_accountant_id)`,
    [
      'comp-u6', 'u6', 'Carlos Profesional EIR', '20451236543', 'CARLOS PROFESIONAL EIR',
      'Av. Siempre Viva 742, Lima', '45123654', 1, 'PROF_NATURAL', 'demo123', 'F001', 'B001', 'PRODUCTION', 'u2'
    ]
  );
  console.log('Upserted company comp-u6 (is_persona_natural=1).');

  const u = await db.query("SELECT id,name,email,role,subscription_status FROM users WHERE id='u6'");
  const c = await db.query("SELECT id,owner_user_id,is_persona_natural,assigned_accountant_id FROM companies WHERE id='comp-u6'");
  console.log('USER:', JSON.stringify(u[0]));
  console.log('COMPANY:', JSON.stringify(c[0]));
};

upsert().then(() => { console.log('Backfill complete.'); process.exit(0); })
  .catch(e => { console.error('Backfill error:', e); process.exit(1); });
