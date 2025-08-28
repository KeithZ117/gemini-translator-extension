// Keep track of elements that have been translated
const translatedMark = 'gemini-translated-block';

// Listen for the message from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRANSLATE_PAGE') {
        console.log("Translation started for language:", request.lang);
        const targetLanguage = request.lang;
        
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
        return true; // Keep the message channel open for the async response
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
            padding: 0.2em 0em; /* Adjust padding for a cleaner look without background */
            /* Removed fixed background and color to inherit from the site's theme */
            opacity: 0.8; /* De-emphasize translation slightly to distinguish from original */
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
    // Expanded selectors to include divs and spans which are often used for content.
    const selectors = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, td, div, span';
    const elements = node.querySelectorAll(selectors);

    elements.forEach(el => {
        // Element should not be part of an existing translation block
        if (el.closest('.gemini-translated-text') || el.closest('.gemini-translation-wrapper')) {
            return;
        }

        // Check if element is visible, has meaningful text content, and hasn't been translated.
        if (el.offsetParent !== null && 
            el.innerText.trim().length > 15 && 
            !el.classList.contains(translatedMark) &&
            el.closest(`.${translatedMark}`) === null &&
            el.closest('a, button, nav, header, footer, style, script') === null) { // Avoid elements inside navigation/interactive elements

                // Stricter rule for generic divs and spans:
                // Only translate them if they don't contain other block-level elements.
                // This prevents us from translating huge container divs.
                if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
                    // Check if it has any block-level children or other known content blocks
                    if (el.querySelector(selectors) !== null) {
                        return; // Skip this one, as it contains other blocks we'll process separately
                    }
                }
                
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
        const translatedText = translatedTexts[i].trim();

        if (translatedText) {
            // To prevent re-translation, wrap original and translation in a container.
            // This is more robust against DOM changes by frameworks.
            const wrapper = document.createElement('div');
            wrapper.className = 'gemini-translation-wrapper';

            const translationElement = document.createElement('div');
            translationElement.className = 'gemini-translated-text';
            translationElement.innerText = translatedText;
            
            // Replace original block with the wrapper containing both
            if (originalBlock.parentNode) {
                originalBlock.parentNode.insertBefore(wrapper, originalBlock);
            }
            wrapper.appendChild(originalBlock);
            wrapper.appendChild(translationElement);
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