// a fragment of the editor can be use to manipulate the data inside
/**
 * @typedef {object} Token
 * @property {number} err
 * @property {string} type
 * @property {string} str
 */
class Fragment {
    //An array of token can be use to concatinate to a valid string later
    /**@type {Token} */
    parts;
    // range of the selected fragment, if any
    offset;

    /**@param {Range} range  @param {'html' | 'text'} type */
    constructor(range, type) {
        this.parts = [];
        this.offset = {start: 0, end: 0};
        if(type === 'html') {
            let common = range.commonAncestorContainer;
            if(common.nodeName === '#text' || common.nodeName === 'PRE') {
                range.setStart(range.startContainer, 0);
                range.setEnd(range.endContainer, range.endContainer.data.length);
                this.init_range(common, 0, range);
                return;
            }
            let find = (parent, offset) => {
                if(common === parent) return parent.childNodes[offset] || null;
                while(parent.parentNode !== common) parent = parent.parentNode;
                return parent
            }
            let start = find(range.startContainer, range.startOffset);
            let end = find(range.endContainer, range.endOffset);
            if(!start) return;
            this.dfs_init(start, end, range);
        }
        else {
            this.init_text(range, 0, '');
            this.offset = {start: 0, end: this.parts.length};
        }
    }
    dfs_init(start, end, range) {
        let range_ = range.cloneRange(), common = range.commonAncestorContainer;
        let i = Array.from(common.childNodes).indexOf(start);
        range.setStart(common, i);
        while(start !== end) {
            this.init_range(start, i, range_);
            start = start.nextSibling;
            i++;
        }
        if(range.endContainer === common) {
            this.offset.end = this.parts.length;
            this.parts.push({str: '', type: 'text', err: 0});
            range.setEnd(common, i);
        }
        else {
            this.init_range(end, i, range_); 
            range.setEnd(common, i + 1);
        }
    }
    init_text(str, j, tag) {
        let test = arr => arr.find(tg => str.startsWith(tg, j));
        let start = this.parts.length - 1;
        while(true) {
            let t = null;
            if(j >= str.length) {
                if(start >= 0) {
                    this.parts[start].err = 1;
                }
                return j;
            }
            if(t = test(Object.keys(tags))) {
                this.parts.push({str: t.slice(1,-1), err: 0, type: 'open'});
                j = this.init_text(str, j + t.length, t);
            }
            else if(t = test(Object.values(tags))) {
                this.parts.push({str: t.slice(2, -1), err: 0, type: 'close'});
                j += t.length;
                if(t === tags[tag]) return j;
                else this.parts.at(-1).err = 1;
            }
            else if(t = test(Object.keys(math_delimeter))) {
                let start = j;
                j += t.length;
                while(!str.startsWith(math_delimeter[t], j) && j < str.length) j++;
                j += math_delimeter[t].length;
                this.parts.push({str: str.slice(start, j), type: 'math', err: t.length});
                if(j > str.length) this.parts.at(-1).err = 0;
            }
            else {
                if(this.parts.at(-1)?.type === 'text') this.parts.at(-1).str += str[j];
                else this.parts.push({str: str[j], err: 0, type: 'text'});
                j++;
            }
        }
    }
    /** @param {Range} range @param {Node} node @param {number} counter   */
    init_range(node, counter, range) {
        let set = (parent, offset) => {
            if(range.startContainer === parent && offset === range.startOffset)
                this.offset.start = this.parts.length;
            if(range.endContainer === parent && offset === range.endOffset)
                this.offset.end = this.parts.length;
        };
        set(node.parentNode, counter);
        if(node.nodeName === '#text' || node.nodeName === 'MJX-CONTAINER' || node.nodeName === 'PRE') {
            if(node.nodeName === 'MJX-CONTAINER') {
                let math_type = node.attributes.display ? 1 : 0;
                this.parts.push({str: node.lastChild.textContent, type: 'math', err: math_type});
            }
            else {
                let err = 0;
                if(node.nodeName === 'PRE') node = node.firstChild, err = 1;
                if(node === range.startContainer) {
                    this.offset.start = this.parts.length;
                    this.offset.partial_start = range.startOffset;
                }
                if(node === range.endContainer) {
                    this.offset.end = this.parts.length;
                    this.offset.partial_end = range.endOffset;
                }
                this.parts.push({str: node.data, err: err, type: 'text'});
            }
            return;
        }
        this.parts.push({str: node.nodeName.toLowerCase(), type: 'open', err: 0});
        let it = node.firstChild;
        for(let i = 0; i < node.childNodes.length; i++) {
            this.init_range(it, i, range);
            it = it.nextSibling;
        }
        set(node, node.childNodes.length);
        this.parts.push({str: node.nodeName.toLowerCase(), type: 'close', err: 0});
    }
    /**@param {'text' | 'html'} type  @returns {string | Array<Node>}*/
    output(type) {
        if(type === 'text') return this.parts.map(token => toString(token)).join('');
        let div = document.createElement('div'), cur = div;
        for(let i = 0; i < this.parts.length; i++) {
            let token = this.parts[i];
            if((token.err !== 0) ^ (token.type === 'math')) {
                cur.insertAdjacentHTML('beforeend', `<pre class="err">${map_to_html(toString(token))}</pre>`);
            }
            else if(token.type === 'text') {
                cur.insertAdjacentHTML('beforeend', map_to_html(token.str));
            }
            else if(token.type === 'open') {
                cur.appendChild(document.createElement(token.str));
                cur = cur.lastChild;
            }
            else if(token.type === 'close') {
                cur = cur.parentNode;
            } 
            else if(token.type === 'math') {
                let math = token.err;
                if(math === '\\ref{'.length) cur.insertAdjacentHTML('beforeend', 
                    `<mjx-container class="ref">${token.str.slice(math, -1)}</mjx-container>`)
                else cur.appendChild(MathJax.tex2chtml(token.str.slice(math, -math), {display: math === 2}));
                cur.lastChild.insertAdjacentHTML('beforeend', `<script type="math">${token.str}</script>`);
            }
        }
        MathJax.startup?.document?.clear();
        MathJax.startup?.document?.updateDocument();
        return Array.from(div.childNodes);
    }
    text_offset() {
        let sum = 0, ret = {start: 0, end: 0};
        for(let i = 0; i < this.parts.length; i++) {
            if(i === this.offset.start) ret.start = sum + (this.offset.partial_start ?? 0);
            if(i === this.offset.end) ret.end = sum + (this.offset.partial_end ?? 0);
            sum += this.parts[i].str.length;
            sum += this.parts[i].type === 'open' ? 2: this.parts[i].type === 'close' ? 3: 0;
        }
        return ret;
    }
    /** @param {NodeUI} node @returns {String} */
    static to_file(node) {
        if(node.math_logic === 'referenced') return;
        document.body.appendChild(node.html_div);
        let rect = node.html_div.getBoundingClientRect();
        let str = `${rect.top}, ${rect.left}`;
        node.graph.html_div.appendChild(node.html_div);
        for(const [refs, _] of node.from) {
            str +=`, ${refs.id.trim()}`;
        }
        str = `%% ${node.math_logic}, ${str}\n\\label{${node.id}}\n`;
        if(node.math_logic === 'lemma') str += `\\begin{lemma}{${node.id}}\n${node.raw_text}\n\\end{lemma}\n`;
        else str += node.raw_text + '\n';
        if(node.math_logic === 'input' || node.math_logic === 'output') return str;
        if(node.detail && node.detail.internal_nodes.size !== 0) {
             str += `\n\\begin{proof}\n${Fragment.parse_children(node)}\n\\end{proof}\n`;
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
            str += Fragment.to_file(cur);
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
        cur = new GraphUI(new NodeUI(file_name, null));
        parse:
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if(line.startsWith('%%')) {
                now = new NodeUI('<<error>>', cur);
                let headers = line.slice(2).split(','), tmp;
                now.math_logic = headers[0].trim();
                now.html_div.style.resize = "none";
                now.html_div.style.top = (parseInt(headers[1]) ?? 0) + "px";
                now.html_div.style.left = (parseInt(headers[2]) ?? 0) + "px";
                now.html_div.style.resize = "";
                for(let j = 3; j < headers.length; j++) {
                    if(!now.reference(headers[j].trim())) {
                        err_msg = `error at line ${i}: node named ${headers[i].trim()} does not exist`;
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
        Fragment.compile(cur);
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
            Fragment.compile(node.detail);
        }
    }
}
function toString(token) {
    return token.type === 'open' ? `<${token.str}>`: token.type === 'close' ? `</${token.str}>` : token.str;
}
function map_to_html(str) {
    const html_special = {'<':'&lt;', '>':'&gt;', '&':'&amp;', '\'':'&apos;', '\"':'&quot;'};
    let ret = '';
    for(const c of str) {
        ret += html_special[c] ?? c;
    }
    return ret;
}
document.addEventListener('DOMContentLoaded', () => {
    let input = document.getElementById('uploader');
    document.querySelector('.upload').onclick = () => input.click();
    input.onchange = (e) => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = (e1) => {
            let replace = Fragment.parse_file(e1.target.result, file.name);
            e.target.value = "";
            if(replace instanceof Error) return alert(replace.message);
            GraphUI.current_graph.switch_to(replace);
            GraphHistory.stack = [];
            GraphHistory.position = 0;
        };
        reader.readAsText(file);
    }
    document.querySelector('.download').onclick = () => {
        let a = document.createElement('a');
        let download_text = Fragment.parse_children(GraphUI.current_graph.summary.root); 
        if(download_text instanceof Error) return alert(download_text.message);
        a.href = `data:text/plain;charset=utf-8,` + encodeURIComponent(download_text);
        a.download = "math-example.tex";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
})