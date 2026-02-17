export class SignalingClient {
  constructor(handler) {
    this.ws = null;
    this.handler = handler;
  }

  connect(url) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[Signaling] Connected');
      this.send({ type: 'hello' });
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'offer':
          this.handler.onOffer(msg.sdp);
          break;
        case 'ice-candidate':
          this.handler.onIceCandidate(msg.candidate);
          break;
      }
    };

    this.ws.onclose = () => {
      console.log('[Signaling] Disconnected');
    };

    this.ws.onerror = (err) => {
      console.error('[Signaling] Error:', err);
    };
  }

  sendAnswer(sdp) {
    this.send({ type: 'answer', sdp });
  }

  sendIceCandidate(candidate) {
    this.send({ type: 'ice-candidate', candidate });
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.ws?.close();
  }
}
