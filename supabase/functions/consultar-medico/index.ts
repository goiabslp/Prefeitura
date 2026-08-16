// @ts-nocheck
declare const Deno: any;
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Trata requisicoes preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { crm, uf } = await req.json();

    if (!crm) {
      return new Response(
        JSON.stringify({
          encontrado: false,
          mensagem: "Número do CRM não informado.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const cleanCrm = String(crm).replace(/\D/g, "");
    const cleanUf = String(uf || "MG").toUpperCase().trim();

    if (!cleanCrm) {
      return new Response(
        JSON.stringify({
          encontrado: false,
          mensagem: "CRM informado inválido.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Busca credenciais seguras registradas em secrets/variáveis de ambiente
    const cfmApiKey = Deno.env.get("CFM_API_KEY") || Deno.env.get("CFM_TOKEN");
    const cfmApiUrl = Deno.env.get("CFM_API_URL") || "https://portalmedico.org.br/api/v1/medicos";

    let result: any = null;

    // 1. Tenta consulta ao WebService oficial do CFM via API Key se configurado
    if (cfmApiKey) {
      try {
        const response = await fetch(`${cfmApiUrl}?crm=${cleanCrm}&uf=${cleanUf}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${cfmApiKey}`,
            "Accept": "application/json",
          },
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson && (resJson.nome || resJson.nomeMedico)) {
            result = {
              encontrado: true,
              nome: String(resJson.nome || resJson.nomeMedico).toUpperCase().trim(),
              crm: cleanCrm,
              uf: cleanUf,
              situacao: String(resJson.situacao || "ATIVO").toUpperCase().trim(),
              data_consulta: new Date().toISOString()
            };
          }
        }
      } catch (err) {
        console.error("[consultar-medico] Erro ao conectar com o WebService oficial CFM:", err);
      }
    }

    // 2. Se a chave não estiver configurada no ambiente ou não retornar pelo endpoint direto,
    // executa a consulta pública padronizada de médicos pelo número do CRM e UF
    if (!result) {
      result = await buscarMedicoCfmPublico(cleanCrm, cleanUf);
    }

    if (result && result.encontrado) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({
        encontrado: false,
        crm: cleanCrm,
        uf: cleanUf,
        mensagem: `Médico com CRM ${cleanCrm}/${cleanUf} não foi localizado no Conselho Federal de Medicina (CFM).`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[consultar-medico] Exceção:", error);
    return new Response(
      JSON.stringify({
        encontrado: false,
        mensagem: "Erro ao processar consulta de médico: " + error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Função auxiliar de busca e validação pública de médicos por CRM e UF
async function buscarMedicoCfmPublico(crmNumber: string, ufState: string) {
  try {
    // Tenta endpoint de busca nacional por CRM e UF
    const searchUrl = `https://portalmedico.org.br/api/v1/public/medicos/buscar?crm=${crmNumber}&uf=${ufState}`;
    const res = await fetch(searchUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const med = data[0];
        return {
          encontrado: true,
          nome: String(med.nome || med.nomeMedico).toUpperCase().trim(),
          crm: crmNumber,
          uf: ufState,
          situacao: String(med.situacao || "ATIVO").toUpperCase().trim(),
          data_consulta: new Date().toISOString()
        };
      } else if (data && data.nome) {
        return {
          encontrado: true,
          nome: String(data.nome).toUpperCase().trim(),
          crm: crmNumber,
          uf: ufState,
          situacao: String(data.situacao || "ATIVO").toUpperCase().trim(),
          data_consulta: new Date().toISOString()
        };
      }
    }
  } catch (e) {
    console.log("[consultar-medico] Fallback public API notice:", e);
  }

  return null;
}
