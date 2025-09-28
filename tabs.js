document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  const panels = Array.from(document.querySelectorAll('.panel'));

  if (tabButtons.length === 0 || panels.length === 0) {
    return;
  }

  let activeTarget = null;

  const persistActiveTab = (targetId) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || typeof chrome.storage.local.set !== 'function') {
      return;
    }
    chrome.storage.local.set({ popupActiveTab: targetId }, () => {
      // Ignore storage errors in the UI layer.
    });
  };

  const activateTab = (targetId, options = {}) => {
    if (!targetId) {
      return;
    }

    const button = tabButtons.find((tab) => tab.dataset.target === targetId);
    if (!button) {
      return;
    }

    if (activeTarget === targetId && options.force !== true) {
      return;
    }

    activeTarget = targetId;

    tabButtons.forEach((tab) => {
      const isActive = tab.dataset.target === targetId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle('active', isActive);
      panel.toggleAttribute('hidden', !isActive);
    });

    if (!options.skipPersist) {
      persistActiveTab(targetId);
    }

    if (!options.silent) {
      document.dispatchEvent(new CustomEvent('popup:panel-activated', {
        detail: {
          targetId,
          userInitiated: Boolean(options.userInitiated),
          reason: options.reason || 'activation'
        }
      }));
    }
  };

  const focusAndActivate = (button, reason) => {
    if (!button) {
      return;
    }
    button.focus({ preventScroll: true });
    activateTab(button.dataset.target, {
      userInitiated: true,
      reason
    });
  };

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      focusAndActivate(button, 'mouse');
    });

    button.addEventListener('keydown', (event) => {
      const { key } = event;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
        return;
      }

      event.preventDefault();

      let nextIndex = index;
      if (key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      } else if (key === 'ArrowRight') {
        nextIndex = (index + 1) % tabButtons.length;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = tabButtons.length - 1;
      }

      focusAndActivate(tabButtons[nextIndex], 'keyboard');
    });
  });

  const resolveInitialTarget = () => {
    const defaultTarget = tabButtons.find((tab) => tab.classList.contains('active'))?.dataset.target
      || tabButtons[0]?.dataset.target;

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || typeof chrome.storage.local.get !== 'function') {
      if (defaultTarget) {
        activateTab(defaultTarget, { reason: 'init', silent: false, force: true, skipPersist: true });
      }
      return;
    }

    chrome.storage.local.get('popupActiveTab', (result) => {
      const storedTarget = result?.popupActiveTab;
      const initialTarget = tabButtons.some((tab) => tab.dataset.target === storedTarget)
        ? storedTarget
        : defaultTarget;

      if (initialTarget) {
        activateTab(initialTarget, { reason: 'init', silent: false, force: true, skipPersist: true });
      }
    });
  };

  document.addEventListener('popup:activate-tab', (event) => {
    const targetId = event?.detail?.targetId;
    if (!targetId) {
      return;
    }
    activateTab(targetId, {
      userInitiated: Boolean(event?.detail?.userInitiated),
      reason: event?.detail?.reason || 'programmatic'
    });
    const targetButton = tabButtons.find((tab) => tab.dataset.target === targetId);
    if (targetButton) {
      targetButton.focus({ preventScroll: true });
    }
  });

  resolveInitialTarget();
});
