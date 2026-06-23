import { supabase } from './supabaseClient';
import { User } from '../types';

export interface RemoteAccessState {
  mode: 'selection' | 'host' | 'client';
  connectionState: 'idle' | 'connecting' | 'connected' | 'sharing' | 'disconnected' | 'error';
  accessCode: string;
  inputCode: string;
  errorMsg: string;
  isMouseControlGranted: boolean;
  remoteCursor: { x: number; y: number; active: boolean; visible: boolean; label?: string } | null;
  lastClick: { x: number; y: number; timestamp: number } | null;
}

type RemoteAccessListener = (state: RemoteAccessState) => void;

class RemoteAccessService {
  private state: RemoteAccessState = {
    mode: 'selection',
    connectionState: 'idle',
    accessCode: '',
    inputCode: '',
    errorMsg: '',
    isMouseControlGranted: false,
    remoteCursor: null,
    lastClick: null
  };

  private listeners = new Set<RemoteAccessListener>();

  // WebRTC & Media Stream variables
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public peerConnection: RTCPeerConnection | null = null;
  private channel: any | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  public getState(): RemoteAccessState {
    return { ...this.state };
  }

  public subscribe(listener: RemoteAccessListener) {
    this.listeners.add(listener);
    listener({ ...this.state });
  }

  public unsubscribe(listener: RemoteAccessListener) {
    this.listeners.delete(listener);
  }

  private notify() {
    const currentState = { ...this.state };
    this.listeners.forEach(listener => listener(currentState));
  }

  private updateState(updates: Partial<RemoteAccessState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // WebRTC Cleanup
  public cleanupConnection = () => {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'disconnect',
        payload: {}
      });
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.remoteStream = null;
    this.updateState({
      connectionState: 'idle',
      remoteCursor: null,
      lastClick: null
    });
  };

  // Host Flow
  public startHost = async (currentUser: User) => {
    this.cleanupConnection();
    this.updateState({ connectionState: 'connecting', errorMsg: '' });

    try {
      // 1. Get Screen Stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      this.localStream = stream;

      // Handle native browser stop sharing
      stream.getVideoTracks()[0].onended = () => {
        this.stopSession();
      };

      // 2. Generate random code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      this.updateState({
        mode: 'host',
        accessCode: code,
        connectionState: 'sharing'
      });

      // 3. Connect to Supabase Realtime channel
      const channelName = `remote_access_${code}`;
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      });

      this.channel = channel;

      channel
        .on('broadcast', { event: 'join' }, () => {
          this.initiatePeerConnection(code);
        })
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          const pc = this.peerConnection;
          if (!pc) return;

          if (payload.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            this.updateState({ connectionState: 'connected' });
          } else if (payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("Error adding ice candidate:", e);
            }
          }
        })
        .on('broadcast', { event: 'disconnect' }, () => {
          this.updateState({ connectionState: 'sharing', remoteCursor: null, lastClick: null });
          if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
          }
          if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
          }
        });

      channel.subscribe();

    } catch (err: any) {
      console.error("Failed to capture screen:", err);
      this.updateState({
        connectionState: 'idle',
        errorMsg: 'Acesso à tela negado ou cancelado.'
      });
      throw err;
    }
  };

  private initiatePeerConnection = async (code: string) => {
    this.updateState({ connectionState: 'connecting' });

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnection = pc;

    // Create Data Channel for Mouse/Keyboard events
    const dc = pc.createDataChannel('mouse_control');
    this.dataChannel = dc;
    this.setupDataChannel(dc, true);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { candidate: event.candidate }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.updateState({ connectionState: 'connected' });
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.updateState({ connectionState: 'sharing', remoteCursor: null, lastClick: null });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { offer }
      });
    }
  };

  // Client Flow
  public startClient = async (inputCode: string) => {
    this.cleanupConnection();
    this.updateState({ connectionState: 'connecting', errorMsg: '', inputCode });

    this.updateState({ mode: 'client' });

    const channelName = `remote_access_${inputCode}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    this.channel = channel;

    channel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (payload.offer) {
          const pc = new RTCPeerConnection(this.iceServers);
          this.peerConnection = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate && this.channel) {
              this.channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { candidate: event.candidate }
              });
            }
          };

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              this.remoteStream = event.streams[0];
              this.updateState({ connectionState: 'connected' });
            }
          };

          // Capture Data Channel from host
          pc.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel(event.channel, false);
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              this.updateState({ connectionState: 'connected' });
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              this.updateState({
                connectionState: 'disconnected',
                errorMsg: 'Conexão interrompida pelo transmissor.'
              });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { answer }
          });
        } else if (payload.candidate) {
          const pc = this.peerConnection;
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("Error adding ice candidate client:", e);
            }
          }
        }
      })
      .on('broadcast', { event: 'disconnect' }, () => {
        this.updateState({
          connectionState: 'disconnected',
          errorMsg: 'O transmissor encerrou a sessão.',
          remoteCursor: null,
          lastClick: null
        });
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'join',
          payload: {}
        });
      }
    });
  };

  private setupDataChannel(dc: RTCDataChannel, isHost: boolean) {
    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (isHost) {
          // If we are the host, process mouse control messages from the client
          if (!this.state.isMouseControlGranted) return; // Only process if mouse control is granted by host

          if (data.type === 'mousemove') {
            this.updateState({
              remoteCursor: {
                x: data.x,
                y: data.y,
                active: true,
                visible: true,
                label: data.label || 'Suporte'
              }
            });
          } else if (data.type === 'click') {
            this.updateState({
              lastClick: {
                x: data.x,
                y: data.y,
                timestamp: Date.now()
              }
            });
            // Auto hide cursor after click ripple triggers, or keep visible
          } else if (data.type === 'mouseleave') {
            this.updateState({
              remoteCursor: this.state.remoteCursor ? { ...this.state.remoteCursor, visible: false } : null
            });
          }
        } else {
          // If we are the client, handle host status updates if any
          if (data.type === 'mouse_control_status') {
            this.updateState({ isMouseControlGranted: data.granted });
          }
        }
      } catch (err) {
        console.error("Failed to parse data channel message:", err);
      }
    };

    dc.onopen = () => {
      console.log(`Data channel opened: ${dc.label}`);
      if (isHost) {
        // Send initial mouse control permission status to client
        this.sendMouseControlStatusToClient();
      }
    };
  }

  // Host API to grant mouse control
  public grantMouseControl = (granted: boolean) => {
    this.updateState({ isMouseControlGranted: granted });
    if (!granted) {
      this.updateState({ remoteCursor: null });
    }
    this.sendMouseControlStatusToClient();
  };

  private sendMouseControlStatusToClient() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'mouse_control_status',
        granted: this.state.isMouseControlGranted
      }));
    }
  }

  // Client API to send mouse positions
  public sendMouseMove = (x: number, y: number, label?: string) => {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'mousemove',
        x,
        y,
        label
      }));
    }
  };

  // Client API to send click coordinate
  public sendMouseClick = (x: number, y: number) => {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'click',
        x,
        y
      }));
    }
  };

  // Client API to hide cursor when mouse leaves video area
  public sendMouseLeave = () => {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'mouseleave'
      }));
    }
  };

  public stopSession = () => {
    this.cleanupConnection();
    this.updateState({
      mode: 'selection',
      accessCode: '',
      inputCode: '',
      errorMsg: '',
      isMouseControlGranted: false,
      remoteCursor: null,
      lastClick: null
    });
  };
}

export const remoteAccessService = new RemoteAccessService();
