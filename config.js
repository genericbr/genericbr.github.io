// ================================================================
//  CONFIG.JS — EDITE AQUI, NÃO MEXA NO INDEX.HTML
//  Cada seção tem comentários explicando o que fazer.
// ================================================================

const CONFIG = {

  // ── Informações pessoais ─────────────────────────────────────
  name:       "GenericBR",
  tagline:    "PT-BR Translator & Game Localizer",
  bio:        "Especializado em localização PT-BR de músicas indie e jogos. Suas histórias, na língua do seu público.",
  contactBio: "Aberto para projetos de localização PT-BR de jogos indie e músicas vocaloid/J-pop.",

  // ── Links ────────────────────────────────────────────────────
  links: {
    email:          "seuemail@exemplo.com",
    portfolio:      "https://genericbr.carrd.co",
    portfolioLabel: "Carrd",
    // twitter: "https://twitter.com/seuuser",  // descomente se quiser
  },

  // ── Estatísticas do hero (fallback caso a API falhe) ─────────
  //    Quando a YouTube API carregar, ela sobrescreve esses valores.
  stats: {
    songs:  "10+",
    views:  "20M+",
  },

  // ── YouTube ──────────────────────────────────────────────────
  //  1. Acesse: https://console.cloud.google.com
  //  2. Crie um projeto → Ative a "YouTube Data API v3"
  //  3. Crie uma API Key (Credenciais → Criar Credencial)
  //  4. Cole a key em apiKey abaixo
  //
  //  Para achar o playlistId:
  //    Abra a playlist no YouTube → a URL terá ?list=PLxxxxxxx
  //    Cole esse "PLxxxxxxx" em playlistId abaixo.
  youtube: {
    apiKey:     "AIzaSyAT7jaIbug5dmm_PzFqm7MvzdQkfn7eLUE",
    playlistId: "PLsX_idXfvgUKeFHYUvGJOkwF0mu4nZy_t",
    maxResults: 50,   // máximo 50 por request da API
  },

  // ── Steam ────────────────────────────────────────────────────
  //  Para adicionar um jogo, copie o AppID da URL da Steam:
  //    https://store.steampowered.com/app/2119220/Lured_In/
  //    O AppID é o número: 2119220
  //
  //  Campos disponíveis em cada jogo:
  //    appId  → (obrigatório) número da página Steam
  //    role   → seu papel no projeto (aparece em destaque)
  //    note   → texto opcional extra (ex: "Em desenvolvimento")
  steam: {
    games: [
      {
        appId: "2119220",
        role:  "Localizador PT-BR",
        note:  "Early Access",
      },
      // Adicione mais jogos aqui ↓
      // { appId: "XXXXXXX", role: "Revisão PT-BR" },
      // { appId: "XXXXXXX", role: "Tradução completa PT-BR" },
    ],
  },

};
