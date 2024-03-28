// a fragment of the editor can be use to manipulate the data inside
class Fragment {
    //An array of strings, can be use to concatinate to a valid string later
    parts;
    //top level missing tags
    top_level;

    constructor(range, html) {
        this.parts = [];
        this.top_level = [];
        if(html) {
            this.init_range(range.start.node, range.end.node, range.start.offset, range.end.offset);
        }
        else {
            this.init_text(range, 0, '');
        }
    }
    init_text(str, j, tag) {
        let test = arr => arr.find(tg => str.startsWith(tg, j));
        let start = this.parts.length - 1;
        while(true) {
            let t = null;
            if(j == str.length) {
                if(start >= 0) {
                    this.parts[start].err = true;
                    this.top_level.push(start);
                }
                return j;
            }
            if(str.startsWith('<pre>', j)) {
                j += 5;
                let start = j;
                while(!str.startsWith('</pre>', j) && j < str.length) j++;
                this.parts.push({str: str.slice(start, j + 6), type: 'pre', err: false});
                return j + 6;
            }
            if(t = test(Object.keys(tags))) {
                this.parts.push({str: t, err: false, type: 'open'});
                j = this.init_text(str, j + t.length, t);
            }
            else if(t = test(Object.values(tags))) {
                this.parts.push({str: t, err: false, type: 'close'});
                j += t.length;
                if(tag === '') {
                    this.top_level.push(this.parts.length - 1);
                }
                else if(t === tags[tag]) return j;
                else this.parts.at(-1).err = true;
            }
            else if(t = test(Object.keys(math_delim))) {
                let math_start = j;
                j += t.length;
                while(!str.startsWith(math_delim[t], j) && j < str.length) j++;
                if(j == str.length) {
                    this.parts.push({str: str.slice(math_start, j), type: 'math', err: true});
                    return j;
                }
                j += math_delim[t].length;
                this.parts.push({str: str.slice(math_start, j), type: 'math', err: false});
            }
            else if(t = test(Language.keywords)) {
                this.parts.push({str: t, err: false, type: 'keyword'});
            }
            else {
                if(this.parts.at(-1)?.type === 'text') this.parts.at(-1).str += str[j];
                else this.parts.push({str: str[j], err: false, type: 'text'});
                j++;
            }
        }
    }
    init_range(start, end, s_off, e_off) {
        let up = false;
        while(start !== end || !up) {
            if(up) {
                if(start.nextSibling) {
                    start = start.nextSibling;
                    up = false;
                    continue;
                }
                let tag = node.parentNode.nodeName.toLowerCase();
                let err = true;
                if(this.top_level.length === 0 || this.parts[this.top_level.at(-1)].type === 'close') {
                    this.top_level.push(this.parts);
                }
                else if(this.parts[this.top_level.at(-1)].str.slice(1,-1) === tag) {
                    err = false;
                    this.top_level.pop();
                }
                this.parts.push({str:`</${tag}>`, type:'close', err: err});
                start = start.parentNode;
            }
            else if(node.nodeName === '#text') {
                let str = null;
                if(node === end) str = node.data.slice(s_off, e_off);
                else if(node === start) str = node.data.slice(s_off), s_off = 0;
                else str = node.data;
                this.parts.push({str: str, type:'text', err: false});
                up = true;
            }
            else if(node.math_info) {
                let delim = node.math_info.display ? '$$' : '$';
                this.parts.push({str: delim + node.math_info.str + delim, type: 'math', err: false});
                up = true;
            }
            else if(node.nodeName === 'PRE') {
                this.parts.push({str: node.firstChild.data, type: 'pre', err: 'false'});
                up = true;
            }
            else{
                this.missing_close.push(this.parts.length);
                let tag = node.nodeName.toLowerCase();
                this.parts.push({str:`<${tag}>`, type: 'open', err:false});
                node = node.firstChild;
            }
        }
    }
    /**@param {'segment' | 'text' | 'html'} type  */
    output(type, br) {
        if(type === 'text') return this.parts.map(token => {
            return token.type === 'pre' ? token.str : `<pre>${token.str}</pre>`
        }).join('');
        if(type === 'segment') for(const idx of this.top_level) this.parts[idx].err = false;
        let ret = this.parts.map(token => {
            switch(token.type) {
            case 'open':
            case 'close':
                if(token.err) return `<span class="err">&lt;${token.str.slice(1,-1)}&gt; </span>`;
                else return token.str;
            case 'math':
                let math_str = map_to_html(token.str);
                if(token.err) return `<span class="err">${math_str}</span>`;
                let delim = Object.keys(math_delim).find(d => token.str.startsWith(d));
                return `<script type="math/tex${delim =='$$'||delim=='\\[' ? '; mode=display':''}">
                        ${math_str.slice(delim.length, -delim.length)}</script>`;
            case 'pre':
                return `<pre>${map_to_html(token.str)}</pre>`
            case 'keyword':
            case 'text':
                return map_to_html(token.str, br);
            default:
                return '';
            }
        }).join('');
        if(type === 'segment') for(const idx of this.top_level) this.parts[idx].err = true;
        return ret;
    }
    /** @returns {string}  */
    format(o, type) {
        let ret;
        switch(o) {
        case 'b':
        case 'i':
            for(const idx of this.top_level) {
                this.parts[idx].str = `</${o}>${this.parts[idx].str}<${o}>`;
            }
            ret = `</${o}>${this.output(type)}<${o}>`
            for(const idx of this.top_level) {
                this.parts[idx].str = this.parts[idx].str.slice(3+o.length, 2+ o.length);
            }
            return ret;
        case 'ul':
        case 'ol':
            return `<${o}>\n  <li>${this.output(type, '</li>\n  <li>')}</li>\n</${o}>\n`;
        case 'rm':
            for(const token of this.parts) {
                if(token.type === 'open') token.type = 'hiden open';
                if(token.type === 'close') token.type = 'hiden close';
            }
            ret = this.output(type);
            for(const token of this.parts) {
                if(token.type.startsWith('hiden ')) token.type = token.type.slice(6);
            }
            return ret;
        case 'a':
            let search_for = relations.find(arr => arr.some(str => selected.includes(str)));
            if(!search_for) break;
            // = can also be used in those type of comparison
            if(search_for[0] !== '\\implies') search_for.push('=');

            ret = '\n\\begin{align*}\n  &';
            for(let i = 0; i < selected.length; i++) {
                if(search_for.some(str => selected.startsWith(str, i))) {
                    replace += '\\\\\n  &';
                }
                replace += selected[i];
            }
            return ret + '\\\\\n\\end{align*}\n';
        default:
            throw new Error('operation not supported');
        }
    }
    has_err() {
        for(const token of this.parts) if(token.err) return true;
        return false;
    }
}
//general purpose functions
function map_to_html(str, br = '\n') {
    const html_special = {'<': '&lt;', '>':'&gt;', '&':'&amp;', '\'':'&apos;', '\"': '&quot;'};
    let ret = '';
    for(const c of str) {
        if(c === '\n') ret += br;
        else if(html_special[c]) ret += html_special[c];
        else ret += c;
    }
    return ret;
}
const tags = {'<b>': '</b>', '<i>': '</i>', '<ul>': '</ul>', '<ol>':'</ol>', '<li>':'</li>'};
const math_delim = {'$$': '$$', '\\[': '\\]', '$':'$', '\\(': '\\)'};


const relations = [
    ['\\implies', '\\iff'],     // logical chaining 
    ['\\le', '<', '\\lessim'],  // less 
    ['\\ge', '>', '\\gtrssim'], // greater 
    ['\\equiv', '\\sim', '=']   // equal relation
];