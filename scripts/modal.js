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

    const FOCUSABLE_SELECTOR = [
        'button:not([disabled]):not([tabindex="-1"])',
        '[href]:not([tabindex="-1"])',
        'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"])',
        '[role="button"]:not([tabindex="-1"])',
    ].join(',');

    function isTvLayout() {
        return document.documentElement.classList.contains('layout-tv');
    }

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

    function getFocusableElements(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
            if (el.closest('[hidden], [aria-hidden="true"]')) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (el.disabled) return false;
            return true;
        });
    }

    function stampShowFocus(root) {
        if (!root || !isTvLayout()) return;
        root.querySelectorAll('button, a.emby-button, .emby-button, .paper-icon-button-light, [role="button"]').forEach((el) => {
            if (el.getAttribute('tabindex') === '-1') return;
            el.classList.add('show-focus');
        });
    }

    function resolveInitialFocus(root, initialFocus) {
        if (!root) return null;
        if (initialFocus instanceof HTMLElement && root.contains(initialFocus)) {
            return initialFocus;
        }
        if (typeof initialFocus === 'string') {
            const bySelector = root.querySelector(initialFocus);
            if (bySelector) return bySelector;
        }
        return (
            root.querySelector('[data-autofocus]') ||
            root.querySelector('.is-active') ||
            root.querySelector('.selected') ||
            getFocusableElements(root)[0] ||
            null
        );
    }

    /**
     * Position a dialog near an anchor (fixed coords, viewport-clamped).
     * @param {HTMLElement} dialog
     * @param {HTMLElement} anchor
     */
    function positionNearAnchor(dialog, anchor) {
        if (!dialog || !anchor) return;
        const margin = 8;
        const gap = 8;
        const edgeMargin = 16;
        const btnRect = anchor.getBoundingClientRect();
        const dialogWidth = dialog.offsetWidth || dialog.getBoundingClientRect().width || 200;
        const dialogHeight = dialog.offsetHeight || dialog.getBoundingClientRect().height || 120;
        const spaceBelow = window.innerHeight - btnRect.bottom - margin;
        const spaceAbove = btnRect.top - margin;
        const placeBelow = spaceBelow >= Math.min(spaceAbove, 160) || spaceBelow >= spaceAbove;

        let left = btnRect.left;
        left = Math.min(
            Math.max(edgeMargin, left),
            Math.max(edgeMargin, window.innerWidth - dialogWidth - edgeMargin),
        );

        let top;
        if (placeBelow) {
            top = btnRect.bottom + gap;
        } else {
            top = Math.max(margin, btnRect.top - gap - dialogHeight);
        }
        top = Math.min(Math.max(top, margin), window.innerHeight - Math.min(dialogHeight, window.innerHeight - margin * 2) - margin);

        dialog.style.position = 'fixed';
        dialog.style.left = `${left}px`;
        dialog.style.top = `${top}px`;
        dialog.style.margin = '0';
        dialog.style.right = 'auto';
        dialog.style.bottom = 'auto';
    }

    function focusElement(el) {
        if (!el || typeof el.focus !== 'function') return;
        try {
            el.focus({ preventScroll: true });
        } catch (_) {
            el.focus();
        }
    }

    function owningDialog(el) {
        return el && typeof el.closest === 'function' ? el.closest('.dialog') : null;
    }

    function getFocusRows(dialogEl) {
        const rows = Array.from(dialogEl.querySelectorAll('[data-kefin-focus-row]'));
        const withItems = rows.map((row) => ({
            row,
            items: getFocusableElements(row).filter((el) => el.closest('[data-kefin-focus-row]') === row),
        })).filter((entry) => entry.items.length);
        withItems.sort((a, b) => {
            const at = a.row.getBoundingClientRect();
            const bt = b.row.getBoundingClientRect();
            if (Math.abs(at.top - bt.top) > 4) return at.top - bt.top;
            return at.left - bt.left;
        });
        return withItems;
    }

    /**
     * Attach focus trap to a dialog element. Returns a dispose function.
     * @param {HTMLElement} dialogEl
     * @param {{ returnFocusEl?: HTMLElement|null, initialFocusEl?: HTMLElement|string|null, onEscape?: Function|null }} options
     */
    function attachFocusTrap(dialogEl, options = {}) {
        if (!dialogEl) return () => {};
        const returnFocusEl = options.returnFocusEl || null;
        const onEscape = typeof options.onEscape === 'function' ? options.onEscape : null;

        dialogEl.classList.add('focuscontainer');
        stampShowFocus(dialogEl);

        const focusInitial = () => {
            const target = resolveInitialFocus(dialogEl, options.initialFocusEl);
            if (target) {
                focusElement(target);
            } else if (typeof dialogEl.focus === 'function') {
                if (!dialogEl.hasAttribute('tabindex')) dialogEl.setAttribute('tabindex', '-1');
                focusElement(dialogEl);
            }
        };

        requestAnimationFrame(() => {
            requestAnimationFrame(focusInitial);
        });

        const keydownHandler = (e) => {
            if (!dialogEl.isConnected) return;

            const active = document.activeElement;
            const activeDialog = owningDialog(active);
            // Nested/child modal owns keys until it closes
            if (activeDialog && activeDialog !== dialogEl) return;

            const isNavKey = e.key === 'ArrowDown' || e.key === 'ArrowUp'
                || e.key === 'ArrowLeft' || e.key === 'ArrowRight'
                || e.key === 'Tab';

            if (!dialogEl.contains(active) && e.key !== 'Escape') {
                if (isNavKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    focusInitial();
                }
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                if (onEscape) onEscape(e);
                return;
            }

            const focusables = getFocusableElements(dialogEl);
            if (!focusables.length) return;

            const currentIndex = focusables.indexOf(active);
            const at = currentIndex >= 0 ? currentIndex : 0;
            const rows = getFocusRows(dialogEl);
            const useRows = rows.length >= 2;

            const consume = () => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            };

            if (e.key === 'Tab') {
                consume();
                const next = e.shiftKey
                    ? focusables[(at - 1 + focusables.length) % focusables.length]
                    : focusables[(at + 1) % focusables.length];
                focusElement(next);
                return;
            }

            if (useRows && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                consume();
                let rowIndex = rows.findIndex((entry) => entry.items.includes(active));
                if (rowIndex < 0) {
                    rowIndex = rows.findIndex((entry) => entry.row.contains(active));
                }
                if (rowIndex < 0) rowIndex = 0;
                const row = rows[rowIndex];
                let col = row.items.indexOf(active);
                if (col < 0) col = 0;

                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const nextCol = e.key === 'ArrowRight'
                        ? (col + 1) % row.items.length
                        : (col - 1 + row.items.length) % row.items.length;
                    focusElement(row.items[nextCol]);
                    return;
                }

                const nextRowIndex = e.key === 'ArrowDown'
                    ? (rowIndex + 1) % rows.length
                    : (rowIndex - 1 + rows.length) % rows.length;
                const nextRow = rows[nextRowIndex];
                const nextCol = Math.min(col, nextRow.items.length - 1);
                focusElement(nextRow.items[nextCol]);
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                consume();
                focusElement(focusables[(at + 1) % focusables.length]);
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                consume();
                focusElement(focusables[(at - 1 + focusables.length) % focusables.length]);
            }
        };

        // Document capture so Left/Right are not taken by Jellyfin spatial navigation
        document.addEventListener('keydown', keydownHandler, true);

        return () => {
            document.removeEventListener('keydown', keydownHandler, true);
            if (returnFocusEl && typeof returnFocusEl.focus === 'function' && document.contains(returnFocusEl)) {
                focusElement(returnFocusEl);
            }
        };
    }

    /**
     * Create a Jellyfin-style modal dialog
     * @param {Object} options - Modal configuration
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
            dialogStyle,
            returnFocus,
            initialFocus,
            trapFocus,
            anchor = null,
            dialogClassName = '',
        } = options;

        if (!id) {
            throw new Error('Modal ID is required');
        }

        // Remove existing modal if it exists
        removeModal(id);

        const useFixedSize = fixedSize === true
            || (fixedSize !== false && typeof window !== 'undefined' && window.innerWidth < 900);

        let _showCloseButton = showCloseButton;
        if (title == null && showCloseButton === false) {
            _showCloseButton = false;
        } else if (window.innerWidth < 900 && useFixedSize && showCloseButton !== false && title) {
            _showCloseButton = true;
        }

        const shouldTrap = trapFocus === true || (trapFocus !== false && isTvLayout());
        const returnFocusEl =
            returnFocus instanceof HTMLElement
                ? returnFocus
                : document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;

        // Create modal elements
        const backdrop = document.createElement('div');
        backdrop.className = 'dialogBackdrop dialogBackdropOpened';
        backdrop.setAttribute('data-modal-id', id);

        const dialogContainer = document.createElement('div');
        dialogContainer.className = 'dialogContainer';
        dialogContainer.setAttribute('data-modal-id', id);

        const dialog = document.createElement('div');
        const extraClasses = dialogClassName ? ` ${dialogClassName}` : '';
        dialog.className = `focuscontainer dialog smoothScrollY ui-body-a background-theme-a formDialog ${useFixedSize ? 'dialog-fixedSize' : 'centeredDialog'} opened${extraClasses}`;
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
        if (title || _showCloseButton) {
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
            onClose: typeof onClose === 'function' ? onClose : null,
            returnFocusEl,
            close: () => closeModal(id),
            updateContent: (newContent) => updateModalContent(id, newContent),
            addEventListener: (event, handler) => {
                dialog.addEventListener(event, handler);
            },
            _disposeFocusTrap: null,
            _escapeHandler: null,
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

        if (closeOnEscape && !shouldTrap) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(id);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            modalInstance._escapeHandler = escapeHandler;
        }

        if (anchor instanceof HTMLElement) {
            dialog.classList.remove('centeredDialog', 'formDialog', 'smoothScrollY', 'dialog-fixedSize');
            dialog.style.maxHeight = 'none';
            if (dialogContent) {
                dialogContent.style.padding = dialogContent.style.padding || '0.25em 0';
            }
            requestAnimationFrame(() => {
                positionNearAnchor(dialog, anchor);
            });
        }

        if (shouldTrap) {
            modalInstance._disposeFocusTrap = attachFocusTrap(dialog, {
                returnFocusEl,
                initialFocusEl: initialFocus,
                onEscape: closeOnEscape ? () => closeModal(id) : null,
            });
        } else if (isTvLayout()) {
            stampShowFocus(dialog);
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
            modal._escapeHandler = null;
        }

        if (typeof modal._disposeFocusTrap === 'function') {
            modal._disposeFocusTrap();
            modal._disposeFocusTrap = null;
        } else if (modal.returnFocusEl && typeof modal.returnFocusEl.focus === 'function' && document.contains(modal.returnFocusEl)) {
            try {
                modal.returnFocusEl.focus({ preventScroll: true });
            } catch (_) {
                modal.returnFocusEl.focus();
            }
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
        stampShowFocus(modal.dialog);
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
        applyOpenAnimation,
        attachFocusTrap,
        positionNearAnchor,
        getFocusableElements,
    };
})();
