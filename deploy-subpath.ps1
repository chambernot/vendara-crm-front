# Script de Deploy para Subpath
# Build e prepara arquivos para upload em /joiasia/

param(
    [string]$DeployPath = "dist\vendara\browser",
    [string]$BaseHref = "/joiasia/"
)

Write-Host "🚀 Iniciando build para produção..." -ForegroundColor Cyan
Write-Host "📍 Base href: $BaseHref" -ForegroundColor Yellow
Write-Host ""

# Limpar build anterior
if (Test-Path "dist") {
    Write-Host "🧹 Limpando build anterior..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist"
}

# Build com base-href
Write-Host "📦 Executando ng build..." -ForegroundColor Cyan
ng build --base-href=$BaseHref

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build concluído com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📂 Arquivos gerados em: $DeployPath" -ForegroundColor Yellow
    Write-Host ""
    
    # Verificar se o base-href está correto
    $indexPath = Join-Path $DeployPath "index.html"
    if (Test-Path $indexPath) {
        $indexContent = Get-Content $indexPath -Raw
        if ($indexContent -match "<base href=`"$BaseHref`">") {
            Write-Host "✅ Base href verificado: $BaseHref" -ForegroundColor Green
        } else {
            Write-Host "⚠️  ATENÇÃO: Base href não encontrado ou incorreto!" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Faça upload dos arquivos de '$DeployPath' para o servidor" -ForegroundColor White
    Write-Host "   Destino: /var/www/html/joiasia/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Configure o nginx usando 'nginx-subpath.conf'" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Reinicie o nginx:" -ForegroundColor White
    Write-Host "   sudo systemctl reload nginx" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📖 Veja DEPLOY-SUBPATH.md para instruções detalhadas" -ForegroundColor Yellow
    
} else {
    Write-Host ""
    Write-Host "❌ Build falhou! Verifique os erros acima." -ForegroundColor Red
    exit 1
}
