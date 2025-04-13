// popup.js

// Convert seconds to hh:mm:ss
function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

// Fetch stored time from Chrome storage and update popup
chrome.storage.local.get(["tracKOData"], (result) => {
  const data = result.tracKOData || { academic: 0, entertainment: 0 };

  const academicTime = formatTime(data.academic || 0);
  const entertainmentTime = formatTime(data.entertainment || 0);

  document.getElementById("academicTime").textContent = academicTime;
  document.getElementById("entertainmentTime").textContent = entertainmentTime;

  // Optional: Show warning if too much entertainment time
  if (data.entertainment >= 3600) { // 1 hour
    document.getElementById("warning").textContent = "⚠️ You've watched over 1 hour of entertainment today!";
  }
});
