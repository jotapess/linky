import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

export async function POST(request: NextRequest) {
  try {
    const { url, title } = await request.json()
    
    if (!url && !title) {
      return NextResponse.json(
        { error: 'URL or title is required' },
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
        // GitHub is source of truth - always use GitHub content
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

    // Parse and remove the link
    const lines = currentContent.split('\n')
    const newLines: string[] = []
    let skipNext = false
    let foundLink = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Check if this line contains the link we want to delete
      if (line.includes('[') && line.includes('](')) {
        const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          const linkTitle = linkMatch[1]
          const linkUrl = linkMatch[2]
          
          // Match by URL or title
          if ((url && linkUrl === url) || (title && linkTitle === title)) {
            foundLink = true
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

    if (!foundLink) {
      return NextResponse.json(
        { error: 'Link not found in the file' },
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

    const newContent = cleanedLines.join('\n')

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
    const commitMessage = `Delete link: ${title || url}`
    
    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: 'links.md',
      message: commitMessage,
      content: Buffer.from(newContent).toString('base64'),
      sha: sha,
      branch: defaultBranch,
    })

    // Note: Local file sync removed for Vercel compatibility (serverless functions don't have filesystem access)
    // GitHub is the source of truth, local file sync only works in development

    return NextResponse.json({
      success: true,
      message: 'Link deleted successfully',
    })
  } catch (error: any) {
    console.error('GitHub API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete link from GitHub' },
      { status: 500 }
    )
  }
}

