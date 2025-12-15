'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './theme-provider'

interface AddLinkModalProps {
  open: boolean
  onClose: () => void
  categories: { id: string; title: string }[]
}

export function AddLinkModal({ open, onClose, categories }: AddLinkModalProps) {
  const [url, setUrl] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState<{ title: string; description: string; suggestedCategory?: string | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const { resolvedTheme } = useTheme()

  // Auto-select category when metadata is fetched
  useEffect(() => {
    if (metadata?.suggestedCategory && !selectedCategory) {
      // Check if suggested category exists
      const categoryExists = categories.some(cat => cat.title === metadata.suggestedCategory)
      
      if (categoryExists) {
        setSelectedCategory(metadata.suggestedCategory!)
      } else {
        // Category doesn't exist, suggest creating it
        setSelectedCategory('__new__')
        setNewCategoryName(metadata.suggestedCategory!)
      }
    }
  }, [metadata, categories, selectedCategory])

  const fetchMetadata = async () => {
    if (!url) return
    
    setLoading(true)
    setSelectedCategory('') // Reset category when fetching new URL
    setNewCategoryName('')
    try {
      const response = await fetch('/api/fetch-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      
      const data = await response.json()
      if (data.error) {
        alert(data.error)
        return
      }
      
      setMetadata(data)
    } catch (error) {
      alert('Failed to fetch metadata')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!metadata) return
    
    const categoryToUse = selectedCategory === '__new__' ? newCategoryName : selectedCategory
    
    setSubmitting(true)
    try {
      const response = await fetch('/api/github/add-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: metadata.title,
          description: metadata.description,
          category: categoryToUse || null,
        }),
      })
      
      const data = await response.json()
      
      if (data.error) {
        alert(`Error: ${data.error}`)
        setSubmitting(false)
        return
      }
      
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        handleClose()
        // Reload page to show new link
        window.location.reload()
      }, 2000)
    } catch (error) {
      alert('Failed to add link')
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting && !success) {
      setUrl('')
      setSelectedCategory('')
      setNewCategoryName('')
      setMetadata(null)
      setSuccess(false)
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      <div className="modal-overlay" onClick={handleClose} />
      <div className={`modal ${resolvedTheme === 'dark' ? 'dark' : ''}`}>
        <div className="modal-header">
          <h2>Add New Link</h2>
          <button onClick={handleClose} className="modal-close" disabled={submitting || success}>
            ×
          </button>
        </div>
        
        <div className="modal-content">
          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h3>Link Added Successfully!</h3>
              <p>The link has been added to your repository and will appear after the page refreshes.</p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="form-input"
                  disabled={submitting || loading}
                />
              </div>

              {!metadata ? (
                <button
                  onClick={fetchMetadata}
                  disabled={loading || !url || submitting}
                  className="btn-primary"
                >
                  {loading ? 'Fetching...' : 'Fetch Metadata'}
                </button>
              ) : (
                <>
                  <div className="form-group">
                    <label>Category</label>
                    {metadata.suggestedCategory && (
                      <div className="category-suggestion">
                        💡 Suggested: <strong>{metadata.suggestedCategory}</strong>
                      </div>
                    )}
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="form-select"
                      disabled={submitting || loading}
                    >
                      <option value="">Select a category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.title}>
                          {cat.title}
                        </option>
                      ))}
                      <option value="__new__">+ Create New Category</option>
                    </select>
                  </div>

                  {selectedCategory === '__new__' && (
                    <div className="form-group">
                      <label>New Category Name</label>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Enter category name"
                        className="form-input"
                        disabled={submitting || loading}
                      />
                    </div>
                  )}

                  <div className="metadata-preview">
                    <h3>Preview</h3>
                    <div className="preview-item">
                      <strong>Title:</strong> {metadata.title}
                    </div>
                    <div className="preview-item">
                      <strong>Description:</strong> {metadata.description}
                    </div>
                    {(selectedCategory && selectedCategory !== '__new__' ? selectedCategory : newCategoryName) && (
                      <div className="preview-item">
                        <strong>Category:</strong> {selectedCategory === '__new__' ? newCategoryName : selectedCategory}
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button
                      onClick={() => {
                        setMetadata(null)
                        setUrl('')
                        setSelectedCategory('')
                        setNewCategoryName('')
                      }}
                      className="btn-secondary"
                      disabled={submitting}
                    >
                      Change URL
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || (selectedCategory === '__new__' && !newCategoryName)}
                      className="btn-primary"
                    >
                      {submitting ? 'Adding Link...' : 'Add Link'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

