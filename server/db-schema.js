const db = require('./db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  password VARCHAR(255),
  must_change_password TINYINT(1) DEFAULT 0,
  subscription_status VARCHAR(20) DEFAULT 'PENDING',
  phone VARCHAR(50),
  profile_picture TEXT,
  subscription_start_date VARCHAR(10),
  subscription_end_date VARCHAR(10),
  parent_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(50) PRIMARY KEY,
  owner_user_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ruc VARCHAR(11),
  business_name VARCHAR(255),
  tax_address TEXT,
  dni VARCHAR(8),
  is_persona_natural TINYINT(1) DEFAULT 0,
  sol_user VARCHAR(255),
  sol_pass VARCHAR(255),
  sunat_token TEXT,
  sunat_api_url VARCHAR(255),
  cert_base64 LONGTEXT,
  cert_pass VARCHAR(255),
  serie_factura VARCHAR(10),
  serie_boleta VARCHAR(10),
  sunat_env VARCHAR(20) DEFAULT 'SANDBOX',
  assigned_accountant_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_serie_factura CHECK (serie_factura IS NULL OR serie_factura REGEXP '^F[0-9]{3}$'),
  CONSTRAINT chk_serie_boleta CHECK (serie_boleta IS NULL OR serie_boleta REGEXP '^B[0-9]{3}$'),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PEN',
  description TEXT,
  date VARCHAR(10),
  category VARCHAR(100),
  internal_voucher_url TEXT,
  accountant_voucher_url TEXT,
  invoice_number VARCHAR(100),
  ruc VARCHAR(11),
  subtotal DECIMAL(12,2),
  igv DECIMAL(12,2),
  is_private TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tax_documents (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50) NOT NULL,
  accountant_id VARCHAR(50),
  name VARCHAR(255),
  file_url LONGTEXT,
  mime_type VARCHAR(100),
  folder_path VARCHAR(255),
  upload_date VARCHAR(10),
  period_month VARCHAR(20),
  period_year INT,
  sunat_status VARCHAR(20),
  sunat_hash VARCHAR(255),
  uploaded_by VARCHAR(20),
  document_type VARCHAR(30),
  original_document_id VARCHAR(50),
  pdf_url TEXT,
  xml_url TEXT,
  cdr_url TEXT,
  xml_content LONGTEXT,
  cdr_base64 LONGTEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT NOT NULL,
  features JSON,
  type VARCHAR(20) DEFAULT 'CLIENT',
  limits JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  details TEXT,
  qr_image LONGTEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS subscription_history (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  package_name VARCHAR(255),
  amount DECIMAL(10,2),
  date VARCHAR(10),
  start_date VARCHAR(10),
  end_date VARCHAR(10),
  status VARCHAR(20) DEFAULT 'PAID',
  payment_details TEXT,
  voucher_image LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  date VARCHAR(10),
  time VARCHAR(10),
  type VARCHAR(20),
  description TEXT,
  detail TEXT,
  status VARCHAR(20) DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_products (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  description VARCHAR(255),
  unit VARCHAR(50),
  unit_price DECIMAL(12,2),
  last_used VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS pending_invoices (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50) NOT NULL,
  serie VARCHAR(10),
  correlative INT,
  document_type VARCHAR(30),
  original_document_id VARCHAR(50),
  payload JSON,
  customer_doc_type VARCHAR(10),
  customer_doc_number VARCHAR(20),
  customer_name VARCHAR(255),
  amount DECIMAL(12,2),
  created_at VARCHAR(10),
  last_attempt VARCHAR(10),
  attempt_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDIENTE',
  last_error TEXT,
  CONSTRAINT chk_pi_serie CHECK (serie IS NULL OR serie REGEXP '^[FBETV][0-9]{3}$'),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sunat_global_config (
  id INT PRIMARY KEY DEFAULT 1,
  sunat_token TEXT,
  sunat_api_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  message TEXT,
  date VARCHAR(10),
  is_read TINYINT(1) DEFAULT 0,
  type VARCHAR(20) DEFAULT 'SYSTEM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS correlativos (
  company_id VARCHAR(50) NOT NULL,
  serie VARCHAR(10) NOT NULL,
  last_used INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, serie),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS payment_alerts (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'OTRO',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'PEN',
  due_date VARCHAR(10) NOT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'MENSUAL',
  reminder_days_before INT NOT NULL DEFAULT 3,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  notes TEXT,
  last_paid_date VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS personal_expenses (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  concept VARCHAR(50) NOT NULL DEFAULT 'OTROS_PERSONALES',
  description TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'PEN',
  date VARCHAR(10) NOT NULL,
  voucher_url LONGTEXT,
  merchant_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sire_registros (
  id VARCHAR(50) PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  periodo VARCHAR(7) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  total_registros INT DEFAULT 0,
  base_imponible DECIMAL(12,2) DEFAULT 0.00,
  igv DECIMAL(12,2) DEFAULT 0.00,
  total DECIMAL(12,2) DEFAULT 0.00,
  fecha_generacion VARCHAR(10),
  fecha_aceptacion VARCHAR(10),
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS sire_comprobantes (
  id VARCHAR(50) PRIMARY KEY,
  registro_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50) NOT NULL,
  periodo VARCHAR(7) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  tipo_comprobante VARCHAR(30),
  serie VARCHAR(10),
  numero VARCHAR(20),
  fecha_emision VARCHAR(10),
  ruc_emisor VARCHAR(11),
  razon_social_emisor VARCHAR(255),
  base_imponible DECIMAL(12,2) DEFAULT 0.00,
  igv DECIMAL(12,2) DEFAULT 0.00,
  total DECIMAL(12,2) DEFAULT 0.00,
  moneda VARCHAR(10) DEFAULT 'PEN',
  estado_cruce VARCHAR(30) DEFAULT 'COINCIDE',
  origen VARCHAR(10) DEFAULT 'LOCAL',
  tax_document_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registro_id) REFERENCES sire_registros(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
`;

const ALTER_AND_MIGRATE = async () => {
  const columnExists = async (table, column) => {
    const rows = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    return rows.length > 0;
  };

  // --- Add missing columns to existing users table ---
  const userCols = [
    ['phone', 'VARCHAR(50)'],
    ['profile_picture', 'TEXT'],
  ];
  for (const [col, type] of userCols) {
    if (!(await columnExists('users', col))) {
      await db.query(`ALTER TABLE users ADD COLUMN ${col} ${type}`).catch(() => {});
    }
  }

  // --- Create companies table if not exists (from SCHEMA) ---
  // Already handled by CREATE TABLE IF NOT EXISTS above

  // --- Add company_id to tables that need it ---
  const tablesNeedingCompanyId = ['expenses', 'tax_documents', 'complaints', 'user_products', 'pending_invoices'];
  for (const table of tablesNeedingCompanyId) {
    if (!(await columnExists(table, 'company_id'))) {
      await db.query(`ALTER TABLE ${table} ADD COLUMN company_id VARCHAR(50)`).catch(() => {});
    }
  }

  // --- Add assigned_accountant_id to companies if not exists ---
  if (!(await columnExists('companies', 'assigned_accountant_id'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN assigned_accountant_id VARCHAR(50)`).catch(() => {});
  }
  if (!(await columnExists('companies', 'sire_client_id'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN sire_client_id VARCHAR(255)`).catch(() => {});
  }
  if (!(await columnExists('companies', 'sire_client_secret'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN sire_client_secret VARCHAR(255)`).catch(() => {});
  }

  // --- Add serie columns for Liquidación, Guía Remitente, Guía Transportista ---
  if (!(await columnExists('companies', 'serie_liquidacion'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN serie_liquidacion VARCHAR(10) DEFAULT 'E001'`).catch(() => {});
  }
  if (!(await columnExists('companies', 'serie_guia_remision'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN serie_guia_remision VARCHAR(10) DEFAULT 'T001'`).catch(() => {});
  }
  if (!(await columnExists('companies', 'serie_guia_transporte'))) {
    await db.query(`ALTER TABLE companies ADD COLUMN serie_guia_transporte VARCHAR(10) DEFAULT 'V001'`).catch(() => {});
  }

  // --- Add parent_id to users if not exists (for sub-users) ---
  if (!(await columnExists('users', 'parent_id'))) {
    await db.query(`ALTER TABLE users ADD COLUMN parent_id VARCHAR(50)`).catch(() => {});
  }

  // --- Add employee SOL credential columns to users (RH via Portal Web SOL) ---
  const userSolCols = [
    ['ruc', 'VARCHAR(11)'],
    ['sol_user', 'VARCHAR(255)'],
    ['sol_pass', 'VARCHAR(255)'],
  ];
  for (const [col, type] of userSolCols) {
    if (!(await columnExists('users', col))) {
      await db.query(`ALTER TABLE users ADD COLUMN ${col} ${type}`).catch(() => {});
    }
  }

  // --- Verification token columns ---
  if (!(await columnExists('users', 'is_verified'))) {
    await db.query(`ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 0`).catch(() => {});
    await db.query(`UPDATE users SET is_verified = 1`).catch(() => {});
  }
  if (!(await columnExists('users', 'verification_token'))) {
    await db.query(`ALTER TABLE users ADD COLUMN verification_token VARCHAR(255)`).catch(() => {});
  }
  if (!(await columnExists('users', 'verification_expires'))) {
    await db.query(`ALTER TABLE users ADD COLUMN verification_expires DATETIME`).catch(() => {});
  }

  // --- MIGRATION: Create default company for existing users ---
  const companiesExist = await db.query('SELECT COUNT(*) AS cnt FROM companies');
  const usersExist = await db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='USER'");

  if (companiesExist[0].cnt === 0 && usersExist[0].cnt > 0) {
    console.log('Migrating existing users to companies...');

    // Try to read legacy columns from users table
    let hasLegacyCols = false;
    try {
      const cols = await db.query("SHOW COLUMNS FROM users LIKE 'ruc'");
      hasLegacyCols = cols.length > 0;
    } catch (e) {}

    if (hasLegacyCols) {
      const users = await db.query("SELECT * FROM users WHERE role='USER'");
      for (const u of users) {
        const companyId = 'comp-' + u.id;
        await db.query(
          `INSERT IGNORE INTO companies (id, owner_user_id, name, ruc, business_name, tax_address, dni, is_persona_natural, sol_user, sol_pass, sunat_token, sunat_api_url, cert_base64, cert_pass, serie_factura, serie_boleta, sunat_env, assigned_accountant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId, u.id, u.business_name || u.name || 'Mi Empresa',
            u.ruc || null, u.business_name || null, u.tax_address || null, u.dni || null, u.dni ? 1 : 0,
            u.sol_user || null, u.sol_pass || null, u.sunat_token || null, u.sunat_api_url || null,
            u.cert_base64 || null, u.cert_pass || null, u.serie_factura || null, u.serie_boleta || null,
            u.sunat_env || 'SANDBOX', u.assigned_accountant_id || null
          ]
        );

        // Migrate expenses
        await db.query('UPDATE expenses SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE tax_documents SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE complaints SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE user_products SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE pending_invoices SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
      }
      console.log(`Migrated ${users.length} users to companies.`);
    } else {
      console.log('No legacy user columns found. Creating minimal default companies...');
      const users = await db.query("SELECT id, name FROM users WHERE role='USER'");
      for (const u of users) {
        const companyId = 'comp-' + u.id;
        await db.query(
          'INSERT IGNORE INTO companies (id, owner_user_id, name) VALUES (?, ?, ?)',
          [companyId, u.id, u.name || 'Mi Empresa']
        );
        await db.query('UPDATE expenses SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE tax_documents SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE complaints SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE user_products SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
        await db.query('UPDATE pending_invoices SET company_id = ? WHERE user_id = ? AND company_id IS NULL', [companyId, u.id]).catch(() => {});
      }
      console.log(`Created ${users.length} default companies.`);
    }

    // Clean up legacy SUNAT columns from users if they exist
    const legacyCols = ['ruc', 'business_name', 'tax_address', 'dni', 'sol_user', 'sol_pass', 'sunat_token', 'sunat_api_url', 'cert_base64', 'cert_pass', 'serie_factura', 'serie_boleta', 'sunat_env', 'assigned_accountant_id'];
    for (const col of legacyCols) {
      if (await columnExists('users', col)) {
        await db.query(`ALTER TABLE users DROP COLUMN ${col}`).catch(() => {});
      }
    }
    console.log('Cleaned up legacy SUNAT columns from users table.');
  }

  // Add 'type' column to packages if missing
  if (!(await columnExists('packages', 'type'))) {
    await db.query("ALTER TABLE packages ADD COLUMN type VARCHAR(20) DEFAULT 'CLIENT'").catch(() => {});
    console.log('Added type column to packages table.');
  }

  // --- Add deleted_at to packages for soft delete ---
  if (!(await columnExists('packages', 'deleted_at'))) {
    await db.query("ALTER TABLE packages ADD COLUMN deleted_at DATETIME DEFAULT NULL").catch(() => {});
    console.log('Added deleted_at column to packages table.');
  }

  // --- Add is_persona_natural to companies if not exists (Persona Natural emisora) ---
  if (!(await columnExists('companies', 'is_persona_natural'))) {
    await db.query("ALTER TABLE companies ADD COLUMN is_persona_natural TINYINT(1) DEFAULT 0").catch(() => {});
    console.log('Added is_persona_natural column to companies table.');
  }

  // --- Add NC/ND columns to tax_documents
  const taxDocCols = [
    ['document_type', "VARCHAR(30)"],
    ['original_document_id', "VARCHAR(50)"],
    ['folder_path', "VARCHAR(255)"],
  ];
  for (const [col, type] of taxDocCols) {
    if (!(await columnExists('tax_documents', col))) {
      await db.query(`ALTER TABLE tax_documents ADD COLUMN ${col} ${type}`).catch(() => {});
    }
  }

  // Add original_document_id to pending_invoices
  if (!(await columnExists('pending_invoices', 'original_document_id'))) {
    await db.query("ALTER TABLE pending_invoices ADD COLUMN original_document_id VARCHAR(50)").catch(() => {});
  }

  // Marca de tiempo del último intento (backoff del worker de reintentos en servidor)
  if (!(await columnExists('pending_invoices', 'last_attempt_at'))) {
    await db.query("ALTER TABLE pending_invoices ADD COLUMN last_attempt_at DATETIME NULL").catch(() => {});
    await db.query("CREATE INDEX idx_pi_retry ON pending_invoices (status, attempt_count)").catch(() => {});
  }

  // Add limits column to packages for subscription restrictions
  if (!(await columnExists('packages', 'limits'))) {
    await db.query("ALTER TABLE packages ADD COLUMN limits JSON DEFAULT NULL").catch(() => {});
    console.log('Added limits column to packages table.');
  }

  // Add is_free column to packages table
  if (!(await columnExists('packages', 'is_free'))) {
    await db.query("ALTER TABLE packages ADD COLUMN is_free TINYINT(1) DEFAULT 0").catch(() => {});
    console.log('Added is_free column to packages table.');
  }

  // Add support_phone column to sunat_global_config table
  if (!(await columnExists('sunat_global_config', 'support_phone'))) {
    await db.query("ALTER TABLE sunat_global_config ADD COLUMN support_phone VARCHAR(50) DEFAULT '999888777'").catch(() => {});
    console.log('Added support_phone column to sunat_global_config table.');
  }

  // Ensure default Plan Gratis for CLIENT exists
  const freeClient = await db.query("SELECT * FROM packages WHERE (is_free = 1 OR id = 'pkg-free-client') AND type = 'CLIENT'");
  if (freeClient.length === 0) {
    await db.query(`INSERT INTO packages (id, name, price, duration_months, features, type, is_free, limits) VALUES (?,?,?,?,?,?,?,?)`, [
      'pkg-free-client', 'Plan Gratis', 0, 12, JSON.stringify(['Funciones básicas', '1 Empresa', '10 Comprobantes al mes']), 'CLIENT', 1,
      JSON.stringify({ maxCompanies: { USER: 1, PERSONA_NATURAL: 1 }, maxTaxDocuments: { USER: 10, PERSONA_NATURAL: 10 } })
    ]).catch(() => {});
    console.log('Created default Plan Gratis for CLIENT.');
  }

  // Ensure default Plan Gratis for ACCOUNTANT exists
  const freeAcct = await db.query("SELECT * FROM packages WHERE (is_free = 1 OR id = 'pkg-free-accountant') AND type = 'ACCOUNTANT'");
  if (freeAcct.length === 0) {
    await db.query(`INSERT INTO packages (id, name, price, duration_months, features, type, is_free, limits) VALUES (?,?,?,?,?,?,?,?)`, [
      'pkg-free-accountant', 'Plan Gratis', 0, 12, JSON.stringify(['Gestión básica de contador', 'Hasta 2 empresas gestionadas']), 'ACCOUNTANT', 1,
      JSON.stringify({ maxManagedCompanies: { ACCOUNTANT: 2 }, maxTaxDocuments: { ACCOUNTANT: 20 } })
    ]).catch(() => {});
    console.log('Created default Plan Gratis for ACCOUNTANT.');
  }

  // --- HARDEN: constraints de integridad (series SUNAT, RUC único, company_id obligatorio) ---
  const constraintExists = async (table, name) => {
    const rows = await db.query(
      `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, name]
    );
    return rows.length > 0;
  };
  const ensureCheck = async (table, name, expression) => {
    if (await constraintExists(table, name)) return;
    try {
      await db.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
      console.log(`  [HARDEN] CHECK ${name} agregado`);
    } catch (e) { console.error(`  [HARDEN] No se pudo agregar CHECK ${name}: ${e.message}`); }
  };
  const ensureUniqueIndex = async (table, name, cols) => {
    try {
      await db.query(`ALTER TABLE ${table} ADD UNIQUE INDEX ${name} (${cols})`);
      console.log(`  [HARDEN] Índice único ${name} agregado`);
    } catch (e) { console.error(`  [HARDEN] No se pudo agregar índice único ${name}: ${e.message}`); }
  };

  await ensureCheck('companies', 'chk_serie_factura', "serie_factura IS NULL OR serie_factura REGEXP '^F[0-9]{3}$'");
  await ensureCheck('companies', 'chk_serie_boleta', "serie_boleta IS NULL OR serie_boleta REGEXP '^B[0-9]{3}$'");
  await ensureCheck('companies', 'chk_serie_liquidacion', "serie_liquidacion IS NULL OR serie_liquidacion REGEXP '^E[0-9]{3}$'");
  await ensureCheck('companies', 'chk_serie_guia_remision', "serie_guia_remision IS NULL OR serie_guia_remision REGEXP '^T[0-9]{3}$'");
  await ensureCheck('companies', 'chk_serie_guia_transporte', "serie_guia_transporte IS NULL OR serie_guia_transporte REGEXP '^V[0-9]{3}$'");
  await ensureCheck('pending_invoices', 'chk_pi_serie', "serie IS NULL OR serie REGEXP '^[FBETV][0-9]{3}$'");
  await ensureUniqueIndex('companies', 'uq_companies_ruc', 'ruc');

  const hardenCompanyId = async (table) => {
    const cols = await db.query(`SHOW COLUMNS FROM ${table} LIKE 'company_id'`);
    if (cols.length === 0) return;
    // Reconstruir FK como CASCADE (la BD existente no la tenía)
    const fks = await db.query(
      `SELECT kcu.CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE kcu
       WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.TABLE_NAME = ? AND kcu.COLUMN_NAME = 'company_id' AND kcu.REFERENCED_TABLE_NAME = 'companies'`,
      [table]
    );
    for (const fk of fks) {
      await db.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`).catch(() => {});
    }
    try {
      await db.query(`ALTER TABLE ${table} MODIFY company_id VARCHAR(50) NOT NULL`);
    } catch (e) { console.error(`  [HARDEN] No se pudo hacer NOT NULL company_id en ${table}: ${e.message}`); }
    await db.query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_ibfk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`)
      .catch((e) => { console.error(`  [HARDEN] No se pudo agregar FK company en ${table}: ${e.message}`); });
    console.log(`  [HARDEN] company_id endurecido en ${table}`);
  };
  await hardenCompanyId('tax_documents');
  await hardenCompanyId('pending_invoices');
};

const initSchema = async () => {
  const statements = SCHEMA.split('CREATE TABLE')
    .filter(s => s.trim())
    .map(s => 'CREATE TABLE' + s);
  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err) {
      console.error('Error creating table:', err.message);
    }
  }
  await ALTER_AND_MIGRATE();
  await normalizeLegacyRoles();
  console.log('Database schema initialized.');
};

// Normaliza roles legacy a los canónicos (USUARIOS registrados vía "Crear Cuenta")
const normalizeLegacyRoles = async () => {
  try {
    const r1 = await db.query(`UPDATE users SET role='USER' WHERE role IN ('EMPRESARIO')`);
    const r2 = await db.query(`UPDATE users SET role='ACCOUNTANT' WHERE role='CONTADOR'`);
    if (r1.affectedRows > 0 || r2.affectedRows > 0) {
      console.log(`Roles normalizados: ${r1.affectedRows} -> USER, ${r2.affectedRows} -> ACCOUNTANT`);
    }
  } catch (err) {
    console.error('Error normalizando roles:', err.message);
  }
};

module.exports = { initSchema };
