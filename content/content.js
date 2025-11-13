// Content script - runs in the context of web pages

console.log('Mail Support extension content script loaded');

// Store last focused element for Mode 2
let lastFocusedElement = null;

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);

  switch (request.action) {
    case 'getSelectedText':
      const selectedText = window.getSelection().toString();
      sendResponse({ success: true, text: selectedText });
      break;

    case 'replaceSelectedText':
      replaceSelectedText(request.newText);
      sendResponse({ success: true, message: '텍스트가 교체되었습니다' });
      break;

    case 'insertTextAtCursor':
      insertTextAtFocusedElement(request.text);
      sendResponse({ success: true, message: '텍스트가 삽입되었습니다' });
      break;

    case 'getLastFocusedElement':
      const elementInfo = getLastFocusedElementInfo();
      sendResponse({ success: true, elementInfo: elementInfo });
      break;

    case 'showPromptModal':
      showPromptModal();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep channel open for async response
});

// Track focused input elements for Mode 2
document.addEventListener('focusin', function(e) {
  const element = e.target;

  // Check if it's an editable element
  if (isEditableElement(element)) {
    lastFocusedElement = element;
    console.log('Focused editable element:', element.tagName, element.type);
  }
});

// Check if element is editable
function isEditableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const isContentEditable = element.contentEditable === 'true';
  const isTextInput = (tagName === 'input' && ['text', 'email', 'search'].includes(element.type)) ||
                      tagName === 'textarea';

  return isContentEditable || isTextInput;
}

// Get info about last focused element
function getLastFocusedElementInfo() {
  if (!lastFocusedElement) {
    return { exists: false };
  }

  return {
    exists: true,
    tagName: lastFocusedElement.tagName,
    type: lastFocusedElement.type || 'contenteditable',
    isContentEditable: lastFocusedElement.contentEditable === 'true'
  };
}

// Replace selected text with corrected text (Mode 1)
function replaceSelectedText(newText) {
  const selection = window.getSelection();

  if (!selection.rangeCount) {
    console.log('No text selected');
    return;
  }

  const range = selection.getRangeAt(0);

  // Check if selection is in an editable element
  const container = range.commonAncestorContainer;
  const element = container.nodeType === 3 ? container.parentNode : container;

  if (isEditableElement(element) || element.closest('[contenteditable="true"]')) {
    // Delete selected text and insert new text
    range.deleteContents();
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    console.log('Text replaced successfully');
  } else {
    console.log('Selected text is not in an editable area');
  }
}

// Insert text at last focused element (Mode 2)
function insertTextAtFocusedElement(text) {
  if (!lastFocusedElement) {
    console.log('No focused element found');
    alert('메일 작성란에 커서를 두고 다시 시도해주세요.');
    return;
  }

  const element = lastFocusedElement;

  if (element.contentEditable === 'true') {
    // For contentEditable elements
    element.focus();

    // Try to use execCommand first (works in most cases)
    if (document.queryCommandSupported('insertText')) {
      document.execCommand('insertText', false, text);
    } else {
      // Fallback: insert at cursor position
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
      } else {
        element.textContent = text;
      }
    }
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    // For textarea and input elements
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const currentValue = element.value;

    // Insert text at cursor position
    element.value = currentValue.substring(0, start) + text + currentValue.substring(end);

    // Move cursor to end of inserted text
    const newPosition = start + text.length;
    element.selectionStart = newPosition;
    element.selectionEnd = newPosition;

    element.focus();
  }

  console.log('Text inserted successfully');
}

// Show prompt modal for Mode 2
function showPromptModal() {
  // Check if modal already exists
  if (document.getElementById('mailSupportPromptModal')) {
    return;
  }

  // Create modal HTML
  const modalHTML = `
    <div id="mailSupportPromptModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <h2 style="
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        ">📧 메일 작성 도우미</h2>

        <p style="
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #666;
        ">작성하고 싶은 메일 내용을 설명해주세요.</p>

        <textarea id="mailSupportPromptInput" placeholder="예: 고객사에 프로젝트 진행 상황을 알리는 공손한 메일" style="
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          box-sizing: border-box;
        "></textarea>

        <div style="
          display: flex;
          gap: 8px;
          margin-top: 16px;
        ">
          <button id="mailSupportGenerateBtn" style="
            flex: 1;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          ">작성하기</button>

          <button id="mailSupportCancelBtn" style="
            padding: 12px 24px;
            background: #f1f3f4;
            color: #333;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">취소</button>
        </div>

        <div id="mailSupportStatus" style="
          margin-top: 12px;
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          display: none;
        "></div>
      </div>
    </div>
  `;

  // Insert modal into page
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('mailSupportPromptModal');
  const input = document.getElementById('mailSupportPromptInput');
  const generateBtn = document.getElementById('mailSupportGenerateBtn');
  const cancelBtn = document.getElementById('mailSupportCancelBtn');
  const status = document.getElementById('mailSupportStatus');

  // Focus input
  input.focus();

  // Generate button
  generateBtn.addEventListener('click', async function() {
    const prompt = input.value.trim();

    if (!prompt) {
      showModalStatus('프롬프트를 입력해주세요.', 'error');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '작성 중...';
    showModalStatus('AI가 메일을 작성하고 있습니다...', 'info');

    try {
      // Get API key
      chrome.storage.local.get(['geminiApiKey'], async function(result) {
        if (!result.geminiApiKey) {
          showModalStatus('API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.', 'error');
          generateBtn.disabled = false;
          generateBtn.textContent = '작성하기';
          return;
        }

        // Call background script to generate text
        chrome.runtime.sendMessage({
          action: 'generateMail',
          prompt: prompt,
          apiKey: result.geminiApiKey
        }, function(response) {
          generateBtn.disabled = false;
          generateBtn.textContent = '작성하기';

          if (response && response.success) {
            showModalStatus('✓ 메일이 작성되었습니다!', 'success');

            // Insert generated text
            setTimeout(function() {
              insertTextAtFocusedElement(response.text);
              closeModal();
            }, 500);
          } else {
            showModalStatus('❌ 오류: ' + (response?.error || '알 수 없는 오류'), 'error');
          }
        });
      });
    } catch (error) {
      generateBtn.disabled = false;
      generateBtn.textContent = '작성하기';
      showModalStatus('❌ 오류: ' + error.message, 'error');
    }
  });

  // Cancel button
  cancelBtn.addEventListener('click', closeModal);

  // Close on outside click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close modal function
  function closeModal() {
    if (modal) {
      modal.remove();
    }
  }

  // Show status in modal
  function showModalStatus(message, type) {
    status.textContent = message;
    status.style.display = 'block';

    if (type === 'success') {
      status.style.background = '#d4edda';
      status.style.color = '#155724';
      status.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
      status.style.background = '#f8d7da';
      status.style.color = '#721c24';
      status.style.border = '1px solid #f5c6cb';
    } else if (type === 'info') {
      status.style.background = '#d1ecf1';
      status.style.color = '#0c5460';
      status.style.border = '1px solid #bee5eb';
    }
  }
}

// Initialize content script
function init() {
  console.log('Content script initialized');

  // Listen for context menu actions from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'contextMenuClicked') {
      console.log('Context menu clicked:', request.menuItemId);
      sendResponse({ success: true });
    }
  });
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
