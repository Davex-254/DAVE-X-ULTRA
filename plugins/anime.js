'use strict';

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { getBotName, createFakeContact, channelInfo } = require('../lib/messageConfig');

async function gifToMp4(gifBuf) {
  const id = crypto.randomBytes(6).toString('hex');
  const gifPath = path.join(os.tmpdir(), `davex_${id}.gif`);
  const mp4Path = path.join(os.tmpdir(), `davex_${id}.mp4`);
  fs.writeFileSync(gifPath, gifBuf);
  execFileSync('ffmpeg', [
    '-loglevel', 'error',
    '-i', gifPath,
    '-movflags', 'faststart',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-y', mp4Path
  ], { timeout: 30000, stdio: ['ignore', 'ignore', 'pipe'] });
  const mp4 = fs.readFileSync(mp4Path);
  try { fs.unlinkSync(gifPath); fs.unlinkSync(mp4Path); } catch {}
  return mp4;
}

const NEKOS_CATEGORIES = [
  'neko', 'husbando', 'kitsune', 'waifu', 'shinobu', 'megumin', 'bully',
  'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk',
  'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite',
  'glomp', 'slap', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe',
];

const WAIFU_CATEGORIES = [
  'waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug',
  'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile',
  'wave', 'highfive', 'nom', 'bite', 'glomp', 'slap', 'happy', 'wink', 'poke',
];

async function fetchAnimeImg(category) {
  const apis = [
    async () => {
      const res = await axios.get(`https://nekos.best/api/v2/${category}`, { timeout: 15000 });
      return res.data?.results?.[0]?.url;
    },
    async () => {
      const res = await axios.get(`https://api.waifu.pics/sfw/${category}`, { timeout: 15000 });
      return res.data?.url;
    },
  ];

  for (const api of apis) {
    try {
      const url = await api();
      if (url) return url;
    } catch {}
  }
  return null;
}

async function downloadImg(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(res.data);
}

function buildAnimeCommand(name, aliases, description, category) {
  return {
    name,
    aliases,
    category: 'anime',
    description,
    usage: `.${name}`,
    execute: async (sock, message, args, context) => {
      const { chatId, senderId } = context;
      const botName = getBotName();
      const fake = createFakeContact(senderId);

      await sock.sendMessage(chatId, { react: { text: '🎌', key: message.key } });

      try {
        const imgUrl = await fetchAnimeImg(category);
        if (!imgUrl) throw new Error('No image found');
        const buf = await downloadImg(imgUrl);

        const isGif = imgUrl.endsWith('.gif');

        if (isGif) {
          const mp4 = await gifToMp4(buf);
          await sock.sendMessage(chatId, {
            video: mp4,
            gifPlayback: true,
            mimetype: 'video/mp4',
            caption: `🎌 *${botName}* | ${name.toUpperCase()}`
          }, { quoted: fake });
        } else {
          await sock.sendMessage(chatId, {
            image: buf,
            caption: `🎌 *${botName}* | ${name.toUpperCase()}`
          }, { quoted: fake });
        }
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
      } catch (err) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
          text: `┌─ *${botName}* ─┐\n│\n│ Failed: ${err.message}\n│\n└─────────────────┘`
        }, { quoted: fake });
      }
    }
  };
}

module.exports = [
  // ============================
  // ANIME MENU
  // ============================
  {
    name: 'animemenu',
    aliases: ['animes', 'animelist'],
    category: 'anime',
    description: 'Show all anime commands',
    execute: async (sock, message, args, context) => {
      const { chatId, senderId } = context;
      const botName = getBotName();
      const fake = createFakeContact(senderId);
      const prefix = global.prefix || '.';

      const cats = NEKOS_CATEGORIES.map(c => `• *${prefix}${c}*`).join('\n');
      await sock.sendMessage(chatId, {
        text: `┌──────────────────────┐\n│  🎌 *ANIME COMMANDS*  │\n└──────────────────────┘\n\n${cats}\n\n_Powered by nekos.best & waifu.pics_`
      }, { quoted: fake });
    }
  },

  // ============================
  // WAIFU
  // ============================
  buildAnimeCommand('waifu', ['wife', 'waifupic'], 'Random waifu image', 'waifu'),
  buildAnimeCommand('neko', ['catgirl', 'nekogirl'], 'Random neko/catgirl image', 'neko'),
  buildAnimeCommand('kitsune', ['foxgirl'], 'Random kitsune/fox girl', 'kitsune'),
  buildAnimeCommand('husbando', ['husband'], 'Random husbando image', 'husbando'),
  buildAnimeCommand('shinobu', [], 'Shinobu from Demon Slayer', 'shinobu'),
  buildAnimeCommand('megumin', [], 'Megumin from KonoSuba', 'megumin'),

  // ============================
  // ANIME GIF REACTIONS
  // ============================
  buildAnimeCommand('hug', ['abraco'], 'Send an anime hug GIF', 'hug'),
  buildAnimeCommand('kiss', ['beso'], 'Send an anime kiss GIF', 'kiss'),
  buildAnimeCommand('slap', ['bofetada'], 'Slap someone anime style', 'slap'),
  buildAnimeCommand('pat', ['patpat', 'headpat'], 'Pat someone on the head', 'pat'),
  buildAnimeCommand('cry', ['llora', 'crying'], 'Anime crying GIF', 'cry'),
  buildAnimeCommand('cuddle', ['snuggle'], 'Anime cuddle GIF', 'cuddle'),
  buildAnimeCommand('blush', ['rubor'], 'Anime blushing GIF', 'blush'),
  buildAnimeCommand('smile', ['sonrisa'], 'Anime smile GIF', 'smile'),
  buildAnimeCommand('wave', ['ola', 'hello'], 'Anime wave GIF', 'wave'),
  buildAnimeCommand('bonk', ['bop'], 'Bonk anime style', 'bonk'),
  buildAnimeCommand('yeet', [], 'Yeet anime style', 'yeet'),
  buildAnimeCommand('poke', ['pegar'], 'Poke someone anime style', 'poke'),
  buildAnimeCommand('bully', ['bully'], 'Anime bully GIF', 'bully'),
  buildAnimeCommand('bite', ['morder'], 'Anime bite GIF', 'bite'),
  buildAnimeCommand('lick', ['lamer'], 'Anime lick GIF', 'lick'),
  buildAnimeCommand('nom', ['chomp'], 'Nom nom anime style', 'nom'),
  buildAnimeCommand('glomp', ['tackle'], 'Anime glomp GIF', 'glomp'),
  buildAnimeCommand('dance', ['bailar'], 'Anime dance GIF', 'dance'),
  buildAnimeCommand('happy', ['feliz'], 'Anime happy GIF', 'happy'),
  buildAnimeCommand('wink', ['guinar'], 'Anime wink GIF', 'wink'),
  buildAnimeCommand('highfive', ['choca'], 'Anime high five GIF', 'highfive'),
  buildAnimeCommand('handhold', ['tomar'], 'Anime hand holding GIF', 'handhold'),
  buildAnimeCommand('awoo', ['howl'], 'Anime awoo GIF', 'awoo'),
  buildAnimeCommand('smug', [], 'Anime smug face', 'smug'),
  buildAnimeCommand('cringe', [], 'Anime cringe GIF', 'cringe'),
  buildAnimeCommand('kick', ['patada'], 'Anime kick GIF', 'kick'),
];
