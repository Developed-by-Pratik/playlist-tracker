'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Headphones,
  Radio,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DuoPartnership, PartnerSnapshot, VoiceSessionState } from '@/lib/types/collaboration';
import { webrtcVoiceService } from '@/lib/voice/webrtc-voice-service';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';

interface VoiceStudyLoungeProps {
  partnership: DuoPartnership | null;
  partnerSnapshot: PartnerSnapshot | null;
  myDisplayName: string;
}

export function VoiceStudyLounge({
  partnership,
  partnerSnapshot,
  myDisplayName,
}: VoiceStudyLoungeProps) {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(webrtcVoiceService.getState());
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const unsubscribe = webrtcVoiceService.subscribe(s => {
      setVoiceState(s);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleJoin = async () => {
    if (!partnership) return;
    setIsJoining(true);
    await webrtcVoiceService.joinVoice(partnership, {
      name: partnerSnapshot?.displayName || 'Study Buddy',
      avatar: partnerSnapshot?.avatarUrl,
    });
    setIsJoining(false);
  };

  const handleLeave = () => {
    webrtcVoiceService.leaveVoice();
  };

  const handleToggleMute = () => {
    webrtcVoiceService.toggleMute();
  };

  const handleToggleDeafen = () => {
    webrtcVoiceService.toggleDeafen();
  };

  const isConnected = voiceState.isActive && voiceState.connectionState === 'connected';

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '520px',
        padding: '2rem',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'space-between',
      }}
    >
      {/* Decorative background glow */}
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: isConnected
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(148, 163, 184, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          transition: 'all 0.5s ease',
        }}
      />

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--border-radius-sm)',
              background: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.12)',
              border: isConnected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConnected ? '#4ade80' : 'var(--accent-primary)',
            }}
          >
            <Headphones style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                1-on-1 Voice Study Lounge
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-surface-2)',
                  color: isConnected ? '#4ade80' : 'var(--text-muted)',
                  border: '1px solid ' + (isConnected ? 'rgba(34, 197, 94, 0.25)' : 'var(--border-color)'),
                }}
              >
                <Radio style={{ width: 10, height: 10 }} />
                <span>{isConnected ? 'LIVE CO-STUDY' : 'READY TO CONNECT'}</span>
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Low-latency peer-to-peer audio for quiet co-working and instant questions
            </p>
          </div>
        </div>

        {isConnected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              background: 'var(--bg-surface-2)',
              padding: '6px 12px',
              borderRadius: 99,
              border: '1px solid var(--border-color)',
            }}
          >
            <Clock style={{ width: 14, height: 14 }} />
            <span>{formatStudyTime(voiceState.durationSeconds)}</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {voiceState.error && (
        <div
          style={{
            margin: '1rem 0',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{voiceState.error}</span>
        </div>
      )}

      {/* Center Stage: Avatars with Speaking Pulse Aura */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3rem',
          margin: '2.5rem 0',
          flexWrap: 'wrap',
          position: 'relative',
        }}
      >
        {/* User Avatar Card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <motion.div
              animate={{
                scale: voiceState.isSelfSpeaking ? [1, 1.12, 1] : 1,
                boxShadow: voiceState.isSelfSpeaking
                  ? '0 0 25px rgba(99, 102, 241, 0.7)'
                  : '0 0 0px rgba(0, 0, 0, 0)',
              }}
              transition={{ duration: 0.35, repeat: voiceState.isSelfSpeaking ? Infinity : 0 }}
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: 'var(--gradient-accent)',
                color: '#fff',
                fontSize: '2rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: voiceState.isSelfSpeaking ? '3px solid #6366f1' : '3px solid var(--border-color)',
                transition: 'border 0.2s ease',
              }}
            >
              {myDisplayName ? myDisplayName[0].toUpperCase() : 'M'}
            </motion.div>

            {/* Mic Muted indicator badge */}
            {voiceState.isMuted && isConnected && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-surface-1)',
                }}
              >
                <MicOff style={{ width: 13, height: 13 }} />
              </span>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {myDisplayName} (You)
            </div>
            <div style={{ fontSize: '0.75rem', color: voiceState.isSelfSpeaking ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
              {voiceState.isMuted ? 'Muted' : voiceState.isSelfSpeaking ? 'Speaking...' : 'Listening'}
            </div>
          </div>
        </div>

        {/* Central Audio Waveform Graphic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40 }}>
          {[16, 28, 40, 24, 34, 18, 30].map((h, i) => (
            <motion.div
              key={i}
              animate={{
                height: isConnected
                  ? voiceState.isSelfSpeaking || voiceState.isPartnerSpeaking
                    ? [h * 0.4, h, h * 0.3]
                    : 6
                  : 4,
                background: isConnected
                  ? voiceState.isSelfSpeaking || voiceState.isPartnerSpeaking
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)'
                  : 'var(--border-color)',
              }}
              transition={{
                duration: 0.45,
                repeat: Infinity,
                delay: i * 0.08,
                ease: 'easeInOut',
              }}
              style={{
                width: 4,
                borderRadius: 99,
                opacity: 0.8,
              }}
            />
          ))}
        </div>

        {/* Partner Avatar Card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <motion.div
              animate={{
                scale: voiceState.isPartnerSpeaking ? [1, 1.12, 1] : 1,
                boxShadow: voiceState.isPartnerSpeaking
                  ? '0 0 25px rgba(34, 197, 94, 0.7)'
                  : '0 0 0px rgba(0, 0, 0, 0)',
              }}
              transition={{ duration: 0.35, repeat: voiceState.isPartnerSpeaking ? Infinity : 0 }}
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: 'var(--bg-surface-2)',
                color: 'var(--text-primary)',
                fontSize: '2rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: voiceState.isPartnerSpeaking ? '3px solid #22c55e' : '3px solid var(--border-color)',
                transition: 'border 0.2s ease',
                overflow: 'hidden',
              }}
            >
              {partnerSnapshot?.avatarUrl ? (
                <img
                  src={partnerSnapshot.avatarUrl}
                  alt={partnerSnapshot.displayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{partnerSnapshot?.displayName ? partnerSnapshot.displayName[0].toUpperCase() : 'B'}</span>
              )}
            </motion.div>

            {/* Deafen indicator badge */}
            {voiceState.isDeafened && isConnected && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-surface-1)',
                }}
              >
                <VolumeX style={{ width: 13, height: 13 }} />
              </span>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {partnerSnapshot?.displayName || 'Study Buddy'}
            </div>
            <div style={{ fontSize: '0.75rem', color: voiceState.isPartnerSpeaking ? 'var(--accent-success)' : 'var(--text-muted)' }}>
              {voiceState.isPartnerSpeaking ? 'Speaking...' : isConnected ? 'Listening' : 'In Study Lounge'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Console */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: 'var(--border-radius-sm)',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}
      >
        {!isConnected ? (
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="btn-primary"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '0.9375rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 99,
            }}
          >
            <PhoneCall style={{ width: 18, height: 18 }} />
            <span>{isJoining ? 'Connecting Audio...' : 'Join Study Lounge'}</span>
          </button>
        ) : (
          <>
            {/* Mic Toggle Button */}
            <button
              onClick={handleToggleMute}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                background: voiceState.isMuted ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-1)',
                color: voiceState.isMuted ? '#ef4444' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={voiceState.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {voiceState.isMuted ? <MicOff style={{ width: 20, height: 20 }} /> : <Mic style={{ width: 20, height: 20 }} />}
            </button>

            {/* Deafen Toggle Button */}
            <button
              onClick={handleToggleDeafen}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                background: voiceState.isDeafened ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-1)',
                color: voiceState.isDeafened ? '#ef4444' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={voiceState.isDeafened ? 'Unmute Partner Audio' : 'Mute Partner Audio (Deafen)'}
            >
              {voiceState.isDeafened ? <VolumeX style={{ width: 20, height: 20 }} /> : <Volume2 style={{ width: 20, height: 20 }} />}
            </button>

            {/* Leave Lounge Button */}
            <button
              onClick={handleLeave}
              style={{
                padding: '0.625rem 1.75rem',
                borderRadius: 99,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
              }}
            >
              <PhoneOff style={{ width: 16, height: 16 }} />
              <span>Leave Lounge</span>
            </button>
          </>
        )}
      </div>

      {/* Helpful Audio Tip */}
      <div
        style={{
          marginTop: '1rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Sparkles style={{ width: 12, height: 12, color: 'var(--accent-primary)' }} />
        <span>Audio stays live even when switching to watch videos or take notes.</span>
      </div>
    </div>
  );
}
