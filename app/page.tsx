import { remark } from 'remark'
import remarkHtml from 'remark-html'
// @ts-ignore - remark-slug doesn't have types
import remarkSlug from 'remark-slug'
import { Octokit } from '@octokit/rest'
import { CommandPalette } from './command-palette'

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SHOW_DEBUG =
  process.env.NODE_ENV !== 'production' ||
  process.env.LINKY_SHOW_DEBUG === '1'

interface Category {
  id: string
  title: string
}

interface Link {
  text: string
  url: string
  category?: string
}

async function getLinks() {
  // Read from GitHub (source of truth)
  const repoOwner = process.env.GITHUB_REPO_OWNER || 
                   process.env.VERCEL_GIT_REPO_OWNER ||
                   'jotapess'
  const repoName = process.env.GITHUB_REPO_NAME || 
                  (process.env.VERCEL_GIT_REPO_SLUG?.includes('/') 
                    ? process.env.VERCEL_GIT_REPO_SLUG.split('/')[1]
                    : process.env.VERCEL_GIT_REPO_SLUG) ||
                  'linky'
  
  // Default fallback content - always ensure we have something to render
  const defaultContent = '# Useful Links\n\n## Getting Started\n\nThis page loads links from GitHub. If you see this message, the GitHub API may be temporarily unavailable.\n\n'
  let fileContents = defaultContent
  let errorMessage = ''
  let debugInfo: any = {
    repoOwner,
    repoName,
    hasToken: !!process.env.GITHUB_TOKEN,
    envVars: {
      GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
      VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER,
      GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
      VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
    }
  }
  
  try {
    // Try to read from GitHub (works for public repos without token)
    const octokit = new Octokit({ 
      auth: process.env.GITHUB_TOKEN || undefined // Optional - works without for public repos
    })
    
    debugInfo.githubCallStarted = true
    
    const response = await octokit.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: 'links.md',
    })
    
    debugInfo.githubResponseReceived = true
    debugInfo.responseDataType = response.data && typeof response.data === 'object' ? 'object' : typeof response.data
    debugInfo.hasContent = 'content' in response.data
    
    if ('content' in response.data) {
      fileContents = Buffer.from(response.data.content, 'base64').toString('utf-8')
      debugInfo.contentLength = fileContents.length
      debugInfo.contentPreview = fileContents.substring(0, 100)
    } else {
      errorMessage = 'GitHub response does not contain content'
      debugInfo.error = errorMessage
      // Keep default content
    }
  } catch (error: any) {
    // If GitHub read fails, use default content - never throw, always return something
    errorMessage = error.message || String(error)
    debugInfo.error = errorMessage
    debugInfo.errorStatus = error.status
    debugInfo.errorCode = error.code
    console.error('Failed to read links.md from GitHub:', {
      error: errorMessage,
      status: error.status,
      repo: `${repoOwner}/${repoName}`,
      hasToken: !!process.env.GITHUB_TOKEN
    })
    // Keep default content - page will still render
  }
  
  // Parse markdown - wrap in try-catch to ensure we always return valid data
  let categories: Category[] = []
  let links: Link[] = []
  let html = '<h1>Useful Links</h1>'
  
  try {
    // First pass: extract categories and links
    const ast = remark().parse(fileContents)
    
    let currentCategory = ''
    let previousLink: Link | null = null
    
    if (ast.children) {
      for (let i = 0; i < ast.children.length; i++) {
        const node = ast.children[i]
        
        if (node.type === 'heading' && node.depth === 2 && node.children) {
          const title = node.children
            .map((child: any) => (child.type === 'text' ? child.value : ''))
            .join('')
          const id = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          categories.push({ id, title })
          currentCategory = title
        }
        
        if (node.type === 'paragraph' && node.children) {
          // Check if this paragraph contains a link
          const linkNode = node.children.find((child: any) => child.type === 'link') as any
          
          if (linkNode && linkNode.children) {
            const text = linkNode.children
              .map((c: any) => (c.type === 'text' ? c.value : ''))
              .join('')
            const url = linkNode.url || ''
            
            if (text && url) {
              previousLink = {
                text,
                url,
                category: currentCategory || undefined,
              }
              links.push(previousLink)
            }
          } else if (previousLink && node.children[0]?.type === 'text') {
            // If previous node was a link and this is a description, skip it
            // (descriptions are already handled)
            previousLink = null
          }
        }
      }
    }
    
    // Second pass: process markdown with slug plugin
    const processedContent = await remark()
      // @ts-ignore - remark-slug has type conflicts with remark versions
      .use(remarkSlug)
      .use(remarkHtml)
      .process(fileContents)
    
    html = processedContent.toString()
  } catch (parseError: any) {
    // If markdown parsing fails, still return valid structure
    console.error('Failed to parse markdown:', parseError)
    html = '<h1>Useful Links</h1><p>Error parsing content. Please check the markdown format.</p>'
    errorMessage = errorMessage || `Parse error: ${parseError.message}`
  }
  
  // Always return valid data structure - never throw
  return {
    html,
    categories,
    links,
    error: errorMessage || undefined,
    debug: debugInfo,
  }
}

export default async function Home() {
  const renderTime = new Date().toISOString()
  
  // Always render the page - getLinks() never throws, always returns valid data
  let result
  try {
    result = await getLinks()
  } catch (error: any) {
    // Fallback if getLinks somehow throws (shouldn't happen, but be safe)
    console.error('Unexpected error in getLinks:', error)
    result = {
      html: '<h1>Useful Links</h1><p>An unexpected error occurred. Please try again later.</p>',
      categories: [],
      links: [],
      error: `Unexpected error: ${error.message || String(error)}`,
      debug: {
        unexpectedError: true,
        error: error.message || String(error)
      }
    }
  }
  
  const { html: htmlContent, categories, links, error, debug } = result

  return (
    <>
      <CommandPalette links={links} categories={categories} />
      <div className="page-wrapper">
        <main className="container">
          {/* Only show debug in non-prod, when explicitly enabled, or when there's an error */}
          {(SHOW_DEBUG || !!error) && (
            <div style={{ 
              background: error ? '#fff3cd' : '#d1ecf1', 
              border: `2px solid ${error ? '#ffc107' : '#17a2b8'}`, 
              padding: '1rem', 
              borderRadius: '4px',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: '#000',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1rem' }}>
                {error ? '⚠️ Error Loading from GitHub' : '✅ Debug Info'}
                <span style={{ marginLeft: '1rem', fontSize: '0.8rem', fontWeight: 'normal', color: '#666' }}>
                  Rendered: {renderTime}
                </span>
              </div>
              {error ? (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div><strong>Error:</strong> {error}</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Showing fallback content. The page is still functional - you can add links via the command palette.
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <a href="/api/test-github" target="_blank" style={{ color: '#007bff' }}>
                      Test GitHub API connection
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div>✅ Successfully loaded {categories.length} categories and {links.length} links</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Content length: {debug?.contentLength || 0} chars
                  </div>
                </div>
              )}
              <details open style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  View Debug Details
                </summary>
                <pre style={{ 
                  background: 'rgba(0,0,0,0.05)', 
                  padding: '0.75rem', 
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: '400px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid rgba(0,0,0,0.1)'
                }}>
                  {JSON.stringify({ ...debug, renderTime }, null, 2)}
                </pre>
              </details>
            </div>
          )}
          <div 
            className="content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
          {categories.length === 0 && links.length === 0 && !error && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#666',
              border: '2px dashed #ddd',
              borderRadius: '8px',
              marginTop: '2rem',
              background: '#f9f9f9'
            }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📝 No links found</p>
              <p>Content is empty. Check if links.md exists in your GitHub repository.</p>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <a href="/api/test-github" target="_blank" style={{ color: '#007bff' }}>
                  Test GitHub API connection
                </a>
              </p>
            </div>
          )}
        </main>
        {categories.length > 0 && (
          <nav className="navigation">
            <div className="nav-title">On this page</div>
            <ul className="nav-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <a href={`#${category.id}`} className="nav-link">
                    {category.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  )
}

