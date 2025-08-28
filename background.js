chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'translate') {
        const targetLanguage = request.lang;
        if (!targetLanguage) {
            sendResponse({ error: 'Target language is not set.' });
            return;
        }

        chrome.storage.sync.get(['geminiApiKey', 'geminiModelName'], async (result) => {
            const apiKey = result.geminiApiKey;
            const modelName = result.geminiModelName || 'gemini-pro'; // Use saved model or fallback
            if (!apiKey) {
                sendResponse({ error: 'API key is not set.' });
                return;
            }

            const texts = request.texts;
            // The Gemini API works best with a clear instruction.
            // We'll join the texts with a unique separator to send them as a single
            // block and then split them back.
            const separator = "|||";
            const combinedText = texts.join(separator);
            const prompt = `Translate the following texts into ${targetLanguage}. Preserve the original structure and the separator "${separator}" between each text block:\n\n${combinedText}`;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                
                if (data.usageMetadata && data.usageMetadata.totalTokenCount) {
                    const tokensUsed = data.usageMetadata.totalTokenCount;
                    // Store token usage locally for stats
                    chrome.storage.local.get('totalTokens', (result) => {
                        const newTotal = (result.totalTokens || 0) + tokensUsed;
                        chrome.storage.local.set({ 'totalTokens': newTotal });
                    });
                }

                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                    const translatedCombinedText = data.candidates[0].content.parts[0].text;
                    const translatedTexts = translatedCombinedText.split(separator);
                    
                    // Basic check to see if the translation returned a similar number of parts.
                    if (translatedTexts.length >= texts.length * 0.8) {
                       sendResponse({ translatedTexts: translatedTexts });
                    } else {
                        // Fallback or error if the structure is not preserved.
                        // This might happen if Gemini doesn't follow instructions perfectly.
                        console.warn("Translation might have failed to preserve structure. Check API response.", data);
                        // A simple fallback could be to send back the raw response text
                        sendResponse({ translatedTexts: translatedCombinedText.split('\\n') });
                    }

                } else {
                     throw new Error('Invalid response structure from Gemini API.');
                }

            } catch (error) {
                console.error('Error calling Gemini API:', error);
                sendResponse({ error: error.message });
            }
        });
        return true; // Indicates that the response is sent asynchronously
    }
});

const CONTEXT_MENU_ID = "GEMINI_TRANSLATE_PAGE";

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Translate Page with Gemini",
    contexts: ["page"],
  });
});

// A reusable function to trigger the translation
function triggerTranslation(tab) {
    if (tab && tab.id) {
        // Get the last used language from storage, default to Chinese
        chrome.storage.sync.get('targetLanguage', (data) => {
            const targetLanguage = data.targetLanguage || 'zh'; 
            
            // Send a message directly to the content script in the specified tab
            chrome.tabs.sendMessage(tab.id, {
                type: 'TRANSLATE_PAGE',
                lang: targetLanguage
            });
        });
    }
}

// Listener for the context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    triggerTranslation(tab);
  }
});

// Listener for the keyboard shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "translate-page") {
    triggerTranslation(tab);
  }
}); 