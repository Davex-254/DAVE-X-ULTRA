const settings = require('../settings.js');
const isAdmin = require('./isAdmin');
const { getSetting, applyFontStyle } = require('./database');
const { channelInfo, createFakeContact, getBotName } = require('./messageConfig');
const { isLidJid, resolvePhoneFromLid, cacheLidPhone } = require('./lidResolver');

function buildContext(sock, message, extra = {}) {
  const chatId = message.key.remoteJid;

  const sender = message.key.fromMe
    ? sock.user.id
    : (message.key.participant || message.key.remoteJid);

  // Preserve LID JIDs — do NOT coerce them to @s.whatsapp.net
  let cleanSender = sender;
  if (sender && sender.includes(':') && !isLidJid(sender)) {
    cleanSender = sender.split(':')[0] + '@s.whatsapp.net';
  }

  const isGroup = chatId ? chatId.endsWith('@g.us') : false;
  const isChannel = chatId ? chatId.endsWith('@newsletter') : false;
  const isPrivate = !isGroup && !isChannel;

  // senderNumber: real phone number (digits only)
  // For LID JIDs: try Layer 0 (participantPn) → Layer 1 (globalLidMapping cache)
  const rawSenderNum = (sender || '').split('@')[0].split(':')[0];
  let senderNumber = rawSenderNum;

  if (isLidJid(sender)) {
    // Layer 0: davexbaileys participantPn/senderPn field
    const keyPn = message.key?.participantPn || message.key?.senderPn;
    if (keyPn) {
      const kNum = String(keyPn).split('@')[0].replace(/[^0-9]/g, '');
      if (/^\d{7,15}$/.test(kNum) && kNum !== rawSenderNum) {
        cacheLidPhone(rawSenderNum, kNum);
        senderNumber = kNum;
      }
    }
    // Layer 1: globalLidMapping + in-memory cache
    if (senderNumber === rawSenderNum) {
      const resolved = resolvePhoneFromLid(sender, sock);
      if (resolved) senderNumber = resolved;
    }
  }

  const { isSudo, getSetting } = require('./database');
  const dbOwnerNumber = getSetting('ownerNumber', '');
  const envOwnerNumber = settings.ownerNumber || '';
  const globalOwnerPhone = global.ownerPhone || '';

  const senderLidNum = isLidJid(sender) ? rawSenderNum : '';
  const ownerLidNum  = (global.ownerLid || '').split('.')[0];

  const senderIsSudo = !!(
    message.key.fromMe ||
    (envOwnerNumber && senderNumber === envOwnerNumber) ||
    (dbOwnerNumber && senderNumber === String(dbOwnerNumber).trim()) ||
    (globalOwnerPhone && senderNumber === globalOwnerPhone) ||
    (ownerLidNum && (senderLidNum === ownerLidNum || senderNumber === ownerLidNum)) ||
    isSudo(cleanSender) ||
    isSudo(`${senderNumber}@s.whatsapp.net`)
  );

  const rawText = (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    message.message?.documentMessage?.caption ||
    ''
  ).trim();

  const userMessage = rawText.toLowerCase().trim();
  const messageId = message.key.id;
  const timestamp = message.messageTimestamp;
  const isFromOwner = message.key.fromMe || senderIsSudo;

  const messageType = Object.keys(message.message || {})[0] || '';
  const hasMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(messageType);
  const hasQuotedMessage = !!(message.message?.extendedTextMessage?.contextInfo?.quotedMessage);

  let isSenderAdmin = false;
  let isBotAdmin = false;
  if ((isGroup || isChannel) && extra.isAdminCheck) {
    const adminStatus = extra.adminStatus || {};
    isSenderAdmin = adminStatus.isSenderAdmin || false;
    isBotAdmin = adminStatus.isBotAdmin || false;
  }

  const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  // Bot can appear as phone JID (botNum) OR as LID JID (botLidNum) — must check both
  const _botNum    = (sock.user?.id  || '').split('@')[0].split(':')[0];
  const _botLidNum = (sock.user?.lid || '').split('@')[0].split(':')[0];
  const isBotMentioned = _botNum
    ? mentions.some(m => {
        const n = m.split('@')[0].split(':')[0];
        return n === _botNum || (_botLidNum && n === _botLidNum);
      })
    : false;

  const senderId = cleanSender;

  const fake = createFakeContact(senderId);

  const reply = async (content, options = {}) => {
    try {
      const quotedMessage = options.quoted !== undefined ? options.quoted : fake;
      delete options.quoted;

      let messageOptions = { ...channelInfo };

      if (typeof content === 'string') {
        messageOptions.text = applyFontStyle(content);
      } else if (typeof content === 'object' && content !== null) {
        Object.assign(messageOptions, content);
        if (content.text && typeof content.text === 'string') {
          messageOptions.text = applyFontStyle(content.text);
        }
        if (content.caption && typeof content.caption === 'string') {
          messageOptions.caption = applyFontStyle(content.caption);
        }
      }

      Object.assign(messageOptions, options);

      return await sock.sendMessage(chatId, messageOptions, { quoted: quotedMessage });
    } catch (error) {
      console.error('Error in reply:', error.message);
      if (typeof content === 'string') {
        return await sock.sendMessage(chatId, { text: content }, { quoted: fake });
      }
    }
  };

  const replyPlain = async (content, options = {}) => {
    try {
      const quotedMessage = options.quoted !== undefined ? options.quoted : fake;
      delete options.quoted;

      let messageOptions = {};
      if (typeof content === 'string') {
        messageOptions.text = content;
      } else if (typeof content === 'object') {
        Object.assign(messageOptions, content);
      }
      Object.assign(messageOptions, options);
      return await sock.sendMessage(chatId, messageOptions, { quoted: quotedMessage });
    } catch (error) {
      console.error('Error in replyPlain:', error.message);
    }
  };

  const react = async (emoji) => {
    try {
      return await sock.sendMessage(chatId, {
        react: { text: emoji, key: message.key }
      });
    } catch (e) {}
  };

  return {
    chatId,
    sender,
    cleanSender,
    senderId,
    senderNumber,
    isGroup,
    isChannel,
    isPrivate,
    senderIsSudo,
    rawText,
    userMessage,
    messageId,
    timestamp,
    isFromOwner,
    messageType,
    hasMedia,
    hasQuotedMessage,
    isSenderAdmin,
    isBotAdmin,
    mentions,
    isBotMentioned,
    reply,
    replyPlain,
    react,
    channelInfo,
    fake,
  };
}

module.exports = buildContext;
