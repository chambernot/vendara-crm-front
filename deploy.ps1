# Script de deploy do Vendara para produção (Windows PowerShell)
# Este script automatiza o processo de build e deploy

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 Iniciando deploy do Vendara para produção..." -ForegroundColor Cyan
Write-Host ""

function Print-Success {
    param($message)
    Write-Host "✓ $message" -ForegroundColor Green
}

function Print-Warning {
    param($message)
    Write-Host "⚠ $message" -ForegroundColor Yellow
}

function Print-Error {
    param($message)
    Write-Host "✗ $message" -ForegroundColor Red
}

# 1. Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Print-Warning "node_modules não encontrado. Instalando dependências..."
    npm install
    Print-Success "Dependências instaladas"
} else {
    Print-Success "node_modules encontrado"
}

# 2. Limpar build anterior
Write-Host ""
Write-Host "🧹 Limpando build anterior..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Print-Success "Build anterior removido"
}

# 3. Build de produção
Write-Host ""
Write-Host "📦 Gerando build de produção..." -ForegroundColor Cyan
npm run build:prod

if ($LASTEXITCODE -eq 0) {
    Print-Success "Build de produção gerado com sucesso"
} else {
    Print-Error "Erro ao gerar build de produção"
    exit 1
}

# 4. Verificar se o build foi gerado
if (-not (Test-Path "dist\vendara\browser")) {
    Print-Error "Diretório dist\vendara\browser não encontrado"
    exit 1
}

# 5. Exibir tamanho do build
Write-Host ""
Write-Host "📊 Estatísticas do build:" -ForegroundColor Cyan
$buildSize = (Get-ChildItem "dist\vendara\browser" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "   Tamanho total: $([math]::Round($buildSize, 2)) MB" -ForegroundColor White
$fileCount = (Get-ChildItem "dist\vendara\browser" -Recurse -File).Count
Write-Host "   Arquivos gerados: $fileCount" -ForegroundColor White

# 6. Perguntar método de deploy
Write-Host ""
Write-Host "Escolha o método de deploy:" -ForegroundColor Cyan
Write-Host "1) Copiar para servidor local" -ForegroundColor White
Write-Host "2) Criar arquivo ZIP para upload" -ForegroundColor White
Write-Host "3) Docker build" -ForegroundColor White
Write-Host "0) Apenas build (já concluído)" -ForegroundColor White
$deployMethod = Read-Host "Opção [0-3]"

switch ($deployMethod) {
    "1" {
        $serverPath = Read-Host "Caminho do servidor (ex: C:\inetpub\wwwroot\vendara)"
        if (Test-Path $serverPath) {
            Print-Warning "Removendo arquivos antigos do servidor..."
            Remove-Item -Path "$serverPath\*" -Recurse -Force
            Print-Success "Arquivos antigos removidos"
        } else {
            New-Item -Path $serverPath -ItemType Directory -Force | Out-Null
        }
        Copy-Item -Path "dist\vendara\browser\*" -Destination $serverPath -Recurse -Force
        Print-Success "Arquivos copiados para $serverPath"
        
        # Copiar .htaccess se for Apache
        if (Test-Path ".htaccess") {
            Copy-Item -Path ".htaccess" -Destination $serverPath -Force
            Print-Success "Arquivo .htaccess copiado"
        }
    }
    "2" {
        $zipName = "vendara-production-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
        Compress-Archive -Path "dist\vendara\browser\*" -DestinationPath $zipName -Force
        Print-Success "Arquivo ZIP criado: $zipName"
        $zipSize = (Get-Item $zipName).Length / 1MB
        Write-Host "   Tamanho do ZIP: $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
    }
    "3" {
        Print-Warning "Construindo imagem Docker..."
        docker build -t vendara:latest .
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Imagem Docker criada: vendara:latest"
            
            $dockerTag = Read-Host "Tag da imagem para push (deixe em branco para pular)"
            if ($dockerTag) {
                docker tag vendara:latest $dockerTag
                docker push $dockerTag
                Print-Success "Imagem enviada: $dockerTag"
            }
        } else {
            Print-Error "Erro ao construir imagem Docker"
        }
    }
    "0" {
        Print-Success "Build concluído. Arquivos em: dist\vendara\browser\"
    }
    default {
        Print-Warning "Opção inválida. Build concluído em: dist\vendara\browser\"
    }
}

Write-Host ""
Print-Success "Deploy preparado com sucesso!"
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Verifique o arquivo DEPLOY-PRODUCTION.md para instruções detalhadas" -ForegroundColor White
Write-Host "   2. Configure seu servidor web (nginx.conf ou .htaccess incluídos)" -ForegroundColor White
Write-Host "   3. Configure HTTPS/SSL para produção" -ForegroundColor White
Write-Host "   4. Configure variáveis de ambiente se necessário" -ForegroundColor White
Write-Host ""
Print-Success "Vendara pronto para produção! 🎉"
Write-Host ""
