
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

