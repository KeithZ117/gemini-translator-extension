document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;

  const getMessage = (key, substitutions) => {
    if (!key) {
      return '';
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
        const message = chrome.i18n.getMessage(key, substitutions);
        if (message) {
          return message;
        }
      }
    } catch (error) {
      console.warn('i18n lookup failed', error);
    }

    if (Array.isArray(substitutions)) {
      return [key, ...substitutions].join(' ');
    }

    if (typeof substitutions === 'string') {
      return ${key} ;
    }

    return key;
  };

  const uiLocale = (() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
        const raw = chrome.i18n.getMessage('@@ui_locale');
        if (raw) {
          return raw.replace('_', '-');
        }
      }
    } catch (error) {
      console.warn('Unable to read UI locale', error);
    }
    return 'en';
  })();

  html.lang = uiLocale;

  const formatNumber = (value) => {
    try {
      return Number(value).toLocaleString(uiLocale);
    } catch (error) {
      console.warn('Unable to format number', error);
      return String(value);
    }
  };

  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const translateBtn = document.getElementById('translateBtn');
  const statusDiv = document.getElementById('status');
  const languageSelect = document.getElementById('targetLanguage');
  const tokenCountSpan = document.getElementById('tokenCount');
  const resetTokensBtn = document.getElementById('resetTokensBtn');
  const openShortcutsBtn = document.getElementById('openShortcuts');

  function applyTranslations() {
    const appTitle = getMessage('app_title');
    if (appTitle) {
      document.title = appTitle;
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) {
        return;
      }
      const message = getMessage(key);
      if (!message) {
        return;
      }
      if (el.tagName === 'OPTION') {
        el.textContent = message;
      } else {
        el.textContent = message;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (!key) {
        return;
      }
      const message = getMessage(key);
      if (message) {
        el.setAttribute('placeholder', message);
      }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.dataset.i18nAriaLabel;
      if (!key) {
        return;
      }
      const message = getMessage(key);
      if (message) {
        el.setAttribute('aria-label', message);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (!key) {
        return;
      }
      const message = getMessage(key);
      if (message) {
        el.setAttribute('title', message);
      }
    });
  }

  applyTranslations();

  let statusTimeoutId;

  function clearStatus() {
    if (statusTimeoutId) {
      clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }
    statusDiv.textContent = '';
    statusDiv.className = 'status';
  }

  function showStatusMessage(text, type = 'success', duration = 4000) {
    clearStatus();
    if (!text) {
      return;
    }
    statusDiv.textContent = text;
    statusDiv.className = status show ;
    if (duration > 0) {
      statusTimeoutId = setTimeout(() => {
        statusDiv.className = 'status';
        statusDiv.textContent = '';
      }, duration);
    }
  }

  function showStatusKey(key, type = 'success', substitutions, duration) {
    const text = getMessage(key, substitutions) || key;
    showStatusMessage(text, type, duration);
  }

  function setBusy(button, busy) {
    if (!button) {
      return;
    }
    const defaultKey = button.dataset.i18n;
    const busyKey = button.dataset.i18nBusy;
    if (busy) {
      if (busyKey) {
        const label = getMessage(busyKey);
        if (label) {
          button.textContent = label;
        }
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      if (defaultKey) {
        const label = getMessage(defaultKey);
        if (label) {
          button.textContent = label;
        }
      }
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function handleRuntimeError(messageKey) {
    const errorMessage = chrome.runtime.lastError?.message;
    if (errorMessage) {
      showStatusKey(messageKey, 'error', [errorMessage]);
    } else {
      showStatusKey('status_unknown_error', 'error');
    }
  }

  chrome.storage.sync.get(['geminiApiKey', 'geminiModelName', 'targetLanguage'], (result) => {
    if (chrome.runtime.lastError) {
      handleRuntimeError('status_settings_failed');
      return;
    }

    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.geminiModelName) {
      modelNameInput.value = result.geminiModelName;
    }
    if (result.targetLanguage) {
      const values = Array.from(languageSelect.options).map((option) => option.value);
      if (values.includes(result.targetLanguage)) {
        languageSelect.value = result.targetLanguage;
      }
    }
  });

  chrome.storage.local.get('totalTokens', (result) => {
    if (chrome.runtime.lastError) {
      handleRuntimeError('status_usage_failed');
      return;
    }

    const totalTokens = result.totalTokens;
    if (typeof totalTokens === 'number' && !Number.isNaN(totalTokens)) {
      tokenCountSpan.textContent = formatNumber(totalTokens);
    } else {
      tokenCountSpan.textContent = '0';
    }
  });

  const focusTargets = {
    'translate-panel': () => languageSelect.focus({ preventScroll: true }),
    'settings-panel': () => apiKeyInput.focus({ preventScroll: true }),
    'usage-panel': () => resetTokensBtn.focus({ preventScroll: true })
  };

  document.addEventListener('popup:panel-activated', (event) => {
    const detail = event.detail || {};
    if (!detail.targetId || !detail.userInitiated) {
      return;
    }
    const focusFn = focusTargets[detail.targetId];
    if (typeof focusFn === 'function') {
      requestAnimationFrame(() => {
        try {
          focusFn();
        } catch (error) {
          console.warn('Unable to focus panel target', error);
        }
      });
    }
  });

  function persistLanguage(value) {
    chrome.storage.sync.set({ targetLanguage: value }, () => {
      if (chrome.runtime.lastError) {
        handleRuntimeError('status_language_failed');
        return;
      }
      showStatusKey('status_language_saved', 'info', undefined, 2500);
    });
  }

  saveSettingsBtn.addEventListener('click', () => {
    clearStatus();

    const apiKey = apiKeyInput.value.trim();
    const modelName = modelNameInput.value.trim();

    const settingsToSave = {};
    const keysToRemove = [];

    if (apiKey) {
      settingsToSave.geminiApiKey = apiKey;
    } else {
      keysToRemove.push('geminiApiKey');
    }

    if (modelName) {
      settingsToSave.geminiModelName = modelName;
    } else {
      keysToRemove.push('geminiModelName');
    }

    const hasUpdates = Object.keys(settingsToSave).length > 0;
    const hasRemovals = keysToRemove.length > 0;

    if (!hasUpdates && !hasRemovals) {
      showStatusKey('status_no_changes', 'info', undefined, 2500);
      return;
    }

    setBusy(saveSettingsBtn, true);
    showStatusKey('status_saving_settings', 'info');

    const finishWithSuccess = (messageKey) => {
      setBusy(saveSettingsBtn, false);
      showStatusKey(messageKey);
    };

    const writeSettings = () => {
      if (!hasUpdates) {
        finishWithSuccess('status_settings_cleared');
        return;
      }

      chrome.storage.sync.set(settingsToSave, () => {
        setBusy(saveSettingsBtn, false);
        if (chrome.runtime.lastError) {
          handleRuntimeError('status_settings_failed');
          return;
        }
        showStatusKey('status_settings_saved');
      });
    };

    if (hasRemovals) {
      chrome.storage.sync.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
          setBusy(saveSettingsBtn, false);
          handleRuntimeError('status_settings_failed');
          return;
        }
        writeSettings();
      });
    } else {
      writeSettings();
    }
  });

  resetTokensBtn.addEventListener('click', () => {
    clearStatus();
    setBusy(resetTokensBtn, true);
    showStatusKey('status_resetting_usage', 'info');

    chrome.storage.local.set({ totalTokens: 0 }, () => {
      setBusy(resetTokensBtn, false);
      if (chrome.runtime.lastError) {
        handleRuntimeError('status_usage_failed');
        return;
      }
      tokenCountSpan.textContent = formatNumber(0);
      showStatusKey('status_usage_reset');
    });
  });

  languageSelect.addEventListener('change', () => {
    clearStatus();
    persistLanguage(languageSelect.value);
  });

  translateBtn.addEventListener('click', () => {
    clearStatus();
    setBusy(translateBtn, true);
    showStatusKey('status_translation_starting', 'info');

    const targetLanguage = languageSelect.value;

    chrome.storage.sync.get('geminiApiKey', (res) => {
      if (chrome.runtime.lastError) {
        setBusy(translateBtn, false);
        handleRuntimeError('status_settings_failed');
        return;
      }

      if (!res.geminiApiKey) {
        setBusy(translateBtn, false);
        showStatusKey('status_missing_api_key', 'error');
        document.dispatchEvent(new CustomEvent('popup:activate-tab', { detail: { targetId: 'settings-panel', reason: 'missing-api-key' } }));
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          setBusy(translateBtn, false);
          showStatusKey('status_unable_active_tab', 'error', [chrome.runtime.lastError.message]);
          return;
        }

        const activeTab = Array.isArray(tabs) ? tabs[0] : undefined;
        if (!activeTab || typeof activeTab.id === 'undefined') {
          setBusy(translateBtn, false);
          showStatusKey('status_active_tab_missing', 'error');
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { type: 'TRANSLATE_PAGE', lang: targetLanguage }, () => {
          if (chrome.runtime.lastError) {
            setBusy(translateBtn, false);
            showStatusKey('status_refresh_tab', 'error');
            return;
          }

          showStatusKey('status_translation_started', 'success');
          setTimeout(() => {
            setBusy(translateBtn, false);
            window.close();
          }, 250);
        });
      });
    });
  });

  openShortcutsBtn.addEventListener('click', () => {
    clearStatus();
    showStatusKey('status_opening_shortcuts', 'info', undefined, 2500);
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }, () => {
      if (chrome.runtime.lastError) {
        handleRuntimeError('status_shortcuts_failed');
        return;
      }
      showStatusKey('status_shortcuts_opened', 'success', undefined, 2500);
    });
  });
});
