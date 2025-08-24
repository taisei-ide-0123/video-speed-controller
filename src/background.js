/**
 * Background Service Worker for Video Speed Controller
 * Handles context menus, keyboard shortcuts, and extension state
 */

// Context menu IDs
const CONTEXT_MENU_IDS = {
  MAIN: 'video-speed-controller-main',
  SPEED_05: 'video-speed-controller-speed-0.5',
  SPEED_075: 'video-speed-controller-speed-0.75',
  SPEED_10: 'video-speed-controller-speed-1.0',
  SPEED_125: 'video-speed-controller-speed-1.25',
  SPEED_15: 'video-speed-controller-speed-1.5',
  SPEED_175: 'video-speed-controller-speed-1.75',
  SPEED_20: 'video-speed-controller-speed-2.0',
  SPEED_25: 'video-speed-controller-speed-2.5',
  SPEED_30: 'video-speed-controller-speed-3.0',
  SPEED_40: 'video-speed-controller-speed-4.0',
  SPEED_50: 'video-speed-controller-speed-5.0',
  SEPARATOR: 'video-speed-controller-separator',
  REMOVE: 'video-speed-controller-remove'
};

// Speed options for context menu
const SPEED_OPTIONS = [
  { id: CONTEXT_MENU_IDS.SPEED_05, speed: 0.5, title: '0.5x' },
  { id: CONTEXT_MENU_IDS.SPEED_075, speed: 0.75, title: '0.75x' },
  { id: CONTEXT_MENU_IDS.SPEED_10, speed: 1.0, title: '1.0x (Normal)' },
  { id: CONTEXT_MENU_IDS.SPEED_125, speed: 1.25, title: '1.25x' },
  { id: CONTEXT_MENU_IDS.SPEED_15, speed: 1.5, title: '1.5x' },
  { id: CONTEXT_MENU_IDS.SPEED_175, speed: 1.75, title: '1.75x' },
  { id: CONTEXT_MENU_IDS.SPEED_20, speed: 2.0, title: '2.0x' },
  { id: CONTEXT_MENU_IDS.SPEED_25, speed: 2.5, title: '2.5x' },
  { id: CONTEXT_MENU_IDS.SPEED_30, speed: 3.0, title: '3.0x' },
  { id: CONTEXT_MENU_IDS.SPEED_40, speed: 4.0, title: '4.0x' },
  { id: CONTEXT_MENU_IDS.SPEED_50, speed: 5.0, title: '5.0x' }
];

/**
 * Initialize extension on startup
 */
async function initializeExtension() {
  try {
    await createContextMenus();
    console.log('Video Speed Controller: Extension initialized');
  } catch (error) {
    console.error('Video Speed Controller: Error initializing extension:', error);
  }
}

/**
 * Create context menus for video speed control
 */
async function createContextMenus() {
  try {
    // Remove existing menus first
    await chrome.contextMenus.removeAll();

    // Create main parent menu
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.MAIN,
      title: 'Set speed for this content',
      contexts: ['video']
    });

    // Create speed option submenus
    SPEED_OPTIONS.forEach(option => {
      chrome.contextMenus.create({
        id: option.id,
        parentId: CONTEXT_MENU_IDS.MAIN,
        title: option.title,
        contexts: ['video']
      });
    });

    // Add separator
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SEPARATOR,
      parentId: CONTEXT_MENU_IDS.MAIN,
      type: 'separator',
      contexts: ['video']
    });

    // Add remove setting option
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.REMOVE,
      parentId: CONTEXT_MENU_IDS.MAIN,
      title: 'Remove content-specific speed',
      contexts: ['video']
    });

  } catch (error) {
    console.error('Video Speed Controller: Error creating context menus:', error);
  }
}

/**
 * Handle context menu clicks
 */
async function handleContextMenuClick(info, tab) {
  try {
    const menuId = info.menuItemId;
    
    // Find speed option
    const speedOption = SPEED_OPTIONS.find(option => option.id === menuId);
    
    if (speedOption) {
      // Set content-specific speed
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setContentSpeed',
        speed: speedOption.speed
      });
    } else if (menuId === CONTEXT_MENU_IDS.REMOVE) {
      // Remove content-specific speed
      await chrome.tabs.sendMessage(tab.id, {
        action: 'removeContentSpeed'
      });
    }
  } catch (error) {
    console.error('Video Speed Controller: Error handling context menu click:', error);
  }
}

/**
 * Handle keyboard shortcuts
 */
async function handleCommand(command) {
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const activeTab = tabs[0];

    switch (command) {
      case 'toggle-extension':
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'toggleExtension'
        });
        break;

      case 'increase-speed':
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'adjustSpeed',
          delta: 0.1
        });
        break;

      case 'decrease-speed':
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'adjustSpeed',
          delta: -0.1
        });
        break;

      default:
        console.warn('Video Speed Controller: Unknown command:', command);
    }
  } catch (error) {
    console.error('Video Speed Controller: Error handling command:', error);
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
      await createContextMenus();
    }
  } catch (error) {
    console.error('Video Speed Controller: Error handling installation:', error);
  }
}

// Event listeners
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
chrome.commands.onCommand.addListener(handleCommand);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Indicate async response
});