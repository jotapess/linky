'use client'

import { useEffect } from 'react'

interface NewLinkIndicatorProps {
  links: Array<{ text: string; url: string }>
}

export function NewLinkIndicator({ links }: NewLinkIndicatorProps) {
  useEffect(() => {
    // Get new links from sessionStorage
    try {
      const newLinksStr = sessionStorage.getItem('linky:newLinks')
      if (!newLinksStr) return
      
      const newLinkIds = JSON.parse(newLinksStr) as string[]
      if (!Array.isArray(newLinkIds) || newLinkIds.length === 0) return
      
      // Find all links in the DOM and add emoji if they match
      const allLinks = document.querySelectorAll('.content a[href]')
      
      allLinks.forEach((linkElement) => {
        const href = linkElement.getAttribute('href')
        const linkText = linkElement.textContent?.trim() || ''
        
        // Check if this link matches any new link
        const isNewLink = newLinkIds.some((id) => {
          const [url, title] = id.split('|')
          return href === url || linkText === title
        })
        
        if (isNewLink && !linkElement.querySelector('.new-link-indicator')) {
          // Add emoji indicator
          const indicator = document.createElement('span')
          indicator.className = 'new-link-indicator'
          indicator.textContent = ' ✨'
          indicator.setAttribute('aria-label', 'New link')
          linkElement.appendChild(indicator)
        }
      })
    } catch (e) {
      // Ignore errors
    }
  }, [links])

  return null
}

