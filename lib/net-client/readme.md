# net-client

WebRTC client for connecting to a multiplayer server using a binary protocol defined with `net-schema`.

## Usage

```js
import { NetClient } from 'net-client';
import { Schema } from 'net-schema';

const protocol = {
  join: {
    id: 1,
    channel: 'reliable',
    fields: { name: Schema.string },
  },
  position: {
    id: 2,
    channel: 'unreliable',
    fields: { x: Schema.f32, y: Schema.f32 },
  },
};

const client = new NetClient(protocol);

client.onConnect = () => {
  console.log('Connected');
  client.sendMessage('join', { name: 'player1' });
};

client.onMessage = (type, data) => {
  if (type === 'position') {
    console.log(data.x, data.y);
  }
};

client.onDisconnect = () => {
  console.log('Disconnected');
};

client.onError = (err) => {
  console.error(err);
};

client.connect('ws://localhost:3000');
```

## API

### `new NetClient(schema)`

Creates a client with a protocol schema defined using `net-schema`.

### `client.connect(url)`

Connects to a signaling server at the given WebSocket URL.

### `client.sendMessage(type, data)`

Encodes and sends a message over the appropriate channel (reliable or unreliable) as defined in the schema.

### `client.getConnectionStatus()`

Returns the current connection state: `'disconnected'`, `'connecting'`, or `'connected'`.

### `client.disconnect()`

Closes the peer and signaling connections.

### Events

- `client.onConnect` — called when the peer connection is fully open
- `client.onDisconnect` — called when the peer disconnects
- `client.onMessage(type, data)` — called with the decoded message type and fields
- `client.onError(err)` — called when a message fails to decode
