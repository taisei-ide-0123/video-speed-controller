/**
 * Storage module for Video Speed Controller
 * Handles settings persistence and retrieval using Chrome Storage API
 */
class VideoSpeedStorage {
  constructor() {
    this.STORAGE_KEYS = {
      DEFAULT_SPEED: 'defaultSpeed',
      ENABLED: 'enabled',
      CONTENT_SPEEDS: 'contentSpeeds'
    };
    
    this.DEFAULT_VALUES = {
      defaultSpeed: 1.0,
      enabled: true,
      contentSpeeds: {}
    };
  }

  /**
   * Get default speed setting
   * @returns {Promise<number>} Default speed value
   */
  async getDefaultSpeed() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.DEFAULT_SPEED);
      return result[this.STORAGE_KEYS.DEFAULT_SPEED] || this.DEFAULT_VALUES.defaultSpeed;
    } catch (error) {
      console.error('Error getting default speed:', error);
      return this.DEFAULT_VALUES.defaultSpeed;
    }
  }

  /**
   * Set default speed setting
   * @param {number} speed - Speed value between 0.5 and 5.0
   * @returns {Promise<void>}
   */
  async setDefaultSpeed(speed) {
    try {
      const clampedSpeed = Math.max(0.5, Math.min(5.0, speed));
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.DEFAULT_SPEED]: clampedSpeed
      });
    } catch (error) {
      console.error('Error setting default speed:', error);
    }
  }

  /**
   * Get extension enabled status
   * @returns {Promise<boolean>} Enabled status
   */
  async getEnabled() {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.ENABLED);
      return result[this.STORAGE_KEYS.ENABLED] !== undefined 
        ? result[this.STORAGE_KEYS.ENABLED] 
        : this.DEFAULT_VALUES.enabled;
    } catch (error) {
      console.error('Error getting enabled status:', error);
      return this.DEFAULT_VALUES.enabled;
    }
  }

  /**
   * Set extension enabled status
   * @param {boolean} enabled - Enabled status
   * @returns {Promise<void>}
   */
  async setEnabled(enabled) {
    try {
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.ENABLED]: Boolean(enabled)
      });
    } catch (error) {
      console.error('Error setting enabled status:', error);
    }
  }

  /**
   * Get speed for specific content
   * @param {string} contentId - Unique content identifier
   * @returns {Promise<number|null>} Content-specific speed or null if not set
   */
  async getContentSpeed(contentId) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CONTENT_SPEEDS);
      const contentSpeeds = result[this.STORAGE_KEYS.CONTENT_SPEEDS] || {};
      return contentSpeeds[contentId] || null;
    } catch (error) {
      console.error('Error getting content speed:', error);
      return null;
    }
  }

  /**
   * Set speed for specific content
   * @param {string} contentId - Unique content identifier
   * @param {number} speed - Speed value between 0.5 and 5.0
   * @returns {Promise<void>}
   */
  async setContentSpeed(contentId, speed) {
    try {
      const clampedSpeed = Math.max(0.5, Math.min(5.0, speed));
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CONTENT_SPEEDS);
      const contentSpeeds = result[this.STORAGE_KEYS.CONTENT_SPEEDS] || {};
      
      contentSpeeds[contentId] = clampedSpeed;
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CONTENT_SPEEDS]: contentSpeeds
      });
    } catch (error) {
      console.error('Error setting content speed:', error);
    }
  }

  /**
   * Remove content-specific speed setting
   * @param {string} contentId - Unique content identifier
   * @returns {Promise<void>}
   */
  async removeContentSpeed(contentId) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CONTENT_SPEEDS);
      const contentSpeeds = result[this.STORAGE_KEYS.CONTENT_SPEEDS] || {};
      
      delete contentSpeeds[contentId];
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.CONTENT_SPEEDS]: contentSpeeds
      });
    } catch (error) {
      console.error('Error removing content speed:', error);
    }
  }

  /**
   * Get all content speeds
   * @returns {Promise<Object>} Object with contentId -> speed mappings
   */
  async getAllContentSpeeds() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.CONTENT_SPEEDS);
      return result[this.STORAGE_KEYS.CONTENT_SPEEDS] || {};
    } catch (error) {
      console.error('Error getting all content speeds:', error);
      return {};
    }
  }

  /**
   * Clear all stored data (for debugging/reset purposes)
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Generate content identifier based on current page
   * @param {string} url - Current page URL
   * @returns {string} Content identifier
   */
  generateContentId(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // YouTube: Use channel ID or video ID
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        // For YouTube, try to extract channel from URL path or use video ID
        const pathname = urlObj.pathname;
        const searchParams = urlObj.searchParams;
        
        // Channel page
        if (pathname.includes('/channel/') || pathname.includes('/@')) {
          const match = pathname.match(/\/(channel\/[^\/]+|@[^\/]+)/);
          return match ? `youtube:${match[1]}` : `youtube:${pathname}`;
        }
        
        // Video page - use video ID
        const videoId = searchParams.get('v');
        if (videoId) {
          return `youtube:video:${videoId}`;
        }
        
        return `youtube:${pathname}`;
      }

      // Netflix: Use title ID from URL
      if (hostname.includes('netflix.com')) {
        const pathname = urlObj.pathname;
        const titleMatch = pathname.match(/\/title\/(\d+)/);
        if (titleMatch) {
          return `netflix:title:${titleMatch[1]}`;
        }
        return `netflix:${pathname}`;
      }

      // Twitch: Use channel name
      if (hostname.includes('twitch.tv')) {
        const pathname = urlObj.pathname;
        const channelMatch = pathname.match(/^\/([^\/]+)(?:\/|$)/);
        if (channelMatch && channelMatch[1] !== 'directory') {
          return `twitch:${channelMatch[1]}`;
        }
        return `twitch:${pathname}`;
      }

      // Vimeo: Use video ID
      if (hostname.includes('vimeo.com')) {
        const pathname = urlObj.pathname;
        const videoMatch = pathname.match(/\/(\d+)/);
        if (videoMatch) {
          return `vimeo:${videoMatch[1]}`;
        }
        return `vimeo:${pathname}`;
      }

      // Default: Use hostname + pathname
      return `${hostname}:${urlObj.pathname}`;
    } catch (error) {
      console.error('Error generating content ID:', error);
      return url;
    }
  }
}

// Create global instance
const videoSpeedStorage = new VideoSpeedStorage();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.videoSpeedStorage = videoSpeedStorage;
}