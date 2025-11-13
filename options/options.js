// Options page script for API key management

document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusElement = document.getElementById('apiKeyStatus');

  // Load saved API key on page load
  loadApiKey();

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁️';
    }
  });

  // Save API key
  saveBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('API 키를 입력해주세요.', 'error');
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      showStatus('올바른 Gemini API 키 형식이 아닙니다. (AIza로 시작해야 합니다)', 'error');
      return;
    }

    // Save to Chrome storage
    chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
      showStatus('API 키가 성공적으로 저장되었습니다!', 'success');

      // Notify background script
      chrome.runtime.sendMessage({
        action: 'apiKeyUpdated',
        apiKey: apiKey
      });
    });
  });

  // Test API connection
  testBtn.addEventListener('click', async function() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('API 키를 먼저 입력해주세요.', 'error');
      return;
    }

    showStatus('API 연결을 테스트하는 중...', 'info');
    testBtn.disabled = true;

    try {
      const result = await testGeminiApi(apiKey);
      if (result.success) {
        showStatus('✅ API 연결 성공! Gemini API가 정상 작동합니다.', 'success');
      } else {
        showStatus('❌ API 연결 실패: ' + result.error, 'error');
      }
    } catch (error) {
      showStatus('❌ API 테스트 중 오류 발생: ' + error.message, 'error');
    } finally {
      testBtn.disabled = false;
    }
  });

  // Clear API key
  clearBtn.addEventListener('click', function() {
    if (confirm('정말 API 키를 삭제하시겠습니까?')) {
      chrome.storage.local.remove('geminiApiKey', function() {
        apiKeyInput.value = '';
        showStatus('API 키가 삭제되었습니다.', 'info');

        // Notify background script
        chrome.runtime.sendMessage({
          action: 'apiKeyRemoved'
        });
      });
    }
  });

  // Load API key from storage
  function loadApiKey() {
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        showStatus('저장된 API 키가 로드되었습니다.', 'info');
      }
    });
  }

  // Show status message
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
  }

  // Test Gemini API
  async function testGeminiApi(apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Hello, this is a test. Please respond with "API test successful".'
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || '알 수 없는 오류'
        };
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        return { success: true };
      } else {
        return { success: false, error: '응답 데이터가 올바르지 않습니다.' };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
