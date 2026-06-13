// Central config for the mobile client.
// Dev: connect straight to the VPS public IP (works on any network; Android
// cleartext is allowed via app.json usesCleartextTraffic). For a production
// build, point this at wss://<your-domain>/ws once TLS is set up.
export const WS_URL = 'ws://52.66.176.80:8787/ws';

// Supabase (anon key is public by design — same project as the web client).
export const SUPABASE_URL = 'https://ymtccjfbcfogkplisjhr.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdGNjamZiY2ZvZ2twbGlzamhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTg2MTcsImV4cCI6MjA5NjAzNDYxN30.tWU3xu-UodQvt9-P2TIOy0xsyNtJ9fvB_WJFfClWwaU';

// Neon HUD palette (mirrors the web client tokens).
export const COLORS = {
  bg: '#05080d',
  panel: '#0b1020',
  panelRaise: '#121a2e',
  border: 'rgba(124,92,255,0.18)',
  borderDim: 'rgba(148,163,184,0.12)',
  text: '#e2e8f0',
  dim: '#8c9bb5',
  gold: '#fbbf24',
  green: '#34d399',
  red: '#f43f5e',
  cyan: '#22d3ee',
};
