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

  // In background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendGeneratedMessageToVoice') {
    // Find the active Google Voice tab
    chrome.tabs.query({url: '*://voice.google.com/*'}, (tabs) => {
      if (tabs.length > 0) {
        // Send message to the first Google Voice tab
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'sendVoiceMessage',
          text: request.text
        }, (response) => {
          console.log('Send message response:', response);
          sendResponse(response);
        });
      } else {
        sendResponse({ 
          success: false, 
          message: 'No Google Voice tab found' 
        });
      }
    });
    return true; // Required for async sendResponse
  }
});

// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeText') {
    // Forward the scraping request to the content script of the active tab
    chrome.tabs.query({url: '*://voice.google.com/*', active: true}, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'scrapeText',
          text: request.text,
          endpoint: request.endpoint
        }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true; // Enable async response
  }
  
  if (request.action === 'sendToGoogleVoice') {
    // Find the active Google Voice tab
    chrome.tabs.query({url: '*://voice.google.com/*'}, (tabs) => {
      if (tabs.length > 0) {
        // Send message to the first Google Voice tab
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'sendMessage',
          text: request.text
        }, (response) => {
          console.log('Send message response:', response);
          sendResponse(response);
        });
      } else {
        sendResponse({ 
          success: false, 
          message: 'No Google Voice tab found' 
        });
      }
    });
    return true; // Required for async sendResponse
  }
});
