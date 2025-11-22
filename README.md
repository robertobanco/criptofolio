# CriptoFólio AI

Aplicativo de análise de portfólio de criptomoedas com IA.

## 🚀 Deploy no Vercel

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)

### Passos para Deploy

1. **Fork ou clone este repositório**

2. **Importe o projeto no Vercel:**
   - Acesse [Vercel](https://vercel.com)
   - Clique em "Add New Project"
   - Selecione este repositório do GitHub

3. **Deploy:**
   - Clique em "Deploy"
   - Aguarde o build completar
   - Pronto! Seu app estará no ar 🎉

### 🔑 Configuração de API Keys

**Não é necessário configurar variáveis de ambiente!** 

O aplicativo solicita as seguintes chaves diretamente ao usuário na primeira vez que é aberto:
- **Google Gemini API Key** - Para análise com IA ([obter aqui](https://aistudio.google.com/app/apikey))
- **API Keys de Cotação de Criptomoedas** - Para dados em tempo real

As chaves são armazenadas localmente no navegador do usuário (localStorage).

## 🛠️ Desenvolvimento Local

### Instalação

```bash
# Instalar dependências
npm install
```

### Executar localmente

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:3000`

### Build de produção

```bash
npm run build
npm run preview
```

## 📦 Tecnologias

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Google Gemini AI

## 🔒 Segurança

- As API keys são armazenadas apenas no navegador do usuário (localStorage)
- Nenhuma chave é enviada para servidores externos além das APIs oficiais
- Cada usuário usa suas próprias credenciais

## 🐛 Troubleshooting

### Build falha no Vercel
- Verifique os logs de build no dashboard do Vercel
- Certifique-se de que todas as dependências estão no `package.json`

### Aplicativo não carrega
- Verifique o console do navegador para erros
- Certifique-se de ter inserido as API keys corretamente quando solicitado
