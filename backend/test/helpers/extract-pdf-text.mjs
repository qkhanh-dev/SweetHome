async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isTextItem(item) {
  return 'str' in item && typeof item.str === 'string';
}

const pdf = await readStdin();
let loadingTask;
let document;

try {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  loadingTask = pdfjs.getDocument({ data: Uint8Array.from(pdf) });
  document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(
      textContent.items
        .filter(isTextItem)
        .map((item) => `${item.str}${item.hasEOL ? '\n' : ''}`)
        .join(''),
    );
  }

  process.stdout.write(JSON.stringify({ pageCount: document.numPages, pages }));
} catch (error) {
  process.stderr.write(error instanceof Error ? `${error.stack ?? error.message}\n` : String(error));
  process.exitCode = 1;
} finally {
  try {
    await document?.cleanup();
  } finally {
    await loadingTask?.destroy();
  }
}
