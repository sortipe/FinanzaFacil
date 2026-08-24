/**
 * retry-worker.js
 * Motor de reintentos de comprobantes pendientes hacia SUNAT, 100% servidor.
 *
 * - Tick liviano cada RETRY_TICK_SEC (default 60s).
 * - Fast-lane: documentos recién fallados (attempt_count = 0) se reintentan a los
 *   RETRY_FIRST_RETRY_MIN minutos (default 5).
 * - Ciclo horario: a partir del intento #2 se reintenta cada RETRY_HOURLY_MIN minutos
 *   (default 60) hasta lograrlo o hasta que el documento supere RETRY_MAX_AGE_DAYS días.
 * - Sin pendientes vencidos no hace nada (solo el SELECT del tick).
 * - Al lograr emisión: crea tax_documents, borra el pendiente y notifica al dueño
 *   y al contador asignado.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const db = require('./db');
const fs = require('fs');
const path = require('path');
const { emitInvoiceDocument, emitNoteDocument } = require('./emitters');

// ─── Configuración ───
const isEnabled = () => process.env.RETRY_ENABLED !== 'false';
const fastLaneEnabled = () => process.env.RETRY_FAST_LANE !== 'false';
const TICK_MS = parseInt(process.env.RETRY_TICK_SEC || '60', 10) * 1000;
const FIRST_RETRY_MIN = parseInt(process.env.RETRY_FIRST_RETRY_MIN || '5', 10);
const HOURLY_MIN = parseInt(process.env.RETRY_HOURLY_MIN || '60', 10);
const MAX_AGE_DAYS = parseInt(process.env.RETRY_MAX_AGE_DAYS || '5', 10);
const STAGGER_MS = parseInt(process.env.RETRY_STAGGER_MS || '4000', 10);
const BATCH_LIMIT = parseInt(process.env.RETRY_BATCH || '20', 10);

const DOC_LABELS = {
    factura: 'Factura',
    boleta: 'Boleta',
    nota_credito: 'N. Crédito',
    nota_debito: 'N. Débito',
    liquidacion_compra: 'Liquidación de Compra',
    guia_remision: 'Guía de Remisión',
    guia_transportista: 'Guía Transportista'
};

// ─── Estado para observabilidad (/api/internal/retry-status) ───
const state = {
    startedAt: null,
    lastRunAt: null,
    lastResult: null,
    totalOk: 0,
    totalFailed: 0,
    running: false,
    intervalMs: TICK_MS
};

const getStatus = () => ({
    enabled: isEnabled(),
    fastLane: fastLaneEnabled(),
    fastLaneMin: FIRST_RETRY_MIN,
    hourlyMin: HOURLY_MIN,
    maxAgeDays: MAX_AGE_DAYS,
    ...state,
    lastRunAt: state.lastRunAt ? new Date(state.lastRunAt).toISOString() : null,
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pad8 = (n) => String(n == null ? 1 : n).padStart(8, '0');
const todayStr = () => new Date().toISOString().split('T')[0];
const randomHash = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/**
 * Pendientes vencidos según su regla de reintento:
 *  - attempt_count = 0 → vencido si nunca se reintentó o pasaron FIRST_RETRY_MIN desde el último
 *  - attempt_count > 0 → vencido si pasaron HOURLY_MIN desde el último
 */
async function fetchDuePending() {
    const fastCond = `(attempt_count = 0 AND (last_attempt_at IS NULL OR last_attempt_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${FIRST_RETRY_MIN} MINUTE)))`;
    const hourlyCond = `(attempt_count > 0 AND (last_attempt_at IS NULL OR last_attempt_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${HOURLY_MIN} MINUTE)))`;
    const ageCond = `STR_TO_DATE(SUBSTRING(created_at, 1, 10), '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL ${MAX_AGE_DAYS} DAY)`;
    const sql = `
        SELECT * FROM pending_invoices
        WHERE status IN ('PENDIENTE', 'RECHAZADO')
          AND (${fastLaneEnabled() ? `${fastCond} OR ${hourlyCond}` : hourlyCond})
          AND ${ageCond}
        ORDER BY created_at ASC
        LIMIT ${BATCH_LIMIT}`;
    return db.query(sql);
}

/** Credenciales SOL desde la tabla companies (fallback si el payload no las trae) */
async function credentialsFromCompany(companyId) {
    if (!companyId) return null;
    try {
        const rows = await db.query(
            'SELECT ruc, sol_user, sol_pass, cert_base64, cert_pass, sunat_env, assigned_accountant_id FROM companies WHERE id = ?',
            [companyId]
        );
        const c = rows && rows[0];
        if (!c) return null;
        return {
            ruc: c.ruc,
            user: c.sol_user,
            pass: c.sol_pass,
            certBase64: c.cert_base64 || undefined,
            certPass: c.cert_pass || undefined,
            env: c.sunat_env || 'PRODUCTION',
            accountantId: c.assigned_accountant_id || null
        };
    } catch { return null; }
}

function resolveCredentials(inv, companyCreds) {
    const pc = inv.payload?.credentials;
    if (pc && pc.user && pc.pass) {
        // Preferir credenciales congeladas en el payload, completando huecos con la empresa
        return {
            ...companyCreds,
            ...pc,
            certBase64: pc.certBase64 || companyCreds?.certBase64,
            certPass: pc.certPass || companyCreds?.certPass
        };
    }
    return companyCreds || pc || null;
}

/** Guarda XML y CDR como archivos físicos bajo uploads/<companyId>/ (paridad con POST /tax-documents) */
function persistFiles(companyId, baseName, xmlContent, cdrBase64) {
    let xmlUrl = '';
    let cdrUrl = '';
    try {
        const safe = (baseName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const dir = path.join(__dirname, 'uploads', companyId || 'general');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (xmlContent) {
            const xmlName = `${safe}.xml`;
            fs.writeFileSync(path.join(dir, xmlName), xmlContent, 'utf8');
            xmlUrl = `/uploads/${companyId || 'general'}/${xmlName}`;
        }
        if (cdrBase64) {
            const cdrName = `R-${safe}.zip`;
            fs.writeFileSync(path.join(dir, cdrName), Buffer.from(cdrBase64, 'base64'));
            cdrUrl = `/uploads/${companyId || 'general'}/${cdrName}`;
        }
    } catch (e) {
        console.error(`[retry-worker] Error guardando archivos de ${baseName}:`, e.message);
    }
    return { xmlUrl, cdrUrl };
}

async function notify(userId, message) {
    if (!userId) return;
    try {
        await db.query(
            'INSERT INTO notifications (id, user_id, message, date, is_read, type) VALUES (?,?,?,?,0,?) ON DUPLICATE KEY UPDATE message = VALUES(message)',
            [`auto-retry-${Date.now()}-${Math.floor(Math.random() * 10000)}`, userId, message, todayStr(), 'AUTO_RETRY']
        );
    } catch (e) {
        console.error('[retry-worker] Error insertando notificación:', e.message);
    }
}

async function handleSuccess(inv, resultBody, companyCreds) {
    const docType = inv.document_type || inv.documentType;
    const label = DOC_LABELS[docType] || 'Comprobante';
    const docId = `${inv.serie}-${pad8(inv.correlative)}`;
    const docName = ['factura', 'boleta'].includes(docType)
        ? docId
        : `${label} ${docId}${inv.customer_name ? ` - ${inv.customer_name}` : ''}`;

    const resolvedDocType = ['nota_credito', 'nota_debito', 'liquidacion_compra', 'guia_remision', 'guia_transportista'].includes(docType)
        ? docType
        : (docType === 'boleta' ? 'boleta' : 'factura');

    const issueDate = String(inv.created_at || '').substring(0, 10) || todayStr();
    const { xmlUrl, cdrUrl } = persistFiles(inv.company_id, docId, resultBody.xmlContent, resultBody.cdrBase64);

    await db.query(
        `INSERT INTO tax_documents (id, user_id, company_id, accountant_id, name, file_url, mime_type, upload_date, period_month, period_year, sunat_status, sunat_hash, uploaded_by, document_type, original_document_id, pdf_url, xml_url, cdr_url, xml_content, cdr_base64, metadata)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
            sunat_status = VALUES(sunat_status),
            xml_url = VALUES(xml_url),
            cdr_url = VALUES(cdr_url),
            xml_content = VALUES(xml_content),
            cdr_base64 = VALUES(cdr_base64),
            metadata = VALUES(metadata)`,
        [
            inv.id, inv.user_id, inv.company_id || null,
            (companyCreds && companyCreds.accountantId) || null,
            docName, '', 'application/xml',
            issueDate,
            new Date(issueDate).toLocaleString('es-ES', { month: 'long' }),
            new Date(issueDate).getFullYear(),
            'SENT', randomHash(), 'SERVER_RETRY', resolvedDocType, inv.original_document_id || null,
            '', xmlUrl, cdrUrl,
            resultBody.xmlContent || null, resultBody.cdrBase64 || null,
            JSON.stringify({
                recipientName: inv.customer_name || '',
                recipientRuc: inv.customer_doc_number || '',
                recipientPhone: inv.customer_doc_number || '',
                description: `${label} emitida automáticamente por el servidor`,
                amount: Number(inv.amount) || 0,
                netAmount: Number(inv.amount) || 0,
                date: issueDate
            })
        ]
    );

    await db.query('DELETE FROM pending_invoices WHERE id = ?', [inv.id]);

    // Notificar al dueño y al contador asignado
    const msg = `${label} ${docId} fue emitida automáticamente a SUNAT y aceptada.`;
    await notify(inv.user_id, msg);
    if (companyCreds && companyCreds.accountantId && companyCreds.accountantId !== inv.user_id) {
        await notify(companyCreds.accountantId, msg);
    }

    console.log(`[retry-worker] ✔ ${docId} (${label}) emitido automáticamente.`);
}

async function handleFailure(inv, errorMsg) {
    await db.query(
        `UPDATE pending_invoices
         SET attempt_count = attempt_count + 1,
             last_attempt = ?,
             last_attempt_at = UTC_TIMESTAMP(),
             status = 'PENDIENTE',
             last_error = ?
         WHERE id = ?`,
        [todayStr(), String(errorMsg || 'Error desconocido').substring(0, 900), inv.id]
    );
    console.log(`[retry-worker] ✖ ${inv.id} falló: ${String(errorMsg || '').substring(0, 160)}`);
}

/** Procesa un único pendiente */
async function retryOne(inv) {
    const companyCreds = await credentialsFromCompany(inv.company_id);
    const creds = resolveCredentials(inv, companyCreds);

    const docType = inv.document_type || inv.documentType;
    const isNote = docType === 'nota_credito' || docType === 'nota_debito';

    let res;
    try {
        res = isNote
            ? await emitNoteDocument(docType, inv.payload, creds)
            : await emitInvoiceDocument(inv.payload?.invoiceData, creds);
    } catch (e) {
        await handleFailure(inv, e.message || 'Excepción en emisión');
        return false;
    }

    if (res.body && res.body.success) {
        await handleSuccess(inv, res.body, companyCreds || {});
        return true;
    }
    await handleFailure(inv, (res.body && res.body.error) || 'Error SUNAT');
    return false;
}

/** Ejecuta un ciclo completo de reintentos. force=true ignora el lock anti-solapamiento parcial. */
async function runCycle(force = false) {
    if (!isEnabled()) return { skipped: true, reason: 'RETRY_ENABLED=false' };
    if (state.running && !force) return { skipped: true, reason: 'ciclo anterior aún en curso' };

    state.running = true;
    const summary = { processed: 0, ok: 0, failed: 0 };
    try {
        const due = await fetchDuePending();
        if (!due || due.length === 0) {
            state.lastRunAt = Date.now();
            state.lastResult = summary;
            return { ...summary, note: 'sin pendientes vencidos' };
        }
        console.log(`[retry-worker] Ciclo iniciado: ${due.length} pendiente(s) vencido(s).`);
        for (const inv of due) {
            try {
                const ok = await retryOne(inv);
                summary.processed++;
                if (ok) { summary.ok++; state.totalOk++; } else { summary.failed++; state.totalFailed++; }
            } catch (e) {
                summary.processed++;
                summary.failed++;
                console.error('[retry-worker] Error procesando', inv.id, e.message);
            }
            if (STAGGER_MS > 0) await sleep(STAGGER_MS);
        }
        state.lastRunAt = Date.now();
        state.lastResult = summary;
        console.log(`[retry-worker] Ciclo terminado: ${summary.ok} OK, ${summary.failed} fallidos.`);
        return summary;
    } catch (e) {
        console.error('[retry-worker] Error en ciclo:', e.message);
        state.lastRunAt = Date.now();
        state.lastResult = { ...summary, error: e.message };
        return { ...summary, error: e.message };
    } finally {
        state.running = false;
    }
}

let started = false;

/** Registra el intervalo permanente. Llamar una sola vez desde index.js */
function startRetryWorker() {
    if (started) return;
    started = true;
    state.startedAt = Date.now();

    if (!isEnabled()) {
        console.log('[retry-worker] Deshabilitado por configuración (RETRY_ENABLED=false).');
        return;
    }

    console.log(`[retry-worker] Iniciado. Tick cada ${TICK_MS / 1000}s | Fast-lane ${FIRST_RETRY_MIN}min | Ciclo ${HOURLY_MIN}min | Edad máx ${MAX_AGE_DAYS}d`);

    // Primer ciclo tras 30s (da tiempo a initSchema/seed)
    setTimeout(() => { runCycle().catch(() => {}); }, 30000);

    setInterval(() => { runCycle().catch(() => {}); }, TICK_MS);
}

module.exports = { startRetryWorker, runCycle, getStatus };
