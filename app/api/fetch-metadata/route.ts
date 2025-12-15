import { NextRequest, NextResponse } from 'next/server'

// Category matching rules
const categoryRules: { [key: string]: string[] } = {
  'Development Tools': ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'dev.to', 'gitingest.com', 'npmjs.com', 'yarnpkg.com'],
  'Documentation': ['docs.', 'documentation', 'mdn', 'developer.mozilla.org', 'nextjs.org/docs', 'react.dev', 'vuejs.org', 'angular.io'],
  'Hosting & Deployment': ['vercel.com', 'netlify.com', 'heroku.com', 'aws.amazon.com', 'cloud.google.com', 'azure.com', 'railway.app', 'render.com'],
  'Design': ['dribbble.com', 'behance.net', 'figma.com', 'adobe.com', 'canva.com', 'sketch.com'],
  'Learning': ['coursera.org', 'udemy.com', 'khanacademy.org', 'freecodecamp.org', 'codecademy.com', 'pluralsight.com'],
  'Tools': ['tool', 'utility', 'generator', 'converter'],
}

function suggestCategory(url: string, title: string, description: string): string | null {
  const urlLower = url.toLowerCase()
  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()
  const combined = `${urlLower} ${titleLower} ${descLower}`
  
  // Check domain-based rules
  for (const [category, keywords] of Object.entries(categoryRules)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return category
      }
    }
  }
  
  // Check for common patterns
  if (combined.includes('tutorial') || combined.includes('learn') || combined.includes('course') || combined.includes('training')) {
    return 'Learning'
  }
  
  if (combined.includes('design') || combined.includes('ui') || combined.includes('ux') || combined.includes('mockup')) {
    return 'Design'
  }
  
  if (combined.includes('api') || combined.includes('documentation') || combined.includes('docs') || combined.includes('reference')) {
    return 'Documentation'
  }
  
  if (combined.includes('hosting') || combined.includes('deploy') || combined.includes('server') || combined.includes('cloud')) {
    return 'Hosting & Deployment'
  }
  
  if (combined.includes('tool') || combined.includes('utility') || combined.includes('generator') || combined.includes('helper')) {
    return 'Development Tools'
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkyBot/1.0)',
      },
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      )
    }
    
    const html = await response.text()
    
    // Extract metadata using regex
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i)
    
    const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+name="twitter:description"\s+content="([^"]+)"/i)
    
    const title = titleMatch 
      ? titleMatch[1].trim().replace(/\s+/g, ' ').substring(0, 100)
      : new URL(url).hostname.replace('www.', '')
    
    const description = descriptionMatch 
      ? descriptionMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200)
      : 'No description available'
    
    // Suggest category
    const suggestedCategory = suggestCategory(url, title, description)
    
    return NextResponse.json({
      title,
      description,
      url,
      suggestedCategory,
    })
  } catch (error: any) {
    console.error('Error fetching metadata:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metadata' },
      { status: 500 }
    )
  }
}

