// Service worker for the Chrome extension
// This handles background tasks and ensures the extension remains active

// Set up initial default settings when the extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
      // Set default settings
      chrome.storage.local.set({
        selectorMethod: 'css',
        selector: '.message, .text-message, .sms-message',
        customSelectors: ['.message', '.text-message', '.message-body'],
        endpoint: ''
      });
    }
  });
  
  // Listen for context menu clicks if you want to add right-click functionality
  chrome.contextMenus?.create({
    id: 'scrapeSelection',
    title: 'Scrape this text',
    contexts: ['selection']
  });
  
  // Handle context menu clicks
  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'scrapeSelection') {
      const selectedText = info.selectionText;
      
      // Store the selected text
      chrome.storage.local.set({ lastScrapedText: selectedText });
      
      // Optionally send to endpoint if configured
      chrome.storage.local.get(['endpoint'], function(data) {
        if (data.endpoint) {
          // Send to the endpoint
          fetch(data.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: selectedText,
              source: tab.url,
              timestamp: new Date().toISOString(),
              method: 'context_menu_selection'
            })
          }).then(response => {
            console.log('Sent selected text to endpoint');
          }).catch(error => {
            console.error('Error sending to endpoint:', error);
          });
        }
      });
    }
  });
  
  // Optional: Set up a listener for messages from popup or content script
  // This can be used for more complex background processing
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processInBackground') {
      // Do some background processing here
      const result = doSomeProcessing(request.data);
      sendResponse({ success: true, result: result });
    }
    return true; // Keep the messaging channel open for async responses
  });
  
  // Example background processing function
  function doSomeProcessing(data) {
    // This is just a placeholder for any background processing you might need
    return {
      processed: true,
      originalData: data,
      timestamp: new Date().toISOString()
    };
  }