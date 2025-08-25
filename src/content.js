/**
 * Content Script for Video Speed Controller
 * Injects into web pages and controls video playback speed
 */

class VideoSpeedController {
  constructor() {
    this.enabled = true;
    this.defaultSpeed = 1.0;
    this.currentSpeed = 1.0;
    this.videos = new WeakMap();
    this.observer = null;
    
    this.init();
  }

  /**
   * Initialize the controller
   */
  async init() {
    try {
      // Load initial settings from storage
      await this.loadSettings();
      
      // Apply speed to existing videos
      this.applyToAllVideos();
      
      // Set up mutation observer for new videos
      this.setupObserver();
      
      // Listen for messages from popup/background
      this.setupMessageListener();
      
      // Listen for storage changes
      this.setupStorageListener();
      
      console.log('Video Speed Controller: Content script initialized');
    } catch (error) {
      console.error('Video Speed Controller: Error initializing:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(['enabled', 'defaultSpeed']);
      
      this.enabled = settings.enabled !== undefined ? settings.enabled : true;
      this.defaultSpeed = settings.defaultSpeed || 1.0;
      this.currentSpeed = this.defaultSpeed;
      
      console.log('Video Speed Controller: Settings loaded', {
        enabled: this.enabled,
        defaultSpeed: this.defaultSpeed
      });
    } catch (error) {
      console.error('Video Speed Controller: Error loading settings:', error);
    }
  }

  /**
   * Apply speed settings to all videos on the page
   */
  applyToAllVideos() {
    if (!this.enabled) {
      this.resetAllVideos();
      return;
    }

    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      this.applySpeedToVideo(video);
    });
  }

  /**
   * Apply speed to a specific video element
   */
  applySpeedToVideo(video) {
    if (!video || !this.enabled) return;

    try {
      // Store the original playback rate if not already stored
      if (!this.videos.has(video)) {
        this.videos.set(video, {
          originalRate: video.playbackRate || 1.0,
          applied: false
        });
      }

      // Apply the current speed
      video.playbackRate = this.currentSpeed;
      
      // Update tracking
      const videoData = this.videos.get(video);
      videoData.applied = true;
      this.videos.set(video, videoData);

      // Add event listener to maintain speed when video resets
      if (!video.hasAttribute('data-speed-controller')) {
        video.setAttribute('data-speed-controller', 'true');
        
        // Reapply speed when video starts playing
        video.addEventListener('play', () => {
          if (this.enabled && video.playbackRate !== this.currentSpeed) {
            video.playbackRate = this.currentSpeed;
          }
        });

        // Reapply speed if video rate changes unexpectedly
        video.addEventListener('ratechange', () => {
          if (this.enabled && video.playbackRate !== this.currentSpeed) {
            // Small delay to avoid conflicts with other scripts
            setTimeout(() => {
              if (this.enabled) {
                video.playbackRate = this.currentSpeed;
              }
            }, 10);
          }
        });
      }

      console.log(`Video Speed Controller: Applied speed ${this.currentSpeed}x to video`);
    } catch (error) {
      console.error('Video Speed Controller: Error applying speed to video:', error);
    }
  }

  /**
   * Reset all videos to their original speed
   */
  resetAllVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      this.resetVideo(video);
    });
  }

  /**
   * Reset a specific video to its original speed
   */
  resetVideo(video) {
    if (!video) return;

    try {
      const videoData = this.videos.get(video);
      if (videoData) {
        video.playbackRate = videoData.originalRate || 1.0;
        videoData.applied = false;
        this.videos.set(video, videoData);
      } else {
        video.playbackRate = 1.0;
      }
    } catch (error) {
      console.error('Video Speed Controller: Error resetting video:', error);
    }
  }

  /**
   * Set up mutation observer to detect new videos
   */
  setupObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled) return;

      for (const mutation of mutations) {
        // Check added nodes for video elements
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'VIDEO') {
              this.applySpeedToVideo(node);
            } else if (node.querySelector) {
              // Check for videos within added elements
              const videos = node.querySelectorAll('video');
              videos.forEach(video => {
                this.applySpeedToVideo(video);
              });
            }
          }
        });
      }
    });

    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Set up message listener for communication with popup/background
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Video Speed Controller: Received message:', message);

      switch (message.action) {
        case 'toggleExtension':
          this.handleToggleExtension(message.enabled);
          sendResponse({ success: true });
          break;

        case 'setSpeed':
          this.handleSetSpeed(message.speed);
          sendResponse({ success: true });
          break;

        case 'getCurrentState':
          sendResponse({
            success: true,
            state: {
              enabled: this.enabled,
              currentSpeed: this.currentSpeed,
              defaultSpeed: this.defaultSpeed
            }
          });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }

      return true; // Keep message channel open for async response
    });
  }

  /**
   * Set up storage listener for settings changes
   */
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'sync') return;

      console.log('Video Speed Controller: Storage changed:', changes);

      // Handle enabled/disabled change
      if (changes.enabled) {
        this.enabled = changes.enabled.newValue;
        if (this.enabled) {
          // Re-apply speed to all videos when enabled
          this.applyToAllVideos();
        } else {
          // Reset all videos when disabled
          this.resetAllVideos();
        }
      }

      // Handle default speed change
      if (changes.defaultSpeed) {
        this.defaultSpeed = changes.defaultSpeed.newValue;
        this.currentSpeed = this.defaultSpeed;
        if (this.enabled) {
          this.applyToAllVideos();
        }
      }
    });
  }

  /**
   * Handle toggle extension message
   */
  handleToggleExtension(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.applyToAllVideos();
    } else {
      this.resetAllVideos();
    }
  }

  /**
   * Handle set speed message
   */
  handleSetSpeed(speed) {
    this.currentSpeed = Math.max(0.5, Math.min(5.0, speed));
    if (this.enabled) {
      this.applyToAllVideos();
    }
  }

  /**
   * Clean up when page unloads
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.resetAllVideos();
  }
}

// Initialize controller when DOM is ready
let controller = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    controller = new VideoSpeedController();
  });
} else {
  controller = new VideoSpeedController();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (controller) {
    controller.cleanup();
  }
});