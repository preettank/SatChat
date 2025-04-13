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
      endpoint: '',
      isMonitoring: false
    });
  }
});

// Listen for context menu clicks if you want to add right-click functionality
chrome.contextMenus?.create({
  id: 'scrapeSelection',
  title: 'Scrape this text',
  contexts: ['selection']
});

// Add a monitoring toggle to the context menu
chrome.contextMenus?.create({
  id: 'toggleMonitoring',
  title: 'Toggle auto-monitoring',
  contexts: ['page']
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
          
          // If there's a reply, send it to Google Voice
          if (data.reply) {
            chrome.tabs.query({url: '*://voice.google.com/*'}, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'sendMessage',
                  text: data.reply
                });
              }
            });
          }
        })
        .catch(error => {
          console.error("Fetch Error:", error);
        });
      } else {
        console.warn("No endpoint configured in storage");
      }
    });
  }
  else if (info.menuItemId === 'toggleMonitoring') {
    // Toggle monitoring state
    chrome.storage.local.get(['isMonitoring'], function(data) {
      const newMonitoringState = !data.isMonitoring;
      
      // Update storage
      chrome.storage.local.set({ isMonitoring: newMonitoringState });
      
      // Get selectors and endpoint to pass to content script
      chrome.storage.local.get(['selectorMethod', 'selector', 'customSelectors', 'endpoint'], function(settings) {
        let selectors = [];
        
        if (settings.selectorMethod === 'custom' && Array.isArray(settings.customSelectors)) {
          settings.customSelectors.forEach(selector => {
            selectors.push({
              type: 'css',
              value: selector
            });
          });
        } else if (settings.selector) {
          selectors.push({
            type: settings.selectorMethod || 'css',
            value: settings.selector
          });
        }
        
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
          action: newMonitoringState ? 'startMonitoring' : 'stopMonitoring',
          selectors: selectors,
          endpoint: settings.endpoint
        });
        
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: 'Text Scraper',
          message: newMonitoringState ? 'Monitoring activated' : 'Monitoring deactivated'
        });
      });
    });
  }
});

// Listen for monitoring status changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'monitoringStatusChanged') {
    // Update badge to indicate monitoring status
    chrome.action.setBadgeText({ 
      text: request.isMonitoring ? 'ON' : '',
      tabId: sender.tab.id
    });
    
    // Set badge color
    chrome.action.setBadgeBackgroundColor({ 
      color: request.isMonitoring ? '#4CAF50' : '#F44336',
      tabId: sender.tab.id
    });
    
    // Store monitoring state
    chrome.storage.local.set({ isMonitoring: request.isMonitoring });
  }
});

// Handle scraping text message
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