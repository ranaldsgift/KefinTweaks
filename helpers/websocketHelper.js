(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks WebSocketHelper]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks WebSocketHelper]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks WebSocketHelper]', ...args);

    // Registry of event listeners: MessageType -> array of callbacks
    const listeners = {};
    // messageType -> unsubscribe from ApiClient.subscribe
    const subscribeUnsubs = {};
    // messageType -> whether we already attached a subscribe fan-out
    const subscribeAttached = {};

    let hookedSocket = null;
    let hookedOriginalOnMessage = null;
    let pollingIntervalId = null;
    let deliveryMode = null; // 'subscribe' | 'onmessage' | null

    const POLL_INTERVAL_MS = 1500;

    function getApiClient() {
        return window.ApiClient || null;
    }

    function getSocket() {
        const api = getApiClient();
        if (!api) return null;
        return api.webSocket || api._webSocket || null;
    }

    function canSubscribe() {
        const api = getApiClient();
        return !!(api && typeof api.subscribe === 'function');
    }

    function dispatchMessage(data) {
        if (!data || typeof data !== 'object') return;
        const messageType = data.MessageType;
        if (!messageType || !listeners[messageType]) return;
        listeners[messageType].forEach((callback) => {
            try {
                callback(data);
            } catch (err) {
                ERR(`Error in WebSocket listener for ${messageType}:`, err);
            }
        });
    }

    function ensureSubscribeForType(messageType) {
        if (subscribeAttached[messageType]) return true;
        if (!canSubscribe()) return false;

        try {
            const api = getApiClient();
            const unsub = api.subscribe([messageType], (msg) => {
                // SDK/subscribe may pass the outbound message object directly
                const data = msg?.MessageType ? msg : { MessageType: messageType, Data: msg?.Data ?? msg };
                if (!data.MessageType) data.MessageType = messageType;
                dispatchMessage(data);
            });
            subscribeAttached[messageType] = true;
            subscribeUnsubs[messageType] = typeof unsub === 'function' ? unsub : null;
            deliveryMode = 'subscribe';
            // Drop any legacy onmessage hook immediately — do not wait for the poll tick
            unhookSocket();
            LOG(`Subscribed via ApiClient.subscribe for ${messageType}`);
            return true;
        } catch (err) {
            ERR(`ApiClient.subscribe failed for ${messageType}:`, err);
            return false;
        }
    }

    function ensureSubscribeForAllRegisteredTypes() {
        if (!canSubscribe()) return false;
        let any = false;
        Object.keys(listeners).forEach((messageType) => {
            if (listeners[messageType]?.length) {
                if (ensureSubscribeForType(messageType)) any = true;
            }
        });
        return any;
    }

    function unhookSocket() {
        if (hookedSocket && hookedOriginalOnMessage !== undefined) {
            try {
                hookedSocket.onmessage = hookedOriginalOnMessage;
            } catch (e) {
                // ignore
            }
        }
        hookedSocket = null;
        hookedOriginalOnMessage = null;
    }

    /**
     * Legacy path: wrap socket.onmessage, re-bind when the socket instance changes.
     * Only used when ApiClient.subscribe is unavailable.
     */
    function hookSocketIfNeeded() {
        if (canSubscribe()) return false;

        const socket = getSocket();
        if (!socket) return false;

        if (hookedSocket === socket) return true;

        unhookSocket();

        try {
            const originalHandler = socket.onmessage;
            hookedOriginalOnMessage = originalHandler;
            hookedSocket = socket;

            socket.onmessage = function(event) {
                // Keep JF handler isolated so its throws do not look like parse failures
                // and do not block KefinTweaks listener delivery.
                if (originalHandler) {
                    try {
                        originalHandler.call(this, event);
                    } catch (err) {
                        WARN('Original WebSocket onmessage handler error:', err);
                    }
                }

                try {
                    const messageData = event.Data || event.data;
                    const data = typeof messageData === 'string' ? JSON.parse(messageData) : messageData;
                    dispatchMessage(data);
                } catch (err) {
                    WARN('WebSocket message parse error:', err);
                }
            };

            deliveryMode = 'onmessage';
            LOG('WebSocket onmessage hook attached (legacy fallback)', {
                readyState: socket.readyState,
            });
            return true;
        } catch (err) {
            ERR('Error hooking WebSocket onmessage:', err);
            hookedSocket = null;
            hookedOriginalOnMessage = null;
            return false;
        }
    }

    function tryInitializeDelivery() {
        // Prefer JF-web style subscribe (reconnect-safe). Never wrap onmessage when subscribe exists.
        if (canSubscribe()) {
            return ensureSubscribeForAllRegisteredTypes();
        }

        // Fallback: raw socket onmessage with rebind support
        return hookSocketIfNeeded();
    }

    function stopPolling() {
        if (pollingIntervalId == null) return;
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }

    function startPolling() {
        if (pollingIntervalId != null) return;
        if (tryInitializeDelivery()) {
            // Still poll in legacy mode so we rebind if socket is replaced
            if (deliveryMode === 'subscribe') return;
        }

        pollingIntervalId = setInterval(() => {
            if (canSubscribe()) {
                if (ensureSubscribeForAllRegisteredTypes() && deliveryMode === 'subscribe') {
                    unhookSocket();
                    stopPolling();
                    LOG('Delivery mode: ApiClient.subscribe');
                    return;
                }
                // subscribe exists but types not attached yet — keep polling, never hook onmessage
                return;
            }

            const socket = getSocket();
            if (!socket) return;

            if (hookedSocket !== socket) {
                hookSocketIfNeeded();
            }
        }, POLL_INTERVAL_MS);
    }

    /**
     * Register a callback to listen for a specific WebSocket message type
     * @param {string} messageType - e.g. 'UserDataChanged', 'LibraryChanged'
     * @param {Function} callback - Receives the parsed message object
     */
    function listen(messageType, callback) {
        return;
        if (typeof messageType !== 'string' || !messageType) {
            ERR('listen() requires a non-empty string messageType');
            return;
        }

        if (typeof callback !== 'function') {
            ERR('listen() requires a callback function');
            return;
        }

        if (!listeners[messageType]) {
            listeners[messageType] = [];
        }

        if (listeners[messageType].includes(callback)) {
            LOG(`Listener already registered for message type: ${messageType}`);
            startPolling();
            return;
        }

        listeners[messageType].push(callback);
        LOG(`Registered listener for message type: ${messageType} (${listeners[messageType].length} total)`, {
            deliveryMode: deliveryMode || 'pending',
            canSubscribe: canSubscribe(),
        });

        if (canSubscribe()) {
            ensureSubscribeForType(messageType);
        }

        startPolling();
    }

    /**
     * Remove a callback registered with listen().
     * @param {string} messageType
     * @param {Function} callback
     */
    function unlisten(messageType, callback) {
        return;
        if (!listeners[messageType]) return;
        listeners[messageType] = listeners[messageType].filter((cb) => cb !== callback);
        LOG(`Unregistered listener for message type: ${messageType} (${listeners[messageType].length} remaining)`);

        if (!listeners[messageType].length && subscribeUnsubs[messageType]) {
            try {
                subscribeUnsubs[messageType]();
            } catch (e) {
                WARN(`Failed to unsubscribe ${messageType}:`, e);
            }
            delete subscribeUnsubs[messageType];
            delete subscribeAttached[messageType];
        }
    }

    window.websocketHelper = {
        listen,
        unlisten,
        /** @returns {'subscribe'|'onmessage'|null} */
        getDeliveryMode() {
            return deliveryMode;
        },
    };

    // Do not startPolling() here — wait until the first listen() so we never
    // wrap JF's socket before any consumer needs delivery.
})();
