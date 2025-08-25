/**
 * Background Service Worker for Video Speed Controller
 * Handles extension state
 */


/**
 * Initialize extension on startup
 */
async function initializeExtension() {
  try {
    console.log('Video Speed Controller: Extension initialized');
  } catch (error) {
    console.error('Video Speed Controller: Error initializing extension:', error);
  }
}



/**
 * Handle messages from content scripts and popup
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'getTabInfo':
        // Return tab information for popup
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({
          success: true,
          tab: tabs[0] || null
        });
        break;

      case 'executeInTab':
        // Execute action in specific tab
        if (message.tabId && message.tabAction) {
          await chrome.tabs.sendMessage(message.tabId, message.tabAction);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Missing tabId or tabAction' });
        }
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Video Speed Controller: Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle extension installation and updates
 */
async function handleInstalled(details) {
  try {
    if (details.reason === 'install') {
      console.log('Video Speed Controller: Extension installed');
      await initializeExtension();
    } else if (details.reason === 'update') {
      console.log('Video Speed Controller: Extension updated');
    }
  } catch (error) {
    console.error('Video Speed Controller: Error handling installation:', error);
  }
}

// Event listeners
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Indicate async response
});