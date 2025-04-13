
let lastMessageText = null;

function checkForNewMessage() {
  // Selector for the most recent message in the message log
  const messageElements = document.querySelectorAll('.message-list-item');
  
  if (messageElements.length === 0) {
    return null;
  }
  
  // Get the most recent message
  const latestMessage = messageElements[messageElements.length - 1];
  
  // Extract message text (adjust selector as needed)
  const messageTextElement = latestMessage.querySelector('.message-text');
  
  if (!messageTextElement) {
    return null;
  }
  
  const currentMessageText = messageTextElement.textContent.trim();
  
  return currentMessageText;
}

function startMessageMonitoring() {
  // Function to check for new messages
  setInterval(() => {
    const currentMessage = checkForNewMessage();
    
    if (currentMessage && currentMessage !== lastMessageText) {
      console.log('New message detected:', currentMessage);
      
      // Send message to backend
      chrome.runtime.sendMessage({
        action: 'scrapeText',
        text: currentMessage,
        endpoint: 'YOUR_BACKEND_ENDPOINT_URL'
      }, (response) => {
        if (response.apiResponse && response.apiResponse.reply) {
          // Automatically send reply to Google Voice
          chrome.runtime.sendMessage({
            action: 'sendToGoogleVoice', 
            text: response.apiResponse.reply 
          }, (sendResponse) => {
            console.log('Google Voice message send result:', sendResponse);
          });
        }
      });
      
      // Update last message to prevent re-processing
      lastMessageText = currentMessage;
    }
  }, 1000); // Check every 1 second
}

// Start monitoring when the page loads
window.addEventListener('load', startMessageMonitoring);

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'scrapeText') {
    const result = scrapeTextFromPage(request.selectors);
    
    // If endpoint is provided, send the data to the endpoint
    if (request.endpoint && result.success) {
      sendToEndpoint(result.text, request.endpoint)
        .then(response => {
          // Add this block here
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
            apiResponse: response
          });
        })
        .catch(error => {
          sendResponse({ 
            success: true, 
            text: result.text,
            apiError: `Failed to send to API: ${error.message}`
          });
        });
      return true; // Keep the messaging channel open for the async response
    }
    
    // Otherwise just return the scraped text
    sendResponse(result);
  }
  return true;
});

function sendGoogleVoiceMessage(messageText) {
  // Find the textarea
  const textarea = document.querySelector('textarea.message-input');
  
  if (!textarea) {
    console.error('Could not find message input textarea');
    return false;
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
    return false;
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
  
  /**
   * Scrape text from the page based on provided selectors
   * @param {Array} selectors - Array of selector objects with type and value
   * @returns {Object} - Result object with success status and text or error
   */
  function scrapeTextFromPage(selectors) {
    try {
      let results = [];
      
      selectors.forEach(selector => {
        let elements;
        
        if (selector.type === 'css') {
          elements = document.querySelectorAll(selector.value);
        } else if (selector.type === 'xpath') {
          const xpathResult = document.evaluate(
            selector.value,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          
          elements = [];
          for (let i = 0; i < xpathResult.snapshotLength; i++) {
            elements.push(xpathResult.snapshotItem(i));
          }
        }
        
        if (elements && elements.length > 0) {
          Array.from(elements).forEach(element => {
            // Get text content of the element
            const text = element.textContent.trim();
            if (text) {
              results.push(text);
            }
            
            // If it's an input or textarea, get its value
            if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') && element.value) {
              results.push(element.value.trim());
            }
          });
        }
      });
      
      if (results.length === 0) {
        return {
          success: false,
          error: 'No elements matched the provided selectors'
        };
      }
      
      return {
        success: true,
        text: results.join('\n\n')
      };
    } catch (error) {
      return {
        success: false,
        error: `Error scraping text: ${error.message}`
      };
    }
  }
  
  /**
   * Send scraped text to the provided API endpoint
   * @param {string} text - The scraped text
   * @param {string} endpoint - The API endpoint URL
   * @returns {Promise} - Promise resolving with the API response
   */
  async function sendToEndpoint(text, endpoint) {
  console.log('Sending to endpoint:', {
    endpoint: endpoint,
    text: text,
    source: window.location.href
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        source: window.location.href,
        timestamp: new Date().toISOString()
      })
    });
    
    console.log('Response status:', response.status);

    if (!response.ok) {
      // Try to get error text from the response
      const errorText = await response.text();
      console.error('Endpoint error response:', errorText);
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    const jsonResponse = await response.json();
    console.log('Parsed JSON response:', jsonResponse);
    
    return jsonResponse;
  } catch (error) {
    console.error('Error in sendToEndpoint:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    throw error;  // Re-throw to allow caller to handle
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
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
});
