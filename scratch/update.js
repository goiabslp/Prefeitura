const fs = require('fs');
const file = 'c:/Users/guigu/OneDrive/Área de Trabalho/Apps/Projeto- Prefeitura-01/Prefeitura-Integrada-DataBase/components/farmacia/EstoqueScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add states
content = content.replace(
    'const [isAddTipoOpen, setIsAddTipoOpen] = useState(false);',
    'const [isAddTipoOpen, setIsAddTipoOpen] = useState(false);\n    const [isAddTipoDosagemOpen, setIsAddTipoDosagemOpen] = useState(false);'
);
content = content.replace(
    'const [isEditTipoOpen, setIsEditTipoOpen] = useState(false);',
    'const [isEditTipoOpen, setIsEditTipoOpen] = useState(false);\n    const [isEditTipoDosagemOpen, setIsEditTipoDosagemOpen] = useState(false);'
);

// 2. Center title
const oldTitleHTML = `<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-pink-600 uppercase text-xl tracking-wide">Novo Medicamento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Insira os dados do lote para alimentar o estoque</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">`;

const newTitleHTML = `<div className="p-5 border-b border-slate-100 flex justify-center items-center relative bg-slate-50">
                            <div className="text-center">
                                <h3 className="font-black text-pink-600 uppercase text-xl tracking-wide">Novo Medicamento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Insira os dados do lote para alimentar o estoque</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="absolute right-5 p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">`;

content = content.replace(oldTitleHTML, newTitleHTML);

// 3. Helper to update a custom select to have the blur effect and z-index fixes
// For "Tipo"
function updateTipoSelect(content, isAdd) {
    const varName = isAdd ? 'isAddTipoOpen' : 'isEditTipoOpen';
    
    // Fix wrapper
    content = content.replace(
        new RegExp(`<div className="relative">\\s*<label className="block text-\\[11px\\] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Tipo \\*</label>`, 'g'),
        (match) => {
            return `<div className={\`relative \${${varName} ? 'z-50' : ''}\`}>\n                                    <label className={\`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 \${${varName} ? 'relative z-50' : ''}\`}>Tipo *</label>`;
        }
    );

    // Fix trigger
    content = content.replace(
        new RegExp(`className="(w-full rounded-xl border border-slate-200 [^"]*?flex justify-between items-center select-none)\\s*(?:\\\${[^}]+})?"`, 'g'),
        (match, classes) => {
            if (match.includes(varName) || !content.includes(match)) return match; // rudimentary check
            return match; // Actually this is too brittle with regex. Let's do exact string replacements.
        }
    );
    return content;
}

// Let's use exact replacements for the selects instead of regex, it's safer.
// I will just write a function that finds the block and replaces it.

fs.writeFileSync(file, content);
console.log('Script ran, part 1');
