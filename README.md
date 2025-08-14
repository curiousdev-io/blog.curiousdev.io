# curiousdev.io Blog

A technical blog exploring software development and other things that interest me.

## Quick Start

### Prerequisites

- [mise](https://mise.jdx.dev/) installed

- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/curiousdev-io/blog.curiousdev.io.git
   cd blog.curiousdev.io
   ```

2. Install tools and dependencies:
   ```bash
   mise install
   npm install
   ```

3. Install pre-commit hooks:
   ```bash
   pip install pre-commit
   pre-commit install
   ```

4. Start the development server:
   ```bash
   mise run dev
   # or
   npm start
   ```

## Available Commands

Using mise:
- `mise run dev` - Start development server
- `mise run build` - Build for production
- `mise run serve` - Serve production build locally
- `mise run lint` - Run ESLint
- `mise run spell` - Check spelling
- `mise run links` - Check markdown links
- `mise run pre-commit` - Run all pre-commit hooks

## Project Structure

```
blog.curiousdev.io/
├── blog/                  # Blog posts
├── src/
│   ├── components/        # React components
│   ├── css/              # Custom styles
│   └── pages/            # Custom pages
├── static/               # Static assets
├── .mise.toml           # Mise configuration
├── docusaurus.config.ts  # Docusaurus config
└── package.json         # Dependencies
```

## Writing Blog Posts

Create new blog posts in the `blog/` directory with the following frontmatter:

```markdown
---
slug: post-slug
title: Post Title
authors: [curiousdev]
tags: [tag1, tag2]
date: 2024-01-15
---

Your content here...

<!--truncate-->

More content after the fold...
```

## Pre-commit Hooks

This project includes several pre-commit hooks:
- **Spell checking** with cspell
- **Link checking** for markdown files
- **Code linting** with ESLint
- **Code formatting** with Prettier
- **Basic file checks** (trailing whitespace, etc.)

## Deployment

The blog can be deployed to various platforms:
- **GitHub Pages**: Use `npm run deploy`
- **Netlify**: Connect your repository and build with `npm run build`
- **Vercel**: Import your repository and deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all pre-commit hooks pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
