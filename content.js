const translatedMark = 'gemini-translated-block';
const TRANSLATED_TEXT_CLASS = 'gemini-translated-text';
const TRANSLATION_WRAPPER_CLASS = 'gemini-translation-wrapper';
const TRANSLATING_CLASS = 'gemini-translating';
const SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, td, div, span';

const translationState = {
    language: null,
    observer: null,
    queuedRoots: new Set(),
    queueTimer: null,
    processing: false
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRANSLATE_PAGE') {
        const targetLanguage = request.lang;

        if (!targetLanguage) {
            console.warn('Translation request missing target language.');
            sendResponse({ acknowledged: false, error: 'Missing target language.' });
            return;
        }

        console.log('Gemini translation triggered for language:', targetLanguage);
        injectStyles();
        setActiveLanguage(targetLanguage);
        queueRootForTranslation(document.body);
        ensureMutationObserver();
        scheduleQueueFlush(0);
        sendResponse({ acknowledged: true });
    }
});

function setActiveLanguage(language) {
    if (translationState.language === language) {
        return;
    }

    translationState.language = language;

    document.querySelectorAll('[data-gemini-translated-lang]').forEach(el => {
        if (el.dataset.geminiTranslatedLang !== language) {
            delete el.dataset.geminiTranslatedLang;
            delete el.dataset.geminiTranslatedSignature;
        }
        delete el.dataset.geminiPending;
        delete el.dataset.geminiPendingLang;
    });
}

function ensureMutationObserver() {
    if (translationState.observer || !document.body) {
        return;
    }

    translationState.observer = new MutationObserver(mutations => {
        if (!translationState.language) {
            return;
        }

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => handleAddedNode(node));
            } else if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                if (parent) {
                    handleTextChange(parent);
                }
            }
        });
    });

    translationState.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

function handleAddedNode(node) {
    if (!node) {
        return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (parent) {
            handleTextChange(parent);
        }
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    if (isGeminiManagedNode(node)) {
        return;
    }

    queueRootForTranslation(node);

    const parent = node.parentElement;
    if (parent && !isGeminiManagedNode(parent)) {
        queueRootForTranslation(parent);
    }
}

function handleTextChange(element) {
    if (!element || isGeminiManagedNode(element)) {
        return;
    }

    queueRootForTranslation(element);
}

function isGeminiManagedNode(node) {
    if (!(node instanceof Element)) {
        return false;
    }

    if (node.classList.contains(TRANSLATION_WRAPPER_CLASS) ||
        node.classList.contains(TRANSLATED_TEXT_CLASS) ||
        node.classList.contains('gemini-spinner') ||
        node.classList.contains('gemini-translating-label')) {
        return true;
    }

    return !!node.closest(`.${TRANSLATED_TEXT_CLASS}`);
}

function queueRootForTranslation(root) {
    if (!translationState.language || !root) {
        return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
        const parent = root.parentElement;
        if (parent) {
            queueRootForTranslation(parent);
        }
        return;
    }

    if (!(root instanceof Element)) {
        return;
    }

    if (isGeminiManagedNode(root)) {
        return;
    }

    translationState.queuedRoots.add(root);

    if (!translationState.processing) {
        scheduleQueueFlush();
    }
}

function scheduleQueueFlush(delay = 120) {
    if (translationState.queueTimer) {
        return;
    }

    translationState.queueTimer = setTimeout(() => {
        translationState.queueTimer = null;
        processTranslationQueue();
    }, delay);
}

async function processTranslationQueue() {
    if (!translationState.language || translationState.processing) {
        return;
    }

    const roots = Array.from(translationState.queuedRoots);
    translationState.queuedRoots.clear();

    const targets = collectTargetsFromRoots(roots, translationState.language);
    if (!targets.length) {
        return;
    }

    translationState.processing = true;
    try {
        await translateTargets(targets, translationState.language);
    } catch (error) {
        console.error('Failed to translate targets:', error);
    } finally {
        translationState.processing = false;
        if (translationState.queuedRoots.size > 0) {
            scheduleQueueFlush();
        }
    }
}

function collectTargetsFromRoots(roots, language) {
    const results = [];
    const visited = new Set();

    roots.forEach(root => {
        gatherTranslationCandidates(root, language, results, visited);
    });

    return results;
}

function gatherTranslationCandidates(root, language, results, visited) {
    if (!root || !(root instanceof Element)) {
        return;
    }

    const candidates = [];

    if (!visited.has(root) && matchesContentSelector(root)) {
        candidates.push(root);
    }

    root.querySelectorAll(SELECTORS).forEach(el => {
        if (!visited.has(el)) {
            candidates.push(el);
        }
    });

    candidates.forEach(el => {
        if (visited.has(el)) {
            return;
        }
        visited.add(el);

        if (!isElementEligibleForTranslation(el)) {
            return;
        }

        const text = extractBlockText(el);
        if (!text || text.length < 15) {
            return;
        }

        const signature = computeSignature(text);
        if (isAlreadyTranslated(el, language, signature)) {
            return;
        }

        results.push({
            element: el,
            text,
            signature
        });
    });
}

function matchesContentSelector(element) {
    if (!(element instanceof Element)) {
        return false;
    }

    try {
        return element.matches(SELECTORS);
    } catch (error) {
        return false;
    }
}

function isElementEligibleForTranslation(element) {
    if (!element || !(element instanceof Element)) {
        return false;
    }

    if (element.dataset.geminiPending === 'true') {
        return false;
    }

    if (element.classList.contains(TRANSLATED_TEXT_CLASS) || element.closest(`.${TRANSLATED_TEXT_CLASS}`)) {
        return false;
    }

    if (element.closest('style, script')) {
        return false;
    }

    if (element.closest('a, button, nav, header, footer')) {
        return false;
    }

    if (!isElementVisible(element)) {
        return false;
    }

    if ((element.tagName === 'DIV' || element.tagName === 'SPAN') && hasNestedContentBlocks(element)) {
        return false;
    }

    return true;
}

function isElementVisible(element) {
    if (!(element instanceof Element)) {
        return false;
    }

    if (element.offsetParent !== null) {
        return true;
    }

    const rects = element.getClientRects();
    if (!rects || rects.length === 0) {
        return false;
    }

    return Array.from(rects).some(rect => rect.width > 0 && rect.height > 0);
}

function hasNestedContentBlocks(element) {
    return element.querySelector(SELECTORS) !== null;
}

function extractBlockText(element) {
    return element.innerText.replace(/\s+/g, ' ').trim();
}

function computeSignature(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return `${text.length}:${Math.abs(hash).toString(36)}`;
}

function isAlreadyTranslated(element, language, signature) {
    if (!element || !(element instanceof Element)) {
        return false;
    }

    if (!element.dataset) {
        return false;
    }

    const lang = element.dataset.geminiTranslatedLang;
    const storedSignature = element.dataset.geminiTranslatedSignature;

    if (!lang || !storedSignature) {
        return false;
    }

    if (lang !== language) {
        return false;
    }

    return storedSignature === signature;
}

async function translateTargets(rawTargets, language) {
    if (!rawTargets.length) {
        return;
    }

    const preparedTargets = prepareTranslationTargets(rawTargets, language);
    if (!preparedTargets.length) {
        return;
    }

    const texts = preparedTargets.map(item => item.text);

    let response;
    try {
        response = await sendTranslationRequest(texts, language);
    } catch (error) {
        handleTranslationError(preparedTargets, error.message || 'Translation failed.');
        return;
    }

    if (!response || response.error) {
        const errorMessage = response && response.error ? response.error : 'Translation failed.';
        handleTranslationError(preparedTargets, errorMessage);
        return;
    }

    const translations = Array.isArray(response.translatedTexts) ? response.translatedTexts : [];
    applyTranslatedTexts(preparedTargets, translations, language);
}

function prepareTranslationTargets(rawTargets, language) {
    return rawTargets.map(target => {
        const element = target.element;

        element.dataset.geminiPending = 'true';
        element.dataset.geminiPendingLang = language;
        element.classList.add(translatedMark);

        const placeholder = ensureTranslationPlaceholder(element);
        setPlaceholderLoading(placeholder);

        return {
            element,
            text: target.text,
            signature: target.signature,
            placeholder
        };
    });
}

function ensureTranslationPlaceholder(originalBlock) {
    const existingWrapper = originalBlock.closest(`.${TRANSLATION_WRAPPER_CLASS}`);
    if (existingWrapper) {
        let placeholder = existingWrapper.querySelector(`.${TRANSLATED_TEXT_CLASS}`);
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = TRANSLATED_TEXT_CLASS;
            existingWrapper.appendChild(placeholder);
        }
        return placeholder;
    }

    const wrapper = document.createElement('div');
    wrapper.className = TRANSLATION_WRAPPER_CLASS;

    const placeholder = document.createElement('div');
    placeholder.className = TRANSLATED_TEXT_CLASS;

    if (originalBlock.parentNode) {
        originalBlock.parentNode.insertBefore(wrapper, originalBlock);
    }

    wrapper.appendChild(originalBlock);
    wrapper.appendChild(placeholder);

    return placeholder;
}

function setPlaceholderLoading(placeholder) {
    placeholder.innerHTML = '';
    placeholder.classList.add(TRANSLATING_CLASS);
    placeholder.classList.remove('gemini-translation-error');

    const spinner = document.createElement('span');
    spinner.className = 'gemini-spinner';
    placeholder.appendChild(spinner);

    const label = document.createElement('span');
    label.className = 'gemini-translating-label';
    label.textContent = 'Translating...';
    placeholder.appendChild(label);
}

function applyTranslatedTexts(preparedTargets, translations, language) {
    if (translations.length !== preparedTargets.length) {
        console.warn('Mismatch between placeholders and translations count.', {
            placeholders: preparedTargets.length,
            translations: translations.length
        });
    }

    const count = Math.min(preparedTargets.length, translations.length);

    for (let i = 0; i < count; i++) {
        const { placeholder, element, signature } = preparedTargets[i];
        const translated = (translations[i] || '').trim();

        placeholder.classList.remove(TRANSLATING_CLASS, 'gemini-translation-error');
        placeholder.textContent = translated;

        element.dataset.geminiTranslatedSignature = signature;
        element.dataset.geminiTranslatedLang = language;
        delete element.dataset.geminiPending;
        delete element.dataset.geminiPendingLang;
    }

    for (let i = count; i < preparedTargets.length; i++) {
        const { placeholder, element } = preparedTargets[i];
        placeholder.classList.remove(TRANSLATING_CLASS);
        placeholder.textContent = '';
        delete element.dataset.geminiPending;
        delete element.dataset.geminiPendingLang;
    }
}

function handleTranslationError(preparedTargets, errorMessage) {
    preparedTargets.forEach(({ placeholder, element }) => {
        placeholder.classList.remove(TRANSLATING_CLASS);
        placeholder.classList.add('gemini-translation-error');
        placeholder.textContent = `Translation failed: ${errorMessage}`;
        delete element.dataset.geminiPending;
        delete element.dataset.geminiPendingLang;
        delete element.dataset.geminiTranslatedSignature;
        delete element.dataset.geminiTranslatedLang;
    });
}

function sendTranslationRequest(texts, language) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({
            type: 'translate',
            texts,
            lang: language
        }, response => {
            if (chrome.runtime.lastError) {
                console.error('Translation request error:', chrome.runtime.lastError);
                resolve({ error: chrome.runtime.lastError.message });
                return;
            }
            resolve(response);
        });
    });
}

function injectStyles() {
    const styleId = 'gemini-translator-styles';
    const newStyles = `
        .${translatedMark} {
            margin-bottom: 0.3em !important;
        }
        .${TRANSLATED_TEXT_CLASS} {
            display: block;
            margin-bottom: 1em;
            padding: 0.2em 0em;
            opacity: 0.8;
            font-size: 1em;
            font-style: normal;
        }
        .${TRANSLATION_WRAPPER_CLASS} {
            position: relative;
        }
        .${TRANSLATING_CLASS} {
            display: flex;
            align-items: center;
            gap: 0.4em;
            color: inherit;
            opacity: 0.6;
        }
        .gemini-translating-label {
            font-style: italic;
        }
        .gemini-spinner {
            width: 0.9em;
            height: 0.9em;
            border: 2px solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: gemini-spin 0.8s linear infinite;
        }
        .gemini-translation-error {
            color: #d93025;
            opacity: 1;
        }
        @keyframes gemini-spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
    `;

    let style = document.getElementById(styleId);
    if (style) {
        style.innerHTML = newStyles;
    } else {
        style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = newStyles;
        document.head.appendChild(style);
    }
}
