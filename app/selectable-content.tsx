'use client'

import { useEffect } from 'react'
import { useDeleteMode } from './delete-mode-context'

interface Link {
  text: string
  url: string
  category?: string
}

interface SelectableContentProps {
  links: Link[]
}

export function SelectableContent({ links }: SelectableContentProps) {
  const { isDeleteMode, selectedLinks, toggleLink } = useDeleteMode()

  useEffect(() => {
    if (!isDeleteMode) {
      // Remove any checkboxes when exiting delete mode
      document.querySelectorAll('.link-checkbox-wrapper').forEach(el => el.remove())
      document.querySelectorAll('.link-selected').forEach(el => el.classList.remove('link-selected'))
      return
    }

    // Find all links in the content and add checkboxes
    const contentLinks = document.querySelectorAll('.content a[href]')
    
    contentLinks.forEach((linkElement) => {
      const href = linkElement.getAttribute('href')
      const linkText = linkElement.textContent?.replace(' ✨', '').trim() || ''
      const linkId = `${href}|${linkText}`
      
      // Check if this link is in our links array
      const isTrackedLink = links.some(l => l.url === href || l.text === linkText)
      if (!isTrackedLink) return
      
      // Check if checkbox already exists
      if (linkElement.previousElementSibling?.classList.contains('link-checkbox-wrapper')) {
        // Update checkbox state
        const checkbox = linkElement.previousElementSibling.querySelector('input') as HTMLInputElement
        if (checkbox) {
          checkbox.checked = selectedLinks.has(linkId)
        }
        // Update selected class
        const parentP = linkElement.closest('p')
        if (parentP) {
          if (selectedLinks.has(linkId)) {
            parentP.classList.add('link-selected')
          } else {
            parentP.classList.remove('link-selected')
          }
        }
        return
      }
      
      // Create checkbox wrapper
      const wrapper = document.createElement('span')
      wrapper.className = 'link-checkbox-wrapper'
      
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'link-checkbox'
      checkbox.checked = selectedLinks.has(linkId)
      checkbox.addEventListener('change', (e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleLink(linkId)
      })
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation()
      })
      
      wrapper.appendChild(checkbox)
      
      // Insert before the link
      linkElement.parentNode?.insertBefore(wrapper, linkElement)
      
      // Add selected class to parent p
      const parentP = linkElement.closest('p')
      if (parentP && selectedLinks.has(linkId)) {
        parentP.classList.add('link-selected')
      }
    })
  }, [isDeleteMode, selectedLinks, links, toggleLink])

  // Prevent link navigation when in delete mode
  useEffect(() => {
    if (!isDeleteMode) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('.content a[href]')
      if (link) {
        e.preventDefault()
        const href = link.getAttribute('href')
        const linkText = link.textContent?.replace(' ✨', '').trim() || ''
        const linkId = `${href}|${linkText}`
        toggleLink(linkId)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isDeleteMode, toggleLink])

  return null
}

