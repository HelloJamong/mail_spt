// Background service worker for Chrome extension

// Extension installed or updated
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation');
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated');
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

// Handle tab updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    console.log('Tab loaded:', tab.url);
    // You can inject content scripts or perform actions here
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
  console.log('Extension icon clicked on tab:', tab.id);
});
