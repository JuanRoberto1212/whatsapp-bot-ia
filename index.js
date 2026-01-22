import express from "express";
import axios from "axios";
import "dotenv/config";

const app = express();
app.use(express.json());

// Armazenamento temporário de estados (em produção, use Redis ou Banco de Dados)
const userSessions = {};

const CONTACT_NUMBER = "11943789843";

// Dados dos Planos baseados na imagem enviada
const PLANOS_INFO = {
    "1": "*Start / Essencial (R$ 79,90)*\nIdeal para quem está começando. Inclui site ultraveloz, design profissional e botão direto para WhatsApp.",
    "2": "*Plan (Pro) (R$ 179,90)*\nFoco em estratégia de vendas e leads. Inclui landing page otimizada, copy estratégica e integração com WhatsApp.",
    "3": "*Business (R$ 499,90)*\nTecnologia de ponta. Inclui dashboards, chatbots com IA, automações e aplicativos próprios."
};

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
    const entry = req.body.entry?.[0];
    const msg = entry?.changes?.[0]?.value?.messages?.[0];

    if (msg) {
        const from = msg.from;
        const text = msg.text?.body?.trim().toLowerCase();

        // Inicializa sessão se não existir
        if (!userSessions[from]) {
            userSessions[from] = { step: "inicio" };
        }

        await processarFluxo(from, text);
    }
    res.sendStatus(200);
});

async function processarFluxo(from, text) {
    let session = userSessions[from];
    let resposta = "";

    switch (session.step) {
        case "inicio":
            resposta = "Olá! Bom dia. Seja bem-vindo à *Midnight Code*! 🚀\nComo podemos ajudar você hoje?\n\n1. Conhecer Planos\n2. Suporte ao Cliente";
            session.step = "menu_principal";
            break;

        case "menu_principal":
            if (text === "1") {
                resposta = "Ótimo! Qual plano você teve mais interesse?\n\n1. Start / Essencial\n2. Plan (Pro)\n3. Business";
                session.step = "escolha_plano";
            } else if (text === "2") {
                resposta = "Para suporte, escolha o setor:\n\n1. Financeiro\n2. Falhas\n3. Dúvidas";
                session.step = "suporte_direcionamento";
            } else {
                resposta = "Por favor, digite apenas *1* ou *2*.";
            }
            break;

        case "escolha_plano":
            if (PLANOS_INFO[text]) {
                resposta = `${PLANOS_INFO[text]}\n\nTem interesse em conversar com um de nossos colaboradores?\n1. Sim\n2. Não`;
                session.step = "interesse_colaborador";
            } else {
                resposta = "Opção inválida. Escolha 1, 2 ou 3.";
            }
            break;

        case "interesse_colaborador":
            if (text === "1" || text === "sim") {
                resposta = `Perfeito! Clique no link para falar com nossa equipe: https://wa.me/${CONTACT_NUMBER}`;
                session.step = "inicio"; // Reseta o fluxo
            } else {
                resposta = "Entendido. Se precisar de algo mais, estarei por aqui!";
                session.step = "inicio";
            }
            break;

        case "suporte_direcionamento":
            // Independente da escolha (1, 2 ou 3), direciona para o número
            resposta = `Entendido. Vou te direcionar para um especialista do suporte.\nClique aqui: https://wa.me/${CONTACT_NUMBER}`;
            session.step = "inicio";
            break;

        default:
            session.step = "inicio";
            resposta = "Desculpe, houve um erro no fluxo. Vamos recomeçar?";
            break;
    }

    await responderWhatsApp(from, resposta);
}

async function responderWhatsApp(numero, mensagem) {
    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: numero,
                text: { body: mensagem }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
    } catch (error) {
        console.error("Erro ao enviar WhatsApp:", error.response?.data || error.message);
    }
}

app.listen(process.env.PORT || 3000, () => console.log("Bot ativo!"));