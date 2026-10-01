/**
 * Generic Modal System for Jellyfin-style dialogs
 * Provides reusable modal functionality similar to cardBuilder.js
 */

window.ModalSystem = (function() {
    'use strict';

    // Store active modals
    const activeModals = new Map();

    // Body scroll lock while any kefin modal is open (replaces non-passive wheel trap)
    let bodyScrollLockCount = 0;
    let savedBodyOverflow = null;
    let savedHtmlOverflow = null;

    function lockBodyScroll() {
        if (bodyScrollLockCount === 0) {
            savedBodyOverflow = document.body.style.overflow;
            savedHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }
        bodyScrollLockCount++;
    }

    function unlockBodyScroll() {
        if (bodyScrollLockCount <= 0) return;
        bodyScrollLockCount--;
        if (bodyScrollLockCount === 0) {
            document.body.style.overflow = savedBodyOverflow || '';
            document.documentElement.style.overflow = savedHtmlOverflow || '';
            savedBodyOverflow = null;
            savedHtmlOverflow = null;
        }
    }

    /**
     * Apply Jellyfin's scaleup open animation and clear it when finished.
     * Clearing avoids a stuck compositor layer that leaves large dialogs soft/blurry.
     * @param {HTMLElement} dialog
     */
    function applyOpenAnimation(dialog) {
        if (!dialog) return;
        dialog.style.animation = '160ms ease-out 0s 1 normal both running scaleup';
        const onEnd = (e) => {
            if (e.target !== dialog) return;
            if (e.animationName && e.animationName !== 'scaleup') return;
            dialog.style.animation = '';
            dialog.removeEventListener('animationend', onEnd);
        };
        dialog.addEventListener('animationend', onEnd);
    }

    /**
     * Create a Jellyfin-style modal dialog
     * @param {Object} options - Modal configuration
     * @param {string} options.id - Unique modal ID
     * @param {string} options.title - Modal title
     * @param {string|HTMLElement} options.content - HTML content for the modal body
     * @param {string|HTMLElement} options.footer - Optional footer HTML content
     * @param {Function} options.onClose - Callback when modal closes
     * @param {Function} options.onOpen - Callback when modal opens
     * @param {boolean} options.closeOnBackdrop - Whether to close when clicking backdrop (default: true)
     * @param {boolean} options.closeOnEscape - Whether to close on Escape key (default: true)
     * @param {boolean} options.showCloseButton - Whether to show close button in header (default: true if title exists)
     * @param {boolean} [options.fixedSize] - Use dialog-fixedSize. If undefined, enable when window width < 900.
     * @param {Object} [options.dialogStyle] - CSS styles applied to the dialog before open (e.g. width/height).
     * @returns {Object} Modal instance
     */
    function createModal(options = {}) {
        const {
            id,
            title,
            content,
            footer,
            onClose,
            onOpen,
            closeOnBackdrop = true,
            closeOnEscape = true,
            showCloseButton = true,
            fixedSize,
            dialogStyle
        } = options;

        if (!id) {
            throw new Error('Modal ID is required');
        }

        // Remove existing modal if it exists
        removeModal(id);

        const useFixedSize = fixedSize === true
            || (fixedSize !== false && typeof window !== 'undefined' && window.innerWidth < 900);

        let _showCloseButton = showCloseButton;
        if (window.innerWidth < 900 && useFixedSize) {
            _showCloseButton = true;
        }

        // Create modal elements
        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.setAttribute('data-modal-id', id);

        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.setAttribute('data-modal-id', id);

        const dialog = document.createElement('div');
        dialog.className = `focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog ${useFixedSize ? 'dialog-fixedSize' : 'centeredDialog'} opened`;
        dialog.setAttribute('data-history', 'true');
        dialog.setAttribute('data-autofocus', 'true');
        dialog.setAttribute('data-removeonclose', 'true');
        dialog.setAttribute('data-name', 'kefin-modal');
        dialog.style.display = 'flex';
        dialog.style.flexDirection = 'column';
        if (!useFixedSize) {
            dialog.style.maxHeight = '90vh';
        }
        // Final box size before scaleup so the compositor layer is not soft-scaled after open
        if (dialogStyle && typeof dialogStyle === 'object') {
            Object.assign(dialog.style, dialogStyle);
        }
        applyOpenAnimation(dialog);

        // Create header if title is provided
        let dialogHeader = null;
        dialogHeader = document.createElement('div');
        dialogHeader.className = 'formDialogHeader';
        dialogHeader.style.display = 'flex';
        dialogHeader.style.justifyContent = 'space-between';
        dialogHeader.style.alignItems = 'center';
        dialogHeader.style.padding = '1.25em 1.5em';
        dialogHeader.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        dialogHeader.style.flexShrink = '0';
        
        if (title) {
            const titleElement = document.createElement('h2');
            titleElement.style.margin = '0';
            titleElement.style.textAlign = 'left';
            titleElement.textContent = title;
            dialogHeader.appendChild(titleElement);
        }

        // Add close button if enabled
        if (_showCloseButton) {
            const closeButton = document.createElement('button');
            closeButton.setAttribute('is', 'paper-icon-button-light');
            closeButton.className = 'btnCancel btnClose autoSize paper-icon-button-light';
            closeButton.setAttribute('tabindex', '-1');
            closeButton.title = 'Close';
            closeButton.onclick = () => closeModal(id);

            const closeIcon = document.createElement('span');
            closeIcon.className = 'material-icons close';
            closeIcon.setAttribute('aria-hidden', 'true');
            closeButton.appendChild(closeIcon);

            dialogHeader.appendChild(closeButton);
        }

        if (dialogHeader.childNodes.length > 0) {
            dialog.appendChild(dialogHeader);
        }

        // Create scrollable content area
        const dialogContent = document.createElement('div');
        dialogContent.style.padding = '1.25em 1.5em';
        dialogContent.style.overflowY = 'auto';
        dialogContent.style.flex = '1';
        dialogContent.style.minHeight = '0';
        // Contain overscroll so nested wheel/touch scroll does not chain to the page
        // (avoids a non-passive wheel listener that delays input while the main thread is busy)
        dialogContent.style.overscrollBehavior = 'contain';
        dialog.style.overscrollBehavior = 'contain';

        // Add content
        if (content) {
            if (typeof content === 'string') {
                dialogContent.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                dialogContent.appendChild(content);
            }
        }

        // Create footer if provided
        let dialogFooter = null;
        if (footer) {
            dialogFooter = document.createElement('div');
            dialogFooter.className = 'formDialogFooter kefinModalFooter';
            dialogFooter.style.padding = '1.25em 1.5em';
            dialogFooter.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            dialogFooter.style.flexShrink = '0';

            if (typeof footer === 'string') {
                dialogFooter.innerHTML = footer;
            } else if (footer instanceof HTMLElement) {
                dialogFooter.appendChild(footer);
            }
            dialog.dataset.footer = footer ? 'true' : 'false';
        }

        // Assemble modal
        dialogContent.setAttribute('data-name', 'kefin-modal-content');

        dialog.appendChild(dialogContent);
        if (dialogFooter) {
            dialog.appendChild(dialogFooter);
        }
        dialogContainer.appendChild(dialog);

        // Add to DOM
        // Check if the modal backdrop is already in the DOM
        if (!document.body.querySelector('.dialogBackdrop')) {
            document.body.appendChild(backdrop);
        }
        document.body.appendChild(dialogContainer);

        // Create modal instance
        const modalInstance = {
            id,
            backdrop,
            dialogContainer,
            dialog,
            dialogContent,
            dialogHeader,
            dialogFooter,
            isOpen: true,
            close: () => closeModal(id),
            updateContent: (newContent) => updateModalContent(id, newContent),
            addEventListener: (event, handler) => {
                dialog.addEventListener(event, handler);
            }
        };

        // Store modal instance
        activeModals.set(id, modalInstance);
        //lockBodyScroll();

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
        //unlockBodyScroll();

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
        closeAll: closeAllModals,
        applyOpenAnimation
    };
})();
