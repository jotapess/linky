import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

export async function POST(request: NextRequest) {
  try {
    const { links } = await request.json()
    
    if (!links || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json(
        { error: 'Links array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Get GitHub token from environment variable
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured. Please set GITHUB_TOKEN in your environment variables.' },
        { status: 500 }
      )
    }

    // Get repo info from environment variables
    const repoOwner = process.env.GITHUB_REPO_OWNER || 
                     process.env.VERCEL_GIT_REPO_OWNER ||
                     process.env.GITHUB_OWNER ||
                     'jotapess'
    
    const repoName = process.env.GITHUB_REPO_NAME || 
                    (process.env.VERCEL_GIT_REPO_SLUG?.includes('/') 
                      ? process.env.VERCEL_GIT_REPO_SLUG.split('/')[1]
                      : process.env.VERCEL_GIT_REPO_SLUG) ||
                    process.env.GITHUB_REPO ||
                    'linky'
    
    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'GitHub repository not configured.' },
        { status: 500 }
      )
    }

    const octokit = new Octokit({ auth: githubToken })

    // Get current file content - GitHub is source of truth
    let fileData
    let currentContent = '# Useful Links\n\n'
    let sha: string | undefined = undefined
    
    // GitHub is source of truth - read from GitHub
    try {
      const response = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: 'links.md',
      })
      fileData = response.data
      
      if ('content' in fileData) {
        sha = fileData.sha
        const githubContent = Buffer.from(fileData.content, 'base64').toString('utf-8')
        currentContent = githubContent
      }
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: 'links.md file not found in repository' },
          { status: 404 }
        )
      } else {
        throw error
      }
    }

    // Parse and remove all links
    const lines = currentContent.split('\n')
    const newLines: string[] = []
    let skipNext = false
    const foundLinks: string[] = []
    const deletedCategories = new Set<string>()
    let currentCategory: string | null = null

    // First pass: find and remove all links, track their categories
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Track current category
      if (line.startsWith('## ')) {
        currentCategory = line.replace(/^##\s+/, '').trim()
      }
      
      // Check if this line contains a link we want to delete
      if (line.includes('[') && line.includes('](')) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          const linkTitle = linkMatch[1]
          const linkUrl = linkMatch[2]
          
          // Check if this link matches any in our delete list
          const shouldDelete = links.some((link: { url?: string; title?: string }) => 
            (link.url && linkUrl === link.url) || (link.title && linkTitle === link.title)
          )
          
          if (shouldDelete) {
            foundLinks.push(linkTitle || linkUrl)
            if (currentCategory) {
              deletedCategories.add(currentCategory)
            }
            skipNext = true
            // Skip this line and the next line (description)
            continue
          }
        }
      }
      
      // Skip the description line that follows a deleted link
      if (skipNext && line.trim() !== '' && !line.startsWith('##') && !line.startsWith('[')) {
        skipNext = false
        continue
      }
      
      // Reset skip flag if we hit a blank line or new category
      if (skipNext && (line.trim() === '' || line.startsWith('##'))) {
        skipNext = false
      }
      
      if (!skipNext) {
        newLines.push(line)
      }
    }

    if (foundLinks.length === 0) {
      return NextResponse.json(
        { error: 'No matching links found in the file' },
        { status: 404 }
      )
    }

    // Clean up extra blank lines
    const cleanedLines: string[] = []
    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i]
      const nextLine = newLines[i + 1]
      
      // Don't add multiple consecutive blank lines
      if (line.trim() === '' && nextLine?.trim() === '') {
        continue
      }
      
      cleanedLines.push(line)
    }

    // Second pass: Remove empty categories
    let finalContent = cleanedLines.join('\n')
    const removedCategories: string[] = []
    
    if (deletedCategories.size > 0) {
      const finalLines: string[] = []
      const categoriesToCheck = new Set(deletedCategories)
      let currentCategory: string | null = null
      let categoryStartIndex = -1
      let hasLinksInCategory = false
      let pendingLines: string[] = [] // Store lines until we know if category has links
      
      for (let i = 0; i < cleanedLines.length; i++) {
        const line = cleanedLines[i]
        
        // Check if this is a category heading
        if (line.startsWith('## ')) {
          const categoryName = line.replace(/^##\s+/, '').trim()
          
          // If we were tracking a category and it had no links, skip adding it
          if (currentCategory && categoriesToCheck.has(currentCategory) && !hasLinksInCategory) {
            // Remove trailing blank lines before the category
            while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === '') {
              finalLines.pop()
            }
            removedCategories.push(currentCategory)
            pendingLines = []
          } else if (currentCategory && categoriesToCheck.has(currentCategory) && hasLinksInCategory) {
            // Add pending lines from category that has links
            finalLines.push(...pendingLines)
            pendingLines = []
          }
          
          // Start tracking new category
          currentCategory = categoryName
          categoryStartIndex = i
          hasLinksInCategory = false
          pendingLines = []
          
          // Don't add the category heading yet - wait to see if it has links
          continue
        } else if (currentCategory && categoriesToCheck.has(currentCategory)) {
          // We're in a category we're checking - look for links
          if (line.includes('[') && line.includes('](')) {
            hasLinksInCategory = true
            // Add the category heading now that we know it has links
            if (categoryStartIndex !== -1) {
              finalLines.push(cleanedLines[categoryStartIndex])
              categoryStartIndex = -1
            }
            // Add any pending lines first
            finalLines.push(...pendingLines)
            pendingLines = []
            finalLines.push(line)
          } else {
            // Buffer non-link lines - only add if we find a link later
            if (hasLinksInCategory) {
              // Already have links, add directly
              finalLines.push(line)
            } else {
              // No links yet, buffer these lines
              pendingLines.push(line)
            }
          }
        } else {
          // Not in a category we're checking - add line normally
          if (categoryStartIndex !== -1 && currentCategory) {
            // Add the category heading if we haven't yet
            finalLines.push(cleanedLines[categoryStartIndex])
            categoryStartIndex = -1
          }
          finalLines.push(line)
        }
      }
      
      // Handle case where the last category is empty
      if (currentCategory && categoriesToCheck.has(currentCategory) && !hasLinksInCategory) {
        // Remove trailing blank lines
        while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === '') {
          finalLines.pop()
        }
        removedCategories.push(currentCategory)
      } else if (currentCategory && categoriesToCheck.has(currentCategory) && hasLinksInCategory) {
        // Add remaining pending lines
        finalLines.push(...pendingLines)
      }
      
      // Clean up any trailing blank lines
      while (finalLines.length > 0 && finalLines[finalLines.length - 1].trim() === '') {
        finalLines.pop()
      }
      
      // Ensure we have at least the main heading
      if (finalLines.length === 0 || !finalLines[0].startsWith('# ')) {
        finalLines.unshift('# Useful Links')
      }
      
      finalContent = finalLines.join('\n')
    } else {
      finalContent = cleanedLines.join('\n')
    }

    // Get default branch
    let defaultBranch = 'main'
    try {
      const repoInfo = await octokit.repos.get({
        owner: repoOwner,
        repo: repoName,
      })
      defaultBranch = repoInfo.data.default_branch
    } catch {
      defaultBranch = 'main'
    }

    // Create commit
    const commitMessage = removedCategories.length > 0
      ? `Delete ${foundLinks.length} link(s) (removed ${removedCategories.length} empty categor${removedCategories.length === 1 ? 'y' : 'ies'})`
      : `Delete ${foundLinks.length} link(s)`
    
    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: 'links.md',
      message: commitMessage,
      content: Buffer.from(finalContent).toString('base64'),
      sha: sha,
      branch: defaultBranch,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${foundLinks.length} link(s)`,
      deletedCount: foundLinks.length,
      removedCategories: removedCategories,
    })
  } catch (error: any) {
    console.error('GitHub API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete links from GitHub' },
      { status: error.status || 500 }
    )
  }
}

