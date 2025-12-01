import { createTab, createTabBody } from './tabs';
import { processEmbeds } from './embed';
import { getHintIcon, getHintTitle } from './hints';

interface Block {
  name: string;
  kwargs?: { title?: string; style?: string };
  body?: string;
}

interface ParentBlock {
  blocks?: Block[];
}

interface Page {
  content: string;
}

interface Book {
  renderBlock(type: string, content: string): Promise<string>;
}

interface BlockContext {
  book: Book;
}

/**
 * GitBook Plugin Definition
 * Exports the plugin configuration required by GitBook.
 * - assets: Path to static assets
 * - hooks: Lifecycle hooks (e.g. page:before)
 * - blocks: Custom blocks (tabs, hints)
 */
module.exports = {
  book: {
    assets: './assets',
    css: ['tabs.css', 'embed.css', 'hints.css'],
    js: ['tabs.js'],
  },

  hooks: {
    'page:before': function (page: Page): Page {
      page.content = processEmbeds(page.content);
      return page;
    },
  },

  blocks: {
    tabs: {
      blocks: ['tab', 'endtab'],
      process: async function (this: BlockContext, parentBlock: ParentBlock): Promise<string> {
        const blocks = (parentBlock.blocks || []).filter((block) => block.name === 'tab');

        const tabsHeader = blocks.map((block, i) => createTab(block, i, i === 0)).join('');
        const tabsContentPromises = blocks.map((block, i) => createTabBody(this.book, block, i, i === 0));
        const tabsContent = (await Promise.all(tabsContentPromises)).join('');

        return `
          <div class="tabs-container">
            <div class="tabs-header">${tabsHeader}</div>
            <div class="tabs-body">${tabsContent}</div>
          </div>
        `.trim();
      },
    },

    hint: {
      blocks: ['endhint'],
      process: async function (this: BlockContext, block: Block): Promise<string> {
        const style = (block.kwargs && block.kwargs.style) || 'info';
        const icon = getHintIcon(style);
        const title = getHintTitle(style);
        const renderedBody = await this.book.renderBlock('markdown', block.body || '');

        return `
          <div class="hint hint-${style}">
            <div class="hint-icon">${icon}</div>
            <div class="hint-content">
              <div class="hint-title">${title}</div>
              ${renderedBody}
            </div>
          </div>
        `.trim();
      },
    },
  },
};
