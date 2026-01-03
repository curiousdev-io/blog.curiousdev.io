import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'curious dev Blog',
  tagline: 'Pulling on the threads that interest me',
  favicon: 'img/favicon.ico',

  // GitHub Pages deployment configuration
  url: 'https://blog.curiousdev.io', // Replace 'curiousdev' with your GitHub username
  baseUrl: '/', // Replace with your repository name

  // GitHub Pages deployment settings
  organizationName: 'curiousdev-io', // Replace with your GitHub username/org
  projectName: 'blog.curiousdev.io', // Replace with your repository name
  deploymentBranch: 'gh-pages', // The branch to deploy to
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: false, // Disable docs, we want blog-only
        blog: {
          routeBasePath: '/', // Serve the blog at the site's root
          showReadingTime: true,
          feedOptions: {
            type: 'all',
            copyright: `Copyright © ${new Date().getFullYear()} Curious Dev Blog.`,
            createFeedItems: async (params) => {
              const { blogPosts, defaultCreateFeedItems, ...rest } = params;
              return defaultCreateFeedItems({
                blogPosts: blogPosts.filter((item, index) => index < 10),
                ...rest,
              });
            },
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: 'G-SCLXTFK4J9',
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/banner.png',
    navbar: {
      title: 'Curious Dev',
      logo: {
        alt: 'Curious Dev Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          to: '/about',
          label: 'About Me',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Links',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/curiousdev-io',
            },
            {
              label: 'LinkedIn',
              href: 'https://www.linkedin.com/in/mcnamarabrian/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Curious Dev Blog. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'diff', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
