import { NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

export const dynamic = 'force-dynamic'

export async function GET() {
  const repoOwner = process.env.GITHUB_REPO_OWNER || 
                   process.env.VERCEL_GIT_REPO_OWNER ||
                   'jotapess'
  const repoName = process.env.GITHUB_REPO_NAME || 
                  (process.env.VERCEL_GIT_REPO_SLUG?.includes('/') 
                    ? process.env.VERCEL_GIT_REPO_SLUG.split('/')[1]
                    : process.env.VERCEL_GIT_REPO_SLUG) ||
                  'linky'
  
  const debug: any = {
    repoOwner,
    repoName,
    hasToken: !!process.env.GITHUB_TOKEN,
    envVars: {
      GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
      VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER,
      GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
      VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ? '***SET***' : undefined,
    }
  }
  
  try {
    const octokit = new Octokit({ 
      auth: process.env.GITHUB_TOKEN || undefined
    })
    
    debug.githubCallStarted = true
    
    const response = await octokit.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: 'links.md',
    })
    
    debug.githubResponseReceived = true
    debug.responseDataType = typeof response.data
    debug.hasContent = 'content' in response.data
    
    if ('content' in response.data) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      debug.contentLength = content.length
      debug.contentPreview = content.substring(0, 200)
      debug.success = true
      
      return NextResponse.json({
        success: true,
        message: 'Successfully read from GitHub',
        debug,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
      })
    } else {
      debug.error = 'Response does not contain content'
      return NextResponse.json({
        success: false,
        error: 'Response does not contain content',
        debug,
      }, { status: 500 })
    }
  } catch (error: any) {
    debug.error = error.message || String(error)
    debug.errorStatus = error.status
    debug.errorCode = error.code
    
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      status: error.status,
      debug,
    }, { status: error.status || 500 })
  }
}

