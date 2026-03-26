import { ReactNode, useEffect, useState } from 'react';

const isMobileDevice = () =>
  window.innerWidth <= 480 ||
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function IPhoneFrame({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isMobile) {
    return (
      <div style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {children}
      </div>
    );
  }

  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?(AM|PM)$/i, '');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 40%, #1c1c1e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Outer wrapper holds side buttons as absolute siblings */}
      <div style={{ position: 'relative', flexShrink: 0 }}>

        {/* ── Left side buttons ── */}
        {/* Action button */}
        <div style={{
          position: 'absolute', left: -5, top: 132,
          width: 4, height: 34,
          background: '#3a3a3c', borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 2px rgba(0,0,0,0.5)',
        }} />
        {/* Volume up */}
        <div style={{
          position: 'absolute', left: -5, top: 192,
          width: 4, height: 62,
          background: '#3a3a3c', borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 2px rgba(0,0,0,0.5)',
        }} />
        {/* Volume down */}
        <div style={{
          position: 'absolute', left: -5, top: 270,
          width: 4, height: 62,
          background: '#3a3a3c', borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 2px rgba(0,0,0,0.5)',
        }} />

        {/* ── Right side button (power) ── */}
        <div style={{
          position: 'absolute', right: -5, top: 202,
          width: 4, height: 80,
          background: '#3a3a3c', borderRadius: '0 3px 3px 0',
          boxShadow: '1px 0 2px rgba(0,0,0,0.5)',
        }} />

        {/* ── Phone body ── */}
        <div style={{
          width: 393,
          height: 852,
          borderRadius: 55,
          background: '#1a1a1a',
          border: '2px solid #4a4a4c',
          boxShadow: [
            'inset 0 0 0 1.5px #2a2a2c',
            '0 6px 20px rgba(0,0,0,0.4)',
            '0 30px 80px rgba(0,0,0,0.6)',
            '0 0 0 0.5px rgba(255,255,255,0.08)',
          ].join(', '),
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* ── Screen surface (inset from phone body edges) ── */}
          <div style={{
            position: 'absolute',
            inset: 3,
            borderRadius: 52,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
          }}>

            {/* ── Status bar ── */}
            <div style={{
              height: 59,
              flexShrink: 0,
              position: 'relative',
              background: '#fff',
            }}>
              {/* Dynamic Island */}
              <div style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 126,
                height: 37,
                background: '#000',
                borderRadius: 24,
                zIndex: 10,
              }} />

              {/* Time (left) */}
              <div style={{
                position: 'absolute',
                left: 24,
                bottom: 9,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: -0.4,
                color: '#000',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                lineHeight: 1,
              }}>
                {timeStr}
              </div>

              {/* Status icons (right) */}
              <div style={{
                position: 'absolute',
                right: 22,
                bottom: 9,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}>
                {/* Cellular signal */}
                <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                  <rect x="0" y="6" width="3" height="6" rx="1" fill="#000" />
                  <rect x="4.5" y="3.5" width="3" height="8.5" rx="1" fill="#000" />
                  <rect x="9" y="1.5" width="3" height="10.5" rx="1" fill="#000" />
                  <rect x="13.5" y="0" width="3" height="12" rx="1" fill="#000" />
                </svg>
                {/* WiFi */}
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                  <circle cx="8" cy="11" r="1.3" fill="#000" />
                  <path d="M4.2 7.8A5.3 5.3 0 0 1 8 6.2c1.45 0 2.77.55 3.8 1.6" stroke="#000" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M1.3 4.9A9.3 9.3 0 0 1 8 2.3c2.58 0 4.92.99 6.7 2.6" stroke="#000" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {/* Battery */}
                <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
                  <rect x="0.65" y="0.65" width="21.7" height="11.7" rx="3.5" stroke="#000" strokeWidth="1.3" />
                  <rect x="2.3" y="2.3" width="16.5" height="8.4" rx="2" fill="#000" />
                  <path d="M23.5 4.8v3.4c1-.4 1.6-1.1 1.6-1.7s-.6-1.3-1.6-1.7z" fill="#000" />
                </svg>
              </div>
            </div>

            {/* ── App content (scrollable area managed by child) ── */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {children}
            </div>

            {/* ── Home indicator ── */}
            <div style={{
              height: 34,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
            }}>
              <div style={{
                width: 134,
                height: 5,
                background: '#000',
                borderRadius: 3,
                opacity: 0.18,
              }} />
            </div>

          </div>{/* end screen surface */}
        </div>{/* end phone body */}
      </div>{/* end outer wrapper */}
    </div>
  );
}
