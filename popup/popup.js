// Popup script for Mail Support Extension

let selectedMode = null;
let selectedText = '';

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const apiKeyWarning = document.getElementById('apiKeyWarning');
  const goToSettingsBtn = document.getElementById('goToSettingsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusElement = document.getElementById('status');
  const selectedTextPreview = document.getElementById('selectedTextPreview');
  const resultSection = document.getElementById('resultSection');
  const resultText = document.getElementById('resultText');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const clearResultBtn = document.getElementById('clearResultBtn');

  // Mode buttons
  const mode1Btn = document.getElementById('mode1Btn');
  const mode2Btn = document.getElementById('mode2Btn');
  const mode3Btn = document.getElementById('mode3Btn');

  // Initialize
  checkApiKey();
  getSelectedText();

  // Check if API key is configured
  function checkApiKey() {
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (!result.geminiApiKey) {
        apiKeyWarning.style.display = 'block';
        updateStatus('⚠️ API 키를 설정해주세요', 'error');
      } else {
        apiKeyWarning.style.display = 'none';
        updateStatus('준비됨');
      }
    });
  }

  // Get selected text from active tab
  async function getSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, function(response) {
        if (chrome.runtime.lastError) {
          selectedTextPreview.textContent = '텍스트를 선택한 후 모드를 선택하세요.';
          return;
        }

        if (response && response.text && response.text.trim()) {
          selectedText = response.text.trim();
          selectedTextPreview.textContent = selectedText;
        } else {
          selectedTextPreview.textContent = '텍스트를 선택한 후 모드를 선택하세요.';
        }
      });
    } catch (error) {
      console.error('Error getting selected text:', error);
    }
  }

  // Settings button handlers
  goToSettingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Mode button handlers
  mode1Btn.addEventListener('click', function() {
    selectMode(1, mode1Btn);
  });

  mode2Btn.addEventListener('click', function() {
    selectMode(2, mode2Btn);
  });

  mode3Btn.addEventListener('click', function() {
    selectMode(3, mode3Btn);
  });

  // Select mode and process
  function selectMode(mode, button) {
    // Check API key first
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (!result.geminiApiKey) {
        updateStatus('⚠️ API 키를 먼저 설정해주세요', 'error');
        return;
      }

      // Check if text is selected
      if (!selectedText) {
        updateStatus('⚠️ 텍스트를 먼저 선택해주세요', 'error');
        return;
      }

      // Update UI
      selectedMode = mode;
      updateActiveMode(button);

      // Process with selected mode
      processText(mode, selectedText, result.geminiApiKey);
    });
  }

  // Update active mode button
  function updateActiveMode(activeButton) {
    [mode1Btn, mode2Btn, mode3Btn].forEach(btn => {
      btn.classList.remove('active');
    });
    activeButton.classList.add('active');
  }

  // Process text based on mode
  async function processText(mode, text, apiKey) {
    updateStatus('처리 중...', 'processing');
    resultSection.style.display = 'none';

    try {
      let prompt = '';

      switch(mode) {
        case 1:
          prompt = `다음 텍스트의 맞춤법과 문법을 검사하고 수정해주세요. 수정된 내용만 반환하고, 수정 사항이 있다면 간단한 설명을 추가해주세요:\n\n${text}`;
          break;
        case 2:
          prompt = `다음 메일 내용을 더 전문적이고 효과적으로 수정하고 개선점을 제안해주세요:\n\n${text}`;
          break;
        case 3:
          // Detect language and translate
          const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
          if (isKorean) {
            prompt = `다음 한국어 텍스트를 자연스러운 영어로 번역해주세요:\n\n${text}`;
          } else {
            prompt = `다음 영어 텍스트를 자연스러운 한국어로 번역해주세요:\n\n${text}`;
          }
          break;
      }

      // Call Gemini API
      const result = await callGeminiAPI(apiKey, prompt);

      // Display result
      resultText.textContent = result;
      resultSection.style.display = 'block';
      updateStatus('✓ 완료', 'success');

      // For Mode 1, automatically replace selected text
      if (mode === 1 && selectedText) {
        replaceTextInPage(result);
      }

    } catch (error) {
      updateStatus('❌ 오류: ' + error.message, 'error');
      console.error('Processing error:', error);
    }
  }

  // Call Gemini API via background script
  async function callGeminiAPI(apiKey, prompt) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'callGeminiAPI',
        apiKey: apiKey,
        prompt: prompt
      }, function(response) {
        if (response && response.success) {
          resolve(response.text);
        } else {
          reject(new Error(response?.error || 'API 호출 실패'));
        }
      });
    });
  }

  // Replace text in the page (Mode 1)
  async function replaceTextInPage(newText) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.tabs.sendMessage(tab.id, {
        action: 'replaceSelectedText',
        newText: newText
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Replace text error:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('Text replaced successfully');
        }
      });
    } catch (error) {
      console.error('Error replacing text:', error);
    }
  }

  // Copy result to clipboard
  copyResultBtn.addEventListener('click', function() {
    const text = resultText.textContent;
    navigator.clipboard.writeText(text).then(function() {
      updateStatus('✓ 클립보드에 복사됨', 'success');
    }).catch(function(error) {
      updateStatus('❌ 복사 실패', 'error');
    });
  });

  // Clear result
  clearResultBtn.addEventListener('click', function() {
    resultSection.style.display = 'none';
    resultText.textContent = '';
    selectedMode = null;
    [mode1Btn, mode2Btn, mode3Btn].forEach(btn => {
      btn.classList.remove('active');
    });
    updateStatus('준비됨');
  });

  // Update status display
  function updateStatus(message, type = '') {
    statusElement.textContent = message;
    statusElement.className = 'status';
    if (type) {
      statusElement.classList.add(type);
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateStatus') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = request.status;
  }
});
