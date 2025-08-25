/**
 * Popup Script for Video Speed Controller
 * Handles popup UI interactions and communicates with content scripts
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.currentState = {
      enabled: true,
      currentSpeed: 1.0,
      defaultSpeed: 1.0
    };

    // DOM elements
    this.elements = {
      enabledToggle: document.getElementById('enabledToggle'),
      speedSlider: document.getElementById('speedSlider'),
      sliderValue: document.getElementById('sliderValue'),
      currentSpeedDisplay: document.getElementById('currentSpeedDisplay'),
      mainContent: document.getElementById('mainContent'),
      disabledOverlay: document.getElementById('disabledOverlay'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      presetButtons: document.querySelectorAll('.preset-btn')
    };

    this.init();
  }

  /**
   * Initialize popup controller
   */
  async init() {
    try {
      this.showLoading(true);
      
      // Get current tab
      await this.getCurrentTab();
      
      // Load current settings
      await this.loadCurrentState();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Update UI
      this.updateUI();
      
      this.showLoading(false);
    } catch (error) {
      console.error('Video Speed Controller: Error initializing popup:', error);
      this.showError('Failed to load extension settings');
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0] || null;
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  /**
   * Load current extension state
   */
  async loadCurrentState() {
    try {
      // Initialize storage if not already done
      if (!window.videoSpeedStorage) {
        window.videoSpeedStorage = new VideoSpeedStorage();
      }
      
      // Load basic settings
      this.currentState.enabled = await window.videoSpeedStorage.getEnabled();
      this.currentState.defaultSpeed = await window.videoSpeedStorage.getDefaultSpeed();

      if (this.currentTab) {
        // Try to get state from content script
        try {
          const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'getCurrentState'
          });
          
          if (response && response.success && response.state) {
            this.currentState.enabled = response.state.enabled || this.currentState.enabled;
            this.currentState.currentSpeed = response.state.currentSpeed || this.currentState.currentSpeed;
          }
        } catch (error) {
          // Content script might not be loaded yet
          console.log('Content script not ready, using default state');
          
          // Use default speed
          this.currentState.currentSpeed = this.currentState.defaultSpeed;
        }
      }
    } catch (error) {
      console.error('Error loading current state:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    try {
      // Extension toggle
      this.elements.enabledToggle.addEventListener('change', async (e) => {
        try {
          await this.toggleExtension(e.target.checked);
        } catch (error) {
          console.error('Error toggling extension:', error);
          // Revert toggle state only if storage operation failed
          e.target.checked = !e.target.checked;
        }
      });

      // Speed slider
      this.elements.speedSlider.addEventListener('input', (e) => {
        this.updateSliderValue(parseFloat(e.target.value));
      });

      this.elements.speedSlider.addEventListener('change', async (e) => {
        const speed = parseFloat(e.target.value);
        try {
          // Set as default speed
          await this.setDefaultSpeed(speed);
          // Also apply to current video
          await this.setCurrentSpeed(speed);
        } catch (error) {
          console.error('Error setting speed:', error);
          this.showError('Failed to set speed');
        }
      });

      // Preset buttons
      this.elements.presetButtons.forEach(button => {
        button.addEventListener('click', async () => {
          const speed = parseFloat(button.dataset.speed);
          // Update the slider value
          this.elements.speedSlider.value = speed;
          this.updateSliderValue(speed);
          // Set as default speed
          await this.setDefaultSpeed(speed);
          // Apply to current video
          await this.setCurrentSpeed(speed);
        });
      });


      // Keyboard shortcuts
      document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
          window.close();
        }
      });
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  /**
   * Update UI elements based on current state
   */
  updateUI() {
    try {
      // Toggle switch
      this.elements.enabledToggle.checked = this.currentState.enabled;

      // Speed slider
      this.elements.speedSlider.value = this.currentState.defaultSpeed;
      this.updateSliderValue(this.currentState.defaultSpeed);

      // Current speed display
      this.elements.currentSpeedDisplay.textContent = `${this.currentState.currentSpeed}x`;


      // Disabled overlay
      this.showDisabledOverlay(!this.currentState.enabled);

      // Update preset button states
      this.updatePresetButtons();
    } catch (error) {
      console.error('Error updating UI:', error);
    }
  }

  /**
   * Update slider value display
   */
  updateSliderValue(value) {
    this.elements.sliderValue.textContent = `${value}x`;
  }


  /**
   * Update preset button states
   */
  updatePresetButtons() {
    this.elements.presetButtons.forEach(button => {
      const speed = parseFloat(button.dataset.speed);
      const isActive = Math.abs(speed - this.currentState.currentSpeed) < 0.01;
      button.classList.toggle('active', isActive);
    });
  }

  /**
   * Toggle extension enabled/disabled
   */
  async toggleExtension(enabled) {
    try {
      await window.videoSpeedStorage.setEnabled(enabled);
      this.currentState.enabled = enabled;

      // Try to send message to content script, but don't fail if it's not loaded
      if (this.currentTab) {
        try {
          await this.sendMessageToTab({
            action: 'toggleExtension',
            enabled: enabled
          });
          
          // If enabling, also send the current speed to apply
          if (enabled) {
            await this.sendMessageToTab({
              action: 'setSpeed',
              speed: this.currentState.defaultSpeed
            });
          }
        } catch (error) {
          // Content script might not be loaded, which is okay
          console.log('Content script not available, settings saved for next reload');
        }
      }

      this.updateUI();
      this.showSuccess(enabled ? 'Extension enabled' : 'Extension disabled');
    } catch (error) {
      console.error('Error toggling extension:', error);
      this.showError('Failed to toggle extension');
      throw error; // Re-throw to revert toggle state
    }
  }

  /**
   * Set default speed
   */
  async setDefaultSpeed(speed) {
    try {
      const clampedSpeed = Math.max(0.5, Math.min(5.0, speed));
      await window.videoSpeedStorage.setDefaultSpeed(clampedSpeed);
      this.currentState.defaultSpeed = clampedSpeed;
      
      this.updateSliderValue(clampedSpeed);
    } catch (error) {
      console.error('Error setting default speed:', error);
      this.showError('Failed to set default speed');
    }
  }

  /**
   * Set current video speed
   */
  async setCurrentSpeed(speed) {
    try {
      const clampedSpeed = Math.max(0.5, Math.min(5.0, speed));
      
      // Try to send message to content script
      if (this.currentTab) {
        try {
          await this.sendMessageToTab({
            action: 'setSpeed',
            speed: clampedSpeed
          });
        } catch (error) {
          // Content script might not be loaded on this page
          console.log('No video found on this page or content script not loaded');
          this.showError('No video found on this page');
          return;
        }
      }

      this.currentState.currentSpeed = clampedSpeed;
      this.updateUI();
      this.showSuccess(`Speed set to ${clampedSpeed}x`);
    } catch (error) {
      console.error('Error setting current speed:', error);
      this.showError('Failed to set video speed');
    }
  }

  /**
   * Adjust current video speed
   */
  async adjustCurrentSpeed(delta) {
    try {
      const newSpeed = Math.max(0.5, Math.min(5.0, this.currentState.currentSpeed + delta));
      await this.setCurrentSpeed(newSpeed);
    } catch (error) {
      console.error('Error adjusting current speed:', error);
    }
  }


  /**
   * Send message to current tab's content script
   */
  async sendMessageToTab(message) {
    if (!this.currentTab) {
      throw new Error('No active tab');
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, message);
      if (response && !response.success) {
        throw new Error(response.error || 'Unknown error');
      }
      return response;
    } catch (error) {
      // If content script is not loaded, just log the warning
      console.warn('Content script not responding:', error.message);
      // Only throw if it's not a connection error
      if (!error.message.includes('Could not establish connection')) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Show/hide loading overlay
   */
  showLoading(show) {
    this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  /**
   * Show/hide disabled overlay
   */
  showDisabledOverlay(show) {
    this.elements.disabledOverlay.style.display = show ? 'flex' : 'none';
    this.elements.mainContent.style.opacity = show ? '0.5' : '1';
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    try {
      // Remove existing notifications
      const existingNotifications = document.querySelectorAll('.notification');
      existingNotifications.forEach(notification => {
        notification.remove();
      });

      // Create notification
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.textContent = message;
      
      notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        max-width: 280px;
        text-align: center;
        ${type === 'error' ? 'background: #f44336; color: white;' : ''}
        ${type === 'success' ? 'background: #4caf50; color: white;' : ''}
        ${type === 'info' ? 'background: #2196f3; color: white;' : ''}
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
      console.error('Error showing notification:', error);
    }
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}