const WebSocket = require('c:/Users/Zeel/Desktop/Projects/Game Idea Stock/services/engine/node_modules/ws');

const ws = new WebSocket('ws://52.66.176.80:8787/ws');

ws.on('open', () => {
  console.log('Connected to server!');
  // Send setTF and setActive to initialize
  ws.send(JSON.stringify({ type: 'setTF', payload: { tf: '5s' } }));
  ws.send(JSON.stringify({ type: 'setActive', payload: { aid: 'NEXA' } }));
  
  // Wait 1.5s, then place a market sell order for 1 share
  setTimeout(() => {
    console.log('Sending short order...');
    ws.send(JSON.stringify({
      type: 'order',
      payload: {
        aid: 'NEXA',
        side: 'sell',
        qty: 1,
        orderType: 'market',
        limitPx: 180
      }
    }));
  }, 1500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'snapshot') {
    console.log('Snapshot received. Cash:', msg.payload.player.cash, 'Holdings:', JSON.stringify(msg.payload.player.holdings));
  } else if (msg.type === 'tick') {
    // Only print tick if playerHoldings changes
    if (Object.keys(msg.payload.playerHoldings).length > 0) {
      console.log('Tick playerHoldings:', JSON.stringify(msg.payload.playerHoldings), 'Cash:', msg.payload.cash);
    }
  } else if (msg.type === 'order_result') {
    console.log('Order Result:', JSON.stringify(msg.payload));
  }
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
