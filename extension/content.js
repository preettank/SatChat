// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'scrapeText') {
      const result = scrapeTextFromPage(request.selectors);
      
      // If endpoint is provided, send the data to the endpoint
      if (request.endpoint && result.success) {
        sendToEndpoint(result.text, request.endpoint)
          .then(response => {
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