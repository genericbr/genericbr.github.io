# GenericBR Portfolio

Portfolio estático com auto-fetch de YouTube e Steam.  
**Único arquivo que você vai editar:** `config.js`

---

## 1. Subir no GitHub Pages

```bash
# Crie um repositório chamado exatamente:
# seuusername.github.io

# Clone localmente, cole os arquivos, commit e push:
git init
git add .
git commit -m "init portfolio"
git branch -M main
git remote add origin https://github.com/SEUUSER/SEUUSER.github.io.git
git push -u origin main
```

Depois de alguns minutos o site estará em `https://SEUUSER.github.io`

---

## 2. Configurar YouTube (seção de músicas)

### 2a. Criar API Key

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (nome qualquer)
3. Menu lateral → **APIs e Serviços → Biblioteca**
4. Busque **YouTube Data API v3** → Ativar
5. **Credenciais → Criar credencial → Chave de API**
6. Copie a key e cole em `config.js → youtube.apiKey`

> A API é gratuita. Você tem 10.000 "unidades" por dia — cada carga do portfolio usa ~2.

### 2b. Achar o Playlist ID

1. Abra sua playlist no YouTube
2. Na URL você verá: `?list=PLxxxxxxxxxxxxxxxx`
3. Copie o `PLxxxxxxxxxxxxxxxx` e cole em `config.js → youtube.playlistId`

---

## 3. Adicionar jogos Steam

Abra a página do jogo na Steam. A URL será assim:
```
https://store.steampowered.com/app/2119220/Lured_In/
                                    ↑
                               esse é o AppID
```

Em `config.js → steam.games`, adicione uma linha:
```js
{ appId: "2119220", role: "Localizador PT-BR", note: "Early Access" },
```

**Campos:**
- `appId` → obrigatório
- `role`  → seu papel (aparece em destaque)
- `note`  → opcional, ex: `"Em desenvolvimento"`, `"Lançado 2024"`

---

## 4. Atualizar o portfolio

Adicionou uma música? Só colocar o vídeo na playlist do YouTube — o site já pega automaticamente.

Adicionou um jogo? Adicione o AppID no `config.js`, commit e push.

```bash
git add config.js
git commit -m "add novo jogo"
git push
```

---

## 5. Domínio customizado (opcional)

1. Compre um domínio (Namecheap, Registro.br ~R$40-60/ano)
2. No repositório GitHub: Settings → Pages → Custom domain
3. No painel do seu registrar, adicione um CNAME apontando para `SEUUSER.github.io`

---

## Estrutura dos arquivos

```
/
├── index.html   ← não precisa mexer
├── config.js    ← só edite aqui
└── README.md
```
