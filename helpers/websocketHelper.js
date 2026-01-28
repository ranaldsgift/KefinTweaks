(function() {
    'use strict';
    
    const LOG = (...args) => console.log('[KefinTweaks WebSocketHelper]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks WebSocketHelper]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks WebSocketHelper]', ...args);
    
    // Registry of event listeners: MessageType -> array of callbacks
    const listeners = {};
    
    // Track initialization state
    let isInitialized = false;
    let retries = 0;
    const maxRetries = 10;
    
    /**
     * Initialize WebSocket monitoring by hooking into ApiClient's WebSocket
     */
    function initialize() {
        try {
            // Grab the actual socket
            const socket = (window.ApiClient && (window.ApiClient.webSocket || window.ApiClient._webSocket)) || null;
            
            if (!socket) {
                if (retries >= maxRetries) {
                    ERR('Max retries reached, giving up on WebSocket initialization');
                    return false;
                }
                retries++;
                setTimeout(() => {
                    if (!isInitialized) {
                        initialize();
                    }
                }, 1000);
                return;
            }
            
            // Store original handler if it exists
            const originalHandler = socket.onmessage;
            
            // Hook into onmessage
            socket.onmessage = function(event) {
                try {
                    // Pass it through so Jellyfin still works normally
                    if (originalHandler) {
                        originalHandler.call(this, event);
                    }
                    
                    // Parse the message data
                    const messageData = event.Data || event.data;
                    const data = typeof messageData === 'string' ? JSON.parse(messageData) : messageData;
                    
                    // Get the MessageType
                    const messageType = data.MessageType;
                    
                    if (messageType && listeners[messageType]) {
                        // Fire all callbacks for this message type
                        listeners[messageType].forEach(callback => {
                            try {
                                callback(data);
                            } catch (err) {
                                ERR(`Error in WebSocket listener for ${messageType}:`, err);
                            }
                        });
                    }
                } catch (err) {
                    // Log parse errors but don't break the original handler
                    WARN('WebSocket message parse error:', err);
                }
            };
            
            isInitialized = true;
            LOG('WebSocket monitoring initialized');
            return true;
        } catch (err) {
            ERR('Error initializing WebSocket monitoring:', err);
            return false;
        }
    }
    
    /**
     * Register a callback to listen for a specific WebSocket message type
     * @param {string} messageType - The MessageType to listen for (e.g., 'UserDataChanged', 'PlaybackStopped')
     * @param {Function} callback - Function to call when the message type is received. Receives the parsed message data.
     */
    function listen(messageType, callback) {
        if (typeof messageType !== 'string' || !messageType) {
            ERR('listen() requires a non-empty string messageType');
            return;
        }
        
        if (typeof callback !== 'function') {
            ERR('listen() requires a callback function');
            return;
        }
        
        // Initialize listeners array for this message type if it doesn't exist
        if (!listeners[messageType]) {
            listeners[messageType] = [];
        }
        
        // Add the callback
        listeners[messageType].push(callback);
        LOG(`Registered listener for message type: ${messageType} (${listeners[messageType].length} total listeners)`);
        
        // Ensure WebSocket is initialized
        if (!isInitialized) {
            initialize();
        }
    }
    
    // Expose the API globally
    window.websocketHelper = {
        listen: listen
    };
    
    // Try to initialize immediately
    if (!initialize()) {
        // If WebSocket isn't available yet, retry after a short delay
        // This can happen if the page loads before the WebSocket connection is established
        setTimeout(() => {
            if (!isInitialized) {
                initialize();
            }
        }, 1000);
    }
})();

