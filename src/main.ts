import { processInput } from './tool.ts';
import { initTheme } from './theme.ts';
import { initModals } from './modals.ts';
import { showToast } from './toast.ts';
import { auditCookies } from './cookies.ts';
import { auditVault } from './vault.ts';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initModals();
  auditCookies();
  auditVault();

  const inputEl = document.querySelector('#app-input') as HTMLTextAreaElement;
  const processBtn = document.querySelector('#action-process') as HTMLButtonElement;
  const clearBtn = document.querySelector('#action-clear') as HTMLButtonElement;
  const copyBtn = document.querySelector('#action-copy') as HTMLButtonElement;
  const outputRegion = document.querySelector('#output-region') as HTMLElement;

  if (!inputEl || !processBtn || !clearBtn || !copyBtn || !outputRegion) {
    console.error('Required DOM elements not found');
    return;
  }

  processBtn.addEventListener('click', () => {
    const input = inputEl.value.trim();
    if (!input) {
      showToast('Please enter input');
      return;
    }

    const res = processInput(input);

    if (res.success) {
      const escaped = escapeHtml(res.data);
      outputRegion.innerHTML = `<pre><code>${escaped}</code></pre>`;
      if (res.warnings && res.warnings.length > 0) {
        const warningEl = document.createElement('div');
        warningEl.className = 'warnings';
        warningEl.innerHTML = res.warnings.map(w => `<div class="warning">${escapeHtml(w)}</div>`).join('');
        outputRegion.appendChild(warningEl);
      }
      showToast('Completed successfully!');
    } else {
      outputRegion.innerHTML = `<pre class="error">${escapeHtml(res.error || 'Processing failed')}</pre>`;
      showToast('Error: ' + (res.error || 'Processing failed'));
    }
  });

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    outputRegion.innerHTML = '';
  });

  copyBtn.addEventListener('click', async () => {
    const codeEl = outputRegion.querySelector('code');
    if (codeEl) {
      try {
        await navigator.clipboard.writeText(codeEl.textContent || '');
        showToast('Copied to clipboard!');
      } catch {
        showToast('Failed to copy');
      }
    } else {
      showToast('Nothing to copy');
    }
  });
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

