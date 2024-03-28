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
                let start = j, math_type = t == '$$' || t == '\\[' ? 'math/tex; mode=display': 'math/tex';
                j += t.length;
                while(!str.startsWith(math_delimeter[t], j) && j < str.length) j++;
                j += math_delimeter[t].length;
                this.parts.push({str: str.slice(start, j), type: math_type, err: t.length});
                if(t > str.length) this.parts.at(-1).err = 0;
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
        if(node.nodeName === '#text' || node.math_info || node.nodeName === 'PRE') {
            if(node.math_info) {
                set(parent, counter);
                let delim = node.math_info.type === 'math/tex' ? '$' : '$$';
                this.parts.push({str: delim + node.math_info.str + delim, 
                    type: node.math_info.type, err: delim.length});
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
        set(node.parent, counter);
        this.parts.push({str: node.nodeName.toLowerCase(), type: 'open', err: 0});
        let it = node.firstChild;
        for(let i = 0; i < node.childNodes.length; i++) {
            this.init_range(it, i, range);
            it = it.nextSibling;
        }
        set(node, node.childNodes.length);
        this.parts.push({str: node.nodeName.toLowerCase(), type: 'close', err: 0});
    }
    /**@param {'text' | 'html'} type  @returns {string}*/
    output(type) {
        let tokens = this.parts.map(token => {
            let str = token.str;
            switch(token.type) {
            case 'open':
            case 'close':
                str = token.type === 'open' ? `<${str}>` : `</${str}>`;
                if(type === 'text' || !token.err) return str;
                else return `<pre class="err">${map_to_html(str)}</pre>`;
            case 'math/tex':
            case 'math/tex; mode=display':
                if(type === 'text') return str;
                else if(token.err === 0) return `<pre class="err">${map_to_html(str)}</pre>`;
                else return `<script type="${token.type}">${str.slice(token.err, -token.err)}</script>`
            default:    //text case
                if (type === 'text') return str;
                else if(token.err) return `<pre>${map_to_html(str)}</pre>`
                else return map_to_html(str);
            }
        });
        let ret = {str:'', start: 0, end: 0}, curent = 0;
        for(let i = 0; i < tokens.length; i++) {
            ret.str += tokens[i];
            if(i === this.offset.start) ret.start = curent + (this.offset.partial_start ?? 0);
            if(i === this.offset.end) ret.end = curent + (this.offset.partial_end ?? 0);
            curent += tokens[i].length;
        }
        return ret;
    }
}
function map_to_html(str) {
    const html_special = {'<': '&lt;', '>':'&gt;', '&':'&amp;', '\'':'&apos;', '\"': '&quot;'};
    let ret = '';
    for(const c of str) {
        ret += html_special[c] ?? c;
    }
    return ret;
}