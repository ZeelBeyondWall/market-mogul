const WebSocket = require('c:/Users/Zeel/Desktop/Projects/Game Idea Stock/services/engine/node_modules/ws');

const ws = new WebSocket('ws://localhost:8788/ws');

let testStep = 0;

ws.on('open', () => {
  console.log('CONNECTED to local engine on port 8788!');
  
  // Step 1: Attempt to place an order before authenticating (should be rejected by auth guard)
  console.log('\n[TEST STEP 1] Sending order BEFORE authentication...');
  ws.send(JSON.stringify({
    type: 'order',
    payload: {
      aid: 'NEXA',
      side: 'buy',
      qty: 10,
      orderType: 'market'
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'order_result') {
    console.log('Received order_result:', JSON.stringify(msg.payload));
    
    if (testStep === 0) {
      if (msg.payload.ok === false && msg.payload.reason === 'Authentication required') {
        console.log('✅ STEP 1 SUCCESS: Order was blocked with "Authentication required".');
      } else {
        console.log('❌ STEP 1 FAILED: Order was not blocked correctly.', msg.payload);
      }
      
      // Step 2: Attempt to authenticate with a garbage token (should fail verification)
      testStep = 1;
      console.log('\n[TEST STEP 2] Sending auth handshake with garbage token...');
      ws.send(JSON.stringify({
        type: 'auth',
        payload: {
          token: 'garbage_token_value'
        }
      }));
    } else if (testStep === 1) {
      if (msg.payload.ok === false && msg.payload.reason === 'Authentication failed') {
        console.log('✅ STEP 2 SUCCESS: Auth failed with "Authentication failed".');
      } else {
        console.log('❌ STEP 2 FAILED: Auth did not fail as expected.', msg.payload);
      }
      
      console.log('\nAll local auth integration tests completed!');
      ws.close();
      process.exit(0);
    }
  }
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err.message);
  process.exit(1);
});

// Timeout after 10 seconds to avoid hanging
setTimeout(() => {
  console.error('Test timed out after 10s!');
  ws.close();
  process.exit(1);
}, 10000);
