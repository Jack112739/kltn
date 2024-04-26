"use strict";

import Menu from './../editor/Menu.js';
import editor from '../editor/EditorUI.js';
import GraphUI from './GraphUI.js';
import EdgeUI from './EdgeUI.js';
import GraphHistory from './HistoryUI.js';
/**
 * Represent the element of the proof, as a directed graph
 */
export default class NodeUI {

    // @type{string}
    id;
    // @type{String}
    raw_text;
    /**@type {'claim' | 'define' | 'given'| 'result' | 'lemma'} */
    type
    /**  @type{Map<NodeUI, EdgeUI> | EdgeUI}*/
    from;
    /** @type{Map.<NodeUI, EdgeUI>}*/ 
    to;
    /** @type{Set<NodeUI>} the detail of the proof presented in this node if needed */
    children;
    /**@type {NodeUI} */
    parent;
    /** @type{HTMLDivElement} the HTML element respected to this node*/
    html_div;


    /**@param {NodeUI} parent  */
    constructor(parent) {
        this.id = '';
        this.raw_text = "";
        this.type = 'claim';
        this.from = new Map();
        this.to = new Map();
        this.highlighted = false;
        this.children = new Set();
        this.parent = parent;
        this.html_div = document.createElement('div');
        this.html_div.className = "node claim";
        this.html_div.innerHTML = `
            <h3 class="header"></h3>
            <div class="tex_render"></div>
            <div class="children"><h2>proof:</h2></div>
        `;
        this.html_div.onmousedown = (e) => {e.stopPropagation(); this.start_reshape(e)};
        this.html_div.ondblclick = (e) => {e.stopPropagation(); this.toggle_detail()};
        this.html_div.oncontextmenu = (e) => {e.stopPropagation(); this.open_context_menu(e)};
        this.html_div.assoc_node = this;
        GraphHistory.register('create', {node: this});
    }
    /**@param {MouseEvent} e  */
    open_context_menu(e) {
        e.preventDefault();
        let menu = Menu.node.items.childNodes;
        let can_max = !this.is_maximize && !this.is_ref && ['lemma', 'claim'].includes(this.type);
        menu[MIN].style.display = this.is_maximize ? "" : "none";
        menu[MAX].style.display = can_max ? "" : "none";
        menu[REF].style.display = this.type === 'result' ? "none" : ""; 
        Menu.node.popup(e, this);
    }
    /**@param {MouseEvent} */
    start_reshape(e) {
        let cursor = this.get_cursor(e);
        if(cursor !== 'move' && cursor !== 'resize') return;
        this.toggle_highlight();

        let rect = this.html_div.getBoundingClientRect(), new_rect = null;
        let rel_x =  rect.x -  e.clientX;
        let rel_y =  rect.y - e.clientY;
        let reshape = (e) => {
            new_rect = this.html_div.getBoundingClientRect();
            if(cursor != 'resize') {
                this.html_div.style.left = (this.html_div.offsetLeft - new_rect.x + e.clientX + rel_x) + "px";
                this.html_div.style.top = (this.html_div.offsetTop - new_rect.y + e.clientY + rel_y) + "px";
                this.reposition();
            }
        };
        document.addEventListener('mousemove',reshape);
        document.addEventListener('mouseup', (e) => {
            this.toggle_highlight();
            document.removeEventListener('mousemove', reshape);
            if(new_rect) GraphHistory.register('move', {node: this, from:rect, to:new_rect});
        }, {once: true});
    }
    /**@param {MouseEvent} e  */
    get_cursor(e) {
        let inside = (rect) => rect.x <= e.x && e.x <= rect.right && rect.y <= e.y && e.y <= rect.bottom;
        let render = this.renderer.getBoundingClientRect();
        let resizer = (this.is_maximize ? this.child_div : this.renderer);
        let rect = resizer.getBoundingClientRect(), able = getComputedStyle(resizer).resize !== "none";
        
        if(inside(this.name_rect)) return 'text';
        if(able && inside(new DOMRect(rect.right - 14, rect.bottom - 14, 14, 14))) return 'resize';
        if(inside(render)) return 'move';
        return !this.is_maximize ? 'move' : 'grab';
    }
    /**@param {boolean} opt */
    toggle_detail(opt) {
        if(typeof opt === 'undefined') opt = !this.is_maximize;
        if(opt && (this.is_pseudo|| !['lemma', 'claim'].includes(this.type))) {
            return `this node can not be expanded since it does not ${
                   this.is_pseudo ? 'defined primary inside this node': 'have type claim nor lemma'}`;
        }
        if(opt === this.is_maximize) return;
        ['oncontextmenu', 'ondblclick'].forEach(f => {
            [this.html_div[f], this.renderer[f]] = [this.renderer[f], this.html_div[f]];
        });
        this.renderer.style.width = "";
        this.renderer.style.height = ""
        if(opt) this.html_div.classList.add('zoom');
        this.html_div.style.animation = opt ? "zoom-out 0.5s": "zoom-in 0.2s";
        if(!opt) setTimeout(() => this.html_div.classList.remove('zoom'), 202);
        GraphHistory.register('zoom', {node: this});
    }
    /**@param {boolean} opt @param {boolean} manual  */
    toggle_highlight(opt, manual) {
        if(!manual && this.html_div.classList.contains('manual')) return;
        this.html_div.classList.toggle('highlighted', opt);
        if(manual) this.html_div.classList.toggle('manual', opt);
    }
    /**@param {'delete' | 'set'} op  */
    modify_name_recursive(op) {
        for(const child of this.children) {
            child.modify_name_recursive(op);
        }
        if(this.is_ref && !this.is_pseudo) window.MathGraph.all_label[op](this.id, this);
    }
    reposition() {
        for(const [_, line] of this.from) line.position();
        for(const [_, line] of this.to) line.position();
    }
    remove() {
        this.modify_name_recursive('delete')
        for(let [id, line] of this.from) {
            id.to.delete(this);
            line.remove();
        }
        for(let [id, line] of this.to) {
            id.from.delete(this);
            line.remove();
        }
        this.parent.child_div.removeChild(this.html_div);
        GraphHistory.register('remove', {node: this});
    }
    /** @param {String} name @returns {String | undefined} */
    rename(name) {
        let tmp, truncate = name.trim(), new_type = 'claim';
        if(tmp = hints['refer'].find(iden => name.startsWith(iden))) {
            truncate = truncate.slice(tmp.length).trim();
        }
        this.html_div.classList.toggle('refer', tmp ? true : false);
        for(const type in hints) {
            if(type !== 'refer' && (tmp = hints[type].find(iden => truncate.startsWith(iden)))) {
                new_type = type;
                truncate = truncate.slice(tmp.length).trim();
            }
        }
        truncate = truncate.trim();
        if(truncate.startsWith('#')) return `a label can not start with a '#'`;
        if(truncate && window.MathGraph.all_label.get(truncate) && truncate !== this.id) {
            return `label ${truncate} has already exist`;
        }
        GraphHistory.register('rename', {node: this, name: name, old_name: this.header.textContent});
        if(this.id) window.MathGraph.all_label.delete(this.id); 
        if(truncate) window.MathGraph.all_label.set(truncate, this);
        this.header.textContent = name;
        this.html_div.classList.remove(this.type);
        this.html_div.classList.add(new_type);
        this.id = truncate;
        this.type = new_type;
        this.renderer.style.minWidth = Math.max(this.name_rect.width, 45) + "px";
    }
    /**@param {String} link */
    reference(link) {
        throw new Error('this feature has not been implemented');
    }
    get name_rect() {
        let range = document.createRange();
        range.setStart(this.header, 0);
        range.setEnd(this.header, this.header.childNodes.length);
        return range.getBoundingClientRect();
    }
    get header() {
        return this.html_div.querySelector('.header');
    }
    get renderer() {
        return this.html_div.querySelector('.tex_render');
    }
    /**@return {NodeUI} */
    get root() {
        if(!this.parent) return this;
        return this.parent.root;
    }
    get child_div() {
        return this.html_div.querySelector('.children');
    }
    get is_maximize() {
        return this.html_div.classList.contains('zoom');
    }
    get is_ref() {
        return this.html_div.classList.contains('refer');
    }
    get is_hightlight() {
        return this.html_div.classList.contains('highlight');
    }
    get is_pseudo() {
        return this.html_div.classList.contains('pseudo');
    }
    /**@param {Element} elem @returns {NodeUI} */
    static is_node_component(elem) {
        while(elem && !elem.assoc_node) elem = elem.parentNode;
        return elem?.assoc_node;
    }
}
document.addEventListener('DOMContentLoaded', (e) => {
    Menu.node = new Menu(document.getElementById('rightclick'));
    let menu = Menu.node.items.childNodes;
    menu[EDIT].onclick = (e) => editor.load(Menu.node.associate);
    menu[HIGHTLIGHT].onclick = (e) => Menu.node.associate.toggle_highlight(undefined, true);
    menu[MAX].onclick = (e) => GraphUI.signal(Menu.node.associate.toggle_detail(true));
    menu[MIN].onclick = (e) => Menu.node.associate.toggle_detail(false);
    menu[DETAIL].onclick = (e) => GraphUI.focus(Menu.node.associate)
    menu[REF].onclick = (e) => GraphUI.new_edge(e);
    menu[RENAME].onclick = (e) => {
        let header = Menu.node.associate.header, old_name = header.textContent;
        header.innerHTML = `<input class="rename" value="${old_name}">`;
        let input = header.firstElementChild;
        input.focus();
        input.addEventListener('focusout', e=> header.textContent = old_name );
        input.addEventListener('keydown', (e) => {
            if(e.key !== 'Enter') return;
            GraphUI.signal(Menu.node.associate.rename(input.value));
        });
        Menu.node.hide();
    };
    menu[REMOVE].onclick = (e) => {
        if(window.confirm(`Do you want to delete this node?`)) Menu.node.associate.remove();
    }
});

const EDIT = 0, HIGHTLIGHT = 1, MIN = 2, MAX = 3, DETAIL = 4, REF = 5, RENAME = 6, REMOVE = 7;
const hints = {
    'given': ['assume', 'given', 'in case', 'otherwise', 'assumption'],
    'result': ['QED', 'result', 'contradiction', 'conclusion'],
    'claim': ['claim', 'substitution', 'equation', 'inequality'],
    'lemma': ['lemma', 'theorem', 'proposition', 'corollary'],
    'define': ['define', 'definition', 'axiom'],
    'refer': ['refer', 'reference', 'preliminary', 'premise', 'requires']
};