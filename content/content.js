// Content script - runs in the context of web pages

console.log('Mail Support extension content script loaded');

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);

  switch (request.action) {
    case 'execute':
      executeAction();
      sendResponse({ success: true, message: '작업 실행됨' });
      break;

    case 'getData':
      const data = collectPageData();
      sendResponse({ success: true, data: data });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep channel open for async response
});

// Execute main action
function executeAction() {
  console.log('Executing action on page:', window.location.href);

  // Your custom logic here
  // Example: Highlight all links
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    link.style.border = '2px solid #1a73e8';
  });

  // Notify background script
  chrome.runtime.sendMessage({
    action: 'setStatus',
    status: '페이지 처리 완료'
  });
}

// Collect data from page
function collectPageData() {
  return {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString()
  };
}

// Observe DOM changes (optional)
function observeDOM() {
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      console.log('DOM changed:', mutation.type);
      // Handle DOM changes here
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

// Initialize content script
function init() {
  console.log('Content script initialized');
  // You can start observers or other initialization here
  // observeDOM();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
