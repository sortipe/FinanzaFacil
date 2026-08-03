import { chromium } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs/promises";
import path from "node:path";

const LOGIN_URL =
  "https://api-seguridad.sunat.gob.pe/v1/clientessol/085b176d-2437-44cd-8c3e-e9a83b705921/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenucabina/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAAEZXhlY3B0AAZwYXJhbXN0AFEqJiomL2NsLXRpLWl0bWVudWNhYmluYS9NZW51SW50ZXJuZXQuaHRtJjBlMWY4NDg5ZmVlYWJmOTMxNmI5ODUwNTYyMjA5MTE4ZjkxZTJjMmN0AANleGVweA==.";

const selectors = {
  login: {
    ruc: "#txtRuc",
    user: "#txtUsuario",
    pass: "#txtContrasena",
    submit: "#btnAceptar",
    searchBoxFallback: "input[placeholder*='Busque']",
  },
  inicio: {
    docType: "[id='inicio.tipoDocumento']",
    docNumber: "[id='inicio.numeroDocumento']",
    nameOrRazon: "[id='inicio.razonSocial']",
    tipoRenta: "[id='inicio.tipoRenta']",
    concepto: "[id='inicio.concepto']",
    moneda: "[id='inicio.tipoMoneda']",
    montoNeto: "[id='inicio.montoNeto']",
    retencionSi: "[id='inicio.subTipoRetencion01']",
    retencionNo: "[id='inicio.subTipoRetencion00']",
    continuar: "role=button[name='Continuar']",
  },
  preliminar: {
    emitir: "[id='hon-preliminar.botonGrabarDocumento']",
  },
};

const config = {
  headless: process.env.SUNAT_HEADLESS === "true",
  slowMo: Number(process.env.SUNAT_SLOWMO ?? 80),
  stopBeforeEmit: process.env.SUNAT_STOP_BEFORE_EMIT !== "false",
  rh: {
    docType: process.env.SUNAT_DOC_TYPE ?? "DNI",
    docNumber: process.env.SUNAT_DOC_NUMBER ?? "",
    nameOrRazon: process.env.SUNAT_NOMBRE_RECEPTOR ?? "",
    tipoRenta: process.env.SUNAT_TIPO_RENTA ?? "4",
    concepto: process.env.SUNAT_CONCEPTO ?? "",
    moneda: process.env.SUNAT_MONEDA ?? "SOLES",
    montoNeto: process.env.SUNAT_MONTO_NETO ?? "",
    retencion: process.env.SUNAT_RETENCION ?? "no",
  },
};

const rl = readline.createInterface({ input, output });

const isNonInteractive = process.env.SUNAT_NON_INTERACTIVE === "true";

async function promptIfEmpty(label, current, required = false) {
  if (current && current.trim() !== "") {
    return current;
  }
  if (isNonInteractive) {
    if (required) throw new Error(`Falta el valor requerido: ${label}`);
    return "";
  }
  const answer = await rl.question(`${label}: `);
  return answer.trim();
}

async function promptWithDefault(label, current) {
  if (isNonInteractive) return current;
  const answer = await rl.question(`${label} [${current}]: `);
  const trimmed = answer.trim();
  return trimmed === "" ? current : trimmed;
}

async function waitForFrame(page, urlRegex, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const frame = page.frame({ url: urlRegex });
    if (frame) return frame;
    await page.waitForTimeout(500);
  }
  throw new Error("No se encontro el iframe de emision de recibo por honorarios.");
}

async function waitForFrameReady(page, urlRegex, selector, timeoutMs) {
  const frame = await waitForFrame(page, urlRegex, timeoutMs);
  await frame.locator(selector).waitFor({ state: "visible", timeout: timeoutMs });
  return frame;
}

async function clickIfNeeded(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

async function fillDijitInput(locator, value) {
  await locator.click();
  await locator.fill("");
  await locator.type(value);
}

async function closeDropdowns(frame) {
  const keyboard = frame.page().keyboard;
  await keyboard.press("Escape");
  await keyboard.press("Tab");
  await frame.locator("body").click({ position: { x: 2, y: 2 } });
}

async function run() {
  const ruc = await promptIfEmpty("RUC", process.env.SUNAT_RUC ?? "", true);
  const user = await promptIfEmpty("Usuario SOL", process.env.SUNAT_USUARIO ?? "", true);
  const pass = await promptIfEmpty("Contrasena SOL", process.env.SUNAT_CLAVE ?? "", true);

  const docType = await promptWithDefault("Tipo documento receptor", config.rh.docType);
  const docNumber = await promptIfEmpty("Numero documento receptor", config.rh.docNumber, true);
  const nameOrRazon = await promptIfEmpty("Nombre / Razon social receptor", config.rh.nameOrRazon, true);
  const tipoRenta = await promptWithDefault("Tipo renta (4/5)", config.rh.tipoRenta);
  const concepto = await promptIfEmpty("Concepto del servicio", config.rh.concepto, true);
  const moneda = await promptWithDefault("Moneda", config.rh.moneda);
  const montoNeto = await promptIfEmpty("Monto neto", config.rh.montoNeto, true);
  const retencion = await promptWithDefault("Aplica retencion 8% (si/no)", config.rh.retencion);

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  await page.fill(selectors.login.ruc, ruc);
  await page.fill(selectors.login.user, user);
  await page.fill(selectors.login.pass, pass);
  await page.click(selectors.login.submit);

  await page.waitForURL(/e-menu\.sunat\.gob\.pe\/cl-ti-itmenu\//, {
    timeout: 60000,
  });
  await page.waitForLoadState("domcontentloaded");

  const searchBox = page
    .getByRole("textbox", { name: /Busque una opcion del menu/i })
    .or(page.locator(selectors.login.searchBoxFallback));

  await searchBox.first().waitFor({ state: "visible", timeout: 60000 });
  await searchBox.first().fill("Emitir Recibo por Honorarios");
  await page.keyboard.press("Enter");

  const emitirRh = page.getByText("Emitir Recibo por Honorarios", {
    exact: true,
  });
  await emitirRh.first().waitFor({ state: "visible", timeout: 60000 });
  await emitirRh.first().click();

  let frame;
  try {
    frame = await waitForFrameReady(
      page,
      /ol-ti-itemisionhon\/emitir\.do/,
      selectors.inicio.docNumber,
      30000
    );
  } catch {
    frame = await waitForFrameReady(
      page,
      /ol-ti-itemisionhon\/emitir\.do/,
      selectors.inicio.docNumber,
      60000
    );
  }

  await fillDijitInput(frame.locator(selectors.inicio.docType), docType);
  await fillDijitInput(frame.locator(selectors.inicio.docNumber), docNumber);
  await fillDijitInput(frame.locator(selectors.inicio.nameOrRazon), nameOrRazon);
  await fillDijitInput(frame.locator(selectors.inicio.tipoRenta), tipoRenta);
  await fillDijitInput(frame.locator(selectors.inicio.concepto), concepto);
  await fillDijitInput(frame.locator(selectors.inicio.moneda), moneda);
  await closeDropdowns(frame);
  await fillDijitInput(frame.locator(selectors.inicio.montoNeto), montoNeto);

  if (retencion === "si") {
    await clickIfNeeded(frame.locator(selectors.inicio.retencionSi));
  } else {
    await clickIfNeeded(frame.locator(selectors.inicio.retencionNo));
  }

  await frame.getByRole("button", { name: "Continuar" }).first().click();

  if (config.stopBeforeEmit) {
    console.log("Listo: en pantalla preliminar antes de Emitir.");
    if (!isNonInteractive) {
      await rl.question("Presiona Enter para cerrar el navegador...");
    }
    await browser.close();
    if (!isNonInteractive) {
      await rl.close();
    }
    return;
  }

  await frame.locator(selectors.preliminar.emitir).click();
  console.log("Emitir ejecutado.");

  try {
    const acceptButton = frame.getByRole("button", { name: /Aceptar/i });
    await acceptButton.waitFor({ state: "visible", timeout: 8000 });
    await acceptButton.click();
    console.log("Confirmacion aceptada.");
  } catch {
    // No aparece la confirmacion
  }

  const downloadDir = path.resolve(process.cwd(), "downloads", "sunat");
  await fs.mkdir(downloadDir, { recursive: true });

  try {
    await frame.getByRole("button", { name: /Descargar PDF/i }).waitFor({
      state: "visible",
      timeout: 60000,
    });
  } catch {
    console.warn("No se encontraron los botones de descarga a tiempo.");
  }

  const fileTag = new Date().toISOString().replace(/[:.]/g, "-");

  const downloadPdfPromise = page.waitForEvent("download", { timeout: 60000 });
  await frame.getByRole("button", { name: /Descargar PDF/i }).click();
  const pdfDownload = await downloadPdfPromise;
  const pdfPath = path.join(downloadDir, `rxh-${fileTag}.pdf`);
  await pdfDownload.saveAs(pdfPath);
  console.log("PDF descargado:", pdfPath);

  const downloadXmlPromise = page.waitForEvent("download", { timeout: 60000 });
  await frame.getByRole("button", { name: /Descargar XML/i }).click();
  const xmlDownload = await downloadXmlPromise;
  const xmlPath = path.join(downloadDir, `rxh-${fileTag}.xml`);
  await xmlDownload.saveAs(xmlPath);
  console.log("XML descargado:", xmlPath);

  if (!isNonInteractive) {
    await rl.question("Presiona Enter para cerrar el navegador...");
  }
  await browser.close();
  if (!isNonInteractive) {
    await rl.close();
  }
}

run().catch((error) => {
  console.error("Error en el scraper:", error);
  process.exitCode = 1;
});
