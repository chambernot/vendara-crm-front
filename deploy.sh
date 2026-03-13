#!/bin/bash

# Script de deploy do Vendara para produção
# Este script automatiza o processo de build e deploy

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy do Vendara para produção..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para imprimir mensagens
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    print_warning "node_modules não encontrado. Instalando dependências..."
    npm install
    print_success "Dependências instaladas"
else
    print_success "node_modules encontrado"
fi

# 2. Executar testes (opcional - descomente se tiver testes)
# echo ""
# echo "🧪 Executando testes..."
# npm test
# print_success "Testes passaram"

# 3. Limpar build anterior
echo ""
echo "🧹 Limpando build anterior..."
if [ -d "dist" ]; then
    rm -rf dist
    print_success "Build anterior removido"
fi

# 4. Build de produção
echo ""
echo "📦 Gerando build de produção..."
npm run build:prod

if [ $? -eq 0 ]; then
    print_success "Build de produção gerado com sucesso"
else
    print_error "Erro ao gerar build de produção"
    exit 1
fi

# 5. Verificar se o build foi gerado
if [ ! -d "dist/vendara/browser" ]; then
    print_error "Diretório dist/vendara/browser não encontrado"
    exit 1
fi

# 6. Exibir tamanho do build
echo ""
echo "📊 Estatísticas do build:"
BUILD_SIZE=$(du -sh dist/vendara/browser | cut -f1)
echo "   Tamanho total: $BUILD_SIZE"
FILE_COUNT=$(find dist/vendara/browser -type f | wc -l)
echo "   Arquivos gerados: $FILE_COUNT"

# 7. Perguntar método de deploy
echo ""
echo "Escolha o método de deploy:"
echo "1) Copiar para servidor local"
echo "2) Criar arquivo ZIP para upload"
echo "3) Docker build e push"
echo "4) Deploy automático (configurar variáveis)"
echo "0) Apenas build (já concluído)"
read -p "Opção [0-4]: " DEPLOY_METHOD

case $DEPLOY_METHOD in
    1)
        read -p "Caminho do servidor (ex: /var/www/vendara): " SERVER_PATH
        if [ -d "$SERVER_PATH" ]; then
            print_warning "Removendo arquivos antigos do servidor..."
            rm -rf "$SERVER_PATH"/*
            print_success "Arquivos antigos removidos"
        fi
        cp -r dist/vendara/browser/* "$SERVER_PATH"/
        print_success "Arquivos copiados para $SERVER_PATH"
        ;;
    2)
        ZIP_NAME="vendara-production-$(date +%Y%m%d-%H%M%S).zip"
        cd dist/vendara/browser
        zip -r "../../../$ZIP_NAME" .
        cd ../../..
        print_success "Arquivo ZIP criado: $ZIP_NAME"
        ;;
    3)
        print_warning "Construindo imagem Docker..."
        docker build -t vendara:latest .
        print_success "Imagem Docker criada: vendara:latest"
        
        read -p "Tag da imagem para push (ex: registry.com/vendara:1.0): " DOCKER_TAG
        if [ ! -z "$DOCKER_TAG" ]; then
            docker tag vendara:latest "$DOCKER_TAG"
            docker push "$DOCKER_TAG"
            print_success "Imagem enviada: $DOCKER_TAG"
        fi
        ;;
    4)
        print_warning "Deploy automático requer configuração de variáveis"
        print_warning "Edite este script e configure suas credenciais/servidor"
        # Exemplo: rsync, scp, etc
        # rsync -avz --delete dist/vendara/browser/ user@server:/var/www/vendara/
        ;;
    0)
        print_success "Build concluído. Arquivos em: dist/vendara/browser/"
        ;;
    *)
        print_warning "Opção inválida. Build concluído em: dist/vendara/browser/"
        ;;
esac

echo ""
print_success "Deploy preparado com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Verifique o arquivo DEPLOY-PRODUCTION.md para instruções detalhadas"
echo "   2. Configure seu servidor web (nginx.conf ou .htaccess incluídos)"
echo "   3. Configure HTTPS/SSL para produção"
echo "   4. Configure variáveis de ambiente se necessário"
echo ""
print_success "Vendara pronto para produção! 🎉"
