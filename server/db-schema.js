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
  assigned_accountant_id VARCHAR(50),
  profile_picture TEXT,
  subscription_start_date VARCHAR(10),
  subscription_end_date VARCHAR(10),
  ruc VARCHAR(11),
  dni VARCHAR(8),
  business_name VARCHAR(255),
  tax_address TEXT,
  sol_user VARCHAR(255),
  sol_pass VARCHAR(255),
  sunat_token TEXT,
  sunat_api_url VARCHAR(255),
  cert_base64 LONGTEXT,
  cert_pass VARCHAR(255),
  serie_factura VARCHAR(10),
  serie_boleta VARCHAR(10),
  sunat_env VARCHAR(20) DEFAULT 'PRODUCTION',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tax_documents (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
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
  pdf_url TEXT,
  xml_url TEXT,
  cdr_url TEXT,
  xml_content LONGTEXT,
  cdr_base64 LONGTEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT NOT NULL,
  features JSON,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  date VARCHAR(10),
  time VARCHAR(10),
  type VARCHAR(20),
  description TEXT,
  detail TEXT,
  status VARCHAR(20) DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_products (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  unit VARCHAR(50),
  unit_price DECIMAL(12,2),
  last_used VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pending_invoices (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  serie VARCHAR(10),
  correlative INT,
  document_type VARCHAR(20),
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  console.log('Database schema initialized.');
};

module.exports = { initSchema };
