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
  avatar: "https://genericbr.carrd.co/assets/images/image01.jpg?v=5985aec8",  // ex: "https://i.imgur.com/xxxx.jpg"

  // ── Links ────────────────────────────────────────────────────
  links: {
    youtube:   "https://www.youtube.com/@GenericBR",   // canal (botão YouTube)
    discord:   "https://discord.gg/dst2C2yU6H",
    email:     "genericbr.business@gmail.com",
    portfolio: "https://genericbr.carrd.co",
  },

  // ── YouTube API (chave única para todas as playlists) ────────
  //  Como obter a API Key: veja README.md
  youtube: {
    apiKey: "YOUR_YOUTUBE_API_KEY_HERE",
  },

  // ── Playlists do YouTube ─────────────────────────────────────
  //  Duas playlists separadas: música e audiovisuais.
  //  ID da playlist = o valor depois de "list=" na URL do YouTube.
  playlists: {
    music: {
      id: "PLsX_idXfvgUKeFHYUvGJOkwF0mu4nZy_t",   // <-- sua playlist de músicas
      maxResults: 50,
    },
    audiovisuals: {
      id: "YOUR_AUDIOVISUALS_PLAYLIST_ID",        // <-- insira o ID da playlist de audiovisuais
      maxResults: 50,
    },
  },

  // ── Steam ────────────────────────────────────────────────────
  //  appId = número na URL da loja: store.steampowered.com/app/XXXXXX/
  steam: {
    games: [
      { appId: "4178020", name: "Lured In", dev: "Angler Interactive", role: "Localizador PT-BR", note: "Early Access" },
    ],
  },

};
