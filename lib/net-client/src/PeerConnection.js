export class PeerConnection {
  constructor(events) {
    this.reliableChannel = null;
    this.unreliableChannel = null;
    this.events = events;
    this.channelsReady = 0;
    this.onIceCandidate = null;

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
        this.events.onDisconnected();
      }
    };

    // Server creates channels, client receives them
    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.binaryType = 'arraybuffer';
      console.log(`[PeerConnection] Received channel: ${channel.label}`);

      if (channel.label === 'reliable') {
        this.reliableChannel = channel;
        channel.onopen = () => this.onChannelOpen();
        channel.onmessage = (e) => this.events.onMessage(e.data);
      } else if (channel.label === 'unreliable') {
        this.unreliableChannel = channel;
        channel.onopen = () => this.onChannelOpen();
        channel.onmessage = (e) => this.events.onMessage(e.data);
      }
    };
  }

  onChannelOpen() {
    this.channelsReady++;
    if (this.channelsReady >= 2) {
      this.events.onOpen();
    }
  }

  async handleOffer(sdp) {
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer.sdp;
  }

  async addIceCandidate(candidate) {
    await this.pc.addIceCandidate(candidate);
  }

  sendReliable(data) {
    if (this.reliableChannel?.readyState === 'open') {
      this.reliableChannel.send(new Uint8Array(data).buffer);
    }
  }

  sendUnreliable(data) {
    if (this.unreliableChannel?.readyState === 'open') {
      this.unreliableChannel.send(new Uint8Array(data).buffer);
    }
  }

  close() {
    this.reliableChannel?.close();
    this.unreliableChannel?.close();
    this.pc.close();
  }
}
