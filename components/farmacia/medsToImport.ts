export const FORMAS_FARMACEUTICAS_MAPPING = {
    "adesivo transdérmico": "Adesivo transdérmico",
    "aerossol oral": "Aerossol oral",
    "cápsula": "Cápsula",
    "cápsula de liberação prolongada": "Cápsula de liberação prolongada",
    "cápsula de liberação retardada": "Cápsula de liberação retardada",
    "cápsula gelatinosa dura": "Cápsula gelatinosa dura",
    "cápsula inalatória": "Cápsula inalatória",
    "cápsula mole": "Cápsula mole",
    "cápsula para inalação oral": "Cápsula para inalação oral",
    "comprimido": "Comprimido",
    "comprimido de liberação prolongada": "Comprimido de liberação prolongada",
    "comprimido de liberação retardada": "Comprimido de liberação retardada",
    "comprimido dispersível": "Comprimido dispersível",
    "comprimido mastigável": "Comprimido mastigável",
    "comprimido orodispersível": "Comprimido orodispersível",
    "comprimido para suspensão": "Comprimido para suspensão",
    "comprimido para suspensão oral": "Comprimido para suspensão oral",
    "comprimido para uso tópico": "Comprimido para uso tópico",
    "comprimido revestido": "Comprimido revestido",
    "comprimido solúvel": "Comprimido solúvel",
    "comprimido sublingual": "Comprimido sublingual",
    "comprimido vaginal": "Comprimido vaginal",
    "comprimidos dispersíveis": "Comprimidos dispersíveis",
    "creme": "Creme",
    "creme dermatológico": "Creme dermatológico",
    "creme vaginal": "Creme vaginal",
    "dispositivo intrauterino (DIU)": "Dispositivo intrauterino (DIU)",
    "elixir": "Elixir",
    "emulsão oral": "Emulsão oral",
    "enema": "Enema",
    "frasco-ampola": "Frasco-ampola",
    "gel": "Gel",
    "gel oral": "Gel oral",
    "gel vaginal": "Gel vaginal",
    "goma de mascar": "Goma de mascar",
    "granulado oral": "Granulado oral",
    "granulado para suspensão oral": "Granulado para suspensão oral",
    "granulado revestido de liberação prolongada": "Granulado revestido de liberação prolongada",
    "grânulo para suspensão oral": "Grânulo para suspensão oral",
    "grânulos revestidos": "Grânulos revestidos",
    "implante": "Implante",
    "loção": "Loção",
    "óleo para uso oral": "Óleo para uso oral",
    "óvulo vaginal": "Óvulo vaginal",
    "pasta": "Pasta",
    "pastilha": "Pastilha",
    "pó": "Pó",
    "pó estéril para solução injetável": "Pó estéril para solução injetável",
    "pó inalatório": "Pó inalatório",
    "pó liofilizado para solução injetável": "Pó liofilizado para solução injetável",
    "pó liofilizado para solução para infusão": "Pó liofilizado para solução para infusão",
    "pó liofilizado para suspensão injetável de liberação prolongada": "Pó liofilizado para suspensão injetável de liberação prolongada",
    "pó liófilizado para injetável": "Pó liófilizado para injetável",
    "pó para dispersão oral": "Pó para dispersão oral",
    "pó para inalação": "Pó para inalação",
    "pó para inalação oral": "Pó para inalação oral",
    "pó para solução injetável": "Pó para solução injetável",
    "pó para solução oral": "Pó para solução oral",
    "pó para solução para infusão": "Pó para solução para infusão",
    "pó para solução para infusão e inalação": "Pó para solução para infusão e inalação",
    "pó para suspensão injetável": "Pó para suspensão injetável",
    "pó para suspensão injetável de liberação prolongada": "Pó para suspensão injetável de liberação prolongada",
    "pó para suspensão oral": "Pó para suspensão oral",
    "pomada": "Pomada",
    "pomada oftálmica": "Pomada oftálmica",
    "solução": "Solução",
    "solução aerossol": "Solução aerossol",
    "solução bucal": "Solução bucal",
    "solução capilar": "Solução capilar",
    "solução inalatória": "Solução inalatória",
    "solução injetável": "Solução injetável",
    "solução injetável de liberação prolongada": "Solução injetável de liberação prolongada",
    "solução injetável depot": "Solução injetável depot",
    "solução nasal": "Solução nasal",
    "solução oftálmica": "Solução oftálmica",
    "solução oral": "Solução oral",
    "solução otológica": "Solução otológica",
    "solução para diluição para infusão": "Solução para diluição para infusão",
    "solução para infusão": "Solução para infusão",
    "solução para inalação": "Solução para inalação",
    "solução para uso tópico": "Solução para uso tópico",
    "solução retal": "Solução retal",
    "solução spray": "Solução spray",
    "solução spray nasal": "Solução spray nasal",
    "solução tópica": "Solução tópica",
    "suspensão aerossol": "Suspensão aerossol",
    "suspensão injetável": "Suspensão injetável",
    "suspensão injetável de liberação prolongada": "Suspensão injetável de liberação prolongada",
    "suspensão injetável intratecal ou intrabrônquica": "Suspensão injetável intratecal ou intrabrônquica",
    "suspensão oftálmica": "Suspensão oftálmica",
    "suspensão oral": "Suspensão oral",
    "suspensão para inalação nasal": "Suspensão para inalação nasal",
    "tintura": "Tintura",
    "unidade": "Unidade",
    "xampu": "Xampu"
};

const mapCategoria = (cat: string): 'CBAF' | 'CEAF' | 'CESAF' => {
    if (cat.includes('CBAF')) return 'CBAF';
    if (cat.includes('CEAF')) return 'CEAF';
    if (cat.includes('CESAF')) return 'CESAF';
    return 'CBAF';
}

export const getMedsToImport = (rawText: string) => {
    return rawText.split('\n').filter(line => line.trim().length > 0).map(line => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 4) {
            let nome = parts[0];
            let forma = FORMAS_FARMACEUTICAS_MAPPING[parts[1].toLowerCase()] || parts[1];
            let dosagemRaw = parts[2];
            let categoria = mapCategoria(parts[3]);

            let dosagem = dosagemRaw === "'-" || dosagemRaw === "-" ? "" : dosagemRaw;

            return {
                nome: nome.toUpperCase(),
                tipo: forma,
                dosagem: dosagem,
                categoria: categoria,
                principio_ativo: nome.toUpperCase(),
                quantidade: 0,
                unidade: 'un',
                limite_minimo: 10,
                validade: '2099-12-31',
                lote: 'LOTE-INICIAL'
            };
        }
        return null;
    }).filter(m => m !== null);
};
