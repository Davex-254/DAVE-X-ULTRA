const axios = require('axios');
const { getBotName, createFakeContact, channelInfo } = require('../lib/messageConfig');

module.exports = [
  // ============================
  // AI CHAT
  // ============================
  {
    name: 'ai',
    aliases: ['chatgpt', 'gpt', 'ask'],
    category: 'ai',
    description: 'Ask the AI a question',
    usage: '.ai <question>',
    execute: async (sock, message, args, context) => {
      const { chatId, senderId } = context;
      const botName = getBotName();
      const fake = createFakeContact(senderId);
      const question = args.join(' ').trim();

      if (!question) {
        return sock.sendMessage(chatId, {
          text: `❌ Ask me anything!\n.ai <your question>`
        }, { quoted: fake });
      }

      await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

      const apis = [
        async () => {
          const res = await axios.get(
            `https://apiskeith.top/ai/gpt4?q=${encodeURIComponent(question)}`,
            { timeout: 20000 }
          );
          if (!res.data?.status) return null;
          return res.data?.result || null;
        },
        async () => {
          const res = await axios.get(
            `https://api.giftedtech.co.ke/api/ai/chatgpt?apikey=gifted&text=${encodeURIComponent(question)}`,
            { timeout: 20000 }
          );
          return res.data?.result || null;
        },
        async () => {
          const res = await axios.get(
            `https://api.dreaded.site/api/chatgpt?text=${encodeURIComponent(question)}`,
            { timeout: 20000 }
          );
          return res.data?.result || res.data?.message || null;
        },
        async () => {
          const res = await axios.get(
            `https://bk9.fun/ai/chatgpt?text=${encodeURIComponent(question)}`,
            { timeout: 15000 }
          );
          return res.data?.BK9 || null;
        }
      ];

      let answer = null;
      for (const api of apis) {
        try {
          answer = await api();
          if (answer && typeof answer === 'string' && answer.trim()) break;
        } catch (e) {}
      }

      if (!answer) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return sock.sendMessage(chatId, { text: `❌ AI failed. Try again later.` }, { quoted: fake });
      }

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
      await sock.sendMessage(chatId, {
        text: `*Q:* ${question.substring(0, 100)}\n\n${answer}`,
        ...channelInfo
      }, { quoted: fake });
    }
  },

  // ============================
  // IMAGE GENERATION
  // ============================
  {
    name: 'imagine',
    aliases: ['dalle', 'dream', 'genimage'],
    category: 'ai',
    description: 'Generate AI image from prompt',
    usage: '.imagine <prompt>',
    execute: async (sock, message, args, context) => {
      const { chatId, senderId } = context;
      const botName = getBotName();
      const fake = createFakeContact(senderId);
      const prompt = args.join(' ').trim();

      if (!prompt) {
        return sock.sendMessage(chatId, {
          text: `❌ Provide a prompt!\n.imagine <description>`
        }, { quoted: fake });
      }

      await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

      try {
        let imageBuf = null;

        // 1. Keith flux — returns raw image bytes
        try {
          const res = await axios.get(
            `https://apiskeith.top/ai/flux?prompt=${encodeURIComponent(prompt)}`,
            { timeout: 35000, responseType: 'arraybuffer' }
          );
          const buf = Buffer.from(res.data);
          if (buf.length > 5000) imageBuf = buf;
        } catch (e) {}

        // 2. Gifted AI image
        if (!imageBuf) {
          try {
            const res = await axios.get(
              `https://api.giftedtech.co.ke/api/ai/stablediffusion?apikey=gifted&prompt=${encodeURIComponent(prompt)}`,
              { timeout: 35000 }
            );
            const imageUrl = res.data?.result || res.data?.url || null;
            if (imageUrl && imageUrl.startsWith('http')) {
              const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
              const buf = Buffer.from(imgRes.data);
              if (buf.length > 5000) imageBuf = buf;
            }
          } catch (e) {}
        }

        // 3. BK9 flux fallback
        if (!imageBuf) {
          try {
            const res = await axios.get(
              `https://bk9.fun/ai/flux?prompt=${encodeURIComponent(prompt)}`,
              { timeout: 35000, responseType: 'arraybuffer' }
            );
            const buf = Buffer.from(res.data);
            if (buf.length > 5000) imageBuf = buf;
          } catch (e) {}
        }

        // 4. Dreaded image
        if (!imageBuf) {
          try {
            const res = await axios.get(
              `https://api.dreaded.site/api/aiimage?prompt=${encodeURIComponent(prompt)}`,
              { timeout: 35000 }
            );
            const imageUrl = res.data?.result?.url || res.data?.url || res.data?.image || null;
            if (imageUrl && imageUrl.startsWith('http')) {
              const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
              const buf = Buffer.from(imgRes.data);
              if (buf.length > 5000) imageBuf = buf;
            }
          } catch (e) {}
        }

        if (!imageBuf) throw new Error('All image APIs failed');

        await sock.sendMessage(chatId, {
          image: imageBuf,
          caption: `*${botName} AI Image*\n_${prompt}_`,
          ...channelInfo
        }, { quoted: fake });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
      } catch (error) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Image generation failed. Try again later.` }, { quoted: fake });
      }
    }
  }
];
