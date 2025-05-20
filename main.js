const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const owasp = require("owasp-password-strength-test")

const forwardID = uuidv4() // ID for identifying file sender
let win;
let token;
let url = "http:/localhost:8080";

// defaults for newly created passwords
owasp.config({
  allowPassphrases: true, 
  maxLength: 127,
  minLength: 8,
  minPhraseLength: 15,
  minOptionalTestsToPass: 4
})

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);

  win.loadURL("http://localhost:3000"); // Load frontend from backend server
}

app.whenReady().then(() => {
  // Start backend server
  exec("node server.js", { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) console.error("Server error:", err);
    if (stdout) console.log("Server stdout:", stdout);
    if (stderr) console.error("Server stderr:", stderr);
  });

  // Wait for the server to boot
  setTimeout(createWindow, 2000);

  /*
  Takes in login success
  Changes login status
  Used to get hide/show buttons in index.html
  Sends result to parent window
  */
  ipcMain.on("login-change", (success) => {
    if (success) {
      win.webContents.send("update-login", true);
    } else win.webContents.send("update-login", false);
  });

  /*
  Creates child window for login
  Returns nothing
  */
  ipcMain.on("pop-window", () => {
    const child = new BrowserWindow({
      width: 600,
      height: 500,
      parent: win,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        preload: path.join(__dirname, "login_preload.js"), // points to preload script
      },
    });
    child.loadFile(path.join(__dirname, "login.html")); // points to html file 
    child.setResizable(false);
    child.setMenu(null);
  });
  buildKeys(); // create private/public keys if they're not there

  /*
  Opens the open file dialog 
  Used to find gather user input for what file to open
  Returns array {path, content}
  */
  ipcMain.handle("open-file", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
    });
    if (canceled || !filePaths.length) {
      console.log("opening canceled");
      return null;
    }
    const filePath = filePaths[0];
    const content = await fsp.readFile(filePath, "utf8");
    return { path: filePath, content };
  });

  /*
  Opens the open folder dialog 
  Used to gather user input for what folder to open
  Returns array {folderPath, folderName, folderFiles}
  */
  ipcMain.handle("open-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths.length) return null;
    const results = [];
    for (const dir of filePaths) {
      const names = await fsp.readdir(dir);
      for (const name of names) {
        const p = path.join(dir, name);
        if ((await fsp.stat(p)).isFile()) {
          const content = await fsp.readFile(p, "utf8");
          results.push({ path: p, name, content });
        }
      }
    }
    return results;
  });

  /*
  Takes in filePath
  Reads current saved version of the file
  Returns file content
  */
  ipcMain.handle("read-file", async (_event, filePath) => {
    return fsp.readFile(filePath, "utf8");
  });

  ipcMain.handle("input-validate", (pass) => {
    const res = owasp.test(pass);
    if (!res.strong) {
      return res.errors[0]
    } else {
      return ""
    }
  })

  /*
  Takes in username and password from user
  Used to create account
  Returns string (response)
  */
  ipcMain.handle("create-account", async (event, username, pass) => {
    try { // try to build vars
      const hashedPass = hashPass(pass);
      const passwordFull = buildPlaintext(hashedPass);
      const encryptedPassword = await encryptPassword(passwordFull);

      const res = await fetch(url + "/accounts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: encryptedPassword,
        }),
      });

      if (res.status === 200) return "Account created successfully!";
      if (res.status === 403) return "Username already exists!";
      if (res.status === 400) return "Bad request!";
      return "Unknown error!";
    } catch (error) {
      console.error("Create account error:", error);
      throw new Error("Account creation failed unexpectedly");
    }
  });

  /*
  Takes in username and password from user
  Used to login 
  Returns string (response)
  */
  ipcMain.handle("login", async (_event, username, pass) => {
    const hashedPass = hashPass(pass); // hashes the password
    const passwordFull = buildPlaintext(hashedPass); // adds UUID to password ex. (hash:ID=UUID)
    // the public key will be used by the server to create a unique logout token
    const publicKey = fetchPublic(); // gets personal public key
    const publicKeyClean = publicKey // strips the public key for kotlin compatability 
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\n/g, "");
    const privateKey = fetchPrivate(); // gets personal private key
    const encryptedPassword = await encryptPassword(passwordFull); // encrypts passwordFull with server public key

    try { // try to send POST req
      const res = await fetch(url + "/accounts/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: encryptedPassword,
          key: publicKeyClean,
        }),
      });
      console.log("login response", res);
      if (res.status !== 200) {
        if (res.status === 403) return "Invalid credentials!";
        if (res.status === 400) return "Bad request!";
        if (res.status === 500) return "Server error!";
        return "Unknown error!";
      }

      // Start of decrypting the logout token from the server
      const encryptedTokenBase64 = await res.text();
      const encryptedToken = Buffer.from(encryptedTokenBase64, "base64");

      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        encryptedToken
      );
      const tokenString = decryptedBuffer.toString("utf8"); 
      token = Buffer.from(buildPlaintext(tokenString)); // This is the logout token
      return "Login successful!";
    } catch (error) {
      console.error("Login error:", error);
      throw new Error("Login failed unexpectedly");
    }
  });

  /*
  Used to logout
  Sends token from login to logout
  Returns string (response)
  */
  ipcMain.handle("logout", async (_event) => {
    const encryptedToken = await encryptPassword(token); // encrypts logout token with server public key
    try { // try to send POST req
      const res = await fetch(url + "/accounts/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: encryptedToken,
        }),
      });
      if (res.status == 200) {
        token = null;
        return true;
      } else return false;
    } catch (error) {
      throw new Error("Logout failed unexpectedly");
    }
  });

  /*
  Takes in current code in editor and filePath
  Used to send file
  */
  ipcMain.handle("send-file", async (_event, code, filePath) => {
    let fileName = filePath.split("/").pop();
    let newFileName = filePath.replace(/\.py$/, ".json"); // fileName for code to be written 
    const codeB64 = forge.util.encode64(code); // the 'code' is just the text from the active open file
    try { // try to send POST req 
      const res = await fetch(url + "/exchange/forward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: forwardID,
          task: {
            command: "run-file",
            file_name: fileName,
            file_content: codeB64,
          },
        }),
      });
      const output = await res.text();
      if (res) {
        let toWrite; // the strigified JSON res
        try { // try to parse JSON
          const obj = JSON.parse(output);
          toWrite = JSON.stringify(obj, null, 4);
        } catch {
          toWrite = output;
        }
        fs.writeFileSync(newFileName, toWrite, "utf8"); // writes the JSON as a file so index.html can open it up
        return true;
      } else {
        return false;
      }
    } catch (e) {
      throw new Error("Error when trying to open file");
    }
  });

  /*
  Takes in the path of file and file content
  Used to save-file
  returns bool
  */
  ipcMain.handle("save-file", async (_evt, path, content) => {
    try { // try to write file
      await fsp.writeFile(path, content, "utf8");
      return true;
    } catch (error) {
      console.error("Error saving file:", error);
      return false;
    }
  });
});

/*
  Encrypts the password that is sent to server
  Takes in the password hash + UUID 
  Encrypts using server public key
  Encodes in base64 
  Returns base64 string
  */
async function encryptPassword(password) {
  const res = await fetch("http://localhost:8080/key");
  const data = await res.text();

  const key = forge.util.decode64(data);
  const pk = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(key));

  const encrypted = pk.encrypt(password, "RSA-OAEP");

  const encryptedBase64 = forge.util.encode64(encrypted);

  return encryptedBase64;
}

/*
  Takes in password hash
  Generates a UUID
  Concatenates hash + ":ID=" + UUID
  Returns string
  */
function buildPlaintext(pass) {
  const uuid = uuidv4();
  return pass + ":ID=" + uuid;
}

/*
  Builds public and private keys
  Should only run when the app is very first ran
  Uses RSA encryption with SHA-1
  Returns none
  */
function buildKeys() {
  const publicPath = path.join(__dirname, "public_key.pem");
  const privatePath = path.join(__dirname, "private_key.pem");
  if (!fs.existsSync(publicPath) && !fs.existsSync(privatePath)) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    const publicKeyPEM = publicKey.export({ type: "spki", format: "pem" });
    const privateKeyPEM = privateKey.export({ type: "pkcs8", format: "pem" });

    fs.writeFileSync(publicPath, publicKeyPEM);
    fs.writeFileSync(privatePath, privateKeyPEM);
  }
}

/*
Gets the personal private key
Builds it if it's not found
Gets the private key in PEM format
Returns string
*/
function fetchPrivate() {
  const privateKeyPath = path.join(__dirname, "private_key.pem");
  if (!fs.existsSync(privateKeyPath)) {
    buildKeys();
  }
  const privateKeyPEM = fs.readFileSync(privateKeyPath).toString();
  return privateKeyPEM;
}

/*
Gets the personal public key
Builds it if it's not found
gets the public key in PEM format
Returns string
*/
function fetchPublic() {
  const publicKeyPath = path.join(__dirname, "public_key.pem");
  if (!fs.existsSync(publicKeyPath)) {
    buildKeys();
  }
  const publicKeyPEM = fs.readFileSync(publicKeyPath).toString();
  return publicKeyPEM;
}

/*
Takes in the plaintext password from user
Creates hash using SHA-256
Returns hash as string
*/
function hashPass(pass) {
  return crypto.createHash("sha256").update(pass).digest("hex");
}
