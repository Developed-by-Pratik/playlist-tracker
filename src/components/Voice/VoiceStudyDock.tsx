'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Clock,
  Maximize2,
} from 'lucide-react';
import { webrtcVoiceService } from '@/lib/voice/webrtc-voice-service';
import { VoiceSessionState } from '@/lib/types/collaboration';
import { formatStudyTime } from '@/lib/study-time/study-time-tracker';

interface VoiceStudyDockProps {
  onOpenLounge: () => void;
}

export function VoiceStudyDock({ onOpenLounge }: VoiceStudyDockProps) {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(webrtcVoiceService.getState());

  useEffect(() => {
    const unsub = webrtcVoiceService.subscribe(s => {
      setVoiceState(s);
    });
    return () => {
      unsub();
    };
  }, []);

  if (!voiceState.isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          bottom: '1.75rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0.625rem 1.125rem',
          borderRadius: 99,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.2)',
          color: '#fff',
        }}
      >
        {/* Partner Avatar with speaking pulse */}
        <div style={{ position: 'relative', width: 32, height: 32 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8125rem',
              fontWeight: 800,
              boxShadow: voiceState.isPartnerSpeaking ? '0 0 12px rgba(52, 211, 153, 0.9)' : 'none',
              transition: 'box-shadow 0.2s ease',
              overflow: 'hidden',
            }}
          >
            {voiceState.partnerAvatar ? (
              <img
                src={voiceState.partnerAvatar}
                alt={voiceState.partnerName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span>{voiceState.partnerName ? voiceState.partnerName[0].toUpperCase() : 'B'}</span>
            )}
          </div>

          {/* Speaking Live Dot */}
          <span
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: voiceState.isPartnerSpeaking ? '#22c55e' : '#6366f1',
              border: '2px solid #0f172a',
            }}
          />
        </div>

        {/* Info Text */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 700 }}>
            <span>{voiceState.partnerName}</span>
            <span
              style={{
                fontSize: '0.625rem',
                fontFamily: 'var(--font-mono)',
                color: voiceState.isPartnerSpeaking ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
              }}
            >
              {voiceState.isPartnerSpeaking ? '● Speaking' : 'Co-studying'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'var(--font-mono)' }}>
            <Clock style={{ width: 10, height: 10 }} />
            <span>{formatStudyTime(voiceState.durationSeconds)}</span>
          </div>
        </div>

        {/* Mini Audio Waves */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18, margin: '0 4px' }}>
          {[10, 16, 12, 18, 8].map((h, i) => (
            <motion.div
              key={i}
              animate={{
                height: voiceState.isSelfSpeaking || voiceState.isPartnerSpeaking
                  ? [4, h, 3]
                  : 3,
              }}
              transition={{
                duration: 0.35,
                repeat: Infinity,
                delay: i * 0.07,
              }}
              style={{
                width: 2.5,
                borderRadius: 99,
                background: voiceState.isPartnerSpeaking ? '#22c55e' : 'var(--accent-primary)',
              }}
            />
          ))}
        </div>

        {/* Controls Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.15)' }} />

        {/* Mute Button */}
        <button
          onClick={() => webrtcVoiceService.toggleMute()}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: voiceState.isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            color: voiceState.isMuted ? '#f87171' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title={voiceState.isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {voiceState.isMuted ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
        </button>

        {/* Deafen Button */}
        <button
          onClick={() => webrtcVoiceService.toggleDeafen()}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: voiceState.isDeafened ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            color: voiceState.isDeafened ? '#f87171' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title={voiceState.isDeafened ? 'Unmute Audio' : 'Mute Audio'}
        >
          {voiceState.isDeafened ? <VolumeX style={{ width: 14, height: 14 }} /> : <Volume2 style={{ width: 14, height: 14 }} />}
        </button>

        {/* Expand Lounge Button */}
        <button
          onClick={onOpenLounge}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Open Voice Study Lounge in Duo Hub"
        >
          <Maximize2 style={{ width: 13, height: 13 }} />
        </button>

        {/* Leave Voice Button */}
        <button
          onClick={() => webrtcVoiceService.leaveVoice()}
          style={{
            padding: '5px 12px',
            borderRadius: 99,
            border: 'none',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)',
            transition: 'all 0.2s ease',
          }}
          title="Leave voice co-study session"
        >
          <PhoneOff style={{ width: 12, height: 12 }} />
          <span>Leave</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
