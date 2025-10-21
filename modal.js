/**
 * Generic Modal System for Jellyfin-style dialogs
 * Provides reusable modal functionality similar to cardBuilder.js
 */

window.ModalSystem = (function() {
    'use strict';

    // Store active modals
    const activeModals = new Map();

    /**
     * Create a Jellyfin-style modal dialog
     * @param {Object} options - Modal configuration
     * @param {string} options.id - Unique modal ID
     * @param {string} options.title - Modal title
     * @param {string} options.content - HTML content for the modal body
     * @param {Function} options.onClose - Callback when modal closes
     * @param {Function} options.onOpen - Callback when modal opens
     * @param {boolean} options.closeOnBackdrop - Whether to close when clicking backdrop (default: true)
     * @param {boolean} options.closeOnEscape - Whether to close on Escape key (default: true)
     * @returns {Object} Modal instance
     */
    function createModal(options = {}) {
        const {
            id,
            title,
            content,
            onClose,
            onOpen,
            closeOnBackdrop = true,
            closeOnEscape = true
        } = options;

        if (!id) {
            throw new Error('Modal ID is required');
        }

        // Remove existing modal if it exists
        removeModal(id);

        // Create modal elements
        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.setAttribute('data-modal-id', id);

        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.setAttribute('data-modal-id', id);

        const dialog = document.createElement('div');
        dialog.className = 'focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog centeredDialog opened';
        dialog.setAttribute('data-history', 'true');
        dialog.setAttribute('data-autofocus', 'true');
        dialog.setAttribute('data-removeonclose', 'true');
        dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';

        const dialogContent = document.createElement('div');
        dialogContent.style.margin = '0';
        dialogContent.style.padding = '1.25em 1.5em 1.5em';

        // Add title if provided
        if (title) {
            const titleElement = document.createElement('h2');
            titleElement.style.margin = '0 0 .5em';
            titleElement.textContent = title;
            dialogContent.appendChild(titleElement);
        }

        // Add content
        if (content) {
            if (typeof content === 'string') {
                dialogContent.innerHTML += content;
            } else if (content instanceof HTMLElement) {
                dialogContent.appendChild(content);
            }
        }

        // Assemble modal
        dialog.appendChild(dialogContent);
        dialogContainer.appendChild(dialog);

        // Add to DOM
        document.body.appendChild(backdrop);
        document.body.appendChild(dialogContainer);

        // Create modal instance
        const modalInstance = {
            id,
            backdrop,
            dialogContainer,
            dialog,
            dialogContent,
            isOpen: true,
            close: () => closeModal(id),
            updateContent: (newContent) => updateModalContent(id, newContent),
            addEventListener: (event, handler) => {
                dialog.addEventListener(event, handler);
            }
        };

        // Store modal instance
        activeModals.set(id, modalInstance);

        // Add event listeners
        if (closeOnBackdrop) {
            backdrop.addEventListener('click', () => closeModal(id));
            dialogContainer.addEventListener('click', (e) => {
                if (e.target === dialogContainer) {
                    closeModal(id);
                }
            });
        }

        if (closeOnEscape) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(id);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            modalInstance._escapeHandler = escapeHandler;
        }

        // Call onOpen callback
        if (onOpen && typeof onOpen === 'function') {
            onOpen(modalInstance);
        }

        return modalInstance;
    }

    /**
     * Close a modal by ID
     * @param {string} id - Modal ID
     */
    function closeModal(id) {
        const modal = activeModals.get(id);
        if (!modal) return;

        // Remove escape handler if it exists
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
        }

        // Remove from DOM
        if (modal.backdrop && modal.backdrop.parentNode) {
            modal.backdrop.parentNode.removeChild(modal.backdrop);
        }
        if (modal.dialogContainer && modal.dialogContainer.parentNode) {
            modal.dialogContainer.parentNode.removeChild(modal.dialogContainer);
        }

        // Remove from active modals
        activeModals.delete(id);

        // Call onClose callback if modal instance has it
        if (modal.onClose && typeof modal.onClose === 'function') {
            modal.onClose();
        }
    }

    /**
     * Remove a modal by ID (force removal)
     * @param {string} id - Modal ID
     */
    function removeModal(id) {
        const modal = activeModals.get(id);
        if (modal) {
            closeModal(id);
        }
    }

    /**
     * Update modal content
     * @param {string} id - Modal ID
     * @param {string|HTMLElement} content - New content
     */
    function updateModalContent(id, content) {
        const modal = activeModals.get(id);
        if (!modal) return;

        if (typeof content === 'string') {
            modal.dialogContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            modal.dialogContent.innerHTML = '';
            modal.dialogContent.appendChild(content);
        }
    }

    /**
     * Check if a modal is open
     * @param {string} id - Modal ID
     * @returns {boolean}
     */
    function isModalOpen(id) {
        return activeModals.has(id);
    }

    /**
     * Get all active modal IDs
     * @returns {Array<string>}
     */
    function getActiveModalIds() {
        return Array.from(activeModals.keys());
    }

    /**
     * Close all modals
     */
    function closeAllModals() {
        const ids = Array.from(activeModals.keys());
        ids.forEach(id => closeModal(id));
    }

    // Public API
    return {
        create: createModal,
        close: closeModal,
        remove: removeModal,
        updateContent: updateModalContent,
        isOpen: isModalOpen,
        getActiveIds: getActiveModalIds,
        closeAll: closeAllModals
    };
})();
