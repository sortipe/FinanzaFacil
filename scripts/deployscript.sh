#!/bin/bash

# Script de despliegue para FinanzaFacil
# Uso: ./scripts/deployscript.sh

set -e  # Salir en caso de error

# Colores para output
echo_red() { echo "\033[0;31m$1\033[0m"; }
echo_green() { echo "\033[0;32m$1\033[0m"; }
echo_yellow() { echo "\033[1;33m$1\033[0m"; }

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Función de error
handle_error() {
    log "ERROR: $1"
    exit 1
}

# Comprobar Node.js y npm
check_prerequisites() {
    log "Comprobando prerequisitos..."
    
    if ! command -v node >/dev/null 2>&1; then
        handle_error "Node.js no está instalado"
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        handle_error "npm no está instalado"
    fi
    
    if ! command -v git >/dev/null 2>&1; then
        handle_error "git no está instalado"
    fi
    
    local node_version=$(node -v | sed 's/v//')
    local major_version=$(echo "$node_version" | cut -d. -f1)
    
    if [ "$major_version" -lt 18 ]; then
        handle_error "Node.js 18+ es requerido, encontrado $node_version"
    fi
    
    log "✓ Node.js $node_version encontrado"
}

# Instalar dependencias
install_dependencies() {
    log "Instalando dependencias..."
    
    # Instalar dependencias del frontend
    cd "$(dirname "$0")/.."
    
    if [ ! -d "node_modules" ]; then
        log "Instalando dependencias del frontend..."
        npm ci || npm install
    else
        log "Dependencies del frontend ya instaladas"
    fi
    
    # Instalar dependencias del backend
    if [ -f "server/package.json" ]; then
        log "Instalando dependencias del backend..."
        cd "server"
        if [ ! -d "node_modules" ]; then
            npm ci || npm install
        else
            log "Dependencies del backend ya instaladas"
        fi
        cd ".."
    fi
    
    cd "$(dirname "$0")/.."
}

# Construir el frontend
build_frontend() {
    log "Construyendo el frontend..."
    
    if [ ! -d "dist" ]; then
        log "Build del frontend no encontrado, construyendo..."
        npm run build
    else
        log "Build del frontend ya existe, limpiando..."
        rm -rf dist
        npm run build
    fi
    
    if [ ! -d "dist" ]; then
        handle_error "Build del frontend falló - directorio dist no encontrado"
    fi
    
    log "✓ Build del frontend completado"
}

# Construir/compilar backend (si aplica)
build_backend() {
    log "Construyendo backend..."
    
    if [ -f "server/package.json" ] && grep -q "build" "server/package.json"; then
        cd "server"
        log "Construyendo backend..."
        npm run build || log "Advertencia: script de build del backend falló o no está definido"
        cd ".."
    else
        log "No hay script de build del backend, usando código source directamente"
    fi
}

# Configurar servidor (opcional)
setup_server() {
    log "Configurando servidor..."
    
    # Comprobar si hay PM2 o equivalente
    if command -v pm2 >/dev/null 2>&1; then
        log "PM2 encontrado, usando para gestión de procesos"
        
        # Establecer aplicación PM2
        if pm2 list | grep -q "FinanzaFacil-Backend"; then
            log "Deteniendo instancia existente de FinanzaFacil-Backend..."
            pm2 stop FinanzaFacil-Backend
            pm2 delete FinanzaFacil-Backend
        fi
        
        # Iniciar servidor
        cd "server"
        pm2 start index.js --name FinanzaFacil-Backend --time
        cd ".."
        
        log "✓ Servidor backend iniciado con PM2"
    else
        log "PM2 no encontrado, iniciar manualmente: cd server && node index.js"
    fi
}

# Establecer permisos de archivo correcto
set_permissions() {
    log "Estableciendo permisos de archivo..."
    
    # Scripts
    if [ -f "scripts/deployscript.sh" ]; then
        chmod +x "scripts/deployscript.sh"
    fi
    
    # Archivos .env
    if [ -f ".env.production" ]; then
        chmod 600 ".env.production"
    fi
    
    log "Permisos actualizados"
}

# Verificar despliegue
verify_deployment() {
    log "Verificando despliegue..."
    
    # Comprobar que el build existe
    if [ ! -d "dist" ]; then
        handle_error "Directorio build frontend no encontrado"
    fi
    
    # Comprobar archivos críticos
    local critical_files=(
        "dist/index.html"
        "package.json"
        ".env.production.template"
    )
    
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            log "Advertencia: Archivo crítico no encontrado: $file"
        fi
    done
    
    # Mostrar URLs
    echo_green "\n=== Despliegue Exitoso ==="
    echo_green "Frontend: http://localhost:3000"
    echo_green "Backend API: http://localhost:5555/api"
    echo_green "\nScripts útiles:"
    echo_green "  - Iniciar servidor backend: cd server && node index.js"
    echo_green "  - Verificar despliegue: ./scripts/deployscript.sh --verify"
    echo_green "  - Ver logs de backend: pm2 logs FinanzaFacil-Backend"
}

# Función principal
main() {
    echo_green "🚀 Iniciando despliegue de FinanzaFacil..."
    
    check_prerequisites
    install_dependencies
    build_frontend
    build_backend
    setup_server
    set_permissions
    verify_deployment
    
    echo_green "\n✨ ¡Despliegue completado exitosamente!"
}

# Ejecutar función principal
main "$@"
