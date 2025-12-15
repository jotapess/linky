import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

export async function POST(request: NextRequest) {
  const runId = `run_${Date.now()}`
  try {
    const { url, title, description, category } = await request.json()
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:8',message:'Request received',data:{url,title,category,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    
    if (!url || !title) {
      return NextResponse.json(
        { error: 'URL and title are required' },
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
    // Try Vercel env vars first, then custom env vars, then defaults
    const repoOwner = process.env.GITHUB_REPO_OWNER || 
                     process.env.VERCEL_GIT_REPO_OWNER ||
                     process.env.GITHUB_OWNER ||
                     'jotapess' // Default repository owner
    
    const repoName = process.env.GITHUB_REPO_NAME || 
                    (process.env.VERCEL_GIT_REPO_SLUG?.includes('/') 
                      ? process.env.VERCEL_GIT_REPO_SLUG.split('/')[1]
                      : process.env.VERCEL_GIT_REPO_SLUG) ||
                    process.env.GITHUB_REPO ||
                    'linky' // Default repository name
    
    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'GitHub repository not configured. Please set GITHUB_REPO_OWNER and GITHUB_REPO_NAME in your environment variables.' },
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
        sha = fileData.sha // Always get SHA for updates
        const githubContent = Buffer.from(fileData.content, 'base64').toString('utf-8')
        
        // #region agent log
        await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:70',message:'GitHub content read (source of truth)',data:{githubContentLength:githubContent.length,githubContentPreview:githubContent.substring(0,200),runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Check for corruption: detect duplicate links (same URL appears multiple times)
        const linkMatches = githubContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
        const urls = linkMatches.map(m => {
          const urlMatch = m.match(/\(([^)]+)\)/)
          return urlMatch ? urlMatch[1] : ''
        })
        const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index)
        const hasCorruption = duplicateUrls.length > 0
        
        // #region agent log
        await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:94',message:'Corruption check',data:{hasCorruption,duplicateUrls:duplicateUrls.slice(0,5),totalLinks:linkMatches.length,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // GitHub is source of truth - use GitHub content
        // If corrupted, deduplicate and write cleaned content back first
        if (hasCorruption) {
          // #region agent log
          await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:108',message:'Deduplicating corrupted GitHub content',data:{runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Deduplicate: remove duplicate links by URL
          const lines = githubContent.split('\n')
          const seenUrls = new Set<string>()
          const cleanedLines: string[] = []
          let skipNext = false
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const urlMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/)
            
            if (urlMatch) {
              const url = urlMatch[2]
              if (seenUrls.has(url)) {
                // Skip this duplicate link and its description line
                skipNext = true
                continue
              }
              seenUrls.add(url)
              skipNext = false
            } else if (skipNext && line.trim() !== '' && !line.startsWith('##')) {
              // Skip description line for duplicate
              continue
            } else {
              skipNext = false
            }
            
            cleanedLines.push(line)
          }
          
          const cleanedContent = cleanedLines.join('\n')
          
          // Write cleaned content back to GitHub first (fix corruption)
          try {
            const defaultBranch = 'main'
            await octokit.repos.createOrUpdateFileContents({
              owner: repoOwner,
              repo: repoName,
              path: 'links.md',
              message: 'Fix: Remove duplicate links',
              content: Buffer.from(cleanedContent).toString('base64'),
              sha: sha,
              branch: defaultBranch,
            })
            
            // Get updated SHA after cleaning
            const updatedResponse = await octokit.repos.getContent({
              owner: repoOwner,
              repo: repoName,
              path: 'links.md',
            })
            if ('sha' in updatedResponse.data) {
              sha = updatedResponse.data.sha
            }
            
            // #region agent log
            await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:148',message:'Corruption fixed in GitHub, updated SHA',data:{newSha:sha,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
          } catch (cleanError: any) {
            // #region agent log
            await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:152',message:'Failed to fix corruption in GitHub',data:{error:String(cleanError),runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Continue with cleaned content anyway
          }
          
          currentContent = cleanedContent
          // #region agent log
          await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:157',message:'Deduplication complete, using cleaned content',data:{originalLength:githubContent.length,cleanedLength:currentContent.length,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        } else {
          currentContent = githubContent
        }
        
        // #region agent log
        await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:130',message:'Using GitHub content (source of truth)',data:{hasCorruption,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } catch (error: any) {
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:88',message:'GitHub read error',data:{errorStatus:error.status,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (error.status === 404) {
        // File doesn't exist in GitHub - start fresh
        currentContent = '# Useful Links\n\n'
        sha = undefined
      } else {
        // Other error - throw it
        throw error
      }
    }
    
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:131',message:'Content source finalized',data:{currentContentLength:currentContent.length,currentContentPreview:currentContent.substring(0,200),sha:sha||'undefined',runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Parse and add new link
    const lines = currentContent.split('\n')
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:129',message:'Before insertion logic',data:{currentContentLength:currentContent.length,linesCount:lines.length,linesPreview:lines.slice(0,10).join('|'),category,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    let newContent = ''
    let categoryFound = false
    let insertIndex = -1

    // Find where to insert the link
    if (category) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ') && lines[i].includes(category)) {
          categoryFound = true
          // #region agent log
          await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:142',message:'Category found',data:{category,matchedLine:lines[i],lineIndex:i,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          // Find the end of this category section (before next ## heading)
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith('## ')) {
              insertIndex = j
              break
            }
            if (j === lines.length - 1) {
              insertIndex = lines.length
            }
          }
          if (insertIndex === -1) insertIndex = lines.length
          // #region agent log
          await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:157',message:'Insert index calculated',data:{insertIndex,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          break
        }
      }
    }

    // Generate markdown for new link
    const linkMarkdown = `[${title}](${url})\n${description}`

    if (categoryFound && insertIndex !== -1) {
      // Insert into existing category
      // Find the last non-empty line before the next category
      let insertAt = insertIndex - 1
      // Skip trailing empty lines
      while (insertAt > 0 && lines[insertAt].trim() === '') {
        insertAt--
      }
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:170',message:'Before splice',data:{insertAt,insertIndex,linesBeforeSplice:lines.length,linesAroundInsert:lines.slice(Math.max(0,insertAt-2),insertAt+3).join('|'),runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Insert after the last content line, with proper spacing
      lines.splice(insertAt + 1, 0, '', linkMarkdown)
      // #region agent log
      await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:176',message:'After splice',data:{linesAfterSplice:lines.length,linesAroundInsert:lines.slice(Math.max(0,insertAt-2),insertAt+5).join('|'),runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      newContent = lines.join('\n')
    } else if (category) {
      // Add new category section at the end
      const trimmed = currentContent.trim()
      newContent = trimmed + (trimmed.endsWith('\n') ? '' : '\n') + `\n## ${category}\n\n${linkMarkdown}\n`
    } else {
      // Add to end without category
      const trimmed = currentContent.trim()
      newContent = trimmed + (trimmed.endsWith('\n') ? '' : '\n') + `\n\n${linkMarkdown}\n`
    }
    
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:216',message:'New content generated',data:{newContentLength:newContent.length,newContentPreview:newContent.substring(0,300),categoryFound,insertIndex,originalContentLength:currentContent.length,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    
    // Check if newContent has the link we're adding (prevent duplicates)
    const linkUrlInContent = newContent.includes(url)
    // #region agent log
    await fetch('http://127.0.0.1:7243/ingest/f6b0bbdb-af68-4c38-9024-1ff95d3a0602',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-link/route.ts:220',message:'Duplicate check',data:{linkUrlInContent,url,runId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

    // Get default branch
    let defaultBranch = 'main'
    try {
      const repoInfo = await octokit.repos.get({
        owner: repoOwner,
        repo: repoName,
      })
      defaultBranch = repoInfo.data.default_branch
    } catch {
      // Fallback to 'main', try 'master' if main fails
      defaultBranch = 'main'
    }

    // Create commit
    const commitMessage = sha 
      ? `Add link: ${title}`
      : `Create links.md and add link: ${title}`
    
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: repoOwner,
        repo: repoName,
        path: 'links.md',
        message: commitMessage,
        content: Buffer.from(newContent).toString('base64'),
        sha: sha, // undefined if creating new file
        branch: defaultBranch,
      })
      
      // Note: Local file sync removed for Vercel compatibility (serverless functions don't have filesystem access)
      // GitHub is the source of truth, local file sync only works in development
    } catch (error: any) {
      // Handle permission errors specifically
      if (error.status === 403 || error.message?.includes('Resource not accessible')) {
        return NextResponse.json(
          { 
            error: 'Permission denied. Please check that your GitHub token has "Contents: Read and write" permission for this repository. For fine-grained PATs, make sure the repository is included in the token\'s repository access.',
            details: error.message
          },
          { status: 403 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Link added successfully',
    })
  } catch (error: any) {
    console.error('GitHub API error:', error)
    
    // Provide more helpful error messages
    if (error.status === 403) {
      return NextResponse.json(
        { 
          error: 'Permission denied. Your GitHub token needs "Contents: Read and write" permission. Please check your token settings.',
          details: error.message
        },
        { status: 403 }
      )
    }
    
    if (error.status === 404) {
      const repoOwner = process.env.GITHUB_REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || 'jotapess'
      const repoName = process.env.GITHUB_REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG?.split('/')[1] || 'linky'
      return NextResponse.json(
        { 
          error: `Repository not found. Please verify that the repository "${repoOwner}/${repoName}" exists and your token has access to it.`,
          details: error.message
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to add link to GitHub',
        details: error.response?.data?.message || error.message
      },
      { status: error.status || 500 }
    )
  }
}

