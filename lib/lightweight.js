const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/messageStore.json');
const MAX_MESSAGES_PER_CHAT = 50;
const MAX_CONTACTS = 1000;
const MAX_CHATS = 500;

class LightweightStore {
  constructor() {
    this.messages = {};
    this.contacts = {};
    this.chats = {};
  }

  readFromFile() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        this.messages = data.messages || {};
        this.contacts = data.contacts || {};
        this.chats = data.chats || {};
      }
    } catch (e) {
      this.messages = {};
      this.contacts = {};
      this.chats = {};
    }
  }

  writeToFile() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify({
        messages: this.messages,
        contacts: this.contacts,
        chats: this.chats
      }));
    } catch (e) {}
  }

  bind(ev) {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.remoteJid) continue;
        const jid = msg.key.remoteJid;
        if (!this.messages[jid]) this.messages[jid] = [];
        this.messages[jid].push(msg);
        if (this.messages[jid].length > MAX_MESSAGES_PER_CHAT) {
          this.messages[jid].splice(0, this.messages[jid].length - MAX_MESSAGES_PER_CHAT);
        }
      }
    });

    ev.on('contacts.upsert', (contacts) => {
      for (const contact of contacts) {
        if (contact.id) this.contacts[contact.id] = contact;
      }
    });

    ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        if (chat.id) this.chats[chat.id] = chat;
      }
    });
  }

  cleanup() {
    // Trim contacts — keep most recently seen MAX_CONTACTS
    const contactKeys = Object.keys(this.contacts);
    if (contactKeys.length > MAX_CONTACTS) {
      const drop = contactKeys.slice(0, contactKeys.length - MAX_CONTACTS);
      for (const k of drop) delete this.contacts[k];
    }

    // Trim chats — keep most recently seen MAX_CHATS
    const chatKeys = Object.keys(this.chats);
    if (chatKeys.length > MAX_CHATS) {
      const drop = chatKeys.slice(0, chatKeys.length - MAX_CHATS);
      for (const k of drop) delete this.chats[k];
    }

    // Remove empty message arrays
    for (const jid of Object.keys(this.messages)) {
      if (!this.messages[jid]?.length) delete this.messages[jid];
    }
  }

  loadMessage(jid, id) {
    if (!this.messages[jid]) return null;
    return this.messages[jid].find(m => m.key?.id === id) || null;
  }

  getMessages(jid) {
    return this.messages[jid] || [];
  }
}

const store = new LightweightStore();
module.exports = store;
