chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      function extractCustomer() {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const mRefRegex = /\bM\d{10,20}\b/g;

        const pElements = document.getElementsByTagName("p");
        const allText = Array.from(pElements)
          .map(el => el.textContent)
          .join(" ");
      
        const emailMatches = allText.match(emailRegex);
        const subscriptionMatches = allText.match(mRefRegex);
      
        return {
          email: emailMatches ? emailMatches[emailMatches.length - 1] : null,
          subscription: subscriptionMatches ? subscriptionMatches[subscriptionMatches.length - 1] : null,
        };
      }
    
      function isWhatsappChat() {
        const titleElement = document.querySelector("title");
        if (!titleElement) return false;
        return /^\d+$/.test(titleElement.textContent.trim());
      }

      async function getCustomer(csrfToken,customerEmail) {
        
        if (!customerEmail) {
          throw new Error("No email address found in the conversation.");
        }
        
        const searchPayload = {
          jsonrpc: "2.0",
          method: "call",
          params: {
            model: "res.partner",
            method: "search",
            args: [
              [
                ["email", "=", customerEmail],
                ["active", "in", [true, false]],
              ]
            ],
            kwargs: {
              limit: 1,
            },
          },
          id: Date.now(),
        };
        
        const response = await fetch("/web/dataset/call_kw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify(searchPayload),
        });

        const result = await response.json();
        console.log("Search partner result:", result);
        
        // Check if a partner was found
        if (result.result && result.result.length > 0) {
          return result.result[0];
        }
        
        // If no partner was found, throw an error
        throw new Error(`No contact found with email: ${customerEmail}`);
      }

      async function getSub(csrfToken, clientOrderRef) {
        const payload = {
          jsonrpc: "2.0",
          method: "call",
          params: {
            model: "sale.order",
            method: "search",
            args: [
              [
                ["display_name", "ilike", clientOrderRef],
                ["database_ids", "!=", false]
              ]
            ],
            kwargs: {
              limit: 1,
              order: "create_date desc",
            },
          },
          id: Date.now(),
        };

        const response = await fetch("/web/dataset/call_kw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log("Sale order lookup:", result);
        if (result.result && result.result.length > 0) {
          return result.result[0];
        }
        return null;
      }
      const { email, subscription } = extractCustomer();
      const description = `<a href="${window.location.href}"><strong>Conversation</strong></a><br><pre>${request.message ? request.message : ""}</pre>`;
      const stage = parseInt(request.ticketType)
      if (window.location.hostname.includes("odoo.com")) {
        let csrfToken = null;
        let uid = null;
        const scripts = document.querySelectorAll(
          "script[type='text/javascript']"
        );

        scripts.forEach((script) => {
          if (script.textContent.includes("odoo.__session_info__")) {
            const match = script.textContent.match(
              /odoo.__session_info__\s*=\s*({.*});/
            );
            if (match) {
              try {
                const sessionInfo = JSON.parse(match[1]);
                uid = sessionInfo.uid || null;
              } catch (error) {
                console.error("Failed to parse session info JSON", error);
              }
            }
          }
          if (script.id === "web.layout.odooscript") {
            try {
              const match = script.textContent.match(/csrf_token:\s*"([^"]+)"/);
              if (match) {
                csrfToken = match[1];
              }
            } catch (error) {
              console.error(
                "Failed to extract CSRF token or session info",
                error
              );
            }
          }
        });

        if (!csrfToken || !uid) {
          sendResponse({
            success: false,
            error: "Failed to extract CSRF token or UID.",
          });
          return;
        }
        
        try {
          const customer_id = await getCustomer(csrfToken,email);
          const subscription_id = subscription? await getSub(csrfToken,subscription): null;
          const payload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
              model: "project.task",
              method: "create",
              args: [
                {
                  name: request.ticketTitle,
                  project_id: 49,
                  description: description,
                  reviewer_id: null,
                  partner_id: customer_id,
                  user_ids: [],
                  stage_id: stage,
                  tag_ids: stage == 193? [2015,37442,request.ticketTagId]:[37442,request.ticketTagId],
                  message_partner_ids: [customer_id],
                  mnt_subscription_id: subscription_id
                },
              ],
              kwargs: {},
            },
            id: Date.now(),
          };
          if (isWhatsappChat()) {
            payload.params.args[0].stage_id = 72135;
          }
          const response = await fetch("/web/dataset/call_kw", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          const result = await response.json();
          if (result.error) {
            sendResponse({ success: false, error: result.error.data.message });
          } else {
            const url = `https://www.odoo.com/odoo/project.task/${result.result}`;
            sendResponse({
              success: true,
              taskId: result.result,
              ticket: url,
            });
            window.open(url, '_blank');
          }
        } catch (error) {
          // This will send the error to popup.js for red error display
          sendResponse({
            success: false,
            error: error.message,
          });
        }
      } else {
        sendResponse({
          success: false,
          error: "Invalid URL or missing active_id.",
        });
      }
    } catch (error) {
      console.error("Error processing request:", error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});