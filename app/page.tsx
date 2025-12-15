import { remark } from 'remark'
import remarkHtml from 'remark-html'
// @ts-ignore - remark-slug doesn't have types
import remarkSlug from 'remark-slug'
import { Octokit } from '@octokit/rest'
import { CommandPalette } from './command-palette'

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
  
  try {
    // Try to read from GitHub (works for public repos without token)
    const octokit = new Octokit({ 
      auth: process.env.GITHUB_TOKEN // Optional - works without for public repos
    })
    
    const response = await octokit.repos.getContent({
      owner: repoOwner,
      repo: repoName,
      path: 'links.md',
    })
    
    if ('content' in response.data) {
      fileContents = Buffer.from(response.data.content, 'base64').toString('utf-8')
    }
  } catch (error) {
    // If GitHub read fails, use default empty content
    console.error('Failed to read links.md from GitHub:', error)
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
  }
}

export default async function Home() {
  const { html: htmlContent, categories, links } = await getLinks()

  return (
    <>
      <CommandPalette links={links} categories={categories} />
      <div className="page-wrapper">
        <main className="container">
          <div 
            className="content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
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

