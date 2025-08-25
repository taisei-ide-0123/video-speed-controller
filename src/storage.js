/**
 * Storage module for Video Speed Controller
 * Handles settings persistence and retrieval using Chrome Storage API
 */
class VideoSpeedStorage {
  constructor() {
    this.STORAGE_KEYS = {
      DEFAULT_SPEED: 'defaultSpeed',
      ENABLED: 'enabled'
    };
    
    this.DEFAULT_VALUES = {
      defaultSpeed: 1.0,
      enabled: true
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
   * Clear all stored data (for debugging/reset purposes)
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

// Create global instance
const videoSpeedStorage = new VideoSpeedStorage();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.videoSpeedStorage = videoSpeedStorage;
}