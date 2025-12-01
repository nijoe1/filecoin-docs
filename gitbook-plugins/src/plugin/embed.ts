function getYouTubeId(url: string): string | null {
  if (!url) return null;
  // Support various YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2] && match[2].length === 11 ? match[2] : null;
}

export function createEmbedHtml(url: string, caption: string): string {
  if (!url) {
    return '<div class="embed-container generic"><p>Missing embed URL</p></div>';
  }

  const youtubeId = getYouTubeId(url);

  if (youtubeId) {
    const html =
      '<div class="embed-container youtube">' +
      `<iframe src="https://www.youtube.com/embed/${youtubeId}" ` +
      'frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">' +
      '</iframe>' +
      (caption ? `<p class="embed-caption">${caption}</p>` : '') +
      '</div>';
    return html;
  }

  return (
    '<div class="embed-container generic">' +
    `<a href="${url}" target="_blank" rel="noopener">${url}</a>` +
    (caption ? `<p class="embed-caption">${caption}</p>` : '') +
    '</div>'
  );
}

export function processEmbeds(content: string): string {
  // Handle embeds with endembed block
  content = content.replace(
    /\{%\s*embed\s+url="([^"]+)"\s*%\}([\s\S]*?)\{%\s*endembed\s*%\}/g,
    (_match, url: string, caption: string) => createEmbedHtml(url, caption.trim())
  );

  // Handle self-closing embeds
  content = content.replace(
    /\{%\s*embed\s+url="([^"]+)"\s*%\}(?!\s*[\s\S]*?\{%\s*endembed)/g,
    (_match, url: string) => createEmbedHtml(url, '')
  );

  return content;
}
