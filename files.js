const openedFiles = [];
const fileHandles = {};

async function openFile() {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
              description: "Text Files",
              accept: {
                "text/plain": [".txt"],
              },
          },
          {
            description: "Python Files",
            accept: {
              "text/x-python": [".py"],
            },
          },
          {
              description: "JavaScript Files",
              accept: {
                "application/javascript": [".js"],
              },
          },
        ],
      });
  
      const file = await fileHandle.getFile();
      const content = await file.text();
  
      if (!openedFiles.includes(file.name)) {
        openedFiles.push(file.name);
        fileHandles[file.name] = fileHandle; 
        updateSidebar();
      }

      editor.setValue(content);
      setActiveFile(file.name);
      hideWelcome(); 
      showNotification(`Opened ${file.name} successfully.`, "check-circle", "#5FC234");
    } catch (e) {
      console.error("Error opening file:", e);
      showNotification("Failed to open file.", "error", "#F48872");
    }
}
  
async function openFolder() {
  try {
    const directoryHandle = await window.showDirectoryPicker();

    openedFiles.length = 0;
    for (const key in fileHandles) {
      delete fileHandles[key];
    }

    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === "file") {
        openedFiles.push(name); 
        fileHandles[name] = handle;
      } 
    }

    updateSidebar();

    if (openedFiles.length > 0) {
      const firstFileName = openedFiles[0];
      const fileHandle = fileHandles[firstFileName];
      const file = await fileHandle.getFile();
      const content = await file.text();

      editor.setValue(content);
      setActiveFile(firstFileName);
    }

    hideWelcome();
    showNotification(`Opened ${directoryHandle.name} successfully.`, "check-circle", "#5FC234");
  } catch (e) {
    console.error("Error opening folder:", e);
    showNotification("Failed to open folder.", "error", "#F48872");
  }
}

function setActiveFile(fileName) {
  document.querySelectorAll(".file-item").forEach((item) => {
    if (item.textContent === fileName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function updateSidebar() {
  const openedFilesList = document.getElementById("opened-files");
  openedFilesList.innerHTML = "";

  openedFiles.forEach((fileName) => {
    const file = document.createElement("li");
    file.textContent = fileName;
    file.classList.add("file-item");

    file.addEventListener("click", () => {
      openFileSidebar(fileName);
    });

    openedFilesList.appendChild(file);
  });

  const currentFile = editor.getValue();
  if (currentFile) {
    setActiveFile(currentFile);
  }
}

async function openFileSidebar(fileName) {
  try {
    const fileHandle = fileHandles[fileName];
    const file = await fileHandle.getFile();
    const content = await file.text();

    editor.setValue(content);
    setActiveFile(fileName);
  } catch (e) {
    console.error(`Error opening file ${fileName} from sidebar:`, e);
    showNotification(`Failed to open ${fileName}.`, "error", "#F48872");
  }
}

