// Retrieve the video title from the DOM
function getVideoTitle() {
    // Try to use YouTube's title element
    let titleElement = document.querySelector('h1.title yt-formatted-string');
    if (titleElement && titleElement.innerText.trim().length > 0) {
      return titleElement.innerText.trim();
    }
    // Fallback to document.title (remove trailing " - YouTube")
    let title = document.title || "";
    const suffix = " - YouTube";
    if (title.endsWith(suffix)) {
      title = title.slice(0, title.length - suffix.length).trim();
    }
    return title;
  }
  
  // Global variables for tracking
  let currentCategory = "unknown";
  let timeSpent = 0; // in seconds
  let sessionActive = true;
  let isPaused = false; // Pause flag
  let trackingTimer = null; // Holds the timer interval for tracking
  let lastUrl = window.location.href; // Save the current URL
  const MAX_SESSION_TIME = 600; // 10 minutes
  
  // Create or update overlay with category, time, and pause button
  function createOrUpdateOverlay(category, timeSpent) {
    let overlay = document.getElementById("tracko-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tracko-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "10px";
      overlay.style.right = "10px";
      overlay.style.padding = "15px";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      overlay.style.color = "#fff";
      overlay.style.fontSize = "16px";
      overlay.style.borderRadius = "8px";
      overlay.style.zIndex = "9999";
      overlay.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";
      overlay.style.maxWidth = "250px";
      document.body.appendChild(overlay);
    }
    
    const formattedTime = formatTime(timeSpent);
    
    overlay.innerHTML = `
      <strong>Category:</strong> ${category} <br>
      <strong>Time Watched:</strong> ${formattedTime} <br>
      <button id="pauseBtn" style="
        margin-top: 10px;
        padding: 5px 10px;
        background: ${isPaused ? '#28a745' : '#dc3545'};
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">${isPaused ? 'Resume' : 'Pause'}</button>
    `;
    
    document.getElementById("pauseBtn").onclick = () => {
      isPaused = !isPaused;
      createOrUpdateOverlay(category, timeSpent); // Refresh overlay with updated state
    };
  }
  
  // Convert seconds to hh:mm:ss format
  function formatTime(seconds) {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }
  
  // Classify video title using Groq API
  function classifyVideo(title) {
    console.log("Sending title for classification:", title);
    return fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Your_API"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI that classifies YouTube video titles as either 'academic' or 'entertainment'. If unclear, respond with 'unabletofind'. Only respond with the category name."
          },
          {
            role: "user",
            content: `Title: ${title}`
          }
        ],
        temperature: 0.3
      })
    })
    .then(response => response.json())
    .then(data => {
      const content = data.choices?.[0]?.message?.content?.toLowerCase().trim();
      const validCategories = ["academic", "entertainment"];
      const category = validCategories.includes(content) ? content : "unabletofind";
      console.log("Received classification from Groq:", category);
      return category;
    })
    .catch(error => {
      console.error("Error during classification:", error);
      return "unabletofind";
    });
  }
  
  // Start tracking the video with a category and set up the timer.
  function startTrackingWithCategory(categoryReceived) {
    if (trackingTimer) {
      clearInterval(trackingTimer);
    }
    
    currentCategory = categoryReceived;
    timeSpent = 0; // Reset time for new video.
    sessionActive = true;
    isPaused = false;
    
    createOrUpdateOverlay(currentCategory, timeSpent);
    console.log("Starting timer with category:", currentCategory);
    
    trackingTimer = setInterval(() => {
      if (!sessionActive) {
        clearInterval(trackingTimer);
        console.log("Session time reached maximum (10 minutes). Timer stopped.");
        return;
      }
      
      if (isPaused) return;
      
      timeSpent += 5;
      console.log(`Updated time: ${timeSpent} seconds for category ${currentCategory}`);
      
      if (timeSpent >= MAX_SESSION_TIME) {
        sessionActive = false;
        console.log("Maximum session time reached. No further time will be recorded.");
      }
      
      chrome.storage.local.get(["tracKOData"], (result) => {
        let data = result.tracKOData || { academic: 0, entertainment: 0 };
        if (currentCategory === "academic" || currentCategory === "entertainment") {
          data[currentCategory] += 5;
        }
        chrome.storage.local.set({ tracKOData: data }, () => {
          console.log("Persistent storage updated:", data);
        });
      });
      
      chrome.runtime.sendMessage({
        type: "updateFirebase",
        data: {
          category: currentCategory,
          increment: 5
        }
      });
      
      createOrUpdateOverlay(currentCategory, timeSpent);
    }, 5000);
  }
  
  // Initialize tracking for the current video.
  function initTracking() {
    const title = getVideoTitle();
    console.log("Extracted video title:", title);
    classifyVideo(title).then((category) => {
      startTrackingWithCategory(category);
    });
  }
  
  // Monitor URL changes as a backup
  function observeUrlChange() {
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log("URL changed! New video detected.");
        initTracking();
      }
    }, 2000);
  }
  
  // Observe title changes using MutationObserver.
  function observeTitleChange() {
    const titleElement = document.querySelector('h1.title yt-formatted-string');
    if (!titleElement) {
      console.log("No title element found; cannot observe title changes.");
      return;
    }
    
    let lastTitle = titleElement.innerText;
    
    const observer = new MutationObserver(() => {
      const newTitle = titleElement.innerText;
      if (newTitle !== lastTitle) {
        lastTitle = newTitle;
        console.log("Title changed to:", newTitle);
        initTracking();
      }
    });
    
    observer.observe(titleElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  // Initialize the tracking when the page is loaded.
  window.addEventListener("load", () => {
    setTimeout(() => {
      initTracking();
      observeUrlChange();  // Backup polling for URL changes.
      observeTitleChange(); // Preferably observe the actual title element.
    }, 2000);
  });
  
