import express from "express"; 
import axios from "axios";
import "dotenv/config"; 

const app = express();
app.use(express.json());

// Verificacao do webhook (Meta pede isso)

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get("/webhook", (req, res) => {
    
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFICADO");
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
    console.log("Recebi algo no POST!"); // Issto PRECISA aparecer no log do Railway

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const msg = value?.messages?.[0];

    if (msg && msg.text) {
        const text = msg.text.body;
        const from = msg.from;
        console.log(`Mensagem de ${from}: ${text}`);

        try {
            const aiResponse = await perguntarIA(text);
            await responderWhatssApp(from, aiResponse);
        } catch (err) {
            console.error("Erro ao responder:", err.message);
        }
    }

    res.sendStatus(200); // Sempre responda 200 para o Meta não travar seu webhook
});

async function perguntarIA(texto) {
    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Você é um assistente claro direto e gentil." },
                { role: "user", content: texto }
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            }
        }

    );

    return response.data.choices[0].message.content;
}

async function responderWhatssApp(numero, mensagem) {
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
}


const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});