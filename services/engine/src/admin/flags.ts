// Runtime-toggleable engine flags (mutable singleton). Read by hot paths in engine.
// Centralized so admin endpoints can flip them and the engine sees changes immediately.
export const ENGINE_FLAGS = {
  maintenanceMode: false,
  tradingHalted: false,
  botsEnabled: true,
  eventsEnabled: true,
  registrationDisabled: false,
  volatilityMult: 1.0,
  spreadMult: 1.0,
  activityMult: 1.0,
  broadcastBanner: '',
  // v7.1: when true, bots can only trade assets whose minLevel <= player.level.
  // Default false — bots act independently per their own level (the design).
  botsRespectPlayerLevel: false,
};

export type EngineFlags = typeof ENGINE_FLAGS;
