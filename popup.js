document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const translateBtn = document.getElementById('translateBtn');
  const statusDiv = document.getElementById('status');
  const languageSelect = document.getElementById('targetLanguage');
  const tokenCountSpan = document.getElementById('tokenCount');
  const resetTokensBtn = document.getElementById('resetTokensBtn');

  // Load saved API key, model name, language, and token count
  chrome.storage.sync.get(['geminiApiKey', 'geminiModelName', 'targetLanguage'], function(result) {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.geminiModelName) {
      modelNameInput.value = result.geminiModelName;
    }
    if (result.targetLanguage) {
      languageSelect.value = result.targetLanguage;
    }
  });

  chrome.storage.local.get('totalTokens', (result) => {
    if (result.totalTokens) {
        tokenCountSpan.textContent = result.totalTokens.toLocaleString();
    }
  });

  saveSettingsBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    const modelName = modelNameInput.value.trim();

    const settingsToSave = {};
    if (apiKey) {
      settingsToSave.geminiApiKey = apiKey;
    } else {
        // If the user clears the key, remove it from storage.
        chrome.storage.sync.remove('geminiApiKey');
    }

    if (modelName) {
      settingsToSave.geminiModelName = modelName;
    } else {
        // If the user clears the model, remove it from storage.
        chrome.storage.sync.remove('geminiModelName');
    }

    if (Object.keys(settingsToSave).length > 0) {
      chrome.storage.sync.set(settingsToSave, function() {
        statusDiv.textContent = 'Settings saved.';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000);
      });
    } else {
      statusDiv.textContent = 'Settings cleared.';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    }
  });

  resetTokensBtn.addEventListener('click', function() {
      chrome.storage.local.set({ 'totalTokens': 0 }, function() {
          tokenCountSpan.textContent = '0';
          statusDiv.textContent = 'Token count reset.';
          setTimeout(() => { statusDiv.textContent = ''; }, 3000);
      });
  });

  // Save selected language on change
  languageSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ 'targetLanguage': languageSelect.value });
  });

  translateBtn.addEventListener('click', function() {
    const targetLanguage = languageSelect.value;
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && tabs[0].id) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: startTranslation,
                args: [targetLanguage] // Pass language as an argument
            });
        } else {
            statusDiv.textContent = 'Could not find active tab.';
        }
    });
    window.close();
  });
});

function startTranslation(targetLanguage) {
    // This function is executed in the content script's context
    // It sends a message that the content script will listen for.
    window.postMessage({ type: 'TRANSLATE_PAGE', lang: targetLanguage }, '*');
} 