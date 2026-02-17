import { createCodec } from 'net-schema';
import { PeerManager } from './PeerManager.js';

export class NetServer {
  constructor(schema) {
    this.codec = createCodec(schema);
    this.onConnect = null;
    this.onDisconnect = null;
    this.onMessage = null;
    this.onError = null;
  }

  listen({ port, simulateLatency = 0, simulatePacketLoss = 0 }) {
    console.log(`Server started on port ${port}`);
    console.log(`Simulated latency: ${simulateLatency}ms`);
    console.log(`Simulated packet loss: ${simulatePacketLoss}%`);

    this.peerManager = new PeerManager({
      port,
      simulateLatency,
      simulatePacketLoss,
    }, {
      onPeerReady: (clientId) => {
        this.onConnect?.(clientId);
      },
      onPeerMessage: (clientId, data) => {
        try {
          const { type, ...fields } = this.codec.decode(data);
          this.onMessage?.(clientId, type, fields);
        } catch (err) {
          this.onError?.(err);
        }
      },
      onPeerDisconnected: (clientId) => {
        this.onDisconnect?.(clientId);
      },
    });
  }

  sendMessage(clientId, type, data) {
    const msg = { type, ...data };
    const encoded = this.codec.encode(msg);
    const channel = this.codec.channelFor(msg);
    if (channel === 'reliable') {
      this.peerManager.sendReliable(clientId, encoded);
    } else {
      this.peerManager.sendUnreliable(clientId, encoded);
    }
  }

  broadcastMessage(type, data, excludeClientId) {
    const msg = { type, ...data };
    const encoded = this.codec.encode(msg);
    const channel = this.codec.channelFor(msg);
    for (const clientId of this.peerManager.getClientIds()) {
      if (clientId === excludeClientId) continue;
      if (channel === 'reliable') {
        this.peerManager.sendReliable(clientId, encoded);
      } else {
        this.peerManager.sendUnreliable(clientId, encoded);
      }
    }
  }

  getClientIds() {
    return this.peerManager.getClientIds();
  }

  stop() {
    this.peerManager.close();
  }
}
