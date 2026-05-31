// Runtime-toggleable engine flags (mutable singleton). Read by hot paths in engine.
// Centralized so admin endpoints can flip them and the engine sees changes immediately.
export const ENGINE_FLAGS = {
  maintenanceMode: false,        // Refuses new client connections via gateway/health
  tradingHalted: false,          // Rejects all player orders
  botsEnabled: true,             // Bots only tick when true
  eventsEnabled: true,           // News engine fires events when true
  registrationDisabled: false,   // Not enforced server-side here; surfaced for UI
  volatilityMult: 1.0,           // Multiplies asset.vol on tickMarket
  spreadMult: 1.0,               // Multiplies MM bot spread
  activityMult: 1.0,             // Multiplies bot activity in tickBots
  broadcastBanner: '',           // Emergency message shown in client header (snapshot field)
};

export type EngineFlags = typeof ENGINE_FLAGS;
