# Gemini Page Translator Chrome Extension

This is a powerful Chrome extension that translates web page content using the Google Gemini API, offering a rich set of features for a seamless bilingual reading experience.

## Features

-   **Multi-Language Translation**: Translate pages into various languages, including Chinese, Japanese, English, and more.
-   **Bilingual Display**: Instead of replacing text, the extension displays the translation directly below the original paragraph, creating an easy-to-follow, side-by-side reading experience.
-   **Custom Gemini Model**: Flexibility to use different Gemini models (e.g., `gemini-pro`, `gemini-1.5-flash-latest`) by specifying the model name in the settings.
-   **Token Usage Tracking**: Keep track of your API usage with a built-in token counter, which can be reset at any time.
-   **Quick Access**:
    -   **Context Menu**: Simply right-click on any page and select "Translate Page with Gemini" to start.
    -   **Keyboard Shortcut**: Use the default shortcut `Alt+X` for instant translation.
-   **Secure API Key Storage**: Your Gemini API key is stored securely in your browser's local storage.

## Files

-   `manifest.json`: The extension's manifest file, defining permissions and commands.
-   `popup.html`: The popup UI for settings, language selection, and stats.
-   `popup.js`: The logic for the popup UI.
-   `content.js`: Injected into web pages to handle text extraction and bilingual display.
-   `background.js`: The service worker that handles context menus, shortcuts, and API calls to Gemini.
-   `icons/`: Directory for the extension's icon.

## Setup and Installation

1.  **Get a Gemini API Key**:
    -   Go to [Google AI Studio](https://aistudio.google.com/).
    -   Create a new API key.

2.  **Add an Icon**:
    -   This project needs an icon. Create a 128x128 pixel PNG image named `icon128.png`.
    -   Place this file inside the `icons/` directory.

3.  **Load the Extension in Chrome**:
    -   Open Chrome and navigate to `chrome://extensions`.
    -   Enable "Developer mode" using the toggle switch in the top-right corner.
    -   Click on the "Load unpacked" button.
    -   Select the directory where you have saved these extension files.

## How to Use

1.  **Initial Setup**:
    -   Click on the extension's icon in the Chrome toolbar to open the popup.
    -   Enter your Gemini API key.
    -   (Optional) Enter a specific Gemini Model name. If left blank, it defaults to `gemini-pro`.
    -   Click "Save Settings".

2.  **Translating a Page**:
    -   **Method 1 (Popup)**: Open the popup, select your target language, and click the "Translate Page" button.
    -   **Method 2 (Right-Click)**: Right-click anywhere on the page and choose "Translate Page with Gemini".
    -   **Method 3 (Shortcut)**: Press `Alt+X` on your keyboard.

3.  **Check Usage**:
    -   Open the popup to see the total number of tokens used.
    -   Click "Reset Count" to clear the tracker.

4.  **Change Shortcut (Optional)**:
    -   Navigate to `chrome://extensions/shortcuts` to customize the keyboard shortcut.

## Notes

-   The translation quality depends on the Gemini model used.
-   Very large pages might take a moment to translate or hit API rate limits.
-   The extension sends the page's text to the Google API for translation. Please be mindful of the privacy of the content you translate. 