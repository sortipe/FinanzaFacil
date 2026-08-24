# Procfile para FinanzaFacil - Gestión de Procesos de Producción

# Definición de procesos para ejecución en producción con PM2
web: node server/index.js --port 5555
backend-worker: node server/retry-worker.js

# Descripciones opcionales (útiles para logs de PM2)
web.description = Servidor principal de Express.js con todas las rutas API
backend-worker.description = Worker de reintentos para tareas SUNAT asíncronas
