'use client'

import { Command } from 'cmdk'
import { useTheme } from './theme-provider'
import { useEffect, useState } from 'react'
import { AddLinkModal } from './add-link-modal'
import { DeleteLinkModal } from './delete-link-modal'

interface Link {
  text: string
  url: string
  category?: string
}

interface Category {
  id: string
  title: string
}

interface CommandPaletteProps {
  links: Link[]
  categories: Category[]
}

export function CommandPalette({ links, categories }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)
  const [showDeleteLink, setShowDeleteLink] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<Link | null>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <>
      {open && (
        <div className="command-palette-overlay" onClick={() => setOpen(false)} />
      )}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        className="command-palette"
        label="Command Menu"
      >
        <Command.Input placeholder="Search links, categories, or commands..." />
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          {categories.length > 0 && (
            <Command.Group heading="Categories">
              {categories.map((cat) => (
                <Command.Item
                  key={`category-${cat.id}`}
                  onSelect={() => {
                    document.getElementById(cat.id)?.scrollIntoView({ behavior: 'smooth' })
                    setOpen(false)
                  }}
                >
                  {cat.title}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {links.length > 0 && (
            <>
              <Command.Group heading="Links">
                {links.map((link, index) => (
                  <Command.Item
                    key={`link-${index}`}
                    onSelect={() => {
                      window.open(link.url, '_blank')
                      setOpen(false)
                    }}
                  >
                    <span>{link.text}</span>
                    {link.category && (
                      <span className="command-item-category">{link.category}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Delete Links">
                {links.map((link, index) => (
                  <Command.Item
                    key={`delete-link-${index}`}
                    onSelect={() => {
                      setLinkToDelete(link)
                      setOpen(false)
                      setShowDeleteLink(true)
                    }}
                  >
                    <span>Delete: {link.text}</span>
                    {link.category && (
                      <span className="command-item-category">{link.category}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            </>
          )}
          <Command.Group heading="Actions">
            <Command.Item
              onSelect={() => {
                setOpen(false)
                setShowAddLink(true)
              }}
            >
              Add New Link
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Theme">
            <Command.Item
              onSelect={() => {
                setTheme('light')
                setOpen(false)
              }}
            >
              Switch to Light Mode
            </Command.Item>
            <Command.Item
              onSelect={() => {
                setTheme('dark')
                setOpen(false)
              }}
            >
              Switch to Dark Mode
            </Command.Item>
            <Command.Item
              onSelect={() => {
                setTheme('system')
                setOpen(false)
              }}
            >
              Use System Preference
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
      <AddLinkModal
        open={showAddLink}
        onClose={() => setShowAddLink(false)}
        categories={categories}
      />
      <DeleteLinkModal
        open={showDeleteLink}
        onClose={() => {
          setShowDeleteLink(false)
          setLinkToDelete(null)
        }}
        link={linkToDelete}
      />
    </>
  )
}

