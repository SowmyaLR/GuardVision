
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "guardvision-redact",
    title: "GuardVision: Redact PII in this image",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "guardvision-redact") {
    // Store the image URL first to ensure the UI can pick it up even if it's still loading
    chrome.storage.local.set({ pendingImage: info.srcUrl }, () => {
      if (chrome.sidePanel) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    });
  }
});
