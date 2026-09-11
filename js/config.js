/* ==========================================================================
   Stepwise — deployment config
   --------------------------------------------------------------------------
   apiBase points at the serverless function that holds the Anthropic API key.

     • `node server.js` locally      → "/api/analyze" (default, works as-is)
     • Vercel / Netlify              → "/api/analyze" (default, works as-is)
     • Static host (GitHub Pages)    → either point this at a function deployed
                                       elsewhere, e.g.
                                         "https://your-app.vercel.app/api/analyze"
                                       or leave it: the analyse box disables
                                       itself and the library still works.

   The key is NEVER put here. It belongs in the server's environment only.
   ========================================================================== */
window.STEPWISE_CONFIG = {
  apiBase: '/api/analyze'
};
