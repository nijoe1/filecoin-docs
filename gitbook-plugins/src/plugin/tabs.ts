interface TabBlock {
  kwargs?: { title?: string };
  body?: string;
}

interface Book {
  renderBlock(type: string, content: string): Promise<string>;
}

export function createTab(block: TabBlock, index: number, isActive: boolean): string {
  const title = (block.kwargs && block.kwargs.title) || 'Tab ' + (index + 1);
  return `<div class="tab${isActive ? ' active' : ''}" data-tab="${index}">${title}</div>`;
}

export async function createTabBody(book: Book, block: TabBlock, index: number, isActive: boolean): Promise<string> {
  const body = block.body || '';
  const rendered = body ? await book.renderBlock('markdown', body) : '';
  return `<div class="tab-content${isActive ? ' active' : ''}" data-tab="${index}">${rendered}</div>`;
}
