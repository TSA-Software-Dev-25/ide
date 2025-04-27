const fileDropContent = document.querySelector("#file .dropdown-content");
const fileDrop = document.querySelector("#file .dropdown-btn");

const editDropContent = document.querySelector("#edit .dropdown-content");
const editDrop = document.querySelector("#edit .dropdown-btn");

function Copy() {
    const selectedText = editor.getModel().getValueInRange(editor.getSelection());
    navigator.clipboard.writeText(selectedText).then(() => {
    }).catch(() => {
      console.error("Nothing copied");
    });
}
  
function Paste() {
    navigator.clipboard.readText().then((text) => {
      editor.executeEdits(null, [
        { range: editor.getSelection(), text: text, forceMoveMarkers: true }
      ]);
    }).catch(() => {
      console.error("Nothing to paste");
    });
}

function toggleDropdown(content, button) {
    let ddContent = document.querySelector(content);
    let ddBtn = document.querySelector(button);
    ddContent.classList.toggle("show");
    ddBtn.classList.toggle("show");
}

document.addEventListener("click", function (event) {
    if (
        !fileDrop.contains(event.target) &&
        !fileDropContent.contains(event.target)
    ) {
        fileDropContent.classList.remove("show");
        fileDrop.classList.remove("show");
    }

    if (
        !editDrop.contains(event.target) &&
        !editDropContent.contains(event.target)
    ) {
        editDropContent.classList.remove("show");
        editDrop.classList.remove("show");
    }
});

const fileDropItems = document.querySelectorAll("#file .dropdown-content ul");
fileDropItems.forEach((item) => {
    item.addEventListener("click", () => {
        fileDropContent.classList.remove("show");
        fileDrop.classList.remove("show");
    });
});

const editDropItems = document.querySelectorAll("#edit .dropdown-content ul");
editDropItems.forEach((item) => {
    item.addEventListener("click", () => {
        editDropContent.classList.remove("show");
        editDrop.classList.remove("show");
    });
});

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.code === "KeyO") {
        event.preventDefault(); 
        openFile(); 
    }
  
    if (event.ctrlKey && event.code === "KeyK") {
        event.preventDefault(); 
        openFolder(); 
    }

    if (event.ctrlKey && event.code === "KeyF") {
        event.preventDefault(); 
        editor.getAction('actions.find').run(); 
    }
  
    if (event.ctrlKey && event.code === "KeyH") {
        event.preventDefault(); 
        editor.getAction('editor.action.startFindReplaceAction').run();
    }
  });