'use client'

import { Toaster } from 'react-hot-toast'

export function ToasterProvider() {
  return (
    <Toaster 
      position="top-center"
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
        },
        success: {
          iconTheme: {
            primary: 'var(--accent)',
            secondary: 'var(--bg)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--error)',
            secondary: 'var(--bg)',
          },
        },
      }}
    />
  )
}
