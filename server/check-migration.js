const db = require('./db');
(async () => {
  try {
    const c = await db.query('SELECT id, owner_user_id, name, ruc FROM companies');
    console.log('Companies:', JSON.stringify(c, null, 2));
    const cols = await db.query("SHOW COLUMNS FROM expenses LIKE 'company_id'");
    console.log('Expenses has company_id:', cols.length > 0);
    const ucols = await db.query("SHOW COLUMNS FROM users LIKE 'sol_user'");
    console.log('Users still has sol_user:', ucols.length > 0);
    process.exit();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
