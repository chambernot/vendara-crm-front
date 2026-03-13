# Hotfix - Dashboard Peças Paradas

## 🐛 Problema Identificado

**Erro:** "Erro ao carregar peças paradas" no dashboard  
**Causa:** DashboardService estava usando `HttpClient` diretamente em vez de `ApiClient`

### Impacto

O serviço não estava respeitando:
- URL base da API configurada no environment
- Interceptors (auth, workspace)
- Header `x-workspace-id` não estava sendo enviado
- Tratamento de erros padronizado

## ✅ Correção Aplicada

**Arquivo:** `src/app/core/services/dashboard.service.ts`

### Antes
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getStaleProducts(days: number = 30, limit: number = 10): Observable<StaleProductDto[]> {
    return this.http.get<StaleProductDto[]>(
      `/api/dashboard/stale-products?days=${days}&limit=${limit}`
    );
  }
}
```

### Depois
```typescript
import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiClient = inject(ApiClient);

  getStaleProducts(days: number = 30, limit: number = 10): Observable<StaleProductDto[]> {
    console.log('📊 [DASHBOARD SERVICE] Buscando produtos parados via API');
    console.log('📊 [DASHBOARD SERVICE] Params:', { days, limit });
    return this.apiClient.get<StaleProductDto[]>(
      `/dashboard/stale-products?days=${days}&limit=${limit}`
    );
  }
}
```

## 📋 Mudanças

1. ✅ Substituído `HttpClient` por `ApiClient`
2. ✅ Atualizado para usar `inject()` (padrão Angular moderno)
3. ✅ Removido `/api` do endpoint (ApiClient adiciona automaticamente)
4. ✅ Adicionados logs para debug
5. ✅ Garantido envio de header `x-workspace-id`

## 📦 Pacote Atualizado

**Arquivo:** `vendara-production-workspace-fix-20260304-213308.zip` (0.33 MB)  
**Build:** 04/03/2026 21:33  
**Tempo de build:** 30.447 segundos

## 🚀 Deploy

Substitua o pacote anterior por este. A correção é compatível e não requer mudanças no backend.

### Checklist
- [ ] Extrair novo pacote no servidor
- [ ] Limpar cache do navegador (Ctrl+Shift+R)
- [ ] Testar dashboard → Peças paradas
- [ ] Verificar se dados carregam corretamente
- [ ] Confirmar que header `x-workspace-id` está sendo enviado (DevTools > Network)

## 🔍 Verificação

Após o deploy, verifique no console do navegador:
```
📊 [DASHBOARD SERVICE] Buscando produtos parados via API
📊 [DASHBOARD SERVICE] Params: { days: 30, limit: 10 }
📥 [ApiClient] GET request: { url: '...', endpoint: '/dashboard/stale-products?days=30&limit=10' }
🏢 [WORKSPACE] ADICIONANDO WORKSPACE AO REQUEST
✅ [WORKSPACE] Header x-workspace-id foi adicionado CORRETAMENTE!
```

## 📝 Notas Técnicas

### Por que usar ApiClient?

O `ApiClient` é um wrapper do `HttpClient` que:
- Adiciona URL base automaticamente (`environment.apiBaseUrl`)
- Aplica todos os interceptors (auth, workspace, whatsapp)
- Garante envio de headers necessários (`x-workspace-id`, `Authorization`)
- Implementa retry automático para erros de rede
- Centraliza tratamento de erros

### Padrão do Sistema

Todos os services da aplicação usam `ApiClient`:
- ✅ WorkspaceService
- ✅ SalesApiService
- ✅ MessagesApiService
- ✅ TemplatesApiService
- ✅ FollowupsApiService
- ✅ ClientsApiService
- ✅ ProductService
- ✅ StockMovementService
- ⚠️ DashboardService (CORRIGIDO neste hotfix)

## ✅ Resultado Esperado

Após o deploy, o dashboard deve:
1. Carregar "Peças paradas" sem erro
2. Exibir produtos sem movimentação nos últimos N dias
3. Permitir alterar filtro (30/45/60 dias)
4. Mostrar foto, nome, preço e dias parados
5. Permitir navegar para detalhes do produto

---

**Hotfix aplicado com sucesso!** 🎉
