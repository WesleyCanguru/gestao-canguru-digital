import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export const generatePaidTrafficStrategy = async (pdfText: string) => {
  const prompt = `
    Você é um especialista em tráfego pago e marketing digital. 
    Analise o texto extraído de um PDF de estratégia de tráfego pago abaixo e gere um objeto JSON estruturado para exibição em um dashboard.
    
    O JSON deve seguir exatamente esta estrutura:
    {
      "monthly_budget": number,
      "daily_budget": "string (ex: R$ 25/dia)",
      "priority_goal": "string (ex: 5 clientes)",
      "avg_ticket": number,
      "strategic_decision": "string (resumo da decisão estratégica)",
      "campaign_structure": {
        "sets": [
          {
            "id": "string (ex: Conjunto 1)",
            "title": "string",
            "destination_url": "string",
            "audience": "string",
            "keywords": ["string"],
            "prefilled_message": "string"
          }
        ]
      },
      "phase_2_description": "string",
      "phase_2_campaigns": [
        {
          "title": "string",
          "description": "string",
          "value": "string (ex: R$ 900/mês)"
        }
      ],
      "alert_message": "string"
    }

    Texto da estratégia:
    ${pdfText}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          monthly_budget: { type: Type.NUMBER },
          daily_budget: { type: Type.STRING },
          priority_goal: { type: Type.STRING },
          avg_ticket: { type: Type.NUMBER },
          strategic_decision: { type: Type.STRING },
          campaign_structure: {
            type: Type.OBJECT,
            properties: {
              sets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    destination_url: { type: Type.STRING },
                    audience: { type: Type.STRING },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    prefilled_message: { type: Type.STRING }
                  },
                  required: ["id", "title", "destination_url", "audience", "keywords", "prefilled_message"]
                }
              }
            },
            required: ["sets"]
          },
          phase_2_description: { type: Type.STRING },
          phase_2_campaigns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                value: { type: Type.STRING }
              },
              required: ["title", "description", "value"]
            }
          },
          alert_message: { type: Type.STRING }
        },
        required: [
          "monthly_budget", 
          "daily_budget", 
          "priority_goal", 
          "avg_ticket", 
          "strategic_decision", 
          "campaign_structure", 
          "phase_2_description", 
          "phase_2_campaigns", 
          "alert_message"
        ]
      }
    }
  });

  return JSON.parse(response.text);
};
