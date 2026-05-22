// ================================================================
//  CONFIG.JS — EDITE AQUI, NÃO MEXA NO INDEX.HTML
// ================================================================

const CONFIG = {

  // ── Informações pessoais ─────────────────────────────────────
  name:    "GenericBR",
  handle:  "Dhimitri Rael",
  tagline: "English · Portuguese Translator",
  bio:     "Feel free to contact me directly via Discord — for complex projects (like an album or game translation), email me instead.",

  // ── Avatar (URL de imagem — pode ser do GitHub, imgur, etc.) ─
  avatar: "",  // ex: "https://i.imgur.com/xxxx.jpg"

  // ── Links ────────────────────────────────────────────────────
  links: {
    youtube:   "https://www.youtube.com/@GenericBR",   // canal (botão YouTube)
    discord:   "https://discord.gg/RGAuGPaS",
    email:     "seuemail@exemplo.com",
    portfolio: "https://genericbr.carrd.co",
  },

  // ── YouTube API ──────────────────────────────────────────────
  //  Como obter a API Key e o Playlist ID: veja README.md
  youtube: {
    apiKey:     "YOUR_YOUTUBE_API_KEY_HERE",
    playlistId: "list=PLsX_idXfvgUKeFHYUvGJOkwF0mu4nZy_t",
    maxResults: 50,
  },

  // ── Steam ────────────────────────────────────────────────────
  //  appId = número na URL da loja: store.steampowered.com/app/XXXXXX/
  steam: {
    games: [
      { appId: "2119220", role: "Localizador PT-BR", note: "Early Access" },
      // { appId: "XXXXXXX", role: "Tradução PT-BR" },
    ],
  },

};
