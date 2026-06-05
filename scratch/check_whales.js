const fs = require('fs');
const path = require('path');
const state = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'state.json')));
const w = state.traders.find(x => x.id === 845);
console.log('Trader 845 details:', w ? { id: w.id, name: w.name, cash: w.cash, bornNet: w.bornNet, playerTrades: w.playerTrades } : 'none');
const firstTraderWithTrades = state.traders.find(x => x.playerTrades && x.playerTrades.length > 0 && !x.isPlayer);
console.log('Bot with trades:', firstTraderWithTrades ? { id: firstTraderWithTrades.id, name: firstTraderWithTrades.name, trades: firstTraderWithTrades.playerTrades.length, firstTrade: firstTraderWithTrades.playerTrades[0] } : 'none');
