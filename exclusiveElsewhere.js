/* 
Exclusive Elsewhere
Modifies the behavior of the Jellyfin Enhanced Elsewhere functionality
Adds custom branding when the item is not available on any selected streaming services

If you want to add an icon to the text you can do so by targeting the "exclusive" class.

For example:
.streaming-lookup-container a.exclusive::after {
    content: '';
    background: url(/path/to/icon.png);
    background-size: contain;
    background-repeat: no-repeat;
    width: 25px;
    height: 25px;
    display: inline-block;
    margin-left: 0.5rem;
} 
*/

(function () {
    const observer = new MutationObserver(() => {
        const link = document.querySelector('.itemDetailPage:not(.hide) .streaming-lookup-container>div>div:first-child a');
        if (link && link.innerHTML.trim() === "Not available on any streaming services in Canada") {
            link.innerHTML = "Only available on ";
            link.classList.add("exclusive");
            link.title = "24kev.in Exclusive"
            link.disable = true;
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
})();