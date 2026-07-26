require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const db = require('./db');

(async () => {
  try {
    const colExists = async (table, col) => {
      const r = await db.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`);
      return r.length > 0;
    };

    // 1. Create companies table
    console.log('Creating companies table...');
    await db.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('companies table OK');

    // 2. Add company_id to tables
    const tables = ['expenses', 'tax_documents', 'complaints', 'user_products', 'pending_invoices'];
    for (const t of tables) {
      if (!(await colExists(t, 'company_id'))) {
        console.log(`Adding company_id to ${t}...`);
        await db.query(`ALTER TABLE ${t} ADD COLUMN company_id VARCHAR(50)`);
      }
    }

    // 3. Migrate data for each USER
    const companiesCount = await db.query('SELECT COUNT(*) AS cnt FROM companies');
    const usersCount = await db.query("SELECT COUNT(*) AS cnt FROM users WHERE role='USER'");
    console.log(`Companies: ${companiesCount[0].cnt}, Users: ${usersCount[0].cnt}`);

    if (companiesCount[0].cnt === 0 && usersCount[0].cnt > 0) {
      const hasLegacy = await colExists('users', 'ruc');
      console.log('Has legacy ruc column:', hasLegacy);

      if (hasLegacy) {
        const users = await db.query("SELECT * FROM users WHERE role='USER'");
        for (const u of users) {
          const cid = 'comp-' + u.id;
          console.log(`Migrating user ${u.id} (${u.name}) -> company ${cid}`);
          await db.query(
            `INSERT IGNORE INTO companies (id, owner_user_id, name, ruc, business_name, tax_address, dni, sol_user, sol_pass, sunat_token, sunat_api_url, cert_base64, cert_pass, serie_factura, serie_boleta, sunat_env, assigned_accountant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [cid, u.id, u.business_name || u.name || 'Mi Empresa',
             u.ruc || null, u.business_name || null, u.tax_address || null, u.dni || null,
             u.sol_user || null, u.sol_pass || null, u.sunat_token || null, u.sunat_api_url || null,
             u.cert_base64 || null, u.cert_pass || null, u.serie_factura || null, u.serie_boleta || null,
             u.sunat_env || 'PRODUCTION', u.assigned_accountant_id || null]
          );
          await db.query('UPDATE expenses SET company_id=? WHERE user_id=? AND company_id IS NULL', [cid, u.id]).catch(() => {});
          await db.query('UPDATE tax_documents SET company_id=? WHERE user_id=? AND company_id IS NULL', [cid, u.id]).catch(() => {});
          await db.query('UPDATE complaints SET company_id=? WHERE user_id=? AND company_id IS NULL', [cid, u.id]).catch(() => {});
          await db.query('UPDATE user_products SET company_id=? WHERE user_id=? AND company_id IS NULL', [cid, u.id]).catch(() => {});
          await db.query('UPDATE pending_invoices SET company_id=? WHERE user_id=? AND company_id IS NULL', [cid, u.id]).catch(() => {});
        }
        console.log(`Migrated ${users.length} users.`);

        // Clean legacy columns from users
        const legacy = ['ruc', 'business_name', 'tax_address', 'dni', 'sol_user', 'sol_pass', 'sunat_token', 'sunat_api_url', 'cert_base64', 'cert_pass', 'serie_factura', 'serie_boleta', 'sunat_env', 'assigned_accountant_id'];
        for (const col of legacy) {
          if (await colExists('users', col)) {
            console.log(`Dropping ${col} from users...`);
            await db.query(`ALTER TABLE users DROP COLUMN ${col}`).catch(e => console.error(`  Error: ${e.message}`));
          }
        }
      } else {
        const users = await db.query("SELECT id, name FROM users WHERE role='USER'");
        for (const u of users) {
          const cid = 'comp-' + u.id;
          await db.query('INSERT IGNORE INTO companies (id, owner_user_id, name) VALUES (?,?,?)', [cid, u.id, u.name || 'Mi Empresa']);
          for (const t of tables) {
            await db.query(`UPDATE ${t} SET company_id=? WHERE user_id=? AND company_id IS NULL`, [cid, u.id]).catch(() => {});
          }
        }
        console.log(`Created ${users.length} default companies.`);
      }
    }

    // 4. Verify
    const finalCompanies = await db.query('SELECT id, name, ruc FROM companies');
    console.log('Final companies:', JSON.stringify(finalCompanies, null, 2));
    const expCol = await colExists('expenses', 'company_id');
    console.log('expenses.company_id exists:', expCol);

    process.exit();
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
})();
