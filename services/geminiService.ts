export const generateDocumentContent = async (
  topic: string, 
  tone: string, 
  docType: string
): Promise<{ title: string; body: string }> => {
  try {
    const payload = {
      tipo: 'documento',
      dados: {
        topic,
        tone,
        docType
      }
    };

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro na comunicação com o servidor (${res.status}).`);
    }

    const data = await res.json();
    const textResponse = data.text;
    
    if (!textResponse) throw new Error("Sem resposta da IA");

    const json = JSON.parse(textResponse);
    
    return {
      title: json.title || "Documento Sem Título",
      body: json.body || textResponse
    };
  } catch (error) {
    console.error("Erro ao gerar conteúdo:", error);
    // Fallback em caso de erro de parse ou conexão
    return {
      title: "Erro na Geração",
      body: "Não foi possível estruturar o documento automaticamente. Verifique sua conexão e tente novamente."
    };
  }
};
