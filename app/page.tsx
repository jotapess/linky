import { remark } from 'remark'
import remarkHtml from 'remark-html'
// @ts-ignore - remark-slug doesn't have types
import remarkSlug from 'remark-slug'
import { Octokit } from '@octokit/rest'
import { CommandPalette } from './command-palette'

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  
  let fileContents = '# Useful Links\n\n'
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
    }
  } catch (error: any) {
    // If GitHub read fails, use default empty content
    errorMessage = error.message || String(error)
    debugInfo.error = errorMessage
    debugInfo.errorStatus = error.status
    debugInfo.errorStack = error.stack
    console.error('Failed to read links.md from GitHub:', debugInfo)
    fileContents = '# Useful Links\n\n'
  }
  
  // First pass: extract categories and links
  const categories: Category[] = []
  const links: Link[] = []
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
  
  return {
    html: processedContent.toString(),
    categories,
    links,
    error: errorMessage || undefined,
    debug: debugInfo,
  }
}

export default async function Home() {
  try {
    const { html: htmlContent, categories, links, error, debug } = await getLinks()

    return (
      <>
        <CommandPalette links={links} categories={categories} />
        <div className="page-wrapper">
          <main className="container">
            {/* Always show debug info */}
            <div style={{ 
              background: error ? '#fff3cd' : '#d1ecf1', 
              border: `1px solid ${error ? '#ffc107' : '#bee5eb'}`, 
              padding: '1rem', 
              borderRadius: '4px',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: '#000'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {error ? '⚠️ Error Loading from GitHub' : '🔍 Debug Info'}
              </div>
              {error ? (
                <div>
                  <div><strong>Error:</strong> {error}</div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    Showing default content. Check Vercel environment variables.
                  </div>
                </div>
              ) : null}
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>View Debug Details</summary>
                <pre style={{ 
                  background: 'rgba(0,0,0,0.05)', 
                  padding: '0.5rem', 
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: '300px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            </div>
            <div 
              className="content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            {htmlContent.trim() === '<h1>Useful Links</h1>' && (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#666',
                border: '2px dashed #ddd',
                borderRadius: '8px',
                marginTop: '2rem'
              }}>
                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📝 No links found</p>
                <p>Content is empty. Check if links.md exists in your GitHub repository.</p>
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
  } catch (error: any) {
    console.error('Error rendering page:', error)
    return (
      <div className="page-wrapper">
        <main className="container">
          <div className="content">
            <h1 style={{ color: '#d32f2f' }}>❌ Error Loading Page</h1>
            <p>Failed to load links. Please check the console for details.</p>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '1rem', 
              borderRadius: '4px', 
              overflow: 'auto',
              border: '1px solid #ddd'
            }}>
              {error.message || String(error)}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </div>
        </main>
      </div>
    )
  }
}

