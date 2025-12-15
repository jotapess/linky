'use client'

import { useEffect, useState } from 'react'

export function NewLinkNotification() {
  const [showNotification, setShowNotification] = useState(false)

  useEffect(() => {
    // Check if we should show notification
    try {
      const shouldShow = sessionStorage.getItem('linky:showNotification') === 'true'
      if (shouldShow) {
        setShowNotification(true)
      }
    } catch (e) {
      // Ignore errors
    }
  }, [])

  const handleDismiss = () => {
    setShowNotification(false)
    try {
      sessionStorage.removeItem('linky:showNotification')
    } catch (e) {
      // Ignore errors
    }
  }

  if (!showNotification) return null

  return (
    <div className="new-link-notification" style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#4CAF50',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out',
    }}>
      <span style={{ fontSize: '20px' }}>✨</span>
      <span style={{ flex: 1 }}>New link added successfully!</span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '20px',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
        aria-label="Dismiss notification"
      >
        ×
      </button>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

