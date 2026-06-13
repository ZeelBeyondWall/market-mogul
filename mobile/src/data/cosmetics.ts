// Shared cosmetics catalog — used by StorePage (purchase + equip) and
// ProfilePage (showcase + equip). Equip conventions: frames/badges equip by
// item.id, name colors equip by item.value (hex).

export interface CosmeticItem {
  id: string;
  name: string;
  cost: number;
  type: 'frame' | 'badge' | 'name_color' | 'theme';
  previewUrl?: string;
  value: string; // The CSS class or style value
}

export const COSMETICS_LIST: CosmeticItem[] = [
  // PROFILE FRAMES
  { id: 'frame_gold', name: 'Gold Frame', cost: 150, type: 'frame', previewUrl: '/store/frame_gold.png', value: 'gold-frame' },
  { id: 'frame_purple', name: 'Purple Frame', cost: 150, type: 'frame', previewUrl: '/store/frame_purple.png', value: 'purple-frame' },
  { id: 'frame_diamond', name: 'Diamond Frame', cost: 300, type: 'frame', previewUrl: '/store/frame_diamond.png', value: 'diamond-frame' },
  { id: 'frame_emerald', name: 'Emerald Frame', cost: 500, type: 'frame', previewUrl: '/store/frame_emerald.png', value: 'emerald-frame' },

  // PROFILE BADGES
  { id: 'badge_bronze', name: 'Bronze Trader', cost: 100, type: 'badge', previewUrl: '/store/badge_bronze.png', value: 'bronze-badge' },
  { id: 'badge_silver', name: 'Silver Trader', cost: 150, type: 'badge', previewUrl: '/store/badge_silver.png', value: 'silver-badge' },
  { id: 'badge_gold', name: 'Gold Trader', cost: 200, type: 'badge', previewUrl: '/store/badge_gold.png', value: 'gold-badge' },
  { id: 'badge_diamond', name: 'Diamond Trader', cost: 300, type: 'badge', previewUrl: '/store/badge_diamond.png', value: 'diamond-badge' },
  { id: 'badge_champion', name: 'Market Champion', cost: 400, type: 'badge', previewUrl: '/store/badge_champion.png', value: 'champion-badge' },

  // NAME COLORS
  { id: 'color_gold', name: 'Gold Username', cost: 100, type: 'name_color', value: '#ffd700' },
  { id: 'color_purple', name: 'Purple Username', cost: 100, type: 'name_color', value: '#a78bfa' },
  { id: 'color_green', name: 'Green Username', cost: 100, type: 'name_color', value: '#10b981' },
  { id: 'color_cyan', name: 'Cyan Username', cost: 100, type: 'name_color', value: '#06b6d4' },

  // PORTFOLIO THEMES
  { id: 'theme_purple', name: 'Purple Market Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_purple.png', value: 'purple' },
  { id: 'theme_green', name: 'Green Profit Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_green.png', value: 'green' },
  { id: 'theme_gold', name: 'Gold Wealth Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_gold.png', value: 'gold' },
  { id: 'theme_blue', name: 'Blue Trading Theme', cost: 300, type: 'theme', previewUrl: '/store/theme_blue.png', value: 'blue' }
];

// Visual-only rarity tier derived from existing gem cost (cheap=default, mid=purple, premium=gold)
export const rarityClass = (cost: number) => (cost >= 400 ? 'rarity-gold' : cost >= 150 ? 'rarity-purple' : '');
