import { WebSocketServer, WebSocket } from 'ws';

export class SignalingServer {
  constructor(port, handler) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      console.log('[Signaling] Client connected');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          switch (msg.type) {
            case 'hello':
              handler.onClient(ws);
              break;
            case 'answer':
              handler.onAnswer(ws, msg.sdp);
              break;
            case 'ice-candidate':
              handler.onIceCandidate(ws, msg.candidate);
              break;
          }
        } catch (e) {
          console.error('[Signaling] Parse error:', e);
        }
      });

      ws.on('close', () => {
        console.log('[Signaling] Client disconnected');
      });
    });

  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.wss.close();
  }
}
