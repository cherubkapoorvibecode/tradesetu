import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Read .env.local directly
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '.env.local');
  const vars: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        vars[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
      }
    }
  }
  return vars;
}

const envVars = loadEnvFile();

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'api-server',
      configureServer(server) {
        // Pass all env vars to process.env
        process.env.GEMINI_API_KEY = envVars.GEMINI_API_KEY;
        process.env.NOTION_API_KEY = envVars.NOTION_API_KEY;
        process.env.NOTION_PAGE_ID = envVars.NOTION_PAGE_ID;
        process.env.SARVAM_API_KEY = envVars.SARVAM_API_KEY;

        // Initialize Notion databases on server start
        import('./server/notionService').then(({ initNotion }) => {
          initNotion();
        });

        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/compliance') {
            const { handleComplianceRequest } = await import('./server/complianceHandler');
            handleComplianceRequest(req, res);
          } else if (req.url === '/api/chat') {
            const { handleChatRequest } = await import('./server/complianceHandler');
            handleChatRequest(req, res);
          } else if (req.url === '/api/feedback') {
            const { handleFeedbackRequest } = await import('./server/complianceHandler');
            handleFeedbackRequest(req, res);
          } else if (req.url === '/api/product-feedback') {
            const { handleProductFeedbackRequest } = await import('./server/complianceHandler');
            handleProductFeedbackRequest(req, res);
          } else if (req.url === '/api/events') {
            const { handleEventsRequest } = await import('./server/complianceHandler');
            handleEventsRequest(req, res);
          } else if (req.url === '/api/hs-classify') {
            const { handleHsClassifyRequest } = await import('./server/complianceHandler');
            handleHsClassifyRequest(req, res);
          } else if (req.url === '/api/aggregate') {
            const { handleAggregateRequest } = await import('./server/complianceHandler');
            handleAggregateRequest(req, res);
          } else if (req.url === '/api/lead') {
            const { handleLeadRequest } = await import('./server/complianceHandler');
            handleLeadRequest(req, res);
          } else if (req.url === '/api/sarvam/translate') {
            const { handleTranslateRequest } = await import('./server/sarvamService');
            handleTranslateRequest(req, res);
          } else if (req.url === '/api/sarvam/detect') {
            const { handleDetectRequest } = await import('./server/sarvamService');
            handleDetectRequest(req, res);
          } else if (req.url === '/api/sarvam/tts') {
            const { handleTtsRequest } = await import('./server/sarvamService');
            handleTtsRequest(req, res);
          } else if (req.url === '/api/label-analyze') {
            const { handleLabelAnalyzeRequest } = await import('./server/labelGuardHandler');
            handleLabelAnalyzeRequest(req, res);
          } else if (req.url === '/api/sarvam/asr') {
            const { handleAsrRequest } = await import('./server/sarvamService');
            handleAsrRequest(req, res);
          } else if (req.url === '/api/crew/run') {
            const { handleCrewRunRequest } = await import('./server/crewHandler');
            handleCrewRunRequest(req, res);
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
