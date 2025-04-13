let lastScrapedText = null;
let monitoringInterval = null;
let currentSelectors = [];
let currentEndpoint = '';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'scrapeText') {
    const result = scrapeTextFromPage(request.selectors);
    
    // Store the last scraped text for comparison during monitoring
    if (result.success) {
      lastScrapedText = result.text;
    }
    
    // If endpoint is provided, send the data to the endpoint
    if (request.endpoint && result.success) {
      sendToEndpoint(result.text, request.endpoint, result.phone)
        .then(response => {
          // Handle auto-reply if available
          if (response.reply) {
            chrome.runtime.sendMessage({
              action: 'sendToGoogleVoice', 
              text: response.reply 
            }, (response) => {
              console.log('Google Voice message send result:', response);
            });
          }
          
          sendResponse({ 
            success: true, 
            text: result.text,
            phone: result.phone,
            apiResponse: response
          });
        })
        .catch(error => {
          sendResponse({ 
            success: true, 
            text: result.text,
            phone: result.phone,
            apiError: `Failed to send to API: ${error.message}`
          });
        });
      return true; // Keep the messaging channel open for the async response
    }
    
    // Otherwise just return the scraped text
    sendResponse(result);
  }
  else if (request.action === 'startMonitoring') {
    startTextMonitoring(request.selectors, request.endpoint);
    sendResponse({ success: true, message: 'Monitoring started' });
  }
  else if (request.action === 'stopMonitoring') {
    stopTextMonitoring();
    sendResponse({ success: true, message: 'Monitoring stopped' });
  }
  else if (request.action === 'sendMessage') {
    sendGoogleVoiceMessage(request.text)
      .then(success => {
        sendResponse({ 
          success: success,
          message: success ? 'Message sent successfully' : 'Failed to send message'
        });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          message: `Error: ${error.message}`
        });
      });
    
    return true; // Required for async sendResponse
  }
  
  return true; // Enable async response
});

function startTextMonitoring(selectors, endpoint) {
  // Store the current selectors and endpoint for use in the monitoring function
  currentSelectors = selectors;
  currentEndpoint = endpoint;
  
  // Stop any existing monitoring
  stopTextMonitoring();
  
  console.log('Starting text monitoring with selectors:', selectors);
  
  // Start the monitoring interval
  monitoringInterval = setInterval(() => {
    const result = scrapeTextFromPage(currentSelectors);
    
    if (result.success) {
      // If the text has changed and isn't empty
      if (result.text && result.text !== lastScrapedText) {
        console.log('Text change detected:', result.text);
        
        // Send to endpoint if provided
        if (currentEndpoint) {
          sendToEndpoint(result.text, currentEndpoint, result.phone)
            .then(response => {
              console.log('API Response:', response);
              
              // Auto-reply if available
              if (response.reply) {
                chrome.runtime.sendMessage({
                  action: 'sendToGoogleVoice', 
                  text: response.reply 
                }, (sendResponse) => {
                  console.log('Google Voice message send result:', sendResponse);
                });
              }
            })
            .catch(error => {
              console.error('API Error:', error);
            });
        }
        
        // Update the last scraped text
        lastScrapedText = result.text;
      }
    }
  }, 3000); // Check every 3 seconds - adjust as needed
  
  // Notify background script that monitoring is active
  chrome.runtime.sendMessage({ action: 'monitoringStatusChanged', isMonitoring: true });
}

function stopTextMonitoring() {
  if (monitoringInterval) {
    console.log('Stopping text monitoring');
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    
    // Notify background script that monitoring is inactive
    chrome.runtime.sendMessage({ action: 'monitoringStatusChanged', isMonitoring: false });
  }
}

function scrapeTextFromPage(selectors) {
  try {
    let results = [];
    let phoneNumber = null;
    
    // Select all incoming messages
    const incomingMessageSelector = '.message-row:not(.outgoing)';
    const messageElements = document.querySelectorAll(incomingMessageSelector);
    
    // Get the last incoming message
    if (messageElements.length > 0) {
      const lastMessage = messageElements[messageElements.length - 1];
      const messageContent = lastMessage.querySelector('.subject-content-container .content');
      
      if (messageContent) {
        const text = messageContent.textContent.trim();
        if (text) {
          results.push(text);
        }
      }
    }
    
    // Extract phone number
    const phoneNumberElement = document.querySelector('.secondary-text');
    if (phoneNumberElement) {
      phoneNumber = phoneNumberElement.textContent.trim().replace(/[^\d]/g, '');
    }
    
    if (results.length === 0) {
      return {
        success: false,
        error: 'No incoming messages found'
      };
    }
    
    return {
      success: true,
      text: results[0], // Just the last message
      phone: phoneNumber
    };
  } catch (error) {
    return {
      success: false,
      error: `Error scraping text: ${error.message}`
    };
  }
}

async function sendToEndpoint(text, endpoint, phoneNumber = null) {
  console.log('Sending to endpoint:', {
    endpoint: endpoint,
    text: text,
    phone: phoneNumber,
    source: window.location.href
  });

  try {
    const payload = JSON.stringify({
      text: text,
      phone: phoneNumber,
      source: window.location.href,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'omit', // Prevents sending cookies
      body: payload
    });
    
    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', {
        status: response.status,
        statusText: response.statusText,
        errorDetails: errorText
      });
      
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    // Parse JSON response
    const jsonResponse = await response.json();
    console.log('API Response:', jsonResponse);
    
    return jsonResponse;
  } catch (error) {
    console.error('Error in sendToEndpoint:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    throw error;
  }
}

function sendGoogleVoiceMessage(messageText) {
  // Find the textarea
  const textarea = document.querySelector('textarea.message-input');
  
  if (!textarea) {
    console.error('Could not find message input textarea');
    return Promise.resolve(false);
  }
  
  // Simulate user input by setting value and dispatching events
  textarea.value = messageText;
  
  // Dispatch input and change events to trigger Angular/React bindings
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  
  textarea.dispatchEvent(inputEvent);
  textarea.dispatchEvent(changeEvent);
  
  // Find the send button
  const sendButton = document.querySelector('button[aria-label="Send message"]');
  
  if (!sendButton) {
    console.error('Could not find send button');
    return Promise.resolve(false);
  }
  
  // Try multiple methods to enable the button
  function attemptButtonClick() {
    // Method 1: Remove disabled attribute
    sendButton.removeAttribute('disabled');
    
    // Method 2: Set disabled to false
    sendButton.disabled = false;
    
    // Method 3: Simulate mouse events
    const mouseOverEvent = new MouseEvent('mouseover', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    const mouseDownEvent = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    const mouseUpEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    sendButton.dispatchEvent(mouseOverEvent);
    sendButton.dispatchEvent(mouseDownEvent);
    sendButton.dispatchEvent(mouseUpEvent);
  }
  
  // Attempt to enable the button
  attemptButtonClick();
  
  // Add a delay before clicking to ensure all events have processed
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        // Final attempt to click the button
        sendButton.click();
        
        console.log('Message sent successfully');
        resolve(true);
      } catch (error) {
        console.error('Failed to click send button', error);
        resolve(false);
      }
    }, 500); // 500ms delay
  });
}

// Check if monitoring was active before and restart it on page load/reload
window.addEventListener('load', () => {
  chrome.storage.local.get(['isMonitoring', 'selectorMethod', 'selector', 'customSelectors', 'endpoint'], function(data) {
    if (data.isMonitoring) {
      // Recreate selectors from storage
      let selectors = [];
      
      if (data.selectorMethod === 'custom' && Array.isArray(data.customSelectors)) {
        data.customSelectors.forEach(selector => {
          selectors.push({
            type: 'css',
            value: selector
          });
        });
      } else if (data.selector) {
        selectors.push({
          type: data.selectorMethod || 'css',
          value: data.selector
        });
      }
      
      // Start monitoring if we have valid selectors
      if (selectors.length > 0 && data.endpoint) {
        startTextMonitoring(selectors, data.endpoint);
      }
    }
  });
});