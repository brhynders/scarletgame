import { createCodec } from 'net-schema';
import { SignalingClient } from './SignalingClient.js';
import { PeerConnection } from './PeerConnection.js';

export class NetClient {
  constructor(schema) {
    this.codec = createCodec(schema);
    this._state = 'disconnected';
    this.onConnect = null;
    this.onDisconnect = null;
    this.onMessage = null;
    this.onError = null;

    this.peer = new PeerConnection({
      onOpen: () => {
        this._state = 'connected';
        this.onConnect?.();
      },
      onMessage: (data) => {
        try {
          const { type, ...fields } = this.codec.decode(data);
          this.onMessage?.(type, fields);
        } catch (err) {
          this.onError?.(err);
        }
      },
      onDisconnected: () => {
        this._state = 'disconnected';
        this.onDisconnect?.();
      },
    });

    this.signaling = new SignalingClient({
      onOffer: async (sdp) => {
        const answerSdp = await this.peer.handleOffer(sdp);
        this.signaling.sendAnswer(answerSdp);
      },
      onIceCandidate: (candidate) => {
        this.peer.addIceCandidate(candidate);
      },
    });

    this.peer.onIceCandidate = (candidate) => {
      this.signaling.sendIceCandidate(candidate);
    };
  }

  connect(url) {
    this._state = 'connecting';
    this.signaling.connect(url);
  }

  sendMessage(type, data) {
    if (this._state !== 'connected') return;
    const msg = { type, ...data };
    const encoded = this.codec.encode(msg);
    const channel = this.codec.channelFor(msg);
    if (channel === 'reliable') {
      this.peer.sendReliable(encoded);
    } else {
      this.peer.sendUnreliable(encoded);
    }
  }

  getConnectionStatus() {
    return this._state;
  }

  disconnect() {
    this.peer.close();
    this.signaling.close();
    this._state = 'disconnected';
  }
}
