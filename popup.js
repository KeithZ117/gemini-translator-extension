document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const translateBtn = document.getElementById('translateBtn');
  const statusDiv = document.getElementById('status');
  const languageSelect = document.getElementById('targetLanguage');
  const tokenCountSpan = document.getElementById('tokenCount');
  const resetTokensBtn = document.getElementById('resetTokensBtn');
  const openShortcutsBtn = document.getElementById('openShortcuts');

  let statusTimeoutId;

  function clearStatus() {
    if (statusTimeoutId) {
      clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }
    statusDiv.textContent = '';
    statusDiv.className = 'status';
  }

  function showStatus(message, type = 'success') {
    clearStatus();
    statusDiv.textContent = message;
    statusDiv.className = `status show ${type}`;
    statusTimeoutId = setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, 4000);
  }

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
    if (typeof result.totalTokens === 'number' && !Number.isNaN(result.totalTokens)) {
      tokenCountSpan.textContent = result.totalTokens.toLocaleString();
    } else {
      tokenCountSpan.textContent = '0';
    }
  });

  saveSettingsBtn.addEventListener('click', function() {
    clearStatus();
    const apiKey = apiKeyInput.value.trim();
    const modelName = modelNameInput.value.trim();

    const settingsToSave = {};
    const keysToRemove = [];
    if (apiKey) {
      settingsToSave.geminiApiKey = apiKey;
    } else {
        // If the user clears the key, remove it from storage.
        keysToRemove.push('geminiApiKey');
    }

    if (modelName) {
      settingsToSave.geminiModelName = modelName;
    } else {
        // If the user clears the model, remove it from storage.
        keysToRemove.push('geminiModelName');
    }

    const applySet = () => {
      if (Object.keys(settingsToSave).length > 0) {
        chrome.storage.sync.set(settingsToSave, function() {
          if (chrome.runtime.lastError) {
            showStatus(`Failed to save settings: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          showStatus('Settings saved.', 'success');
        });
      } else if (keysToRemove.length > 0) {
        showStatus('Settings cleared.', 'success');
      } else {
        showStatus('No changes detected.', 'success');
      }
    };

    if (keysToRemove.length > 0) {
      chrome.storage.sync.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
          showStatus(`Failed to update settings: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        applySet();
      });
    } else {
      applySet();
    }
  });

  resetTokensBtn.addEventListener('click', function() {
      clearStatus();
      chrome.storage.local.set({ 'totalTokens': 0 }, function() {
          if (chrome.runtime.lastError) {
            showStatus(`Failed to reset usage: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          tokenCountSpan.textContent = '0';
          showStatus('Token count reset.', 'success');
      });
  });

  // Save selected language on change
  languageSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ 'targetLanguage': languageSelect.value });
  });

  translateBtn.addEventListener('click', function() {
    clearStatus();
    const targetLanguage = languageSelect.value;
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (chrome.runtime.lastError) {
          showStatus(`Unable to access active tab: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }

        const activeTab = tabs[0];
        if (activeTab && activeTab.id !== undefined) {
            chrome.tabs.sendMessage(activeTab.id, {
              type: 'TRANSLATE_PAGE',
              lang: targetLanguage
            }, () => {
              if (chrome.runtime.lastError) {
                showStatus('Please refresh this tab and try again.', 'error');
                return;
              }
              showStatus('Translation started.', 'success');
              setTimeout(() => window.close(), 200);
            });
        } else {
            showStatus('Could not find the active tab.', 'error');
        }
    });
  });

  openShortcutsBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});
