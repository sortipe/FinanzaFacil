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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(50) PRIMARY KEY,
  owner_user_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ruc VARCHAR(11),
  business_name VARCHAR(255),
  tax_address TEXT,
  dni VARCHAR(8),
  sol_user VARCHAR(255),
  sol_pass VARCHAR(255),
  sunat_token TEXT,
  sunat_api_url VARCHAR(255),
  cert_base64 LONGTEXT,
  cert_pass VARCHAR(255),
  serie_factura VARCHAR(10),
  serie_boleta VARCHAR(10),
  sunat_env VARCHAR(20) DEFAULT 'PRODUCTION',
  assigned_accountant_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tax_documents (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  accountant_id VARCHAR(50),
  name VARCHAR(255),
  file_url LONGTEXT,
  mime_type VARCHAR(100),
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
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT NOT NULL,
  features JSON,
  type VARCHAR(20) DEFAULT 'CLIENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  details TEXT,
  qr_image LONGTEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pending_invoices (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  company_id VARCHAR(50),
  serie VARCHAR(10),
  correlative INT,
  document_type VARCHAR(20),
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sunat_global_config (
  id INT PRIMARY KEY DEFAULT 1,
  sunat_token TEXT,
  sunat_api_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50),
  message TEXT,
  date VARCHAR(10),
  is_read TINYINT(1) DEFAULT 0,
  type VARCHAR(20) DEFAULT 'SYSTEM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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

  // --- Add parent_id to users if not exists (for sub-users) ---
  if (!(await columnExists('users', 'parent_id'))) {
    await db.query(`ALTER TABLE users ADD COLUMN parent_id VARCHAR(50)`).catch(() => {});
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
          `INSERT IGNORE INTO companies (id, owner_user_id, name, ruc, business_name, tax_address, dni, sol_user, sol_pass, sunat_token, sunat_api_url, cert_base64, cert_pass, serie_factura, serie_boleta, sunat_env, assigned_accountant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId, u.id, u.business_name || u.name || 'Mi Empresa',
            u.ruc || null, u.business_name || null, u.tax_address || null, u.dni || null,
            u.sol_user || null, u.sol_pass || null, u.sunat_token || null, u.sunat_api_url || null,
            u.cert_base64 || null, u.cert_pass || null, u.serie_factura || null, u.serie_boleta || null,
            u.sunat_env || 'PRODUCTION', u.assigned_accountant_id || null
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

  // Add NC/ND columns to tax_documents
  const taxDocCols = [
    ['document_type', "VARCHAR(30)"],
    ['original_document_id', "VARCHAR(50)"],
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
  console.log('Database schema initialized.');
};

module.exports = { initSchema };
