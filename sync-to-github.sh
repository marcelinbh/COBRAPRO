#!/bin/bash

# Script de sincronização automática: Manus Git > GitHub
# Este script sincroniza o repositório do Manus com o GitHub
# e ativa o deploy automático no Digital Ocean

set -e

PROJECT_DIR="/home/ubuntu/cobrapro"
GITHUB_REMOTE="github"
MANUS_REMOTE="origin"
BRANCH="main"

echo "🔄 Iniciando sincronização Manus > GitHub..."
echo "📅 $(date)"

cd "$PROJECT_DIR"

# Verificar se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Há mudanças não commitadas. Execute git commit primeiro."
    exit 1
fi

# Verificar diferença entre Manus e GitHub
MANUS_HEAD=$(git rev-parse "$MANUS_REMOTE/$BRANCH")
GITHUB_HEAD=$(git rev-parse "$GITHUB_REMOTE/$BRANCH" 2>/dev/null || echo "0000000")

if [ "$MANUS_HEAD" = "$GITHUB_HEAD" ]; then
    echo "✅ Repositórios já estão sincronizados"
    echo "   Manus:  $MANUS_HEAD"
    echo "   GitHub: $GITHUB_HEAD"
    exit 0
fi

echo "📊 Status:"
echo "   Manus:  $MANUS_HEAD"
echo "   GitHub: $GITHUB_HEAD"

# Fazer fetch do GitHub para ter referência atualizada
echo "📥 Atualizando referências do GitHub..."
git fetch "$GITHUB_REMOTE" "$BRANCH" 2>/dev/null || true

# Fazer push para GitHub
echo "📤 Fazendo push para GitHub..."
git push "$GITHUB_REMOTE" "$BRANCH" --force

echo "✅ Sincronização concluída com sucesso!"
echo "🚀 Deploy automático no Digital Ocean foi acionado"
echo "   Verifique em: https://cobrapro.online"
echo ""
echo "📝 Commits sincronizados:"
git log "$GITHUB_REMOTE/$BRANCH".."$MANUS_REMOTE/$BRANCH" --oneline || echo "   (Nenhum novo commit)"
