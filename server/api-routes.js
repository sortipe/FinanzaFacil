const express = require('express');
const router = express.Router();
const db = require('./db');
const { sendEmail } = require('./mailer');
const sireApiService = require('./sire-api-service');

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
  phone: 'phone', profile_picture: 'profilePicture',
  subscription_start_date: 'subscriptionStartDate', subscription_end_date: 'subscriptionEndDate',
  parent_id: 'parentId',
  ruc: 'ruc', sol_user: 'solUser', sol_pass: 'solPass',
  is_verified: 'isVerified', verification_token: 'verificationToken', verification_expires: 'verificationExpires',
  created_at: 'createdAt', updated_at: 'updatedAt'
};

const COMPANY_FIELDS = {
  id: 'id', owner_user_id: 'ownerUserId', name: 'name', ruc: 'ruc',
  business_name: 'businessName', tax_address: 'taxAddress', dni: 'dni',
  is_persona_natural: 'isPersonaNatural',
  sol_user: 'solUser', sol_pass: 'solPass', sire_client_id: 'sireClientId', sire_client_secret: 'sireClientSecret',
  sunat_token: 'sunatToken',
  sunat_api_url: 'sunatApiUrl', cert_base64: 'certBase64', cert_pass: 'certPass',
  serie_factura: 'serieFactura', serie_boleta: 'serieBoleta',
  serie_liquidacion: 'serieLiquidacion', serie_guia_remision: 'serieGuiaRemision', serie_guia_transporte: 'serieGuiaTransporte',
  sunat_env: 'sunatEnv',
  assigned_accountant_id: 'assignedAccountantId',
  created_at: 'createdAt', updated_at: 'updatedAt'
};

const validatePasswordStrength = (password, email, name) => {
  if (!password) return { isValid: false, error: 'La contraseña es requerida' };
  if (password.length < 8) return { isValid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  if (!/[A-Z]/.test(password)) return { isValid: false, error: 'La contraseña debe incluir al menos una letra mayúscula (A-Z)' };
  if (!/[a-z]/.test(password)) return { isValid: false, error: 'La contraseña debe incluir al menos una letra minúscula (a-z)' };
  if (!/[0-9]/.test(password)) return { isValid: false, error: 'La contraseña debe incluir al menos un número (0-9)' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { isValid: false, error: 'La contraseña debe incluir al menos un carácter especial (!@#$...)' };

  const lowerPwd = password.toLowerCase();
  const commonPwds = ['123456', '12345678', '123456789', 'password', 'qwerty', 'admin123', '123123', '111111', 'abc123', 'finanza', 'finanza123'];
  if (commonPwds.includes(lowerPwd)) return { isValid: false, error: 'La contraseña es demasiado común y fácil de adivinar' };

  if (email) {
    const emailName = email.toLowerCase().split('@')[0];
    if (emailName.length > 2 && lowerPwd.includes(emailName)) {
      return { isValid: false, error: 'La contraseña no debe contener tu correo o usuario' };
    }
  }
  return { isValid: true };
};

const EXPENSE_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', amount: 'amount', currency: 'currency',
  description: 'description', date: 'date', category: 'category',
  internal_voucher_url: 'internalVoucherUrl', accountant_voucher_url: 'accountantVoucherUrl',
  invoice_number: 'invoiceNumber', ruc: 'ruc', subtotal: 'subtotal', igv: 'igv',
  is_private: 'isPrivate', created_at: 'createdAt'
};

const TAXDOC_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', accountant_id: 'accountantId', name: 'name',
  file_url: 'fileUrl', mime_type: 'mimeType', folder_path: 'folderPath',
  upload_date: 'uploadDate',
  period_month: 'periodMonth', period_year: 'periodYear', sunat_status: 'sunatStatus',
  sunat_hash: 'sunatHash', uploaded_by: 'uploadedBy', document_type: 'documentType',
  original_document_id: 'originalDocumentId', pdf_url: 'pdfUrl',
  xml_url: 'xmlUrl', cdr_url: 'cdrUrl', xml_content: 'xmlContent',
  cdr_base64: 'cdrBase64', created_at: 'createdAt'
};

const PACKAGE_FIELDS = {
  id: 'id', name: 'name', price: 'price', duration_months: 'durationMonths',
  features: 'features', type: 'type', is_free: 'isFree', created_at: 'createdAt'
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
  id: 'id', user_id: 'userId', company_id: 'companyId', user_name: 'userName', user_email: 'userEmail',
  date: 'date', time: 'time', type: 'type', description: 'description',
  detail: 'detail', status: 'status', created_at: 'createdAt'
};

const USERPRODUCT_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', description: 'description', unit: 'unit',
  unit_price: 'unitPrice', last_used: 'lastUsed', created_at: 'createdAt'
};

const PENDING_INVOICE_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', accountant_id: 'accountantId',
  description: 'description', amount: 'amount', currency: 'currency', frequency: 'frequency',
  day_of_month: 'dayOfMonth', status: 'status', attempt_count: 'attemptCount',
  last_attempt: 'lastAttempt', last_error: 'lastError', original_document_id: 'originalDocumentId',
  next_run_date: 'nextRunDate', created_at: 'createdAt'
};

async function checkSubscriptionLimits(userId, limitType, countQuery, countParams) {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user[0]) return null;

  const today = new Date().toISOString().split('T')[0];
  let pkgRow = null;

  const isUserActive = user[0].subscription_status === 'ACTIVE' && user[0].subscription_end_date && user[0].subscription_end_date >= today;

  if (isUserActive) {
    const activeRecord = await db.query(
      'SELECT package_name FROM subscription_history WHERE user_id = ? AND status = ? AND end_date >= ? ORDER BY created_at DESC LIMIT 1',
      [userId, 'PAID', today]
    );
    if (activeRecord[0] && activeRecord[0].package_name) {
      const found = await db.query('SELECT limits FROM packages WHERE name = ? AND deleted_at IS NULL', [activeRecord[0].package_name]);
      if (found[0]) pkgRow = found[0];
    }
  }

  // Fallback to Free Plan if no active paid subscription package limits were found
  if (!pkgRow || !pkgRow.limits) {
    const isAcctRole = user[0].role === 'ACCOUNTANT' || user[0].role === 'CONTADOR';
    const targetType = isAcctRole ? 'ACCOUNTANT' : 'CLIENT';
    const freePkg = await db.query('SELECT limits FROM packages WHERE type = ? AND is_free = 1 AND deleted_at IS NULL LIMIT 1', [targetType]);
    if (freePkg[0]) pkgRow = freePkg[0];
  }

  if (!pkgRow || !pkgRow.limits) return null;
  const limits = typeof pkgRow.limits === 'string' ? JSON.parse(pkgRow.limits) : pkgRow.limits;
  const roleKey = (user[0].role === 'PERSONA_NATURAL' || user[0].role === 'EMPRESARIO') ? 'USER' : user[0].role;
  const roleLimit = limits[limitType] ? limits[limitType][roleKey] : null;
  if (roleLimit === null || roleLimit === undefined) return null;
  var countResult = await db.query(countQuery, countParams);
  return { limit: roleLimit, count: countResult[0].total };
}

const PENDINGINV_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', serie: 'serie', correlative: 'correlative',
  document_type: 'documentType', original_document_id: 'originalDocumentId',
  customer_doc_type: 'customerDocType',
  customer_doc_number: 'customerDocNumber', customer_name: 'customerName',
  amount: 'amount', created_at: 'createdAt', last_attempt: 'lastAttempt',
  attempt_count: 'attemptCount', status: 'status', last_error: 'lastError'
};

// --- Correlativos (compartidos por empresa + serie) ---
// El correlativo vive en la BD, no en localStorage, para que todos los usuarios
// de una misma empresa compartan la misma secuencia y no se dupliquen IDs.

const computeBaselineCorrelative = async (companyId, serie) => {
  const td = await db.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)) AS m
       FROM tax_documents WHERE company_id = ? AND id LIKE CONCAT(?, '-%')`,
    [companyId, serie]
  );
  const pi = await db.query(
    'SELECT MAX(correlative) AS m FROM pending_invoices WHERE company_id = ? AND serie = ?',
    [companyId, serie]
  );
  return Math.max(td[0]?.m || 0, pi[0]?.m || 0);
};

// Validación de serie: SUNAT (F001-F999, B001-B999, E001-E999, T001-T999, V001-V999) o Internos (TICK, NV01, PROF, COT01, OPAG, OP01)
const SERIE_SUNAT_REGEX = /^[FBETV][0-9]{3}$/;
const SERIE_INTERNA_REGEX = /^(TICK|TK[0-9]{2}|NV[0-9]{2}|PROF|COT[0-9]{2}|COT|OPAG|OP[0-9]{2})$/i;
const validateSerie = (serie) => SERIE_SUNAT_REGEX.test(String(serie || '')) || SERIE_INTERNA_REGEX.test(String(serie || ''));

const allocateNextCorrelative = async (companyId, serie, requested) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT last_used FROM correlativos WHERE company_id = ? AND serie = ? FOR UPDATE',
      [companyId, serie]
    );
    let last = 0;
    if (rows.length === 0) {
      last = await computeBaselineCorrelative(companyId, serie);
      await conn.execute(
        'INSERT INTO correlativos (company_id, serie, last_used) VALUES (?, ?, ?)',
        [companyId, serie, last]
      );
    } else {
      last = rows[0].last_used || 0;
    }
    const req = parseInt(requested, 10);
    const next = Math.max(last + 1, isNaN(req) || req < 1 ? last + 1 : req);
    await conn.execute(
      'UPDATE correlativos SET last_used = ? WHERE company_id = ? AND serie = ?',
      [next, companyId, serie]
    );
    await conn.commit();
    return next;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const SUNATCONFIG_FIELDS = { sunat_token: 'sunatToken', sunat_api_url: 'sunatApiUrl', support_phone: 'supportPhone', updated_at: 'updatedAt' };

const PAYMENT_ALERT_FIELDS = {
  id: 'id', user_id: 'userId', company_id: 'companyId', title: 'title', category: 'category',
  amount: 'amount', currency: 'currency', due_date: 'dueDate', frequency: 'frequency',
  reminder_days_before: 'reminderDaysBefore', status: 'status', notes: 'notes',
  last_paid_date: 'lastPaidDate', created_at: 'createdAt'
};

const PERSONAL_EXPENSE_FIELDS = {
  id: 'id', user_id: 'userId', concept: 'concept', description: 'description',
  amount: 'amount', currency: 'currency', date: 'date', voucher_url: 'voucherUrl',
  merchant_name: 'merchantName', notes: 'notes', created_at: 'createdAt'
};

const NOTIFICATION_FIELDS = {
  id: 'id', user_id: 'userId', message: 'message', date: 'date',
  is_read: 'isRead', type: 'type', created_at: 'createdAt'
};

const SIRE_REGISTRO_FIELDS = {
  id: 'id', company_id: 'companyId', periodo: 'periodo', tipo: 'tipo', estado: 'estado',
  total_registros: 'totalRegistros', base_imponible: 'baseImponible', igv: 'igv', total: 'total',
  fecha_generacion: 'fechaGeneracion', fecha_aceptacion: 'fechaAceptacion', observaciones: 'observaciones',
  created_at: 'createdAt'
};

const SIRE_COMPROBANTE_FIELDS = {
  id: 'id', registro_id: 'registroId', company_id: 'companyId', periodo: 'periodo', tipo: 'tipo',
  tipo_comprobante: 'tipoComprobante', serie: 'serie', numero: 'numero', fecha_emision: 'fechaEmision',
  ruc_emisor: 'rucEmisor', razon_social_emisor: 'razonSocialEmisor', base_imponible: 'baseImponible',
  igv: 'igv', total: 'total', moneda: 'moneda', estado_cruce: 'estadoCruce', origen: 'origen',
  tax_document_id: 'taxDocumentId', created_at: 'createdAt'
};

// --- USERS ---
router.get('/users', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(rows.map(r => {
      const mapped = mapRow(r, USER_FIELDS);
      delete mapped.password;
      return mapped;
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/verify-credentials', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    const [user] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!user) return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    if (user.password && user.password !== password) return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    if (user.is_verified === 0) return res.status(403).json({ success: false, error: 'Cuenta no verificada' });
    
    const mapped = mapRow(user, USER_FIELDS);
    delete mapped.password;
    res.json({ success: true, user: mapped });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- USER SELF-SERVICE PASSWORD RECOVERY ---
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Always return success to prevent email-enumeration attacks
    if (!user) {
      return res.json({ success: true, message: 'Si el email está registrado, se enviará una nueva contraseña.' });
    }

    const newPassword = generateTempPassword();

    await db.query('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?', [newPassword, user.id]);

    const baseUrl = process.env.APP_URL || 'https://finanzafacil.com';
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/?email=${encodeURIComponent(user.email)}`;

    console.log(`\n========================================`);
    console.log(`📧 RECUPERACIÓN DE CONTRASEÑA (self-service)`);
    console.log(`   Para: ${user.email}`);
    console.log(`   Usuario: ${user.name}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
    console.log(`   Link de Ingreso: ${loginUrl}`);
    console.log(`========================================\n`);

    try {
      const result = await sendEmail({
        to: user.email,
        subject: 'Recuperación de Contraseña - FinanzaFacil',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #7C3AED; font-size: 24px;">FinanzaFacil</h1>
            </div>
            <h2 style="color: #333;">Hola ${user.name},</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              Has solicitado recuperar tu contraseña. Usa la siguiente clave temporal para acceder:
            </p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <code style="font-size: 24px; font-weight: bold; color: #7C3AED; letter-spacing: 4px;">${newPassword}</code>
            </div>
            <div style="text-align: center; margin: 28px 0 16px 0;">
              <a href="${loginUrl}" target="_blank" style="background-color: #7C3AED; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);">
                Ingresar a mi Cuenta
              </a>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              O copia este enlace en tu navegador:<br/>
              <a href="${loginUrl}" style="color: #7C3AED; word-break: break-all;">${loginUrl}</a>
            </p>
            <p style="color: #e74c3c; font-size: 13px; font-weight: bold; margin-top: 20px;">
              ⚠ Esta es una contraseña temporal. Cambia tu contraseña al iniciar sesión.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="color: #999; font-size: 11px; text-align: center;">
              FinanzaFacil - Tu plataforma de finanzas inteligentes
            </p>
          </div>
        `
      });
      if (!result.sent) {
        console.log(`⚠ No se pudo enviar el email (password en consola): ${result.warning}`);
      }
    } catch (err) {
      console.log(`⚠ No se pudo enviar el email (password en consola): ${err.message}`);
    }

    res.json({ success: true, message: 'Si el email está registrado, se enviará una nueva contraseña.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify email activation token from email link click
router.post('/auth/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token de activación no proporcionado' });

    const rows = await db.query('SELECT * FROM users WHERE verification_token = ?', [token]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'El enlace de activación es inválido o ya fue utilizado.' });
    }

    const user = rows[0];
    if (user.verification_expires && new Date(user.verification_expires).getTime() < Date.now()) {
      return res.status(400).json({ error: 'El enlace de activación ha expirado. Por favor solicita uno nuevo.' });
    }

    await db.query('UPDATE users SET is_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?', [user.id]);
    res.json({ success: true, message: '¡Tu cuenta ha sido activada exitosamente! Ya puedes ingresar.', email: user.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Resend verification email link
router.post('/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El correo electrónico es requerido' });

    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows || rows.length === 0) {
      return res.json({ success: true, message: 'Si el correo está registrado, se enviará el enlace de activación.' });
    }

    const user = rows[0];
    if (user.is_verified === 1) {
      return res.status(400).json({ error: 'Esta cuenta ya se encuentra verificada y activa.' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    await db.query('UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?', [token, expires, user.id]);

    const baseUrl = process.env.APP_URL || 'https://finanzafacil.com';
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/?verify_token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Enlace de Activación - FinanzaFacil',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #4F46E5; font-size: 26px; margin: 0; font-weight: 800;">FinanzaFacil</h1>
          </div>
          <h2 style="color: #1f2937; font-size: 20px; font-weight: 700;">¡Hola, ${user.name}!</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
            Has solicitado un nuevo enlace de activación para tu cuenta en <strong>FinanzaFacil</strong>. Por favor haz clic en el siguiente botón:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" target="_blank" style="background-color: #4F46E5; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block;">
              Verificar mi Cuenta
            </a>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Se ha enviado un nuevo enlace de activación a tu correo.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

    if (user.password) {
      const checkPwd = validatePasswordStrength(user.password, user.email, user.name);
      if (!checkPwd.isValid) {
        return res.status(400).json({ error: checkPwd.error });
      }
    }

    // Check maxSubUsers limit for parent user
    if (user.parentId) {
      const subResult = await checkSubscriptionLimits(user.parentId, 'maxSubUsers',
        'SELECT COUNT(*) AS total FROM users WHERE parent_id = ?', [user.parentId]);
      if (subResult && subResult.count >= subResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de sub usuarios para tu plan' });
      }
    }

    // maxSubUsersPerCreatedClient: cap sub-usuarios of a client created by an accountant, by the accountant's plan.
    if (user.parentId) {
      const parentInfo = await db.query('SELECT u.parent_id, p.role AS parent_role FROM users u LEFT JOIN users p ON u.parent_id = p.id WHERE u.id = ?', [user.parentId]);
      if (parentInfo[0] && parentInfo[0].parent_id && parentInfo[0].parent_role === 'ACCOUNTANT') {
        const ccResult = await checkSubscriptionLimits(parentInfo[0].parent_id, 'maxSubUsersPerCreatedClient',
          'SELECT COUNT(*) AS total FROM users WHERE parent_id = ?', [user.parentId]);
        if (ccResult && ccResult.count >= ccResult.limit) {
          return res.status(403).json({ error: `Este cliente ha alcanzado el límite de sub usuarios (${ccResult.limit}) definido en tu plan de contador` });
        }
      }
    }

    // Check maxCreatedAccountants limit for parent user when creating an accountant
    if (user.parentId && user.role === 'ACCOUNTANT') {
      const createdAcctResult = await checkSubscriptionLimits(user.parentId, 'maxCreatedAccountants',
        'SELECT COUNT(*) AS total FROM users WHERE parent_id = ? AND role = ?', [user.parentId, 'ACCOUNTANT']);
      if (createdAcctResult && createdAcctResult.count >= createdAcctResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de contadores a crear para tu plan' });
      }

      // maxCreatedAccountantsPerCreatedClient: cap ACCOUNTANT sub-users of a client created by an accountant, by the accountant's plan.
      const createdClientParent = await db.query('SELECT u.parent_id, p.role AS parent_role FROM users u LEFT JOIN users p ON u.parent_id = p.id WHERE u.id = ?', [user.parentId]);
      if (createdClientParent[0] && createdClientParent[0].parent_id && createdClientParent[0].parent_role === 'ACCOUNTANT') {
        const ccResult = await checkSubscriptionLimits(createdClientParent[0].parent_id, 'maxCreatedAccountantsPerCreatedClient',
          'SELECT COUNT(*) AS total FROM users WHERE parent_id = ? AND role = ?', [user.parentId, 'ACCOUNTANT']);
        if (ccResult && ccResult.count >= ccResult.limit) {
          return res.status(403).json({ error: `Este cliente ha alcanzado el límite de contadores creados (${ccResult.limit}) definido en tu plan de contador` });
        }
      }
    }

    // Check maxCreatedClients limit for parent (accountant) when creating a client USER
    if (user.parentId && user.role === 'USER') {
      const createdClientResult = await checkSubscriptionLimits(user.parentId, 'maxCreatedClients',
        'SELECT COUNT(*) AS total FROM users WHERE parent_id = ? AND role = ?', [user.parentId, 'USER']);
      if (createdClientResult && createdClientResult.count >= createdClientResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de clientes a crear para tu plan' });
      }
    }
    const crypto = require('crypto');
    const isSelfRegister = !user.parentId && user.isVerified !== true;
    const isVerifiedVal = isSelfRegister ? 0 : 1;
    const token = isSelfRegister ? crypto.randomBytes(32).toString('hex') : null;
    const expires = isSelfRegister ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ') : null;

    await db.query(`INSERT INTO users (id, name, email, role, password, must_change_password, subscription_status, phone, profile_picture, subscription_start_date, subscription_end_date, parent_id, ruc, sol_user, sol_pass, is_verified, verification_token, verification_expires) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      user.id, user.name, user.email, user.role || 'USER', user.password || null, user.mustChangePassword ? 1 : 0,
      user.subscriptionStatus || 'PENDING', user.phone || null, user.profilePicture || null,
      user.subscriptionStartDate || null, user.subscriptionEndDate || null, user.parentId || null,
      user.ruc || null, user.solUser || null, user.solPass || null,
      isVerifiedVal, token, expires
    ]);

    if (isSelfRegister && token) {
      const baseUrl = process.env.APP_URL || 'https://finanzafacil.com';
      const verifyUrl = `${baseUrl.replace(/\/$/, '')}/?verify_token=${token}`;
      sendEmail({
        to: user.email,
        subject: 'Activa tu cuenta en FinanzaFacil',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #4F46E5; font-size: 26px; margin: 0; font-weight: 800;">FinanzaFacil</h1>
              <p style="color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-t: 4px;">Gestión Contable e Inventario</p>
            </div>
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 700;">¡Hola, ${user.name}!</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              Gracias por registrarte en <strong>FinanzaFacil</strong>. Para completar la activación de tu cuenta y comenzar a utilizar la plataforma, por favor confirma tu correo electrónico haciendo clic en el siguiente botón:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}" target="_blank" style="background-color: #4F46E5; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                Verificar mi Cuenta
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
              Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br/>
              <a href="${verifyUrl}" style="color: #4F46E5; word-break: break-all;">${verifyUrl}</a>
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
              Este enlace expira en 24 horas. Si no creaste una cuenta en FinanzaFacil, puedes ignorar este correo.
            </p>
          </div>
        `
      }).catch(e => console.error('Error enviando correo de verificación:', e));
    }

    res.json({
      success: true,
      user: {
        ...user,
        isVerified: isVerifiedVal === 1,
        requiresEmailVerification: isSelfRegister
      }
    });
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

    if (data.password !== undefined && data.mustChangePassword !== true) {
      const checkPwd = validatePasswordStrength(data.password, data.email, data.name);
      if (!checkPwd.isValid) {
        return res.status(400).json({ error: checkPwd.error });
      }
    }

    const fields = [];
    const values = [];
    const map = {
      name: 'name', email: 'email', role: 'role', password: 'password',
      mustChangePassword: 'must_change_password', subscriptionStatus: 'subscription_status',
      phone: 'phone', profilePicture: 'profile_picture',
      subscriptionStartDate: 'subscription_start_date', subscriptionEndDate: 'subscription_end_date',
      parentId: 'parent_id',
      ruc: 'ruc', solUser: 'sol_user', solPass: 'sol_pass'
    };
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col}=?`);
        values.push(key === 'mustChangePassword' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (fields.length === 0) return res.json({ success: true });
    

  // Check maxAccountants limit for owner when assigning a new accountant
  if (data.assignedAccountantId) {
    var companyRow = await db.query('SELECT owner_user_id, assigned_accountant_id FROM companies WHERE id = ?', [req.params.id]);
    var ownerId = companyRow[0] ? companyRow[0].owner_user_id : null;
    if (ownerId && companyRow[0].assigned_accountant_id !== data.assignedAccountantId) {
      var ownerResult = await checkSubscriptionLimits(ownerId, 'maxAccountants',
        'SELECT COUNT(DISTINCT assigned_accountant_id) AS total FROM companies WHERE owner_user_id = ? AND assigned_accountant_id IS NOT NULL AND id != ?', [ownerId, req.params.id]);
      if (ownerResult && ownerResult.count >= ownerResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de contadores para tu plan' });
      }
    }
  }
  values.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);
    const [updated] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, user: { ...updated, ...mapRow(updated, USER_FIELDS) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ADMIN PASSWORD RESET ---
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, mustChangePassword } = req.body;

    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updateFields = [];
    const values = [];
    if (password !== undefined) {
      updateFields.push('password = ?');
      values.push(password);
    }
    if (mustChangePassword !== undefined) {
      updateFields.push('must_change_password = ?');
      values.push(mustChangePassword ? 1 : 0);
    }
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No se especificaron campos para actualizar' });
    }
    values.push(id);
    await db.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMPANIES ---
router.get('/companies', async (req, res) => {
  try {
    const { userId } = req.query;
    const sql = userId ? 'SELECT * FROM companies WHERE owner_user_id = ? ORDER BY created_at ASC' : 'SELECT * FROM companies ORDER BY created_at ASC';
    const rows = await db.query(sql, userId ? [userId] : []);
    res.json(rows.map(r => ({ ...r, ...mapRow(r, COMPANY_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/companies/:id', async (req, res) => {
  try {
    const [row] = await db.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    res.json(row ? { ...row, ...mapRow(row, COMPANY_FIELDS) } : { error: 'Company not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/companies', async (req, res) => {
  try {
    const c = req.body;
    if (c.isPersonaNatural) {
      const existing = await db.query('SELECT COUNT(*) AS total FROM companies WHERE owner_user_id = ?', [c.ownerUserId]);
      if (existing[0] && existing[0].total > 0) {
        return res.status(400).json({ error: 'Un usuario Persona Natural solo puede tener una empresa' });
      }
    }

    // Check maxCompanies limit for owner
    const ownerResult = await checkSubscriptionLimits(c.ownerUserId, 'maxCompanies',
      'SELECT COUNT(*) AS total FROM companies WHERE owner_user_id = ?', [c.ownerUserId]);
    if (ownerResult && ownerResult.count >= ownerResult.limit) {
      return res.status(403).json({ error: 'Has alcanzado el límite de empresas para tu plan' });
    }

    // Check maxManagedCompanies limit for accountant
    if (c.assignedAccountantId) {
      const accountantResult = await checkSubscriptionLimits(c.assignedAccountantId, 'maxManagedCompanies',
        'SELECT COUNT(*) AS total FROM companies WHERE assigned_accountant_id = ?', [c.assignedAccountantId]);
      if (accountantResult && accountantResult.count >= accountantResult.limit) {
        return res.status(403).json({ error: 'El contador ha alcanzado su límite de empresas a gestionar' });
      }
    }

    // Check maxAccountants limit for owner
    if (c.assignedAccountantId) {
      const ownerAcctResult = await checkSubscriptionLimits(c.ownerUserId, 'maxAccountants',
        'SELECT COUNT(DISTINCT assigned_accountant_id) AS total FROM companies WHERE owner_user_id = ? AND assigned_accountant_id IS NOT NULL', [c.ownerUserId]);
      if (ownerAcctResult && ownerAcctResult.count >= ownerAcctResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de contadores para tu plan' });
      }
    }

    // Check maxManagedCompaniesPerAccountant limit for the creating empresario
    if (c.assignedAccountantId) {
      const acctParent = await db.query('SELECT parent_id FROM users WHERE id = ?', [c.assignedAccountantId]);
      const parentId = acctParent[0] && acctParent[0].parent_id;
      if (parentId && parentId === c.ownerUserId) {
        const ccResult = await checkSubscriptionLimits(parentId, 'maxManagedCompaniesPerAccountant',
          'SELECT COUNT(*) AS total FROM companies WHERE assigned_accountant_id = ? AND owner_user_id = ?', [c.assignedAccountantId, c.ownerUserId]);
        if (ccResult && ccResult.count >= ccResult.limit) {
          return res.status(403).json({ error: 'Este contador ha alcanzado el límite de empresas gestionadas para tu plan' });
        }
      }
    }

    // maxCompaniesPerCreatedClient: cap companies of a client USER created by an accountant (empresario).
    const ownerParent = await db.query('SELECT u.parent_id, p.role AS parent_role FROM users u LEFT JOIN users p ON u.parent_id = p.id WHERE u.id = ?', [c.ownerUserId]);
    if (ownerParent[0] && ownerParent[0].parent_id && ownerParent[0].parent_role === 'ACCOUNTANT') {
      const ccResult = await checkSubscriptionLimits(ownerParent[0].parent_id, 'maxCompaniesPerCreatedClient',
        'SELECT COUNT(*) AS total FROM companies WHERE owner_user_id = ?', [c.ownerUserId]);
      if (ccResult && ccResult.count >= ccResult.limit) {
        return res.status(403).json({ error: `Este cliente ha alcanzado el límite de empresas (${ccResult.limit}) definido en tu plan de contador` });
      }

      // maxAccountantsPerCreatedClient: cap distinct accountants the created-client works with, by the accountant's plan.
      const ccAcctResult = await checkSubscriptionLimits(ownerParent[0].parent_id, 'maxAccountantsPerCreatedClient',
        'SELECT COUNT(DISTINCT assigned_accountant_id) AS total FROM companies WHERE owner_user_id = ? AND assigned_accountant_id IS NOT NULL', [c.ownerUserId]);
      if (ccAcctResult && ccAcctResult.count >= ccAcctResult.limit) {
        return res.status(403).json({ error: `Este cliente ha alcanzado el límite de contadores con los que puede trabajar (${ccAcctResult.limit}) definido en tu plan de contador` });
      }
    }

    await db.query(`INSERT INTO companies (id, owner_user_id, name, ruc, business_name, tax_address, dni, is_persona_natural, sol_user, sol_pass, sunat_token, sunat_api_url, cert_base64, cert_pass, serie_factura, serie_boleta, serie_liquidacion, serie_guia_remision, serie_guia_transporte, sunat_env, assigned_accountant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      c.id, c.ownerUserId, c.name, c.ruc || null, c.businessName || null, c.taxAddress || null,
      c.dni || null, c.isPersonaNatural ? 1 : 0,
      c.solUser || null, c.solPass || null, c.sunatToken || null, c.sunatApiUrl || null,
      c.certBase64 || null, c.certPass || null, c.serieFactura || null, c.serieBoleta || null,
      c.serieLiquidacion || 'E001', c.serieGuiaRemision || 'T001', c.serieGuiaTransporte || 'V001',
      c.sunatEnv || 'SANDBOX', c.assignedAccountantId || null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/companies/:id', async (req, res) => {
  try {
    const data = req.body;
    const fields = [];
    const values = [];
    const map = {
      name: 'name', ruc: 'ruc', businessName: 'business_name', taxAddress: 'tax_address',
      dni: 'dni', isPersonaNatural: 'is_persona_natural',
      solUser: 'sol_user', solPass: 'sol_pass', sunatToken: 'sunat_token',
      sunatApiUrl: 'sunat_api_url', certBase64: 'cert_base64', certPass: 'cert_pass',
      serieFactura: 'serie_factura', serieBoleta: 'serie_boleta',
      serieLiquidacion: 'serie_liquidacion', serieGuiaRemision: 'serie_guia_remision', serieGuiaTransporte: 'serie_guia_transporte',
      sunatEnv: 'sunat_env',
      assignedAccountantId: 'assigned_accountant_id'
    };
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${col}=?`);
      values.push(data[key]);
    }
  }
  if (fields.length === 0) return res.json({ success: true });

  // Check maxManagedCompanies limit when assigning an accountant
  if (data.assignedAccountantId) {
    const accountantResult = await checkSubscriptionLimits(data.assignedAccountantId, 'maxManagedCompanies',
      'SELECT COUNT(*) AS total FROM companies WHERE assigned_accountant_id = ?', [data.assignedAccountantId]);
    if (accountantResult && accountantResult.count >= accountantResult.limit) {
      return res.status(403).json({ error: 'El contador ha alcanzado su límite de empresas a gestionar' });
    }
  }

  // Check maxManagedCompaniesPerAccountant limit for the creating empresario
  if (data.assignedAccountantId) {
    const [curCompany] = await db.query('SELECT owner_user_id FROM companies WHERE id = ?', [req.params.id]);
    const ownerUserId = curCompany ? curCompany.owner_user_id : null;
    const acctParent = await db.query('SELECT parent_id FROM users WHERE id = ?', [data.assignedAccountantId]);
    const parentId = acctParent[0] && acctParent[0].parent_id;
    if (parentId && parentId === ownerUserId) {
      const ccResult = await checkSubscriptionLimits(parentId, 'maxManagedCompaniesPerAccountant',
        'SELECT COUNT(*) AS total FROM companies WHERE assigned_accountant_id = ? AND owner_user_id = ? AND id != ?', [data.assignedAccountantId, ownerUserId, req.params.id]);
      if (ccResult && ccResult.count >= ccResult.limit) {
        return res.status(403).json({ error: 'Este contador ha alcanzado el límite de empresas gestionadas para tu plan' });
      }
    }
  }

  values.push(req.params.id);
  await db.query(`UPDATE companies SET ${fields.join(',')} WHERE id=?`, values);
  const [updated] = await db.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  res.json({ success: true, company: { ...updated, ...mapRow(updated, COMPANY_FIELDS) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/companies/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- EXPENSES ---
router.get('/expenses', async (req, res) => {
  try {
    const { userId, companyId } = req.query;
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (companyId) { sql += ' AND company_id = ?'; params.push(companyId); }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => {
      const mapped = numFields({ ...r, ...mapRow(r, EXPENSE_FIELDS) }, ['amount', 'subtotal', 'igv']);
      mapped.isPrivate = !!r.is_private;
      return mapped;
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function saveBase64ToDisk(base64Content, subDir, fileNamePrefix) {
  if (!base64Content) return null;
  if (base64Content.startsWith('/uploads/') || base64Content.startsWith('http://') || base64Content.startsWith('https://')) {
    return base64Content;
  }
  try {
    const fs = require('fs');
    const path = require('path');

    let ext = '.jpg';
    let rawB64 = base64Content;

    if (base64Content.includes(';base64,')) {
      const parts = base64Content.split(';base64,');
      const header = parts[0];
      rawB64 = parts[1];
      if (header.includes('png')) { ext = '.png'; }
      else if (header.includes('pdf')) { ext = '.pdf'; }
      else if (header.includes('webp')) { ext = '.webp'; }
    }

    const uploadDirOnDisk = path.join(__dirname, 'uploads', subDir);
    if (!fs.existsSync(uploadDirOnDisk)) {
      fs.mkdirSync(uploadDirOnDisk, { recursive: true });
    }

    const fileName = `${fileNamePrefix}_${Date.now()}${ext}`;
    const diskPath = path.join(uploadDirOnDisk, fileName);
    fs.writeFileSync(diskPath, Buffer.from(rawB64, 'base64'));

    return `/uploads/${subDir}/${fileName}`;
  } catch (err) {
    console.error('Error saving base64 to disk:', err);
    return null;
  }
}

router.post('/expenses', async (req, res) => {
  try {
    const e = req.body;
    if (!e || !e.userId) {
      return res.status(400).json({ error: 'Se requiere userId para registrar el gasto' });
    }

    // Verify company exists to avoid foreign key constraint error
    let validCompanyId = null;
    if (e.companyId && typeof e.companyId === 'string' && e.companyId.trim() !== '') {
      const compCheck = await db.query('SELECT id FROM companies WHERE id = ?', [e.companyId.trim()]);
      if (compCheck.length > 0) {
        validCompanyId = e.companyId.trim();
      }
    }

    const companySubDir = validCompanyId || e.userId || 'general';
    const internalUrl = saveBase64ToDisk(e.internalVoucherUrl, `${companySubDir}/vouchers`, 'voucher_int') || e.internalVoucherUrl || null;
    const accountantUrl = saveBase64ToDisk(e.accountantVoucherUrl, `${companySubDir}/vouchers`, 'voucher_acc') || e.accountantVoucherUrl || null;
    const id = e.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await db.query(`
      INSERT INTO expenses (id, user_id, company_id, amount, currency, description, date, category, internal_voucher_url, accountant_voucher_url, invoice_number, ruc, subtotal, igv, is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        amount = VALUES(amount),
        currency = VALUES(currency),
        description = VALUES(description),
        date = VALUES(date),
        category = VALUES(category),
        internal_voucher_url = COALESCE(VALUES(internal_voucher_url), internal_voucher_url),
        accountant_voucher_url = COALESCE(VALUES(accountant_voucher_url), accountant_voucher_url),
        invoice_number = VALUES(invoice_number),
        ruc = VALUES(ruc),
        subtotal = VALUES(subtotal),
        igv = VALUES(igv),
        is_private = VALUES(is_private)
    `, [
      id, e.userId, validCompanyId, parseFloat(e.amount) || 0, e.currency || 'PEN', e.description || '', e.date || new Date().toISOString().split('T')[0],
      e.category || 'Otros Egresos No SUNAT', internalUrl, accountantUrl,
      e.invoiceNumber || null, e.ruc || null, e.subtotal || null, e.igv || null, e.isPrivate ? 1 : 0
    ]);

    res.json({ success: true, id });
  } catch (e) {
    console.error('Error inserting expense:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/expenses/batch', async (req, res) => {
  try {
    const expensesList = req.body;
    if (!Array.isArray(expensesList) || expensesList.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de egresos' });
    }

    const insertedIds = [];
    for (const e of expensesList) {
      if (!e.userId) continue;

      let validCompanyId = null;
      if (e.companyId && typeof e.companyId === 'string' && e.companyId.trim() !== '') {
        const compCheck = await db.query('SELECT id FROM companies WHERE id = ?', [e.companyId.trim()]);
        if (compCheck.length > 0) {
          validCompanyId = e.companyId.trim();
        }
      }

      const id = e.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const companySubDir = validCompanyId || e.userId || 'general';
      const internalUrl = saveBase64ToDisk(e.internalVoucherUrl, `${companySubDir}/vouchers`, 'voucher_int') || e.internalVoucherUrl || null;
      const accountantUrl = saveBase64ToDisk(e.accountantVoucherUrl, `${companySubDir}/vouchers`, 'voucher_acc') || e.accountantVoucherUrl || null;

      await db.query(`
        INSERT INTO expenses (id, user_id, company_id, amount, currency, description, date, category, internal_voucher_url, accountant_voucher_url, invoice_number, ruc, subtotal, igv, is_private)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          amount = VALUES(amount),
          currency = VALUES(currency),
          description = VALUES(description),
          date = VALUES(date),
          category = VALUES(category),
          internal_voucher_url = COALESCE(VALUES(internal_voucher_url), internal_voucher_url),
          accountant_voucher_url = COALESCE(VALUES(accountant_voucher_url), accountant_voucher_url),
          invoice_number = VALUES(invoice_number),
          ruc = VALUES(ruc),
          subtotal = VALUES(subtotal),
          igv = VALUES(igv),
          is_private = VALUES(is_private)
      `, [
        id, e.userId, validCompanyId, parseFloat(e.amount) || 0, e.currency || 'PEN', e.description || '', e.date || new Date().toISOString().split('T')[0],
        e.category || 'Otros Egresos No SUNAT', internalUrl, accountantUrl,
        e.invoiceNumber || null, e.ruc || null, e.subtotal || null, e.igv || null, e.isPrivate ? 1 : 0
      ]);

      insertedIds.push(id);
    }

    res.json({ success: true, count: insertedIds.length, ids: insertedIds });
  } catch (e) {
    console.error('Error inserting batch expenses:', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const rows = await db.query('SELECT internal_voucher_url, accountant_voucher_url FROM expenses WHERE id = ?', [req.params.id]);
    if (rows[0]) {
      [rows[0].internal_voucher_url, rows[0].accountant_voucher_url].forEach(relPath => {
        if (relPath && relPath.startsWith('/uploads/')) {
          try {
            const diskPath = path.join(__dirname, relPath);
            if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
          } catch (e) {}
        }
      });
    }
    await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TAX DOCUMENTS ---
router.get('/tax-documents', async (req, res) => {
  try {
    const { userId, companyId, includeDeleted } = req.query;
    let sql = 'SELECT * FROM tax_documents WHERE 1=1';
    const params = [];
    if (!includeDeleted) {
      sql += " AND (sunat_status IS NULL OR sunat_status != 'BORRADO')";
    }
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (companyId) {
      const ids = String(companyId).split(',').filter(Boolean);
      if (ids.length) {
        sql += ` AND company_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => ({
      ...r, ...mapRow(r, TAXDOC_FIELDS),
      metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : null
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tax-documents', async (req, res) => {
  try {
    const d = req.body;
    if (!d || !d.companyId) return res.status(400).json({ error: 'companyId es requerido' });
    if (!d.id) return res.status(400).json({ error: 'id es requerido' });

    // Check maxTaxDocuments limit for user
    if (d.userId) {
      const docResult = await checkSubscriptionLimits(d.userId, 'maxTaxDocuments',
        'SELECT COUNT(*) AS total FROM tax_documents WHERE user_id = ?', [d.userId]);
      if (docResult && docResult.count >= docResult.limit) {
        return res.status(403).json({ error: 'Has alcanzado el límite de comprobantes de pago para tu plan. Actualiza tu plan para emitir más comprobantes.' });
      }
    }

    // Check maxTaxDocuments limit for accountant
    if (d.accountantId && d.accountantId !== d.userId) {
      const accountantDocResult = await checkSubscriptionLimits(d.accountantId, 'maxTaxDocuments',
        'SELECT COUNT(*) AS total FROM tax_documents WHERE accountant_id = ?', [d.accountantId]);
      if (accountantDocResult && accountantDocResult.count >= accountantDocResult.limit) {
        return res.status(403).json({ error: 'El contador ha alcanzado su límite de comprobantes de pago' });
      }
    }

    // maxTaxDocumentsPerAccountant: limit comprobantes generated by an accountant CREATED BY the client (empresario).
    // Only applies when the accountant's parent is the doc's user (accountant created by that client).
    if (d.accountantId && d.userId) {
      const acctParent = await db.query('SELECT parent_id FROM users WHERE id = ?', [d.accountantId]);
      const parentId = acctParent[0] && acctParent[0].parent_id;
      if (parentId && parentId === d.userId) {
        const ccResult = await checkSubscriptionLimits(parentId, 'maxTaxDocumentsPerAccountant',
          'SELECT COUNT(*) AS total FROM tax_documents WHERE accountant_id = ? AND user_id = ?',
          [d.accountantId, d.userId]);
        if (ccResult && ccResult.count >= ccResult.limit) {
          return res.status(403).json({ error: 'Este contador ha alcanzado el límite de comprobantes de pago para tu plan' });
        }
      }
    }

    // maxTaxDocumentsPerCreatedClient: cap comprobantes of a client CREATED BY an accountant, by the accountant's plan.
    if (d.userId) {
      const clientParent = await db.query('SELECT u.parent_id, p.role AS parent_role FROM users u LEFT JOIN users p ON u.parent_id = p.id WHERE u.id = ?', [d.userId]);
      if (clientParent[0] && clientParent[0].parent_id && clientParent[0].parent_role === 'ACCOUNTANT') {
        const ccResult = await checkSubscriptionLimits(clientParent[0].parent_id, 'maxTaxDocumentsPerCreatedClient',
          'SELECT COUNT(*) AS total FROM tax_documents WHERE user_id = ?', [d.userId]);
        if (ccResult && ccResult.count >= ccResult.limit) {
          return res.status(403).json({ error: 'Este cliente ha alcanzado el límite de comprobantes de pago (' + ccResult.limit + ') definido en tu plan de contador' });
        }
      }
    }

    const fs = require('fs');
    const path = require('path');

    let finalFileUrl = d.fileUrl || null;
    let finalPdfUrl = d.pdfUrl || null;
    let finalXmlUrl = d.xmlUrl || null;
    let finalCdrUrl = d.cdrUrl || null;

    const companySubDir = d.companyId || d.userId || 'general';
    const folderSubDir = d.folderPath || '';
    const uploadDirOnDisk = path.join(__dirname, 'uploads', companySubDir, folderSubDir);

    if (d.fileUrl || d.xmlContent || d.cdrBase64 || d.pdfUrl) {
      if (!fs.existsSync(uploadDirOnDisk)) {
        fs.mkdirSync(uploadDirOnDisk, { recursive: true });
      }
      const safeName = (d.name || `file_${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, '_');

      // 1. Save main file_url as physical file
      if (d.fileUrl && !d.fileUrl.startsWith('/uploads') && !d.fileUrl.startsWith('http://') && !d.fileUrl.startsWith('https://')) {
        try {
          let rawB64 = d.fileUrl.includes(';base64,') ? d.fileUrl.split(';base64,')[1] : d.fileUrl;
          const buf = Buffer.from(rawB64, 'base64');
          const diskPath = path.join(uploadDirOnDisk, safeName);
          fs.writeFileSync(diskPath, buf);
          finalFileUrl = `/uploads/${companySubDir}/${folderSubDir ? folderSubDir + '/' : ''}${safeName}`;
        } catch (e) {
          console.error('Error saving file to disk:', e);
        }
      }

      // 2. Save xml_content as physical XML file
      if (d.xmlContent && !finalXmlUrl) {
        try {
          const xmlName = `${safeName.replace(/\.[^/.]+$/, '')}.xml`;
          const xmlDiskPath = path.join(uploadDirOnDisk, xmlName);
          fs.writeFileSync(xmlDiskPath, d.xmlContent, 'utf8');
          finalXmlUrl = `/uploads/${companySubDir}/${folderSubDir ? folderSubDir + '/' : ''}${xmlName}`;
        } catch (e) {}
      }

      // 3. Save cdr_base64 as physical ZIP file
      if (d.cdrBase64 && !finalCdrUrl) {
        try {
          const cdrName = `R-${safeName.replace(/\.[^/.]+$/, '')}.zip`;
          const cdrDiskPath = path.join(uploadDirOnDisk, cdrName);
          fs.writeFileSync(cdrDiskPath, Buffer.from(d.cdrBase64, 'base64'));
          finalCdrUrl = `/uploads/${companySubDir}/${folderSubDir ? folderSubDir + '/' : ''}${cdrName}`;
        } catch (e) {}
      }
    }

    await db.query(`INSERT INTO tax_documents (id, user_id, company_id, accountant_id, name, file_url, folder_path, mime_type, upload_date, period_month, period_year, sunat_status, sunat_hash, uploaded_by, document_type, original_document_id, pdf_url, xml_url, cdr_url, xml_content, cdr_base64, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        company_id = VALUES(company_id),
        accountant_id = VALUES(accountant_id),
        name = VALUES(name),
        file_url = VALUES(file_url),
        folder_path = VALUES(folder_path),
        mime_type = VALUES(mime_type),
        upload_date = VALUES(upload_date),
        period_month = VALUES(period_month),
        period_year = VALUES(period_year),
        sunat_status = VALUES(sunat_status),
        sunat_hash = VALUES(sunat_hash),
        uploaded_by = VALUES(uploaded_by),
        document_type = VALUES(document_type),
        original_document_id = VALUES(original_document_id),
        pdf_url = VALUES(pdf_url),
        xml_url = VALUES(xml_url),
        cdr_url = VALUES(cdr_url),
        xml_content = VALUES(xml_content),
        cdr_base64 = VALUES(cdr_base64),
        metadata = VALUES(metadata)`, [
      d.id, d.userId, d.companyId || null, d.accountantId || null, d.name || null, finalFileUrl, d.folderPath || null, d.mimeType || null,
      d.uploadDate || null, d.periodMonth || null, d.periodYear || null, d.sunatStatus || null,
      d.sunatHash || null, d.uploadedBy || null, d.documentType || null, d.originalDocumentId || null,
      finalPdfUrl, finalXmlUrl, finalCdrUrl,
      d.xmlContent || null, d.cdrBase64 || null, d.metadata ? JSON.stringify(d.metadata) : null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tax-documents/:id', async (req, res) => {
  try {
    // Soft delete: updates sunat_status to 'BORRADO' so file stays on disk and row stays in DB
    await db.query("UPDATE tax_documents SET sunat_status = 'BORRADO' WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PACKAGES ---
router.get('/packages', async (req, res) => {
  try {
    const { type } = req.query;

    // Auto-ensure default free package for CLIENT
    const freeClient = await db.query("SELECT * FROM packages WHERE (is_free = 1 OR id = 'pkg-free-client') AND type = 'CLIENT'");
    if (freeClient.length === 0) {
      await db.query(`INSERT INTO packages (id, name, price, duration_months, features, type, is_free, limits) VALUES (?,?,?,?,?,?,?,?)`, [
        'pkg-free-client', 'Plan Gratis', 0, 12, JSON.stringify(['Funciones básicas', '1 Empresa', '10 Comprobantes al mes']), 'CLIENT', 1,
        JSON.stringify({ maxCompanies: { USER: 1, PERSONA_NATURAL: 1 }, maxTaxDocuments: { USER: 10, PERSONA_NATURAL: 10 } })
      ]).catch(() => {});
    }

    // Auto-ensure default free package for ACCOUNTANT
    const freeAcct = await db.query("SELECT * FROM packages WHERE (is_free = 1 OR id = 'pkg-free-accountant') AND type = 'ACCOUNTANT'");
    if (freeAcct.length === 0) {
      await db.query(`INSERT INTO packages (id, name, price, duration_months, features, type, is_free, limits) VALUES (?,?,?,?,?,?,?,?)`, [
        'pkg-free-accountant', 'Plan Gratis', 0, 12, JSON.stringify(['Gestión básica de contador', 'Hasta 2 empresas gestionadas']), 'ACCOUNTANT', 1,
        JSON.stringify({ maxManagedCompanies: { ACCOUNTANT: 2 }, maxTaxDocuments: { ACCOUNTANT: 20 } })
      ]).catch(() => {});
    }

    let query = 'SELECT * FROM packages';
    const params = [];
    if (type) { query += ' WHERE type = ?'; params.push(type); }
    query += ' ORDER BY is_free DESC, created_at ASC';
    const rows = await db.query(query, params);
    res.json(rows
      .filter(r => !r.deleted_at)
      .map(r => ({
        ...r, ...mapRow(r, PACKAGE_FIELDS),
        features: r.features ? (typeof r.features === 'string' ? JSON.parse(r.features) : r.features) : [],
        limits: r.limits ? (typeof r.limits === 'string' ? JSON.parse(r.limits) : r.limits) : null
      })).map(r => numFields(r, ['price', 'durationMonths'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/packages', async (req, res) => {
  try {
    const p = req.body;
    const isFreeVal = p.isFree || p.id?.includes('free') ? 1 : 0;
    await db.query(`INSERT INTO packages (id, name, price, duration_months, features, type, is_free, limits) VALUES (?,?,?,?,?,?,?,?)`, [
      p.id, p.name, p.price, p.durationMonths, p.features ? JSON.stringify(p.features) : '[]', p.type || 'CLIENT', isFreeVal, p.limits ? JSON.stringify(p.limits) : null
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const p = req.body;
    const isFreeVal = p.isFree || p.id?.includes('free') ? 1 : 0;
    await db.query(`UPDATE packages SET name=?, price=?, duration_months=?, features=?, type=?, is_free=?, limits=? WHERE id=?`, [
      p.name, p.price, p.durationMonths, p.features ? JSON.stringify(p.features) : '[]', p.type || 'CLIENT', isFreeVal, p.limits ? JSON.stringify(p.limits) : null, req.params.id
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/packages/:id', async (req, res) => {
  try {
    const [row] = await db.query('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    if (row && (row.is_free === 1 || row.id?.includes('free'))) {
      return res.status(400).json({ error: 'El Plan Gratis es un plan por defecto del sistema y no se puede eliminar.' });
    }
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
    const voucherUrl = saveBase64ToDisk(s.voucherImage, `subscriptions/${s.userId || 'general'}`, 'sub_voucher') || s.voucherImage || null;

    await db.query(`INSERT INTO subscription_history (id, user_id, package_name, amount, date, start_date, end_date, status, payment_details, voucher_image) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
      s.id, s.userId, s.packageName || null, s.amount || null, s.date || null,
      s.startDate || null, s.endDate || null, s.status || 'PAID', s.paymentDetails || null, voucherUrl
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
    const { companyId } = req.query;
    let sql = 'SELECT * FROM complaints WHERE 1=1';
    const params = [];
    if (companyId) { sql += ' AND company_id = ?'; params.push(companyId); }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => ({ ...r, ...mapRow(r, COMPLAINT_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/complaints', async (req, res) => {
  try {
    const c = req.body;
    await db.query(`INSERT INTO complaints (id, user_id, company_id, user_name, user_email, date, time, type, description, detail, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
      c.id, c.userId, c.companyId || null, c.userName || null, c.userEmail || null, c.date || null,
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
    const { userId, companyId } = req.query;
    let sql = 'SELECT * FROM user_products WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (companyId) { sql += ' AND company_id = ?'; params.push(companyId); }
    sql += ' ORDER BY last_used DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => numFields({ ...r, ...mapRow(r, USERPRODUCT_FIELDS) }, ['unitPrice'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/user-products', async (req, res) => {
  try {
    const p = req.body;
    await db.query(`INSERT INTO user_products (id, user_id, company_id, description, unit, unit_price, last_used) VALUES (?,?,?,?,?,?,?)`, [
      p.id, p.userId, p.companyId || null, p.description || null, p.unit || null, p.unitPrice || 0, p.lastUsed || null
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

// --- CORRELATIVOS ---
// GET (solo lectura): siguiente correlativo disponible para empresa+serie
router.get('/next-correlative', async (req, res) => {
  try {
    const { companyId, serie } = req.query;
    if (!companyId || !serie) return res.status(400).json({ success: false, error: 'companyId y serie son requeridos' });
    if (!validateSerie(serie)) return res.status(400).json({ success: false, error: 'Serie inválida: debe ser F001-F999, B001-B999 o E001-E999' });
    const rows = await db.query('SELECT last_used FROM correlativos WHERE company_id = ? AND serie = ?', [companyId, serie]);
    let last = rows[0]?.last_used;
    if (last == null) last = await computeBaselineCorrelative(companyId, serie);
    res.json({ success: true, next: last + 1, last });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST: asigna/reserva atómicamente el siguiente correlativo (consumido al emitir)
router.post('/next-correlative', async (req, res) => {
  try {
    const { companyId, serie, requested } = req.body;
    if (!companyId || !serie) return res.status(400).json({ success: false, error: 'companyId y serie son requeridos' });
    if (!validateSerie(serie)) return res.status(400).json({ success: false, error: 'Serie inválida: debe ser F001-F999, B001-B999 o E001-E999' });
    const next = await allocateNextCorrelative(companyId, serie, requested);
    res.json({ success: true, next, last: next - 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /correlativos: establece la base (último usado) manualmente (Configuración SUNAT)
router.post('/correlativos', async (req, res) => {
  try {
    const { companyId, serie, lastUsed } = req.body;
    if (!companyId || !serie || lastUsed == null) return res.status(400).json({ success: false, error: 'companyId, serie y lastUsed son requeridos' });
    if (!validateSerie(serie)) return res.status(400).json({ success: false, error: 'Serie inválida: debe ser F001-F999, B001-B999 o E001-E999' });
    const value = Math.max(0, parseInt(lastUsed, 10) || 0);
    await db.query(
      `INSERT INTO correlativos (company_id, serie, last_used) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_used = GREATEST(last_used, VALUES(last_used))`,
      [companyId, serie, value]
    );
    const after = await db.query('SELECT last_used FROM correlativos WHERE company_id = ? AND serie = ?', [companyId, serie]);
    const stored = after[0]?.last_used || value;
    res.json({ success: true, last: stored, next: stored + 1 });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// --- PENDING INVOICES ---
router.get('/pending-invoices', async (req, res) => {
  try {
    const { userId, companyId } = req.query;
    let sql = 'SELECT * FROM pending_invoices WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (companyId) {
      const ids = String(companyId).split(',').filter(Boolean);
      if (ids.length) {
        sql += ` AND company_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => numFields({
      ...r, ...mapRow(r, PENDINGINV_FIELDS),
      payload: r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : null
    }, ['amount', 'attemptCount'])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pending-invoices', async (req, res) => {
  try {
    const inv = req.body;
    if (!inv || !inv.id || !inv.userId || !inv.companyId) return res.status(400).json({ error: 'id, userId y companyId son requeridos' });
    if (!validateSerie(inv.serie)) return res.status(400).json({ error: 'Serie inválida: debe ser F001-F999 (factura) o B001-B999 (boleta)' });
    await db.query(`INSERT INTO pending_invoices (id, user_id, company_id, serie, correlative, document_type, original_document_id, payload, customer_doc_type, customer_doc_number, customer_name, amount, created_at, last_attempt, last_attempt_at, attempt_count, status, last_error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),?,?,?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        company_id = VALUES(company_id),
        serie = VALUES(serie),
        correlative = VALUES(correlative),
        document_type = VALUES(document_type),
        original_document_id = VALUES(original_document_id),
        payload = VALUES(payload),
        customer_doc_type = VALUES(customer_doc_type),
        customer_doc_number = VALUES(customer_doc_number),
        customer_name = VALUES(customer_name),
        amount = VALUES(amount),
        created_at = VALUES(created_at),
        last_attempt = VALUES(last_attempt),
        attempt_count = attempt_count + 1,
        status = VALUES(status),
        last_error = VALUES(last_error)`, [
      inv.id, inv.userId, inv.companyId || null, inv.serie || null, inv.correlative || null, inv.documentType || null,
      inv.originalDocumentId || null,
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
    if (data.lastAttemptAt !== undefined) { fields.push('last_attempt_at=?'); values.push(data.lastAttemptAt); }
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

// --- WORKER DE REINTENTOS (control interno protegido) ---
router.post('/internal/retry-run', async (req, res) => {
  const secret = process.env.RETRY_SECRET || '';
  if (!secret || req.get('x-retry-secret') !== secret) return res.status(403).json({ error: 'Forbidden' });
  try {
    const retryWorker = require('./retry-worker');
    const summary = await retryWorker.runCycle(true);
    res.json({ success: true, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/internal/retry-status', (req, res) => {
  const secret = process.env.RETRY_SECRET || '';
  if (!secret || req.get('x-retry-secret') !== secret) return res.status(403).json({ error: 'Forbidden' });
  try {
    const retryWorker = require('./retry-worker');
    res.json(retryWorker.getStatus());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUNAT GLOBAL CONFIG ---
router.get('/sunat-config', async (req, res) => {
  try {
    const [row] = await db.query('SELECT * FROM sunat_global_config WHERE id = 1');
    res.json(row ? { ...row, ...mapRow(row, SUNATCONFIG_FIELDS) } : { sunatToken: '', sunatApiUrl: '', supportPhone: '999888777' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/sunat-config', async (req, res) => {
  try {
    const { sunatToken, sunatApiUrl, supportPhone } = req.body;
    await db.query('INSERT INTO sunat_global_config (id, sunat_token, sunat_api_url, support_phone) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE sunat_token=COALESCE(VALUES(sunat_token), sunat_token), sunat_api_url=COALESCE(VALUES(sunat_api_url), sunat_api_url), support_phone=COALESCE(VALUES(support_phone), support_phone)', [sunatToken || null, sunatApiUrl || null, supportPhone || null]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PAYMENT ALERTS ---
router.get('/payment-alerts', async (req, res) => {
  try {
    const { userId, companyId } = req.query;
    let sql = 'SELECT * FROM payment_alerts WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    if (companyId) { sql += ' AND (company_id = ? OR company_id IS NULL)'; params.push(companyId); }
    sql += ' ORDER BY due_date ASC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => ({ ...r, ...mapRow(r, PAYMENT_ALERT_FIELDS) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payment-alerts', async (req, res) => {
  try {
    const a = req.body;
    const id = a.id || Date.now().toString();
    await db.query(
      `INSERT INTO payment_alerts (id, user_id, company_id, title, category, amount, currency, due_date, frequency, reminder_days_before, status, notes, last_paid_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, a.userId, a.companyId || null, a.title, a.category || 'OTRO', a.amount || 0, a.currency || 'PEN', a.dueDate, a.frequency || 'MENSUAL', a.reminderDaysBefore || 3, a.status || 'PENDIENTE', a.notes || null, a.lastPaidDate || null]
    );
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/payment-alerts/:id', async (req, res) => {
  try {
    const a = req.body;
    const fields = [];
    const values = [];
    if (a.title !== undefined) { fields.push('title=?'); values.push(a.title); }
    if (a.category !== undefined) { fields.push('category=?'); values.push(a.category); }
    if (a.amount !== undefined) { fields.push('amount=?'); values.push(a.amount); }
    if (a.currency !== undefined) { fields.push('currency=?'); values.push(a.currency); }
    if (a.dueDate !== undefined) { fields.push('due_date=?'); values.push(a.dueDate); }
    if (a.frequency !== undefined) { fields.push('frequency=?'); values.push(a.frequency); }
    if (a.reminderDaysBefore !== undefined) { fields.push('reminder_days_before=?'); values.push(a.reminderDaysBefore); }
    if (a.status !== undefined) { fields.push('status=?'); values.push(a.status); }
    if (a.notes !== undefined) { fields.push('notes=?'); values.push(a.notes); }
    if (a.lastPaidDate !== undefined) { fields.push('last_paid_date=?'); values.push(a.lastPaidDate); }
    if (fields.length) {
      values.push(req.params.id);
      await db.query(`UPDATE payment_alerts SET ${fields.join(',')} WHERE id=?`, values);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payment-alerts/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM payment_alerts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PERSONAL EXPENSES ---
router.get('/personal-expenses', async (req, res) => {
  try {
    const { userId } = req.query;
    let sql = 'SELECT * FROM personal_expenses WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id = ?'; params.push(userId); }
    sql += ' ORDER BY date DESC, created_at DESC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => {
      const mapped = numFields({ ...r, ...mapRow(r, PERSONAL_EXPENSE_FIELDS) }, ['amount']);
      return mapped;
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/personal-expenses', async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || Date.now().toString();
    await db.query(
      `INSERT INTO personal_expenses (id, user_id, concept, description, amount, currency, date, voucher_url, merchant_name, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, p.userId, p.concept || 'OTROS_PERSONALES', p.description || '', p.amount || 0, p.currency || 'PEN', p.date, p.voucherUrl || null, p.merchantName || null, p.notes || null]
    );
    res.json({ success: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/personal-expenses/:id', async (req, res) => {
  try {
    const p = req.body;
    const fields = [];
    const values = [];
    if (p.concept !== undefined) { fields.push('concept=?'); values.push(p.concept); }
    if (p.description !== undefined) { fields.push('description=?'); values.push(p.description); }
    if (p.amount !== undefined) { fields.push('amount=?'); values.push(p.amount); }
    if (p.currency !== undefined) { fields.push('currency=?'); values.push(p.currency); }
    if (p.date !== undefined) { fields.push('date=?'); values.push(p.date); }
    if (p.voucherUrl !== undefined) { fields.push('voucher_url=?'); values.push(p.voucherUrl); }
    if (p.merchantName !== undefined) { fields.push('merchant_name=?'); values.push(p.merchantName); }
    if (p.notes !== undefined) { fields.push('notes=?'); values.push(p.notes); }
    if (fields.length) {
      values.push(req.params.id);
      await db.query(`UPDATE personal_expenses SET ${fields.join(',')} WHERE id=?`, values);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/personal-expenses/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM personal_expenses WHERE id = ?', [req.params.id]);
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

// Database connection status & validator endpoint
router.get('/db-status', async (req, res) => {
  const startTime = Date.now();
  try {
    await db.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    res.json({
      status: 'connected',
      database: process.env.DB_DATABASE || 'finanzafacil',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || '3306',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      message: e.message,
      database: process.env.DB_DATABASE || 'finanzafacil',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || '3306',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper: convert specified fields from string to Number
const numFields = (obj, fields) => {
  for (const f of fields) {
    if (obj[f] != null) obj[f] = Number(obj[f]);
  }
  return obj;
};

// ─── SIRE (Sistema Integrado de Registros Electrónicos) ───

router.get('/sire/registros', async (req, res) => {
  try {
    const { companyId, periodo } = req.query;
    let sql = 'SELECT * FROM sire_registros WHERE 1=1';
    const params = [];
    if (companyId) { sql += ' AND company_id = ?'; params.push(companyId); }
    if (periodo) { sql += ' AND periodo = ?'; params.push(periodo); }
    sql += ' ORDER BY periodo DESC, tipo ASC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => mapRow(r, SIRE_REGISTRO_FIELDS)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sire/comprobantes', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.query;
    let sql = 'SELECT * FROM sire_comprobantes WHERE company_id = ? AND periodo = ?';
    const params = [companyId, periodo];
    if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
    sql += ' ORDER BY fecha_emision DESC, serie ASC, numero ASC';
    const rows = await db.query(sql, params);
    res.json(rows.map(r => mapRow(r, SIRE_COMPROBANTE_FIELDS)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sire/generar', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.body;
    if (!companyId || !periodo || !tipo) return res.status(400).json({ error: 'companyId, periodo y tipo requeridos' });

    const registroId = `SIRE-${tipo}-${periodo}-${companyId}-${Date.now()}`;
    const fechaHoy = new Date().toISOString().split('T')[0];

    const [year, month] = periodo.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    let docsSql, docsParams, docFields;
    if (tipo === 'RVIE') {
      docsSql = `SELECT * FROM tax_documents WHERE company_id = ? AND upload_date >= ? AND upload_date <= ? AND document_type IN ('factura','boleta','nota_credito','nota_debito','liquidacion_compra') ORDER BY upload_date`;
      docsParams = [companyId, startDate, endDate];
      docFields = TAXDOC_FIELDS;
    } else {
      docsSql = `SELECT * FROM expenses WHERE company_id = ? AND date >= ? AND date <= ? AND is_private = 0 ORDER BY date`;
      docsParams = [companyId, startDate, endDate];
      docFields = EXPENSE_FIELDS;
    }

    const docs = await db.query(docsSql, docsParams);

    let totalBase = 0, totalIgv = 0, totalMonto = 0;
    const comprobantes = [];

    for (const doc of docs) {
      const mapped = mapRow(doc, docFields);
      let base = 0, igvVal = 0, tot = 0, serieVal = '', numVal = '', tipoComp = '', rucEmisor = '', razonSocial = '', fechaEm = '';

      if (tipo === 'RVIE') {
        const meta = typeof mapped.metadata === 'string' ? JSON.parse(mapped.metadata || '{}') : (mapped.metadata || {});
        tot = meta.amount || meta.netAmount || 0;
        igvVal = meta.retention || 0;
        base = tot - igvVal;
        const parts = (mapped.id || '').split('-');
        serieVal = parts[0] || '';
        numVal = parts.slice(1).join('-') || '';
        tipoComp = mapped.documentType || 'factura';
        const company = await db.query('SELECT ruc, business_name FROM companies WHERE id = ?', [companyId]);
        rucEmisor = company[0]?.ruc || '';
        razonSocial = company[0]?.business_name || '';
        fechaEm = mapped.uploadDate || fechaHoy;
      } else {
        tot = Number(mapped.amount) || 0;
        igvVal = Number(mapped.igv) || 0;
        base = Number(mapped.subtotal) || (tot - igvVal);
        serieVal = '';
        numVal = mapped.invoiceNumber || '';
        tipoComp = 'compra';
        rucEmisor = mapped.ruc || '';
        razonSocial = mapped.description || '';
        fechaEm = mapped.date || fechaHoy;
      }

      totalBase += base;
      totalIgv += igvVal;
      totalMonto += tot;

      const compId = `SC-${registroId}-${comprobantes.length + 1}`;
      comprobantes.push({
        id: compId,
        registroId,
        companyId,
        periodo,
        tipo,
        tipoComprobante: tipoComp,
        serie: serieVal,
        numero: numVal,
        fechaEmision: fechaEm,
        rucEmisor,
        razonSocialEmisor: razonSocial,
        baseImponible: base,
        igv: igvVal,
        total: tot,
        moneda: 'PEN',
        estadoCruce: 'COINCIDE',
        origen: 'LOCAL',
        taxDocumentId: tipo === 'RVIE' ? mapped.id : null,
      });
    }

    // Clean up any existing records for this company, period & type first
    const existing = await db.query('SELECT id FROM sire_registros WHERE company_id = ? AND periodo = ? AND tipo = ?', [companyId, periodo, tipo]);
    for (const ex of existing) {
      await db.query('DELETE FROM sire_comprobantes WHERE registro_id = ?', [ex.id]);
    }
    await db.query('DELETE FROM sire_registros WHERE company_id = ? AND periodo = ? AND tipo = ?', [companyId, periodo, tipo]);

    await db.query(
      `INSERT INTO sire_registros (id, company_id, periodo, tipo, estado, total_registros, base_imponible, igv, total, fecha_generacion) VALUES (?, ?, ?, ?, 'GENERADO', ?, ?, ?, ?, ?)`,
      [registroId, companyId, periodo, tipo, comprobantes.length, totalBase.toFixed(2), totalIgv.toFixed(2), totalMonto.toFixed(2), fechaHoy]
    );

    for (const c of comprobantes) {
      await db.query(
        `INSERT INTO sire_comprobantes (id, registro_id, company_id, periodo, tipo, tipo_comprobante, serie, numero, fecha_emision, ruc_emisor, razon_social_emisor, base_imponible, igv, total, moneda, estado_cruce, origen, tax_document_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.registroId, c.companyId, c.periodo, c.tipo, c.tipoComprobante, c.serie, c.numero, c.fechaEmision, c.rucEmisor, c.razonSocialEmisor, c.baseImponible.toFixed(2), c.igv.toFixed(2), c.total.toFixed(2), c.moneda, c.estadoCruce, c.origen, c.taxDocumentId]
      );
    }

    res.json({
      success: true,
      registro: mapRow({ id: registroId, company_id: companyId, periodo, tipo, estado: 'GENERADO', total_registros: comprobantes.length, base_imponible: totalBase, igv: totalIgv, total: totalMonto, fecha_generacion: fechaHoy }, SIRE_REGISTRO_FIELDS),
      comprobantes: comprobantes.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sire/aceptar', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.body;
    const fechaHoy = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `UPDATE sire_registros SET estado = 'ACEPTADO', fecha_aceptacion = ? WHERE company_id = ? AND periodo = ? AND tipo = ?`,
      [fechaHoy, companyId, periodo, tipo]
    );
    res.json({ success: true, updated: result.affectedRows || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sire/exportar-txt', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.query;
    const rows = await db.query(
      'SELECT * FROM sire_comprobantes WHERE company_id = ? AND periodo = ? AND tipo = ? ORDER BY fecha_emision',
      [companyId, periodo, tipo]
    );

    const company = await db.query('SELECT ruc, business_name FROM companies WHERE id = ?', [companyId]);
    const ruc = company[0]?.ruc || '00000000000';

    const header = tipo === 'RVIE'
      ? 'PERIODO|CUO|CORRELATIVO|FECHA_EMISION|FECHA_VTO|TIPO_CDP|SERIE|NUMERO|TIPO_DOC_CLIENTE|NRO_DOC_CLIENTE|RAZON_SOCIAL|BASE_IMPONIBLE|IGV|TOTAL|MONEDA|TIPO_CAMBIO|ESTADO'
      : 'PERIODO|CUO|CORRELATIVO|FECHA_EMISION|FECHA_VTO|TIPO_CDP|SERIE|NUMERO|TIPO_DOC_PROVEEDOR|NRO_DOC_PROVEEDOR|RAZON_SOCIAL|BASE_IMPONIBLE|IGV|TOTAL|MONEDA|TIPO_CAMBIO|ESTADO';

    let lines = [header];
    rows.forEach((row, idx) => {
      const r = mapRow(row, SIRE_COMPROBANTE_FIELDS);
      const tipoMap = { factura: '01', boleta: '03', nota_credito: '07', nota_debito: '08', liquidacion_compra: '04', compra: '01' };
      const tipoCdp = tipoMap[r.tipoComprobante] || '01';
      lines.push(
        `${r.periodo}|M${String(idx + 1).padStart(4, '0')}|${idx + 1}|${r.fechaEmision}||${tipoCdp}|${r.serie}|${r.numero}|6|${r.rucEmisor}|${r.razonSocialEmisor}|${Number(r.baseImponible).toFixed(2)}|${Number(r.igv).toFixed(2)}|${Number(r.total).toFixed(2)}|${r.moneda || 'PEN'}|1.000|1`
      );
    });

    const content = lines.join('\n');
    const filename = `LE${ruc}${periodo.replace('-', '')}00${tipo === 'RVIE' ? '140100' : '080100'}00111.txt`;

    res.json({ success: true, filename, content, totalRegistros: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ENDPOINTS CONEXIÓN DIRECTA API OAUTH2 SUNAT SIRE ───

router.post('/sire/sunat/conectar', async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId es requerido' });

    const companyRows = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!companyRows.length) return res.status(404).json({ error: 'Empresa no encontrada' });

    const company = mapRow(companyRows[0], COMPANY_FIELDS);
    const tokenObj = await sireApiService.getSireOAuth2Token(company);

    res.json({
      success: true,
      isDemoMode: !!tokenObj.isDemoMode,
      message: tokenObj.isDemoMode
        ? 'Modo Demo Activo (Ingresa un Client ID y Client Secret en "Credenciales API" para conectar a producción SUNAT).'
        : '✓ Conexión OAuth2 Producción SUNAT SIRE verificada exitosamente.',
      tokenType: tokenObj.tokenType,
      expiresIn: tokenObj.expiresIn,
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/sire/sunat/propuesta', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.body;
    if (!companyId || !periodo || !tipo) return res.status(400).json({ error: 'companyId, periodo y tipo requeridos' });

    const companyRows = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!companyRows.length) return res.status(404).json({ error: 'Empresa no encontrada' });
    const company = mapRow(companyRows[0], COMPANY_FIELDS);

    const sunatRes = await sireApiService.fetchPropuestaSunat(company, periodo, tipo);
    const rawItems = Array.isArray(sunatRes.data) ? sunatRes.data : (sunatRes.data?.items || []);

    const registroId = `SIRE-${tipo}-${periodo}-${companyId}-${Date.now()}`;
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Limpiamos registros anteriores
    const existing = await db.query('SELECT id FROM sire_registros WHERE company_id = ? AND periodo = ? AND tipo = ?', [companyId, periodo, tipo]);
    for (const ex of existing) {
      await db.query('DELETE FROM sire_comprobantes WHERE registro_id = ?', [ex.id]);
    }
    await db.query('DELETE FROM sire_registros WHERE company_id = ? AND periodo = ? AND tipo = ?', [companyId, periodo, tipo]);

    let totalBase = 0, totalIgv = 0, totalMonto = 0;
    const comprobantes = [];

    // Mapeamos los items devueltos por SUNAT
    rawItems.forEach((item, idx) => {
      const base = Number(item.mtoValBib || item.baseImponible || item.mtoBase || 0);
      const igvVal = Number(item.mtoIgv || item.igv || 0);
      const tot = Number(item.mtoTotal || item.total || (base + igvVal));

      totalBase += base;
      totalIgv += igvVal;
      totalMonto += tot;

      comprobantes.push({
        id: `SC-${registroId}-${idx + 1}`,
        registroId,
        companyId,
        periodo,
        tipo,
        tipoComprobante: item.codCar || item.tipoDoc || '01',
        serie: item.numSerie || item.serie || '',
        numero: item.numDoc || item.numero || '',
        fechaEmision: item.fecEmision || item.fechaEmision || fechaHoy,
        rucEmisor: item.numDocIdentidad || item.numRuc || item.ruc || '',
        razonSocialEmisor: item.nomRazonSocial || item.razonSocial || 'PROVEEDOR SUNAT',
        baseImponible: base,
        igv: igvVal,
        total: tot,
        moneda: item.codMoneda || 'PEN',
        estadoCruce: 'COINCIDE',
        origen: 'SUNAT',
      });
    });

    await db.query(
      `INSERT INTO sire_registros (id, company_id, periodo, tipo, estado, total_registros, base_imponible, igv, total, fecha_generacion, observaciones) VALUES (?, ?, ?, ?, 'PROPUESTA', ?, ?, ?, ?, ?, 'PROPUESTA OFICIAL SUNAT OAUTH2')`,
      [registroId, companyId, periodo, tipo, comprobantes.length, totalBase.toFixed(2), totalIgv.toFixed(2), totalMonto.toFixed(2), fechaHoy]
    );

    for (const c of comprobantes) {
      await db.query(
        `INSERT INTO sire_comprobantes (id, registro_id, company_id, periodo, tipo, tipo_comprobante, serie, numero, fecha_emision, ruc_emisor, razon_social_emisor, base_imponible, igv, total, moneda, estado_cruce, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.registroId, c.companyId, c.periodo, c.tipo, c.tipoComprobante, c.serie, c.numero, c.fechaEmision, c.rucEmisor, c.razonSocialEmisor, c.baseImponible.toFixed(2), c.igv.toFixed(2), c.total.toFixed(2), c.moneda, c.estadoCruce, c.origen]
      );
    }

    res.json({
      success: true,
      isDemoMode: !!sunatRes.isDemoMode,
      totalRegistros: comprobantes.length,
      baseImponible: totalBase,
      igv: totalIgv,
      total: totalMonto,
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/sire/sunat/aceptar', async (req, res) => {
  try {
    const { companyId, periodo, tipo } = req.body;
    if (!companyId || !periodo || !tipo) return res.status(400).json({ error: 'companyId, periodo y tipo requeridos' });

    const companyRows = await db.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!companyRows.length) return res.status(404).json({ error: 'Empresa no encontrada' });
    const company = mapRow(companyRows[0], COMPANY_FIELDS);

    const sunatRes = await sireApiService.aceptarPropuestaSunat(company, periodo, tipo);
    const fechaHoy = new Date().toISOString().split('T')[0];

    await db.query(
      `UPDATE sire_registros SET estado = 'ACEPTADO', fecha_aceptacion = ?, observaciones = ? WHERE company_id = ? AND periodo = ? AND tipo = ?`,
      [`Ticket SUNAT: ${sunatRes.ticket}`, fechaHoy, companyId, periodo, tipo]
    );

    res.json({
      success: true,
      ticket: sunatRes.ticket,
      message: sunatRes.message,
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
