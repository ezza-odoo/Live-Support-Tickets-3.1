document.getElementById("ticketForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const descriptionInput = document.getElementById("descriptionInput");
  const description = descriptionInput ? descriptionInput.value.trim() : null;
  const titleInput = document.getElementById("title");
  const ticketTitle = titleInput ? titleInput.value.trim() : null;
  const ticketStage = document.querySelector('input[name="stage"]:checked').value;

  const tagSelector = document.getElementById("tagSelector");
  const ticketTagId = tagSelector && tagSelector.value ? parseInt(tagSelector.value, 10) : null;
  
  const loadingElement = document.createElement("div");
  loadingElement.className = "loading";
  loadingElement.textContent = "Creating ticket...";
  loadingElement.style.textAlign = "center";
  loadingElement.style.margin = "20px";
  loadingElement.style.fontWeight = "bold";
  document.body.appendChild(loadingElement);
  adjustPopupSize();

  chrome.storage.local.get("lastActiveTabId", ({ lastActiveTabId }) => {
    if (lastActiveTabId) {
      chrome.tabs.get(lastActiveTabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn("Failed to access stored tab:", chrome.runtime.lastError.message);
          fallbackSearch();
        } else if (isOdooDiscussTab(tab)) {
          sendToOdooTab(tab);
        } else {
          fallbackSearch();
        }
      });
    } else {
      fallbackSearch();
    }
  });

  // Step 2: Fallback to scan all tabs
  function fallbackSearch() {
    chrome.tabs.query({}, (allTabs) => {
      const odooTab = allTabs.find(isOdooDiscussTab);
      if (odooTab) {
        sendToOdooTab(odooTab);
      } else {
        document.body.removeChild(loadingElement);
        showError("No Odoo Discuss tab found. Please open it and try again.");
      }
    });
  }

  // Tab validation logic
  function isOdooDiscussTab(tab) {
    if (!tab.url) return false;
    try {
      const url = new URL(tab.url);
      return (
        url.hostname === "www.odoo.com" &&
        (
          url.searchParams.has("active_id") ||
          url.href.includes("odoo.com/odoo/discuss") ||
          url.href.includes("action_discuss")
        )
      );
    } catch {
      return false;
    }
  }

  // Send message to tab
  function sendToOdooTab(tab) {
    try {
      chrome.tabs.sendMessage(
        tab.id,
        { 
          message: description, 
          ticketType: ticketStage, 
          ticketTitle: ticketTitle,
          ticketTagId: ticketTagId,
        },
        (response) => {
          document.body.removeChild(loadingElement);

          if (chrome.runtime.lastError) {
            console.error("Message error:", chrome.runtime.lastError.message);
            showError("Error reaching chat: Ensure that the open Discuss tab has an active chat.");
          } else if (response && response.success) {
            showSuccess(response.ticket);
          } else {
            console.error("Error from content script:", response?.error || "Unknown error");
            showError(response?.error || "An unknown error occurred");
          }
        }
      );
    } catch (err) {
      document.body.removeChild(loadingElement);
      console.error("Error preparing message:", err);
      showError("Something went wrong while preparing the request.");
    }
  }
});

function adjustPopupSize() {
  setTimeout(() => {
    const body = document.body;
    const html = document.documentElement;

    // Get the max of body and html dimensions
    const width = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth
    );

    const height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight
    );

    // Add some padding buffer to avoid scrollbars
    const paddedWidth = Math.ceil(width + 20);
    const paddedHeight = Math.ceil(height + 20);

    window.resizeTo(paddedWidth, paddedHeight);
  }, 10);
}

/**
 * Shows a success message and link to the created ticket
 * @param {string} ticketUrl - URL to the created ticket
 */
function showSuccess(ticketUrl) {
  document.body.classList.add("success");
  document.querySelector(".success-text").classList.remove("hide");

  const ticketButton = document.createElement("a");
  ticketButton.href = ticketUrl;
  ticketButton.target = "_blank";
  ticketButton.textContent = "Ticket";
  ticketButton.style.display = "block";
  ticketButton.style.margin = "20px auto 0"; 
  ticketButton.style.width = "70%";
  ticketButton.style.padding = "10px";
  ticketButton.style.textAlign = "center";
  ticketButton.style.backgroundColor = "#007bff";
  ticketButton.style.color = "#fff";
  ticketButton.style.border = "none";
  ticketButton.style.borderRadius = "5px";
  ticketButton.style.textDecoration = "none";
  ticketButton.style.fontSize = "16px";
  ticketButton.style.cursor = "pointer";
  ticketButton.style.fontWeight = "bold";

  document.body.appendChild(ticketButton);
  adjustPopupSize();

  setTimeout(() => {
    window.close();
  }, 5000);
}

/**
 * Shows an error message to the user
 * @param {string} errorMessage - The error message to display
 */
function showError(errorMessage) {
  const form = document.getElementById("ticketForm");
  form.style.display = "none";

  document.body.classList.add("failed");
  const failedTextElement = document.querySelector(".failed-text");

  failedTextElement.removeAttribute("style");
  failedTextElement.textContent = errorMessage;
  failedTextElement.classList.remove("hide");

  failedTextElement.style.color = "#721c24";
  failedTextElement.style.backgroundColor = "#f8d7da";
  failedTextElement.style.border = "1px solid #f5c6cb";
  failedTextElement.style.borderRadius = "5px";
  failedTextElement.style.padding = "15px";
  failedTextElement.style.margin = "20px auto";
  failedTextElement.style.display = "block";
  failedTextElement.style.textAlign = "center";
  failedTextElement.style.maxWidth = "90%";
  failedTextElement.style.boxSizing = "border-box";
  failedTextElement.style.wordWrap = "break-word";
  failedTextElement.style.fontSize = "14px";
  failedTextElement.style.fontWeight = "bold";
  failedTextElement.style.lineHeight = "1.4";

  adjustPopupSize();

  setTimeout(() => {
    window.close();
  }, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  adjustPopupSize();
  const stageRadios = document.querySelectorAll('input[name="stage"]');
  const tagContainer = document.getElementById("tagContainer");
  const tagSelector = document.getElementById("tagSelector");

  stageRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
      if (event.target.id === 'stage-func') {
        tagContainer.style.display = 'block';
        tagSelector.required = true;
      } else {
        tagContainer.style.display = 'none';
        tagSelector.required = false;
        tagSelector.value = '';
      }
      adjustPopupSize(); 
    });
  });
});