/**
 * Content Script for Video Speed Controller
 * Handles video detection, speed application, and user interactions
 */

class VideoSpeedController {
  constructor() {
    this.videos = new Set();
    this.observer = null;
    this.isEnabled = true;
    this.currentSpeed = 1.0;
    this.contentId = null;
    this.processingUrls = new Set();
    
    // Bind methods to maintain context
    this.handleMessage = this.handleMessage.bind(this);
    this.processVideoElements = this.processVideoElements.bind(this);
    this.handleUrlChange = this.handleUrlChange.bind(this);
    
    this.init();
  }

  /**
   * Initialize the video speed controller
   */
  async init() {
    try {
      // Load initial settings
      await this.loadSettings();
      
      // Set up video detection
      this.setupVideoObserver();
      
      // Process existing videos
      this.processVideoElements();
      
      // Listen for messages from background script and popup
      chrome.runtime.onMessage.addListener(this.handleMessage);
      
      // Monitor URL changes for SPA navigation
      this.setupUrlChangeDetection();
      
      console.log('Video Speed Controller: Content script initialized');
    } catch (error) {
      console.error('Video Speed Controller: Error initializing content script:', error);
    }
  }

  /**
   * Load settings and determine appropriate speed
   */
  async loadSettings() {
    try {
      // Get extension enabled status
      this.isEnabled = await window.videoSpeedStorage.getEnabled();
      
      if (!this.isEnabled) {
        return;
      }

      // Generate content ID for current page
      this.contentId = window.videoSpeedStorage.generateContentId(window.location.href);
      
      // Try to get content-specific speed first
      let speed = await window.videoSpeedStorage.getContentSpeed(this.contentId);
      
      // Fall back to default speed if no content-specific speed
      if (speed === null) {
        speed = await window.videoSpeedStorage.getDefaultSpeed();
      }
      
      this.currentSpeed = speed;
      console.log(`Video Speed Controller: Loaded speed ${speed}x for content ${this.contentId}`);
    } catch (error) {
      console.error('Video Speed Controller: Error loading settings:', error);
      this.currentSpeed = 1.0;
    }
  }

  /**
   * Set up MutationObserver to detect new video elements
   */
  setupVideoObserver() {
    try {
      // Disconnect existing observer
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver((mutations) => {
        let shouldProcessVideos = false;

        mutations.forEach((mutation) => {
          // Check for added nodes
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if added node is a video or contains videos
              if (node.tagName === 'VIDEO' || node.querySelector('video')) {
                shouldProcessVideos = true;
              }
            }
          });
        });

        if (shouldProcessVideos) {
          // Debounce video processing
          clearTimeout(this.videoProcessTimeout);
          this.videoProcessTimeout = setTimeout(() => {
            this.processVideoElements();
          }, 100);
        }
      });

      // Start observing
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      console.error('Video Speed Controller: Error setting up video observer:', error);
    }
  }

  /**
   * Process all video elements on the page
   */
  async processVideoElements() {
    try {
      if (!this.isEnabled) {
        return;
      }

      const videos = document.querySelectorAll('video');
      
      videos.forEach((video) => {
        if (!this.videos.has(video)) {
          this.setupVideoElement(video);
          this.videos.add(video);
        }
      });
    } catch (error) {
      console.error('Video Speed Controller: Error processing video elements:', error);
    }
  }

  /**
   * Set up individual video element with speed control
   */
  setupVideoElement(video) {
    try {
      // Apply current speed
      this.applySpeedToVideo(video, this.currentSpeed);

      // Listen for loadedmetadata to reapply speed
      video.addEventListener('loadedmetadata', () => {
        this.applySpeedToVideo(video, this.currentSpeed);
      });

      // Listen for rate changes to maintain our speed
      video.addEventListener('ratechange', () => {
        // Only reapply if the rate doesn't match our current speed
        // (avoid infinite loops from our own changes)
        if (Math.abs(video.playbackRate - this.currentSpeed) > 0.01) {
          setTimeout(() => {
            this.applySpeedToVideo(video, this.currentSpeed);
          }, 10);
        }
      });

      console.log('Video Speed Controller: Set up video element with speed', this.currentSpeed);
    } catch (error) {
      console.error('Video Speed Controller: Error setting up video element:', error);
    }
  }

  /**
   * Apply speed to a specific video element
   */
  applySpeedToVideo(video, speed) {
    try {
      if (video && typeof video.playbackRate !== 'undefined') {
        video.playbackRate = speed;
      }
    } catch (error) {
      console.error('Video Speed Controller: Error applying speed to video:', error);
    }
  }

  /**
   * Apply speed to all tracked videos
   */
  applySpeedToAllVideos(speed) {
    try {
      this.currentSpeed = speed;
      
      // Apply to existing videos
      this.videos.forEach((video) => {
        this.applySpeedToVideo(video, speed);
      });

      // Also apply to any videos that might not be tracked yet
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((video) => {
        this.applySpeedToVideo(video, speed);
      });
    } catch (error) {
      console.error('Video Speed Controller: Error applying speed to all videos:', error);
    }
  }

  /**
   * Set up URL change detection for SPA navigation
   */
  setupUrlChangeDetection() {
    let lastUrl = window.location.href;
    
    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleUrlChange(lastUrl, window.location.href), 0);
      lastUrl = window.location.href;
    }.bind(this);
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleUrlChange(lastUrl, window.location.href), 0);
      lastUrl = window.location.href;
    }.bind(this);
    
    // Listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.handleUrlChange(lastUrl, window.location.href);
        lastUrl = window.location.href;
      }, 0);
    });
  }

  /**
   * Handle URL changes (for SPA navigation)
   */
  async handleUrlChange(oldUrl, newUrl) {
    try {
      if (oldUrl === newUrl) {
        return;
      }

      // Prevent multiple simultaneous URL processing
      if (this.processingUrls.has(newUrl)) {
        return;
      }
      this.processingUrls.add(newUrl);

      console.log('Video Speed Controller: URL changed from', oldUrl, 'to', newUrl);

      // Clear existing videos
      this.videos.clear();

      // Wait a bit for new content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reload settings for new content
      await this.loadSettings();

      // Process new video elements
      this.processVideoElements();

      this.processingUrls.delete(newUrl);
    } catch (error) {
      console.error('Video Speed Controller: Error handling URL change:', error);
      this.processingUrls.delete(newUrl);
    }
  }

  /**
   * Handle messages from background script and popup
   */
  handleMessage(message, sender, sendResponse) {
    // Handle async operations
    (async () => {
      try {
        console.log('Video Speed Controller: Received message:', message);
        
        switch (message.action) {
          case 'setContentSpeed':
            await this.setContentSpeed(message.speed);
            sendResponse({ success: true });
            break;

          case 'removeContentSpeed':
            await this.removeContentSpeed();
            sendResponse({ success: true });
            break;

          case 'toggleExtension':
            await this.toggleExtension(message.enabled);
            sendResponse({ success: true });
            break;

          case 'adjustSpeed':
            await this.adjustSpeed(message.delta);
            sendResponse({ success: true });
            break;

          case 'setSpeed':
            await this.setSpeed(message.speed);
            sendResponse({ success: true });
            break;

          case 'getCurrentState':
            sendResponse({
              success: true,
              state: {
                enabled: this.isEnabled,
                currentSpeed: this.currentSpeed,
                contentId: this.contentId
              }
            });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Video Speed Controller: Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate async response
    return true;
  }

  /**
   * Set content-specific speed
   */
  async setContentSpeed(speed) {
    try {
      await window.videoSpeedStorage.setContentSpeed(this.contentId, speed);
      this.applySpeedToAllVideos(speed);
      this.showNotification(`Speed set to ${speed}x for this content`);
    } catch (error) {
      console.error('Video Speed Controller: Error setting content speed:', error);
    }
  }

  /**
   * Remove content-specific speed
   */
  async removeContentSpeed() {
    try {
      await window.videoSpeedStorage.removeContentSpeed(this.contentId);
      
      // Revert to default speed
      const defaultSpeed = await window.videoSpeedStorage.getDefaultSpeed();
      this.applySpeedToAllVideos(defaultSpeed);
      
      this.showNotification('Content-specific speed removed');
    } catch (error) {
      console.error('Video Speed Controller: Error removing content speed:', error);
    }
  }

  /**
   * Toggle extension enabled/disabled
   */
  async toggleExtension(enabled) {
    try {
      // If enabled parameter is provided, use it, otherwise toggle
      if (enabled !== undefined) {
        this.isEnabled = enabled;
      } else {
        this.isEnabled = !this.isEnabled;
      }
      
      await window.videoSpeedStorage.setEnabled(this.isEnabled);
      
      if (this.isEnabled) {
        await this.loadSettings();
        this.processVideoElements();
        this.showNotification('Video Speed Controller enabled');
      } else {
        // Reset all videos to normal speed
        this.applySpeedToAllVideos(1.0);
        this.showNotification('Video Speed Controller disabled');
      }
    } catch (error) {
      console.error('Video Speed Controller: Error toggling extension:', error);
    }
  }

  /**
   * Adjust current speed by delta
   */
  async adjustSpeed(delta) {
    try {
      if (!this.isEnabled) {
        return;
      }

      const newSpeed = Math.max(0.5, Math.min(5.0, this.currentSpeed + delta));
      await this.setSpeed(newSpeed);
    } catch (error) {
      console.error('Video Speed Controller: Error adjusting speed:', error);
    }
  }

  /**
   * Set specific speed
   */
  async setSpeed(speed) {
    try {
      if (!this.isEnabled) {
        console.log('Video Speed Controller: Extension is disabled');
        return;
      }

      const clampedSpeed = Math.max(0.5, Math.min(5.0, speed));
      this.currentSpeed = clampedSpeed;
      
      // Save as content-specific speed
      await window.videoSpeedStorage.setContentSpeed(this.contentId, clampedSpeed);
      
      this.applySpeedToAllVideos(clampedSpeed);
      this.showNotification(`Speed set to ${clampedSpeed}x`);
      
      console.log(`Video Speed Controller: Speed set to ${clampedSpeed}x`);
    } catch (error) {
      console.error('Video Speed Controller: Error setting speed:', error);
    }
  }

  /**
   * Show notification to user
   */
  showNotification(message) {
    try {
      // Create notification element
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      document.body.appendChild(notification);

      // Fade in
      requestAnimationFrame(() => {
        notification.style.opacity = '1';
      });

      // Remove after 3 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.error('Video Speed Controller: Error showing notification:', error);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VideoSpeedController();
  });
} else {
  new VideoSpeedController();
}