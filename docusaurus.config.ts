import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'curious dev Blog',
  tagline: 'Exploring the art and science of software development',
  favicon: 'img/favicon.ico',

  url: 'https://blog.curiousdev.io',
  baseUrl: '/',

  organizationName: 'curiousdev',
  projectName: 'blog.curiousdev.io',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

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
            copyright: `Copyright © ${new Date().getFullYear()} curious dev Blog.`,
            createFeedItems: async (params) => {
              const {blogPosts, defaultCreateFeedItems, ...rest} = params;
              return defaultCreateFeedItems({
                blogPosts: blogPosts.filter((item, index) => index < 10),
                ...rest,
              });
            },
          },
          editUrl: 'https://github.com/curiousdev/blog.curiousdev.io/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    navbar: {
      title: 'curious dev',
      logo: {
        alt: 'curious dev Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          href: 'https://github.com/curiousdev/blog.curiousdev.io',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/curiousdev',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/curiousdev',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} curious dev Blog. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'diff', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
