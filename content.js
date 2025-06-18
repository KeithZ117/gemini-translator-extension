// Keep track of elements that have been translated
const translatedMark = 'gemini-translated-block';

// Listen for the message from the popup
window.addEventListener('message', function(event) {
    if (event.source === window && event.data.type === 'TRANSLATE_PAGE') {
        console.log("Translation started for language:", event.data.lang);
        const targetLanguage = event.data.lang;
        
        // Inject CSS for styling the translated text
        injectStyles();
        
        // Find content blocks to translate
        const contentBlocks = findContentBlocks(document.body);
        const textsToTranslate = contentBlocks.map(block => block.innerText);

        if (textsToTranslate.length > 0) {
            // Send to background script for translation
            chrome.runtime.sendMessage({
                type: 'translate',
                texts: textsToTranslate,
                lang: targetLanguage // Pass language to background script
            }, (response) => {
                if (response.error) {
                    console.error('Translation error:', response.error);
                    alert('Translation failed: ' + response.error);
                } else if (response.translatedTexts) {
                    displayTranslations(contentBlocks, response.translatedTexts);
                }
            });
        }
    }
});

function injectStyles() {
    const styleId = 'gemini-translator-styles';
    const newStyles = `
        .gemini-translated-block {
            margin-bottom: 0.3em !important;
        }
        .gemini-translated-text {
            display: block;
            margin-bottom: 1em; /* Restore the original paragraph margin */
            padding: 0.2em 0.5em;
            background-color: #f8f9fa;
            color: #5f6368;
            font-size: 1em; /* Match original font size */
            font-style: normal; /* Not italic */
        }
    `;

    let style = document.getElementById(styleId);
    if (style) {
        // If styles already exist, just update them
        style.innerHTML = newStyles;
    } else {
        // Otherwise, create the style element and inject it
        style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = newStyles;
        document.head.appendChild(style);
    }
}

function findContentBlocks(node) {
    const blocks = [];
    // More semantic block-level elements
    const selectors = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, td';
    const elements = node.querySelectorAll(selectors);

    elements.forEach(el => {
        // Check if element is visible and has meaningful text content
        // and hasn't been translated yet.
        if (el.offsetParent !== null && 
            el.innerText.trim().length > 15 && // Avoid translating tiny snippets
            !el.classList.contains(translatedMark) &&
            el.closest(`.${translatedMark}`) === null && // Also check parents
            el.closest('a, button') === null) { // Avoid elements inside links/buttons
                blocks.push(el);
                el.classList.add(translatedMark); // Mark as processed
        }
    });
    return blocks;
}

function displayTranslations(blocks, translatedTexts) {
    // We assume the API returns translations in the same order
    if (blocks.length !== translatedTexts.length) {
        console.warn("Mismatch between content blocks and translations count.", {
            blocks: blocks.length,
            translations: translatedTexts.length
        });
    }

    const count = Math.min(blocks.length, translatedTexts.length);
    for (let i = 0; i < count; i++) {
        const originalBlock = blocks[i];
        const translatedText = translatedTexts[i];

        if (translatedText.trim()) {
            const translationElement = document.createElement('div');
            translationElement.className = 'gemini-translated-text';
            translationElement.innerText = translatedText;
            
            // Insert the translation right after the original block
            originalBlock.parentNode.insertBefore(translationElement, originalBlock.nextSibling);
        }
    }
}

// The old listener can be removed or kept for other potential features.
// For now, let's keep it clean and remove it as it's not used by the current flow.
/*
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "get_dom_text") {
        const allText = document.body.innerText;
        sendResponse({text: allText});
    }
    return true; // Indicates that the response is sent asynchronously
});
*/ 