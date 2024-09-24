function extractEmails() {
    const bodyText = document.body.innerText;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = bodyText.match(emailRegex) || [];
    return [...new Set(emails)]; // Return unique emails
  }
  