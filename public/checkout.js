/**
 * Payment Switch - Embeddable Checkout Script
 * Version: 1.0.0
 * 
 * Usage:
 * <script src="https://your-domain.com/checkout.js"></script>
 * <script>
 *   PaymentSwitch.init({
 *     apiKey: 'your_api_key',
 *     sessionId: 'payment_session_id',
 *     onSuccess: function(result) { console.log('Payment successful', result); },
 *     onError: function(error) { console.error('Payment failed', error); },
 *     onCancel: function() { console.log('Payment cancelled'); }
 *   });
 * </script>
 */

(function(window) {
  'use strict';

  const PaymentSwitch = {
    config: {},
    iframe: null,
    overlay: null,

    /**
     * Initialize the checkout
     */
    init: function(options) {
      if (!options.apiKey) {
        throw new Error('API key is required');
      }
      if (!options.sessionId) {
        throw new Error('Session ID is required');
      }

      this.config = {
        apiKey: options.apiKey,
        sessionId: options.sessionId,
        mode: options.mode || 'modal', // 'modal' or 'redirect'
        onSuccess: options.onSuccess || function() {},
        onError: options.onError || function() {},
        onCancel: options.onCancel || function() {},
        theme: options.theme || 'light',
        locale: options.locale || 'en',
        branding: options.branding || null
      };

      // Apply branding if provided
      if (this.config.branding) {
        this.applyBranding(this.config.branding);
      }

      if (this.config.mode === 'redirect') {
        this.redirect();
      } else {
        this.openModal();
      }
    },

    /**
     * Apply branding styles
     */
    applyBranding: function(branding) {
      const style = document.createElement('style');
      style.id = 'payment-switch-branding';
      style.textContent = `
        #payment-switch-overlay .ps-container {
          --ps-primary-color: ${branding.primaryColor || '#2563eb'};
          --ps-secondary-color: ${branding.secondaryColor || '#1e40af'};
          --ps-background-color: ${branding.backgroundColor || '#ffffff'};
          --ps-text-color: ${branding.textColor || '#1f2937'};
          --ps-font-family: ${branding.fontFamily || 'Inter'}, sans-serif;
          --ps-border-radius: ${branding.borderRadius || '8px'};
        }

        #payment-switch-overlay .ps-container {
          background: var(--ps-background-color) !important;
          border-radius: var(--ps-border-radius) !important;
          font-family: var(--ps-font-family) !important;
        }

        #payment-switch-overlay .ps-header {
          background: linear-gradient(135deg, var(--ps-primary-color), var(--ps-secondary-color)) !important;
          border-radius: var(--ps-border-radius) var(--ps-border-radius) 0 0 !important;
        }

        #payment-switch-overlay .ps-close-btn {
          background: rgba(255, 255, 255, 0.2) !important;
        }

        #payment-switch-overlay .ps-close-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
        }
      `;
      document.head.appendChild(style);
    },

    /**
     * Open checkout in modal
     */
    openModal: function() {
      // Create overlay
      this.overlay = document.createElement('div');
      this.overlay.id = 'payment-switch-overlay';
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      `;

      // Create iframe container
      const container = document.createElement('div');
      container.className = 'ps-container';
      container.style.cssText = `
        position: relative;
        width: 100%;
        max-width: 600px;
        height: 90vh;
        max-height: 800px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      `;

      // Add header with branding if logo provided
      if (this.config.branding && this.config.branding.logo) {
        const header = document.createElement('div');
        header.className = 'ps-header';
        header.style.cssText = `
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2563eb, #1e40af);
          border-radius: 8px 8px 0 0;
        `;
        const logo = document.createElement('img');
        logo.src = this.config.branding.logo;
        logo.alt = 'Logo';
        logo.style.cssText = `
          max-height: 40px;
          max-width: 200px;
          object-fit: contain;
        `;
        header.appendChild(logo);
        container.appendChild(header);
      }

      // Create close button
      const closeButton = document.createElement('button');
      closeButton.className = 'ps-close-btn';
      closeButton.innerHTML = '&times;';
      const hasHeader = this.config.branding && this.config.branding.logo;
      closeButton.style.cssText = `
        position: absolute;
        top: ${hasHeader ? '20px' : '10px'};
        right: 10px;
        width: 32px;
        height: 32px;
        border: none;
        background: ${hasHeader ? 'rgba(255, 255, 255, 0.2)' : '#f3f4f6'};
        color: ${hasHeader ? 'white' : '#1f2937'};
        border-radius: 50%;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        z-index: 1;
        transition: background 0.2s;
      `;
      const hasHeaderForHover = this.config.branding && this.config.branding.logo;
      closeButton.onmouseover = function() {
        this.style.background = hasHeaderForHover ? 'rgba(255, 255, 255, 0.3)' : '#e5e7eb';
      };
      closeButton.onmouseout = function() {
        this.style.background = hasHeaderForHover ? 'rgba(255, 255, 255, 0.2)' : '#f3f4f6';
      };
      closeButton.onclick = () => {
        this.close();
        this.config.onCancel();
      };

      // Create iframe
      this.iframe = document.createElement('iframe');
      this.iframe.src = this.getCheckoutUrl();
      this.iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 8px;
      `;
      this.iframe.allow = 'payment';

      container.appendChild(closeButton);
      container.appendChild(this.iframe);
      this.overlay.appendChild(container);
      document.body.appendChild(this.overlay);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Listen for messages
      window.addEventListener('message', this.handleMessage.bind(this));
    },

    /**
     * Redirect to checkout page
     */
    redirect: function() {
      window.location.href = this.getCheckoutUrl();
    },

    /**
     * Get checkout URL
     */
    getCheckoutUrl: function() {
      const baseUrl = window.location.origin;
      const params = new URLSearchParams({
        session_id: this.config.sessionId,
        api_key: this.config.apiKey,
        theme: this.config.theme,
        locale: this.config.locale,
        embedded: this.config.mode === 'modal' ? 'true' : 'false'
      });
      return `${baseUrl}/checkout?${params.toString()}`;
    },

    /**
     * Handle messages from iframe
     */
    handleMessage: function(event) {
      // Verify origin
      if (event.origin !== window.location.origin) {
        return;
      }

      const { type, data } = event.data;

      switch (type) {
        case 'PAYMENT_SUCCESS':
          this.close();
          this.config.onSuccess(data);
          break;
        case 'PAYMENT_ERROR':
          this.close();
          this.config.onError(data);
          break;
        case 'PAYMENT_CANCEL':
          this.close();
          this.config.onCancel();
          break;
        case 'RESIZE_IFRAME':
          if (this.iframe && data.height) {
            this.iframe.style.height = data.height + 'px';
          }
          break;
      }
    },

    /**
     * Close modal
     */
    close: function() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
      this.iframe = null;
      document.body.style.overflow = '';
      window.removeEventListener('message', this.handleMessage.bind(this));
    }
  };

  // Expose to window
  window.PaymentSwitch = PaymentSwitch;

})(window);
