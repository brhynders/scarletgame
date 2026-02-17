import { PeerConnection, DescriptionType } from 'node-datachannel';
import { SignalingServer } from './SignalingServer.js';

let nextClientId = 1;

export class PeerManager {
  constructor(options, events) {
    this.events = events;
    this.simulateLatency = options.simulateLatency ?? 0;
    this.simulatePacketLoss = options.simulatePacketLoss ?? 0;
    this.peers = new Map();
    this.peersByClientId = new Map();

    this.signalingServer = new SignalingServer(options.port, {
      onClient: (ws) => this.createPeer(ws),
      onAnswer: (ws, sdp) => this.handleAnswer(ws, sdp),
      onIceCandidate: (ws, candidate) => this.handleIceCandidate(ws, candidate),
    });
  }

  shouldDrop() {
    return this.simulatePacketLoss > 0 && Math.random() * 100 < this.simulatePacketLoss;
  }

  delaySend(fn) {
    if (this.shouldDrop()) return;
    if (this.simulateLatency > 0) {
      setTimeout(fn, this.simulateLatency);
    } else {
      fn();
    }
  }

  createPeer(ws) {
    const peer = new PeerConnection('server', {
      iceServers: ['stun:stun.l.google.com:19302'],
    });

    const clientId = nextClientId++;
    const state = {
      peer,
      reliableChannel: null,
      unreliableChannel: null,
      clientId,
      ws,
    };
    this.peers.set(ws, state);
    this.peersByClientId.set(clientId, state);

    peer.onLocalDescription((sdp, _type) => {
      this.signalingServer.sendToClient(ws, { type: 'offer', sdp });
    });

    peer.onLocalCandidate((candidate, mid) => {
      this.signalingServer.sendToClient(ws, {
        type: 'ice-candidate',
        candidate: { candidate, sdpMid: mid },
      });
    });

    // Create reliable channel (ordered)
    const reliable = peer.createDataChannel('reliable');
    state.reliableChannel = reliable;

    reliable.onOpen(() => {
      console.log(`[PeerManager] Reliable channel open for ${clientId}`);
      this.events.onPeerReady(clientId);
    });

    reliable.onMessage((data) => {
      const buf = typeof data === 'string' ? Buffer.from(data) : data;
      this.delaySend(() => this.events.onPeerMessage(clientId, buf));
    });

    reliable.onClosed(() => {
      this.onPeerDisconnected(ws);
    });

    // Create unreliable channel (unordered, maxRetransmits=0)
    const unreliable = peer.createDataChannel('unreliable', {
      unordered: true,
      maxRetransmits: 0,
    });
    state.unreliableChannel = unreliable;

    unreliable.onOpen(() => {
      console.log(`[PeerManager] Unreliable channel open for ${clientId}`);
    });

    unreliable.onMessage((data) => {
      const buf = typeof data === 'string' ? Buffer.from(data) : data;
      this.delaySend(() => this.events.onPeerMessage(clientId, buf));
    });

    peer.setLocalDescription();

    // Handle WebSocket close
    ws.on('close', () => {
      this.onPeerDisconnected(ws);
    });
  }

  handleAnswer(ws, sdp) {
    const state = this.peers.get(ws);
    if (!state) return;
    state.peer.setRemoteDescription(sdp, DescriptionType.Answer);
  }

  handleIceCandidate(ws, candidate) {
    const state = this.peers.get(ws);
    if (!state) return;
    if (candidate.candidate) {
      state.peer.addRemoteCandidate(candidate.candidate, candidate.sdpMid ?? '0');
    }
  }

  sendReliable(clientId, data) {
    const state = this.peersByClientId.get(clientId);
    if (!state?.reliableChannel) return;
    this.delaySend(() => {
      try {
        if (state.reliableChannel?.isOpen()) {
          state.reliableChannel.sendMessageBinary(Buffer.from(data));
        }
      } catch { /* channel may have closed */ }
    });
  }

  sendUnreliable(clientId, data) {
    const state = this.peersByClientId.get(clientId);
    if (!state?.unreliableChannel) return;
    this.delaySend(() => {
      try {
        if (state.unreliableChannel?.isOpen()) {
          state.unreliableChannel.sendMessageBinary(Buffer.from(data));
        }
      } catch { /* channel may have closed */ }
    });
  }

  onPeerDisconnected(ws) {
    const state = this.peers.get(ws);
    if (!state) return;

    this.events.onPeerDisconnected(state.clientId);

    try { state.reliableChannel?.close(); } catch {}
    try { state.unreliableChannel?.close(); } catch {}
    try { state.peer.close(); } catch {}

    this.peers.delete(ws);
    this.peersByClientId.delete(state.clientId);
  }

  getClientIds() {
    return Array.from(this.peersByClientId.keys());
  }

  close() {
    for (const [, state] of this.peers) {
      try { state.peer.close(); } catch {}
    }
    this.peers.clear();
    this.peersByClientId.clear();
    this.signalingServer.close();
  }
}
