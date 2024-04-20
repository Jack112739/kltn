class FileIO {
    /** @param {NodeUI} node @returns {String} */
    static to_file(node) {
        if(node.math_logic === 'referenced') return;
        document.body.appendChild(node.html_div);
        let rect = node.html_div.getBoundingClientRect();
        let str=`${rect.top}, ${rect.left}, ${node.renderer.offsetWidth}, ${node.renderer.offsetHeight}`;
        node.graph.html_div.appendChild(node.html_div);
        for(const [refs, _] of node.from) {
            str +=`, ${refs.id.trim()}`;
        }
        str = `%% ${str}\n\\label{${node.id}}\n${node.raw_text}\n`;
        if(node.math_logic === 'input' || node.math_logic === 'output') return str;
        if(node.detail && node.detail.internal_nodes.size !== 0) {
             str += `\n\\begin{proof}\n${FileIO.parse_children(node)}\n\\end{proof}\n`;
        }
        return str;
    }
    static parse_children(node) {
        let str = '';
        let deg_map = new Map(), count = 0;
        let search = [];
        if(!node.detail) return '';
        for(const [_, child] of node.detail?.internal_nodes) {
            deg_map.set(child, child.from.size);
            if(child.from.size === 0) search.push(child);
        }
        while(search.length !== 0) {
            let cur = search.pop();
            count++;
            for(const [adj, _] of cur.to) {
                let deg_dec = deg_map.get(adj) - 1;
                if(deg_dec === 0) search.push(adj);
                deg_map.set(adj, deg_dec);
            }
            str += FileIO.to_file(cur);
        }
        if(count !== node.detail.internal_nodes.size) {
            return new Error('can not process graph with cyclic dependency');
        }
        return str;
    }
    static parse_file(str, file_name) {
        let lines = str.split('\n');
        let cur = null, err_msg = null, now = null;
        GraphHistory.active = true;
        cur = new GraphUI(new NodeUI(file_name.slice(0, -'.tex'.length), null));
        parse:
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if(line.startsWith('%%')) {
                now = new NodeUI('<<error>>', cur);
                let headers = line.slice(2).split(',').map(str => str.trim());
                now.html_div.style.top = parse_int_px(headers[0]);
                now.html_div.style.left = parse_int_px(headers[1]);
                now.renderer.style.width = parse_int_px(headers[2]);
                now.renderer.style.height = parse_int_px(headers[3]);
                for(let j = 4; j < headers.length; j++) {
                    if(!now.reference(headers[j].trim())) {
                        err_msg = `error at line ${i}: node named ${headers[j].trim()} does not exist`;
                        break parse;
                    }
                }
                let name = lines[i + 1]?.trim();
                if(!name) {
                    err_msg = `error at line ${i}: expected a label after line ${i}`;
                    break parse;
                }
                if(!name.startsWith('\\label{') || !name.endsWith('}')) {
                    err_msg = `error at line ${i+1}: labels must have the form \`\\label{<name>}\``;
                    err_msg += `error at line ${i}: expected a label after line ${i}`;
                    break parse;
                }
                now.rename(name.slice('\\label{'.length, -1));
                i++;
            }
            else if(line === '\\begin{proof}') {
                if(!now) {
                    err_msg = `error at line ${i}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text = now.raw_text.trim();
                if(now.raw_text.startsWith('\\begin{lemma}')) {
                    if(!now.raw_text.endsWith('\\end{lemma}')) {
                        err_msg = `error at line ${i}: missing \\end{lemma}`;
                        break parse;
                    }
                    now.math_logic = 'lemma';
                    now.raw_text = now.raw_text.slice('\\begin{lemma}'.length, -'\\end{lemma}'.length);
                }
                cur = new GraphUI(now);
                now.detail = cur;
                now = null;
            }
            else if(line === '\\end{proof}') {
                cur = cur.parent;
                now = null;
            }
            else {
                if(line.length === 0) continue;
                if(!now) {
                    err_msg = `error at line ${i}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text += '\n';
                now.raw_text += line;
            }
        }
        if(cur.parent) err_msg = `missing \\end{proof}`;
        if(err_msg) return new Error(err_msg);
        editor.visual_mode(false);
        FileIO.compile(cur);
        editor.visual_mode(true);
        GraphHistory.active = false;
        return cur;
    }
    static compile(graph) {
        if(!graph) return;
        for(const [_, node] of graph.internal_nodes) {
            editor.load(node);
            editor.raw.data = node.raw_text;
            editor.save();
            editor.close();
            FileIO.compile(node.detail);
        }
    }
}
function parse_int_px(str) {
    if(isNaN(str)) return "";
    return str.trim() + "px";
}
document.addEventListener('DOMContentLoaded', () => {
    let input = document.getElementById('uploader');
    document.querySelector('.upload').onclick = () => input.click();
    input.onchange = (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = (e1) => {
            if(!file.name.endsWith('.tex')) return alert('Can only upload proof stored in .tex file');
            let replace = FileIO.parse_file(e1.target.result, file.name);
            e.target.value = "";
            if(replace instanceof Error) return alert(replace.message);
            GraphUI.current_graph.switch_to(replace);
            GraphHistory.stack = [];
            GraphHistory.position = 0;
        };
        reader.readAsText(file);
    }
    document.querySelector('.download').onclick = async () => {
        let root = GraphUI.current_graph.summary.root;
        try {
            let file_handler = await window.showSaveFilePicker({
                suggestedName: `${root.id}.tex`,
                types: [{
                    accept: {'text/plain': ['.tex']}
                }]
            });
            let stream = await file_handler.createWritable();
            await stream.write(FileIO.parse_children(root));
            await stream.close();
        } catch(e) {
            if(e instanceof AbortError || !(e instanceof DOMException)) return;
            alert(`Fail to save your proof, reason: ${e.message}`);
        }
    }
})