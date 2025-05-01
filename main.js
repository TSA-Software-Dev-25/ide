const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const forge = require("node-forge");
const crypto = require("crypto");

let win;
let token; 

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

  ipcMain.on("pop-window", () => {
    const child = new BrowserWindow({
      width: 300,
      height: 200,
      parent: win,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        preload: path.join(__dirname, "login_preload.js"),
      },
    });
    child.loadFile(path.join(__dirname, "login.html"));
    child.setResizable(false);
    child.setMenu(null);
  });
  buildUUID();
  buildKeys();

  ipcMain.handle("create-account", async (event, username, pass) => {
    const passwordFull = buildPlaintext(pass);
    const encryptedPassword = await encryptPassword(passwordFull);

    const res = await fetch("http://localhost:8080/accounts/create", {
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
  });

  ipcMain.handle("login", async (_event, username, pass) => {
    const passwordFull = buildPlaintext(pass);
    const publicKey = fetchPublic();
    const privateKey = fetchPrivate()
    const encryptedPassword = await encryptPassword(passwordFull);

    const res = await fetch("http://localhost:8080/accounts/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: encryptedPassword,
        key: publicKey
      }),
    });

    if (res.status !== 200) {
      if (res.status === 403) return "Invalid credentials!";
      if (res.status === 400) return "Bad request!";
      if (res.status === 500) return "Server error!";
      return "Unknown error!";
    }

    const encryptedTokenBase64 = await res.text();
    const encryptedToken = Buffer.from(encryptedTokenBase64, 'base64');

    token = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedToken
    );
    return "Login successful!";
  });

  ipcMain.handle("logout", async (_event) => {
    const res = await fetch("http://localhost:8080/accounts/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
      }),
    });

    if (res.status == 200) {
    token = null;
    return "Logged out successfully!";
    }
    if (res.status == 403) return "Invalid token!";
    else return "Unknown error!";
  });

  ipcMain.handle("run", async (_event, data) => { // send code to server
    return "";
  })
})


async function encryptPassword(password) {
  const res = await fetch("http://localhost:8080/key");
  const data = await res.text();

  const key = forge.util.decode64(data);
  const pk = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(key));

  const encrypted = pk.encrypt(password, "RSA-OAEP");

  const encryptedBase64 = forge.util.encode64(encrypted);

  return encryptedBase64;
}

function buildPlaintext(pass) {}

function buildUUID() {}

function buildKeys() {
  if (true) { //replace with checking keys
    const { publicKey, privateKey } = crypto.generateKeyPairSync(
      'rsa', {
        modulusLength: 2048
      }
    );

    const publicKeyPEM = publicKey.export({ type: 'spki', format: 'pem' });
    const privateKeyPEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

    const publicKeyClean = publicKeyPEM // THIS IS THE KEY FUTURE ME
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '');
    
    // save keys to file
  }
}

function fetchPrivate() {} // fetch personal private key

function fetchPublic() {} // fetch personal public key
