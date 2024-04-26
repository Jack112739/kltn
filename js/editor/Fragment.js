"use strict";
import { format, inv_format } from "./EditorUI.js";

// a fragment of the editor can be use to manipulate the data inside
/**
 */
export default class Fragment {
    //An array of token can be use to concatinate to a valid string later
    /**@type {{type: 'text'|'math'|'open'|'close'|'fmt' , str: string, err: number}} */
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
            this.init_text(range, 0, -1);
            this.offset = {start: 0, end: this.parts.length};
        }
    }
    /**@param {Node} start, @param {Node} end @param {Range
     * } range   */
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
    /**@param {str} string, @param {number} j @param {number} open_idx */
    init_text(str, j, open_idx) {
        while(true) {
            let t = null;
            if(j >= str.length) {
                if(open_idx >= 0) {
                    this.parts[open_idx].err = 1;
                }
                return j;
            }
            if(t = Object.keys(format).find(tg => str.startsWith(tg, j))) {
                this.parts.push({str: format[t], err: t === '\\\\' || t === '\\item' ? 0 : 1, type: 'fmt'});
                j += t.length;
            }
            else if(str[j] === '{') {
                this.parts.push({str: '{', err: 1, type: 'open'});
                let prev = this.parts.at(-1), prev2 = this.parts.at(-2);
                if(prev2?.type === 'fmt' && prev2.str !== 'li') {
                    prev.err = 0; prev2.err = 0;
                }
                if(prev.err) j++;
                else j = this.init_text(str, j + 1, this.parts.length - 1);
            }
            else if(str[j] === '}') {
                this.parts.push({str: '}', err: (this.parts[open_idx] ?? {err: 1}).err, type: 'close'});
                return j + 1;
            }
            else if(t = Object.keys(math_delimeter).find(tg => str.startsWith(tg, j))) {
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
        this.parts.push({str: node.nodeName.toLowerCase(), type: 'fmt', err: 0});
        if(node.nodeName !== 'LI') this.parts.push({str: '{', type: 'open', err: 0});
        let it = node.firstChild;
        for(let i = 0; i < node.childNodes.length; i++) {
            this.init_range(it, i, range);
            it = it.nextSibling;
        }
        set(node, node.childNodes.length);
        if(node.nodeName !== 'LI') this.parts.push({str: '}', type: 'close', err: 0});
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
            else if(token.type === 'fmt') {
                if(token.str === 'li' && cur.nodeName === 'LI') cur = cur.parentNode;
                cur.appendChild(document.createElement(token.str));;
                if(token.str === 'li') cur = cur.lastChild;
            }
            else if(token.type === 'open') {
                cur = cur.lastChild;
            }
            else if(token.type === 'close') {
                if(cur.nodeName === 'LI') cur = cur.parentNode;
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
            if(this.parts[i].type === 'fmt') sum += inv_format[this.parts[i].str].length;
            else sum += this.parts[i].str.length;
        }
        return ret;
    }
}
/**@param {{type: 'text'|'math'|'open'|'close'|'fmt' , str: string, err: number}} token */
function toString(token) {
    return  token.type === 'fmt' ? inv_format[token.str]: 
            token.str.replace('\u200b', '');
}
export function map_to_html(str) {
    const html_special = {'<':'&lt;', '>':'&gt;', '&':'&amp;', '\'':'&apos;', '\"':'&quot;', '\u200b': ''};
    let ret = '';
    for(const c of str) {
        ret += html_special[c] ?? c;
    }
    return ret;
}
const math_delimeter = {'$$':'$$', '$':'$', '\\ref{': '}'};