document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const selectorMethod = document.getElementById('selectorMethod');
  const standardSelector = document.getElementById('standardSelector');
  const customSelectors = document.getElementById('customSelectors');
  const selectorsContainer = document.getElementById('selectors');
  const newSelectorInput = document.getElementById('newSelector');
  const addSelectorButton = document.getElementById('addSelector');
  const scrapeButton = document.getElementById('scrapeButton');
  const monitorToggle = document.getElementById('monitorToggle');
  const monitorStatus = document.getElementById('monitorStatus');
  const result = document.getElementById('result');
  const scrapedText = document.getElementById('scrapedText');
  const copyButton = document.getElementById('copyButton');
  const endpointInput = document.getElementById('endpoint');
  
  // Load saved settings
  chrome.storage.local.get(['selectorMethod', 'selector', 'customSelectors', 'endpoint', 'isMonitoring'], function(data) {
    if (data.selectorMethod) {
      selectorMethod.value = data.selectorMethod;
      toggleSelectorMethod(data.selectorMethod);
    }
    
    if (data.selector) {
      document.getElementById('selector').value = data.selector;
    }
    
    if (data.customSelectors && Array.isArray(data.customSelectors)) {
      data.customSelectors.forEach(selector => addSelectorRow(selector));
    }
    
    if (data.endpoint) {
      endpointInput.value = data.endpoint;
    }
    
    // Update monitoring toggle state
    if (data.isMonitoring) {
      monitorToggle.checked = true;
      monitorStatus.textContent = 'Monitoring: Active';
      monitorStatus.className = 'monitoring-active';
    } else {
      monitorToggle.checked = false;
      monitorStatus.textContent = 'Monitoring: Inactive';
      monitorStatus.className = 'monitoring-inactive';
    }
  });
  
  // Selection method change handler
  selectorMethod.addEventListener('change', function() {
    const method = this.value;
    toggleSelectorMethod(method);
    saveSettings();
  });
  
  function toggleSelectorMethod(method) {
    if (method === 'custom') {
      standardSelector.style.display = 'none';
      customSelectors.style.display = 'block';
    } else {
      standardSelector.style.display = 'block';
      customSelectors.style.display = 'none';
    }
  }
  
  // Add selector button handler
  addSelectorButton.addEventListener('click', function() {
    const newSelector = newSelectorInput.value.trim();
    if (newSelector) {
      addSelectorRow(newSelector);
      newSelectorInput.value = '';
      saveSettings();
    }
  });
  
  // Add selector when pressing Enter
  newSelectorInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      addSelectorButton.click();
    }
  });
  
  // Function to add a new selector row
  function addSelectorRow(selector) {
    const row = document.createElement('div');
    row.className = 'selector-row';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'custom-selector';
    input.value = selector;
    input.addEventListener('change', saveSettings);
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
    removeButton.addEventListener('click', function() {
      row.remove();
      saveSettings();
    });
    
    row.appendChild(input);
    row.appendChild(removeButton);
    selectorsContainer.appendChild(row);
  }
  
  // Save settings to storage
  function saveSettings() {
    const method = selectorMethod.value;
    const selector = document.getElementById('selector').value;
    const endpoint = endpointInput.value;
    
    let customSelectorsArray = [];
    if (method === 'custom') {
      const selectorInputs = document.querySelectorAll('.custom-selector');
      selectorInputs.forEach(input => {
        if (input.value.trim()) {
          customSelectorsArray.push(input.value.trim());
        }
      });
    }
    
    chrome.storage.local.set({
      selectorMethod: method,
      selector: selector,
      customSelectors: customSelectorsArray,
      endpoint: endpoint
    });
  }
  
  // Monitoring toggle handler
  monitorToggle.addEventListener('change', function() {
    const isMonitoring = this.checked;
    
    if (isMonitoring) {
      monitorStatus.textContent = 'Monitoring: Active';
      monitorStatus.className = 'monitoring-active';
    } else {
      monitorStatus.textContent = 'Monitoring: Inactive';
      monitorStatus.className = 'monitoring-inactive';
    }
    
    // Save monitoring state
    chrome.storage.local.set({ isMonitoring: isMonitoring });
    
    // Send message to content script to start/stop monitoring
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: isMonitoring ? 'startMonitoring' : 'stopMonitoring',
          selectors: getSelectors(),
          endpoint: endpointInput.value.trim()
        }
      );
    });
  });
  
  // Get current selectors based on settings
  function getSelectors() {
    const method = selectorMethod.value;
    let selectors = [];
    
    if (method === 'custom') {
      const selectorInputs = document.querySelectorAll('.custom-selector');
      selectorInputs.forEach(input => {
        if (input.value.trim()) {
          selectors.push({
            type: 'css',
            value: input.value.trim()
          });
        }
      });
    } else {
      const selectorValue = document.getElementById('selector').value.trim();
      if (selectorValue) {
        selectors.push({
          type: method,
          value: selectorValue
        });
      }
    }
    
    return selectors;
  }
  
  // Scrape button handler
  scrapeButton.addEventListener('click', function() {
    const selectors = getSelectors();
    
    if (selectors.length === 0) {
      showResult('Please enter at least one valid selector', true);
      return;
    }
    
    // Save settings before scraping
    saveSettings();
    
    // Get current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Send message to content script
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: 'scrapeText',
          selectors: selectors,
          endpoint: endpointInput.value.trim()
        },
        function(response) {
          if (response && response.success) {
            showResult(response.text);
            
            // If monitoring is enabled, automatically start monitoring after manual scrape
            if (monitorToggle.checked) {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: 'startMonitoring',
                  selectors: selectors,
                  endpoint: endpointInput.value.trim()
                }
              );
            }
          } else {
            showResult(response ? response.error : 'Could not connect to the page', true);
          }
        }
      );
    });
  });
  
  // Copy button handler
  copyButton.addEventListener('click', function() {
    const text = scrapedText.textContent;
    navigator.clipboard.writeText(text).then(function() {
      copyButton.textContent = 'Copied!';
      setTimeout(function() {
        copyButton.textContent = 'Copy to Clipboard';
      }, 2000);
    });
  });
  
  // Function to display results
  function showResult(text, isError = false) {
    result.style.display = 'block';
    scrapedText.textContent = text;
    
    if (isError) {
      scrapedText.className = 'error';
    } else {
      scrapedText.className = 'success';
    }
  }
});