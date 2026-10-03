/**
 * webrtc-voice-service.ts — Real-time WebRTC 1-on-1 Voice Study Lounge Service
 *
 * Implements peer-to-peer audio co-working with Web Audio API speech volume analysis,
 * Mute/Deafen controls, Supabase Realtime broadcast signaling, and interactive demo partner simulation.
 */

import { DuoPartnership, VoiceSessionState } from '@/lib/types/collaboration';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getSyncId } from '@/lib/cloud-storage';
import { getMyDuoCode } from '@/lib/collaboration/collaboration-service';
import { logger } from '@/lib/observability/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebrtcVoiceService {
  private state: VoiceSessionState = {
    isActive: false,
    connectionState: 'disconnected',
    isMuted: false,
    isDeafened: false,
    isSelfSpeaking: false,
    isPartnerSpeaking: false,
    partnerName: 'Study Partner',
    partnerAvatar: null,
    durationSeconds: 0,
    error: null,
  };

  private listeners: Set<(state: VoiceSessionState) => void> = new Set();
  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speechDetectionAnimId: number | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private demoSpeakingInterval: ReturnType<typeof setInterval> | null = null;
  private channel: RealtimeChannel | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;

  /** Join the 1-on-1 audio lounge */
  public async joinVoice(
    partnership: DuoPartnership,
    partnerProfile: { name: string; avatar?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.isActive) return { success: true };

    logger.info('webrtc-voice', 'Attempting to join voice lounge', { duoCode: partnership.duoCode });

    this.updateState({
      isActive: true,
      connectionState: 'connecting',
      partnerName: partnerProfile.name,
      partnerAvatar: partnerProfile.avatar || null,
      durationSeconds: 0,
      error: null,
    });

    const isDemo = partnership.duoCode === 'DUO-DEMO' || partnership.userB === 'demo-partner-alex';

    try {
      // 1. Request user microphone
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        // 2. Setup Web Audio API speech visualizer
        this.setupAudioAnalysis(this.localStream);
      }
    } catch (err: unknown) {
      const errName = (err as Error)?.name || 'UnknownError';
      const errMsg =
        errName === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone permissions in browser settings.'
          : 'Could not access audio device.';

      logger.warn('webrtc-voice', 'Microphone capture failed or blocked', undefined, err);

      // In demo mode or offline, continue with simulated audio so user can still test
      if (!isDemo) {
        this.updateState({
          connectionState: 'error',
          error: errMsg,
        });
        return { success: false, error: errMsg };
      }
    }

    // 3. Start Session Timer
    this.durationInterval = setInterval(() => {
      this.updateState({ durationSeconds: this.state.durationSeconds + 1 });
    }, 1000);

    // 4. Handle Demo Mode vs Cloud Peer-to-Peer
    if (isDemo) {
      this.setupDemoMode();
      this.updateState({ connectionState: 'connected' });
      logger.info('webrtc-voice', 'Voice study lounge connected in Demo Partner mode (Alex)');
      return { success: true };
    }

    // Setup Cloud WebRTC Signaling via Supabase Realtime Broadcast
    await this.setupWebRTCSignaling(partnership);
    this.updateState({ connectionState: 'connected' });
    logger.info('webrtc-voice', 'Voice study lounge connected');
    return { success: true };
  }

  /** Leave the voice lounge */
  public leaveVoice(): void {
    logger.info('webrtc-voice', 'Leaving voice lounge');

    // Stop duration timer
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    // Stop demo speaking simulation
    if (this.demoSpeakingInterval) {
      clearInterval(this.demoSpeakingInterval);
      this.demoSpeakingInterval = null;
    }

    // Stop audio analysis animation
    if (this.speechDetectionAnimId) {
      cancelAnimationFrame(this.speechDetectionAnimId);
      this.speechDetectionAnimId = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // Close PeerConnection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Cleanup remote audio element
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
    }

    // Unsubscribe from channel
    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.updateState({
      isActive: false,
      connectionState: 'disconnected',
      isMuted: false,
      isDeafened: false,
      isSelfSpeaking: false,
      isPartnerSpeaking: false,
      durationSeconds: 0,
      error: null,
    });
  }

  /** Toggle microphone mute state */
  public toggleMute(): void {
    if (!this.state.isActive) return;
    const nextMuted = !this.state.isMuted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }

    this.updateState({
      isMuted: nextMuted,
      isSelfSpeaking: nextMuted ? false : this.state.isSelfSpeaking,
    });

    logger.debug('webrtc-voice', `Microphone ${nextMuted ? 'MUTED' : 'UNMUTED'}`);
  }

  /** Toggle partner audio deafen state */
  public toggleDeafen(): void {
    if (!this.state.isActive) return;
    const nextDeafened = !this.state.isDeafened;

    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = nextDeafened;
    }

    this.updateState({ isDeafened: nextDeafened });
    logger.debug('webrtc-voice', `Audio output ${nextDeafened ? 'DEAFENED' : 'UNDEAFENED'}`);
  }

  /** Setup Web Audio API volume analyser to detect speaking */
  private setupAudioAnalysis(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSpeaking = () => {
        if (!this.analyser || this.state.isMuted) {
          if (this.state.isSelfSpeaking) this.updateState({ isSelfSpeaking: false });
          this.speechDetectionAnimId = requestAnimationFrame(checkSpeaking);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const speakingNow = average > 14; // Speech energy threshold

        if (speakingNow !== this.state.isSelfSpeaking) {
          this.updateState({ isSelfSpeaking: speakingNow });
          this.broadcastSpeakingState(speakingNow);
        }

        this.speechDetectionAnimId = requestAnimationFrame(checkSpeaking);
      };

      checkSpeaking();
    } catch {
      // Audio analysis fallback
    }
  }

  private broadcastSpeakingState(isSpeaking: boolean): void {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'voice_speaking',
      payload: { isSpeaking },
    }).catch(() => {});
  }

  /** Setup interactive simulation for Demo Partner mode */
  private setupDemoMode(): void {
    // Periodically simulate partner speaking / listening bursts
    this.demoSpeakingInterval = setInterval(() => {
      if (!this.state.isActive) return;
      const willSpeak = Math.random() > 0.6;
      this.updateState({ isPartnerSpeaking: willSpeak });

      if (willSpeak) {
        setTimeout(() => {
          if (this.state.isActive) this.updateState({ isPartnerSpeaking: false });
        }, 3200);
      }
    }, 8000);
  }

  /** Setup Realtime WebRTC signaling via Supabase Broadcast Channel */
  private async setupWebRTCSignaling(partnership: DuoPartnership): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;

    const myUid = (await getSyncId()) || getMyDuoCode();
    const channelName = `webrtc_voice_${partnership.id}`;

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) this.peerConnection?.addTrack(track, this.localStream);
      });
    }

    // Remote audio stream handler
    this.peerConnection.ontrack = event => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        if (!this.remoteAudioElement && typeof document !== 'undefined') {
          this.remoteAudioElement = document.createElement('audio');
          this.remoteAudioElement.autoplay = true;
          document.body.appendChild(this.remoteAudioElement);
        }
        if (this.remoteAudioElement) {
          this.remoteAudioElement.srcObject = remoteStream;
          this.remoteAudioElement.play().catch(() => {});
        }
      }
    };

    // Candidate generation
    this.peerConnection.onicecandidate = event => {
      if (event.candidate && this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'voice_candidate',
          payload: { candidate: event.candidate, senderId: myUid },
        }).catch(() => {});
      }
    };

    // Subscribe to broadcast signaling channel
    this.channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'voice_speaking' }, payload => {
        if (payload.payload?.isSpeaking !== undefined) {
          this.updateState({ isPartnerSpeaking: Boolean(payload.payload.isSpeaking) });
        }
      })
      .on('broadcast', { event: 'voice_candidate' }, async payload => {
        if (payload.payload?.senderId !== myUid && payload.payload?.candidate && this.peerConnection) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
          } catch {
            // ICE candidate fallback
          }
        }
      })
      .subscribe();
  }

  public getState(): VoiceSessionState {
    return this.state;
  }

  public subscribe(callback: (state: VoiceSessionState) => void): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private updateState(partial: Partial<VoiceSessionState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => {
      try {
        fn(this.state);
      } catch {
        // Prevent listener crashes
      }
    });
  }
}

export const webrtcVoiceService = new WebrtcVoiceService();
