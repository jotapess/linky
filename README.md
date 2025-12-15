# Linky - Simple Link Catalog

A super simple, no-frills, one-page website for cataloging useful links found on the internet.

## Features

- Markdown-based link storage
- Clean, minimal design
- Responsive layout
- Dark mode support
- Command+K command palette for quick navigation
- **Automatic link addition** - Add links directly from the UI with auto-generated descriptions
- **Delete links** - Remove links directly from the UI
- Easy to update via GitHub

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the root directory:
```bash
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO_OWNER=jotapess
GITHUB_REPO_NAME=linky
```

**Note:** The repository owner (`jotapess`) and name (`linky`) are already configured as defaults in the code, but you can override them with environment variables if needed.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Adding Links

### Method 1: Via UI (Recommended)

**Adding Links:**
1. Press **Cmd+K** (or **Ctrl+K** on Windows/Linux) to open the command palette
2. Select "Add New Link"
3. Enter the URL and click "Fetch Metadata" (automatically extracts title and description)
4. Select a category (optional) or create a new one
5. Click "Add Link" - it will automatically commit to your GitHub repository

**Deleting Links:**
1. Press **Cmd+K** to open the command palette
2. Go to the "Delete Links" section
3. Select the link you want to delete
4. Confirm deletion in the modal
5. The link will be removed from your GitHub repository

### Method 2: Via GitHub
Simply edit `links.md` in the root directory. Use standard markdown link format:

```markdown
## Category Name

[Link Description](https://example.com)
Description text here
```

## GitHub Token Setup

To enable automatic link addition, you need a GitHub Personal Access Token:

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Linky App")
4. Select the `repo` scope (full control of private repositories)
5. Generate and copy the token
6. Add it to your `.env.local` file as `GITHUB_TOKEN`

**For Vercel Deployment:**
- Add `GITHUB_TOKEN` as an environment variable in your Vercel project settings
- `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are usually auto-detected, but you can set them manually if needed

## Keyboard Shortcuts

- **Cmd+K** / **Ctrl+K** - Open command palette
- **Escape** - Close command palette or modal

## Deployment

This project is configured for Vercel deployment. Simply connect your GitHub repository to Vercel, and it will automatically deploy on every push to the main branch.

**Important:** Make sure to add your `GITHUB_TOKEN` environment variable in Vercel's dashboard for the automatic link addition feature to work.

## Project Structure

- `links.md` - Your links file (edit this to add new links manually)
- `app/page.tsx` - Main page component that renders the markdown
- `app/layout.tsx` - Root layout component
- `app/command-palette.tsx` - Command+K palette component
- `app/add-link-modal.tsx` - Modal for adding new links
- `app/delete-link-modal.tsx` - Modal for deleting links
- `app/api/fetch-metadata/route.ts` - API route for fetching URL metadata
- `app/api/github/add-link/route.ts` - API route for adding links to GitHub
- `app/api/github/delete-link/route.ts` - API route for deleting links from GitHub
- `app/globals.css` - Global styles

