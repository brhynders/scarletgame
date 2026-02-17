# net-server

WebRTC server for hosting multiplayer sessions using a binary protocol defined with `net-schema`.

## Usage

```js
import { NetServer } from 'net-server';
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

const server = new NetServer(protocol);

server.onConnect = (clientId) => {
  console.log(`${clientId} connected`);
};

server.onMessage = (clientId, type, data) => {
  if (type === 'position') {
    server.broadcastMessage('position', data, clientId);
  }
};

server.onDisconnect = (clientId) => {
  console.log(`${clientId} disconnected`);
};

server.onError = (err) => {
  console.error(err);
};

server.listen({ port: 3000 });
```

## API

### `new NetServer(schema)`

Creates a server with a protocol schema defined using `net-schema`.

### `server.listen({ port, simulateLatency?, simulatePacketLoss? })`

Starts the signaling WebSocket server.

- `port` — port to listen on
- `simulateLatency` — artificial delay in ms applied to all messages (default: `0`)
- `simulatePacketLoss` — percentage of messages to drop, from `0` to `100` (default: `0`)

### `server.sendMessage(clientId, type, data)`

Encodes and sends a message to a specific client over the appropriate channel.

### `server.broadcastMessage(type, data, excludeClientId?)`

Encodes and sends a message to all connected clients. Optionally excludes one client by ID.

### `server.getClientIds()`

Returns an array of all connected client IDs.

### `server.stop()`

Shuts down all peer connections and the signaling server.

### Events

- `server.onConnect(clientId)` — called when a client's peer connection is ready
- `server.onDisconnect(clientId)` — called when a client disconnects
- `server.onMessage(clientId, type, data)` — called with the sender's ID, decoded message type, and fields
- `server.onError(err)` — called when a message fails to decode
