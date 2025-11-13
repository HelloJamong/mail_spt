// Background service worker for Chrome extension

// Extension installed or updated
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation');
    initializeExtension();
    createContextMenus();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated');
    createContextMenus();
  }
});

// Initialize extension
function initializeExtension() {
  chrome.storage.local.set({
    status: '준비됨',
    settings: {
      enabled: true
    }
  });
}

// Create context menus for Mode 2
function createContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(function() {
    // Create "메일 작성 도우미" context menu
    chrome.contextMenus.create({
      id: 'mailWritingAssistant',
      title: '메일 작성 도우미',
      contexts: ['editable']
    });

    console.log('Context menus created');
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request);

  switch (request.action) {
    case 'getStatus':
      chrome.storage.local.get(['status'], function(result) {
        sendResponse({ status: result.status || '준비됨' });
      });
      return true; // Keep channel open for async response

    case 'setStatus':
      chrome.storage.local.set({ status: request.status }, function() {
        sendResponse({ success: true });
      });
      return true;

    case 'execute':
      handleExecute(sender, sendResponse);
      return true;

    case 'generateMail':
      handleGenerateMail(request, sendResponse);
      return true;

    case 'callGeminiAPI':
      handleGeminiAPI(request, sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle execute action
function handleExecute(sender, sendResponse) {
  console.log('Execute action from:', sender.tab?.url);

  // Your custom logic here
  chrome.storage.local.set({ status: '처리 중...' }, function() {
    // Notify popup about status change
    chrome.runtime.sendMessage({
      action: 'updateStatus',
      status: '처리 중...'
    });

    // Simulate some work
    setTimeout(function() {
      chrome.storage.local.set({ status: '완료' });
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: '완료'
      });
      sendResponse({ success: true, message: '실행 완료' });
    }, 1000);
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log('Context menu clicked:', info.menuItemId);

  if (info.menuItemId === 'mailWritingAssistant') {
    // Send message to content script to show prompt input
    chrome.tabs.sendMessage(tab.id, {
      action: 'showPromptModal'
    });
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
    // You can inject content scripts or perform actions here
  }
});

// Handle generate mail action (Mode 2)
async function handleGenerateMail(request, sendResponse) {
  const { prompt, apiKey } = request;

  try {
    const fullPrompt = `다음 요청에 따라 전문적인 비즈니스 메일을 작성해주세요:\n\n${prompt}`;
    const text = await callGeminiAPI(apiKey, fullPrompt);
    sendResponse({ success: true, text: text });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle Gemini API call (Mode 1 and Mode 3)
async function handleGeminiAPI(request, sendResponse) {
  const { apiKey, prompt } = request;

  try {
    const text = await callGeminiAPI(apiKey, prompt);
    sendResponse({ success: true, text: text });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Gemini API call function
async function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API 호출 실패');
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const content = data.candidates[0].content;
      if (content.parts && content.parts.length > 0) {
        return content.parts[0].text;
      }
    }

    throw new Error('응답 데이터가 올바르지 않습니다');
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
