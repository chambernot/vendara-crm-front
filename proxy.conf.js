const DEFAULT_DEV_API_KEY = process.env.HCAJOA_DEV_API_KEY || 'dev_api_key_12345';
// Em desenvolvimento, por padrão apontamos para API local.
// Para apontar para outro ambiente (ex: Azure), setar HCAJOA_API_TARGET.
const DEFAULT_API_TARGET = process.env.HCAJOA_API_TARGET || 'http://localhost:5000';

const PROXY_CONFIG = {
  "/api/public": {
    "target": DEFAULT_API_TARGET,
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug",
    "pathRewrite": {
      "^/api/public": "/public"
    },
    "onProxyReq": function(proxyReq, req, res) {
      console.log('[PROXY] Request:', req.method, req.url);
      console.log('[PROXY] Target URL:', DEFAULT_API_TARGET + req.url.replace('/api/public', '/public'));

      // Garantir que o header X-API-KEY exista (muitos ambientes exigem isso mesmo em dev)
      if (req.headers['x-api-key']) {
        proxyReq.setHeader('X-API-KEY', req.headers['x-api-key']);
        console.log('[PROXY] ✅ Header X-API-KEY configurado (request):', req.headers['x-api-key']);
      } else {
        proxyReq.setHeader('X-API-KEY', DEFAULT_DEV_API_KEY);
        console.warn('[PROXY] ⚠️ Header X-API-KEY não encontrado. Injetando default dev.');
      }

      // Encaminhar Authorization se presente
      if (req.headers['authorization']) {
        proxyReq.setHeader('Authorization', req.headers['authorization']);
        console.log('[PROXY] ✅ Header Authorization encaminhado');
      }
      console.log('[PROXY] 📤 Headers enviados ao backend:', proxyReq.getHeaders());
    },
    "onProxyRes": function(proxyRes, req, res) {
      console.log('[PROXY] 📥 Response:', proxyRes.statusCode, req.url);
    },
    "onError": function(err, req, res) {
      console.error('[PROXY] ❌ Erro no proxy:', err.message);
      console.error('[PROXY] Target:', DEFAULT_API_TARGET);
      console.error('[PROXY] Verifique conectividade com o endpoint alvo.');
    }
  },
  "/api": {
    "target": DEFAULT_API_TARGET,
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug",
    "pathRewrite": {
      "^/api": "/api"
    },
    "onProxyReq": function(proxyReq, req, res) {
      // Log para debug
      console.log('[PROXY] Request:', req.method, req.url);
      console.log('[PROXY] Target URL:', DEFAULT_API_TARGET + req.url.replace('/api', '/api'));
      console.log('[PROXY] 🔍 Headers recebidos do navegador:', req.headers);
      
      // Garantir que o header X-API-KEY seja passado
      if (req.headers['x-api-key']) {
        proxyReq.setHeader('X-API-KEY', req.headers['x-api-key']);
        console.log('[PROXY] ✅ Header X-API-KEY configurado:', req.headers['x-api-key']);
      } else {
        proxyReq.setHeader('X-API-KEY', DEFAULT_DEV_API_KEY);
        console.warn('[PROXY] ⚠️ Header X-API-KEY não encontrado! Injetando default dev.');
      }

      // Encaminhar Authorization se presente
      if (req.headers['authorization']) {
        proxyReq.setHeader('Authorization', req.headers['authorization']);
        console.log('[PROXY] ✅ Header Authorization encaminhado');
      }

      // CRÍTICO: Garantir que o header x-workspace-id seja passado (case-insensitive)
      const workspaceId = req.headers['x-workspace-id'];
      if (workspaceId) {
        // Backend espera exatamente 'x-workspace-id' (lowercase)
        proxyReq.setHeader('x-workspace-id', workspaceId);
        console.log('[PROXY] ✅ Header x-workspace-id configurado:', workspaceId);
      } else {
        console.error('[PROXY] ❌ Header x-workspace-id NÃO ENCONTRADO!');
        console.error('[PROXY] ❌ Headers disponíveis:', Object.keys(req.headers));
      }

      // Garantir que o header x-workspace-slug seja passado
      const workspaceSlug = req.headers['x-workspace-slug'];
      if (workspaceSlug) {
        proxyReq.setHeader('x-workspace-slug', workspaceSlug);
        console.log('[PROXY] ✅ Header x-workspace-slug configurado:', workspaceSlug);
      }

      // Garantir Content-Type correto
      if (req.headers['content-type']) {
        proxyReq.setHeader('Content-Type', req.headers['content-type']);
      }

      console.log('[PROXY] 📤 Headers enviados ao backend:', proxyReq.getHeaders());
    },
    "onProxyRes": function(proxyRes, req, res) {
      console.log('[PROXY] 📥 Response:', proxyRes.statusCode, req.url);
      if (proxyRes.statusCode === 401) {
        console.error('[PROXY] ❌ Erro 401 - Não autorizado. Verifique a API Key no backend.');
      }
    },
    "onError": function(err, req, res) {
      console.error('[PROXY] ❌ Erro no proxy:', err.message);
      console.error('[PROXY] Target:', DEFAULT_API_TARGET);
      console.error('[PROXY] Verifique conectividade com o endpoint alvo.');
    }
  }
};

module.exports = PROXY_CONFIG;
