(function () {
    'use strict';

    // Remove Twitch's visual subscription restriction cards as they are added.
    function removeFromNode(node) {
        if (!node || node.nodeType !== 1) return;

        if (node.classList?.contains('video-preview-card-restriction')) {
            node.remove();
            return;
        }

        const restrictions = node.getElementsByClassName?.(
            'video-preview-card-restriction'
        );

        if (!restrictions?.length) return;

        // Iterate backwards because the live HTMLCollection shrinks as we remove.
        for (let index = restrictions.length - 1; index >= 0; index--) {
            restrictions[index].remove();
        }
    }

    function sweepExisting() {
        const restrictions = document.getElementsByClassName(
            'video-preview-card-restriction'
        );

        while (restrictions.length) {
            restrictions[0].remove();
        }
    }

    // Run as early as possible.
    sweepExisting();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        removeFromNode(node);
                    }
                }
            }

            // Also catch class changes that turn an element into a restriction card.
            if (
                mutation.type === 'attributes' &&
                mutation.target?.classList?.contains('video-preview-card-restriction')
            ) {
                mutation.target.remove();
            }
        }
    });

    const observerTarget = document.getElementById('root') || document.body;

    if (observerTarget) {
        observer.observe(observerTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    window.addEventListener(
        'beforeunload',
        () => observer.disconnect(),
        { once: true, passive: true }
    );
})();
