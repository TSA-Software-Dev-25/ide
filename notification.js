
function showNotification(message, iconClass, color) {
  const container = document.getElementById("notif-container");

  const notification = document.createElement("div");
  notification.className = "notification";

  const iconElement = document.createElement("box-icon");
  iconElement.setAttribute("type", "solid");
  iconElement.setAttribute("size", "xs");
  iconElement.setAttribute("color", color);
  iconElement.setAttribute("name", iconClass);
  notification.appendChild(iconElement);

  const messageElement = document.createElement("span");
  messageElement.textContent = message;
  notification.appendChild(messageElement);

  const closeButton = document.createElement("button");
  closeButton.textContent = "×"; 
  closeButton.className = "close-btn";
  closeButton.onclick = () => {
    notification.style.display = "none";
    notification.remove(); 
  };
  notification.appendChild(closeButton);

  container.appendChild(notification);
}

async function runCode() {
  const code = editor.getValue();
  const language = document.getElementById("language").value;
  try {
    showNotification("Code is now running.", "info-circle", "#14A2E3");
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code }),
    });
    const result = await response.json();
    document.getElementById("output").textContent = result.output || result.error;
    if (result.error) {
      showNotification("Code execution failed.", "error", "#F48872");
    } else {
      showNotification("Output received from server.", "check-circle", "#5FC234");
    }
  } catch (e) {
    showNotification("An error occurred while running the code.", "error", "#F48872");
  }
}
