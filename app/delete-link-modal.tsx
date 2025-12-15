'use client'

import { useState } from 'react'
import { useTheme } from './theme-provider'

interface Link {
  text: string
  url: string
  category?: string
}

interface DeleteLinkModalProps {
  open: boolean
  onClose: () => void
  link: Link | null
}

export function DeleteLinkModal({ open, onClose, link }: DeleteLinkModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState(false)
  const { resolvedTheme } = useTheme()

  const handleDelete = async () => {
    if (!link) return
    
    setDeleting(true)
    try {
      const response = await fetch('/api/github/delete-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: link.url,
          title: link.text,
        }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        alert(`Error: ${data.error}`)
        setDeleting(false)
        return
      }
      
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        handleClose()
        // Reload page to show updated links
        window.location.reload()
      }, 2000)
    } catch (error) {
      alert('Failed to delete link')
      setDeleting(false)
    }
  }

  const handleClose = () => {
    if (!deleting && !success) {
      setSuccess(false)
      onClose()
    }
  }

  if (!open || !link) return null

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className={`modal ${resolvedTheme === 'dark' ? 'dark' : ''}`}>
        <div className="modal-header">
          <h2>Delete Link</h2>
          <button onClick={handleClose} className="modal-close" disabled={deleting || success}>
            ×
          </button>
        </div>
        
        <div className="modal-content">
          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h3>Link Deleted Successfully!</h3>
              <p>The link has been removed from your repository and will disappear after the page refreshes.</p>
            </div>
          ) : (
            <>
              <p>Are you sure you want to delete this link?</p>
              
              <div className="delete-preview">
                <div className="preview-item">
                  <strong>Title:</strong> {link.text}
                </div>
                <div className="preview-item">
                  <strong>URL:</strong> {link.url}
                </div>
                {link.category && (
                  <div className="preview-item">
                    <strong>Category:</strong> {link.category}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger"
                >
                  {deleting ? 'Deleting...' : 'Delete Link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

