# CriptoFólio AI

Aplicativo de análise de portfólio de criptomoedas com IA.

## 🚀 Deploy no Vercel

### Pré-requisitos
1. Conta no [Vercel](https://vercel.com)
2. API Key do Google Gemini ([obter aqui](https://aistudio.google.com/app/apikey))

### Passos para Deploy

1. **Fork ou clone este repositório**

2. **Importe o projeto no Vercel:**
   - Acesse [Vercel](https://vercel.com)
   - Clique em "Add New Project"
   - Selecione este repositório do GitHub
   - Configure as variáveis de ambiente

3. **Configure a variável de ambiente:**
   - Nome: `GEMINI_API_KEY`
   - Valor: Sua chave da API do Google Gemini

4. **Deploy:**
   - Clique em "Deploy"
   - Aguarde o build completar

## 🛠️ Desenvolvimento Local

### Instalação

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env.local

# Adicionar sua API key no arquivo .env.local
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

## 🔑 Variáveis de Ambiente

- `GEMINI_API_KEY`: Chave da API do Google Gemini (obrigatória)

## 📝 Notas

- O arquivo `.env.local` é ignorado pelo Git (não será enviado ao repositório)
- Sempre configure as variáveis de ambiente no Vercel antes do deploy
- A API key do Gemini é necessária para o funcionamento da IA

## 🐛 Troubleshooting

### Build falha no Vercel
- Verifique se a variável `GEMINI_API_KEY` está configurada
- Verifique os logs de build no dashboard do Vercel

### Aplicativo não carrega
- Verifique o console do navegador para erros
- Confirme que a API key está válida
