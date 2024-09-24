const accessToken = 'YOUR-ACCESS-TOKEN';

const statusMessage = document.getElementById("statusMessage");

let extractedEmails = [];
let isEmailsExtracted = false;

document.getElementById("extractHubSpot").addEventListener("click", () => {
  handleEmailExtraction("HubSpot");
});

document.getElementById("extractCSV").addEventListener("click", () => {
  handleEmailExtraction("CSV");
});

function handleEmailExtraction(output) {
  if (!isEmailsExtracted) {
    statusMessage.textContent = 'Extracting emails...';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: extractEmails
      }, (results) => {
        if (results && results[0] && results[0].result) {
          extractedEmails = results[0].result.map(([email, name]) => ({ email, name }));
          isEmailsExtracted = true;
          processEmails(output);
        } else {
          statusMessage.textContent = 'No emails found on the page.';
        }
      });
    });
  } else {
    processEmails(output);
  }
}


function processEmails(output) {
  if (output === "HubSpot") {
    addEmailsToHubSpot(extractedEmails);
  } else if (output === "CSV") {
    downloadEmailsAsCSV(extractedEmails);
  }
}

function addEmailsToHubSpot(contacts) {
  let successfullyAdded = 0;
  let totalContacts = contacts.length;

  if (totalContacts === 0) {
    statusMessage.textContent = 'No emails found.';
    return;
  }

  contacts.forEach(({ email, name }, index) => {
    const nameParts = name.trim().split(' ');
    const first = nameParts.slice(0, -1).join(' ');
    const last = nameParts[nameParts.length - 1];

    fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        properties: {
          email: email,
          firstname: first,
          lastname: last
        }
      })
    })
    .then(response => {
      if (response.ok) {
        successfullyAdded++;
      }
      if (index === totalContacts - 1) {
        updateStatusMessage(successfullyAdded, totalContacts);
      }
    })
    .catch(error => {
      console.error(`Error adding email ${email}:`, error);
      if (index === totalContacts - 1) {
        updateStatusMessage(successfullyAdded, totalContacts);
      }
    });
  });
}

function updateStatusMessage(successfullyAdded, totalContacts) {
  if (successfullyAdded > 0) {
    statusMessage.textContent = `${successfullyAdded} out of ${totalContacts} contacts successfully added to HubSpot.`;
  } else {
    statusMessage.textContent = 'No contacts were added to HubSpot.';
  }
}

function downloadEmailsAsCSV(contacts) {
  const csvHeader = "Email,Name\n";
  const csvRows = contacts.map(({ email, name }) => `${email},${name}`).join("\n");
  const csvContent = csvHeader + csvRows;
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  window.location.href = url;
}

function extractEmails() {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  const getEmailsFromMailtoLinks = (element) => {
      const mailtoLinks = Array.from(element.querySelectorAll('a[href^="mailto:"]'));
      if (mailtoLinks.length == 0) {
        return [];
      }
      return mailtoLinks.map(link => ({
          email: link.href.replace(/^mailto:/i, '').trim(),
          element: link
      })).filter(({ email }) => email.match(emailRegex));
  };

  const emailNamePairs = new Map();

  const findEmailStructures = () => {
      const foundEmailsMap = new Map();

      document.querySelectorAll('*').forEach(element => {
          const emailsInText = element.innerText ? (element.innerText.match(emailRegex) || []) : [];
          
          for (const email of emailsInText) {
              if (!foundEmailsMap.has(email)) {
                  foundEmailsMap.set(email, element);
              }
          }

          const mailtoLinks = getEmailsFromMailtoLinks(element);
          
          for (const { email, element: mailtoElement } of mailtoLinks) {
              if (!foundEmailsMap.has(email)) {
                  foundEmailsMap.set(email, mailtoElement);
              }
          }
      });

      const foundEmails = Array.from(foundEmailsMap.entries()).map(([email, element]) => ({
        email,
        element
      }));

      if (foundEmails.length > 0) {
          foundEmails.forEach(({ email, element: emailElement }) => {
              let currentElement = emailElement.parentElement;
              let previousElement = emailElement;
              while (currentElement) {
                  const siblingElements = Array.from(currentElement.children).filter(el => el !== previousElement);

                  const potentialEmails = siblingElements.flatMap(el => {
                      const emailsInText = el.innerText ? (el.innerText.match(emailRegex) || []) : [];
                      const emailsInLinks = getEmailsFromMailtoLinks(el);
                      const combinedEmails = [...emailsInText, ...emailsInLinks];
                      return combinedEmails;
                  });

                  if (potentialEmails.length >= 1) {
                      currentElement = previousElement;

                      const nameRegex = /^[\p{L} ,.'-]+$/u;
                      const names = [];

                      currentElement.querySelectorAll('*').forEach(el => {
                          if (el.innerText) {
                            const foundNames = el.innerText.match(nameRegex);
                            if (foundNames) {
                              names.push(...foundNames);
                            }
                          }
                      });

                      const matchingNames = names.filter(name => {
                        const nameWords = name.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").split(/\s+/);
                        if (nameWords.some(word => email.toLowerCase().includes(word))) {
                          return true;
                        };
                        return false;
                      });

                      emailNamePairs.set(email, matchingNames[0]);

                      break;
                  }

                  previousElement = currentElement; 
                  currentElement = currentElement.parentElement;
              }                  
          });
      }
  };

  findEmailStructures();

  return Array.from(emailNamePairs.entries());
}

