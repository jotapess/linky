'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface Link {
  text: string
  url: string
  category?: string
}

interface DeleteModeContextType {
  isDeleteMode: boolean
  selectedLinks: Set<string>
  enterDeleteMode: () => void
  exitDeleteMode: () => void
  toggleLink: (linkId: string) => void
  selectAll: (links: Link[]) => void
  deselectAll: () => void
  getSelectedCount: () => number
}

const DeleteModeContext = createContext<DeleteModeContextType | undefined>(undefined)

export function DeleteModeProvider({ children }: { children: React.ReactNode }) {
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())

  const enterDeleteMode = useCallback(() => {
    setIsDeleteMode(true)
    setSelectedLinks(new Set())
  }, [])

  const exitDeleteMode = useCallback(() => {
    setIsDeleteMode(false)
    setSelectedLinks(new Set())
  }, [])

  const toggleLink = useCallback((linkId: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(linkId)) {
        newSet.delete(linkId)
      } else {
        newSet.add(linkId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((links: Link[]) => {
    const allIds = new Set(links.map(link => `${link.url}|${link.text}`))
    setSelectedLinks(allIds)
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedLinks(new Set())
  }, [])

  const getSelectedCount = useCallback(() => {
    return selectedLinks.size
  }, [selectedLinks])

  return (
    <DeleteModeContext.Provider value={{
      isDeleteMode,
      selectedLinks,
      enterDeleteMode,
      exitDeleteMode,
      toggleLink,
      selectAll,
      deselectAll,
      getSelectedCount,
    }}>
      {children}
    </DeleteModeContext.Provider>
  )
}

export function useDeleteMode() {
  const context = useContext(DeleteModeContext)
  if (context === undefined) {
    throw new Error('useDeleteMode must be used within a DeleteModeProvider')
  }
  return context
}

