// In background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateFirebase") {
    // Firebase has been removed.
    // You can log the data or handle it in another way if needed.
    console.log("Received category update:", message.data.category, "Increment by:", message.data.increment);
  }
});
