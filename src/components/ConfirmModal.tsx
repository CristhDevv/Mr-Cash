'use client'

import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export function ConfirmModal({ isOpen, onClose, title, message, confirmText = 'Eliminar', onConfirm }: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button 
          onClick={onClose} 
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Cancelar
        </button>
        <button 
          onClick={() => {
            onConfirm()
            onClose()
          }} 
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'var(--error)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
