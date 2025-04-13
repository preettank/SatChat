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
  
  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    console.log("Context Menu Clicked: Starting process"); // Basic logging
    
    if (info.menuItemId === 'scrapeSelection') {
      console.log("Scrape Selection Menu Item Selected");
      
      const selectedText = info.selectionText;
      console.log("Selected Text:", selectedText);
      
      // Retrieve endpoint from storage
      chrome.storage.local.get(['endpoint'], function(data) {
        console.log("Endpoint from storage:", data.endpoint);
        
        if (data.endpoint) {
          console.log("Preparing to send fetch request");
          
          fetch(data.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: selectedText,
              source: tab.url,
              timestamp: new Date().toISOString(),
              method: 'context_menu_selection',
              endpoint: tab.url
            })
          })
          .then(response => {
            console.log("Fetch Response Received");
            console.log("Response Status:", response.status);
            return response.json();
          })
          .then(data => {
            console.log("Parsed Response Data:", data);
          })
          .catch(error => {
            console.error("Fetch Error:", error);
          });
        } else {
          console.warn("No endpoint configured in storage");
        }
      });
    }
  });
  