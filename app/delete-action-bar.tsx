'use client'

import { useState, useEffect } from 'react'
import { useDeleteMode } from './delete-mode-context'

interface Link {
  text: string
  url: string
  category?: string
}

interface DeleteActionBarProps {
  links: Link[]
}

export function DeleteActionBar({ links }: DeleteActionBarProps) {
  const { isDeleteMode, selectedLinks, exitDeleteMode, selectAll, deselectAll } = useDeleteMode()
  const [deleting, setDeleting] = useState(false)

  // Handle escape key to exit delete mode
  useEffect(() => {
    if (!isDeleteMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        exitDeleteMode()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDeleteMode, deleting, exitDeleteMode])

  const selectedCount = selectedLinks.size

  const handleDelete = async () => {
    if (selectedCount === 0) return
    
    setDeleting(true)
    try {
      const linksToDelete = Array.from(selectedLinks).map(id => {
        const [url, title] = id.split('|')
        return { url, title }
      })
      
      const response = await fetch('/api/github/delete-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: linksToDelete }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        alert(`Error: ${data.error}`)
        setDeleting(false)
        return
      }
      
      // Success - reload page
      window.location.reload()
    } catch (error) {
      alert('Failed to delete links')
      setDeleting(false)
    }
  }

  if (!isDeleteMode) return null

  return (
    <div className="delete-action-bar">
      <div className="delete-action-bar-content">
        <div className="delete-action-bar-left">
          <span className="delete-action-title">🗑️ Delete Mode</span>
          <button
            onClick={() => selectAll(links)}
            className="delete-action-btn"
            disabled={deleting}
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="delete-action-btn"
            disabled={deleting || selectedCount === 0}
          >
            Deselect All
          </button>
          <span className="delete-action-count">
            {selectedCount} {selectedCount === 1 ? 'link' : 'links'} selected
          </span>
        </div>
        <div className="delete-action-bar-right">
          <span className="delete-action-hint">Press Esc to cancel</span>
          <button
            onClick={exitDeleteMode}
            className="delete-action-btn"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="delete-action-btn delete-action-btn-primary"
            disabled={deleting || selectedCount === 0}
          >
            {deleting ? 'Deleting...' : `Delete ${selectedCount > 0 ? selectedCount : ''} Link${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

