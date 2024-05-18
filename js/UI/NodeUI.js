"use strict";


/**
 * Represent the element of the proof, as a directed graph
 */
class NodeUI {

    // @type{string}
    id;
    // @type{String}
    raw_text;
    /**@type {'claim' | 'define' | 'given'| 'result' | 'lemma'} */
    type
    /**@type {{from: Map<NodeUI, LeaderLine>, to: Map<NodeUI, LeaderLine> }}*/
    display;
    /**@type {{from: Map<NodeUI, EdgeUI>?, to: Map<NodeUI, EdgeUI> }}*/ 
    math;
    /** @type{Set<NodeUI>} the detail of the proof presented in this node if needed */
    children;
    /**@type {NodeUI} */
    parent;
    /**@type {Set<EdgeUI>} */
    external_ref;
    /** @type{HTMLDivElement} the HTML element respected to this node*/
    html_div;
    /** @type {NodeUI| EdgeUI} the respective pseudo node or truncated edge*/
    ref;

    /**@param {NodeUI} parent @param {NodeUI?} pseudo */
    constructor(parent, pseudo) {
        this.id = '';
        this.parent = parent;
        this.highlighted = false;
        this.children = new Set();
        this.external_ref = new Set();
        this.display    = {from: new Map(), to: new Map() };
        this.math       = {from: pseudo ? null: new Map(), to: new Map()};
        // pseudo node's data is the clone data of the original
        this.ref        = pseudo ? pseudo :null;
        this.raw_text   = pseudo ? pseudo.raw_text: "";
        this.type       = pseudo ? pseudo.type    : 'claim';
        this.html_div   = pseudo ? pseudo.html_div: document.createElement('div');
        this.html_div.assoc_node = this;
        if(pseudo) { pseudo.ref = this; return; }

        this.html_div.className = "node claim";
        this.html_div.innerHTML = `
            <h3 class="header"></h3>
            <div class="tex_render"></div>
            <div class="children"><h2>proof:</h2><div class="dot"></div>
        `;
        let div = this.html_div;
        this.html_div.onmousedown = (e) => {e.stopPropagation(); div.assoc_node.start_reshape(e)};
        this.html_div.ondblclick = (e) => {e.stopPropagation(); div.assoc_node.toggle_detail()};
        this.html_div.oncontextmenu = (e) => {e.stopPropagation(); div.assoc_node.open_context_menu(e)};
        this.child_div.onmousedown = (e) => {e.stopPropagation(); div.assoc_node.start_scroll(e); }
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
        menu[RENAME].style.display = this.is_maximize || this.is_pseudo ? 'none' : '';
        Menu.node.popup(e, this);
    }
    /**@param {MouseEvent} e0*/
    start_reshape(e0) {
        let cursor = this.get_cursor(e0);
        if(cursor !== 'move' && cursor !== 'resize') return;
        this.toggle_highlight(true);

        let rect0 = this.html_div.getBoundingClientRect(), div = this.html_div;
        let [rel_x, rel_y] = [div.offsetLeft - e0.clientX, div.offsetTop - e0.clientY];
        let [w0, h0] = [div.offsetLeft + div.offsetWidth, div.offsetTop + div.offsetWidth];
        let reshape = (e) => {
            e.preventDefault();
            if(cursor != 'resize') {
                let [maybe_x, maybe_y] = [e.clientX + rel_x, e.clientY + rel_y];
                this.html_div.style.left = maybe_x < 0 ? "0" :  maybe_x + "px";
                this.html_div.style.top = maybe_y < 0 ? "0" : maybe_y + "px";
                this.parent.adjust_dot(w0 + e.x - e0.x, h0 + e.y - e0.y);
            }
            this.reposition();
        };
        document.addEventListener('mousemove',reshape);
        document.addEventListener('mouseup', (e) => {
            this.toggle_highlight(false);
            document.removeEventListener('mousemove', reshape);
            if(e.x == e0.x || e.y == e0.y) return;
            GraphHistory.register('move', {node: this, from:rect0, to:this.html_div.getBoundingClientRect()});
        }, {once: true});
    }
    /**@param {MouseEvent} e  */
    get_cursor(e) {
        let resize = (this.is_maximize ? this.child_div : this.renderer), style = getComputedStyle(resize);
        
        if(GraphUI.inside_rect(this.name_rect, e.x, e.y)) return 'text';
        if(style.resize !== "none" && GraphUI.inside_rect(resize, e.x, e.y, -14, -14)) return 'resize';
        if(GraphUI.inside_rect(this.renderer, e.x, e.y)) return 'move';
        return !this.is_maximize ? 'move' : 'grab';
    }
    /**@param {boolean} opt */
    toggle_detail(opt, silent) {
        if(typeof opt === 'undefined') opt = !this.is_maximize;
        if(opt && (this.is_pseudo|| !['lemma', 'claim'].includes(this.type))) {
            return `this node can not be expanded since it ${ 
                   this.is_pseudo ? 'is a pseudo node': 'does not have type claim nor lemma'}`;
        }
        if(opt === this.is_maximize) return;
        ['onmousedown', 'oncontextmenu', 'ondblclick'].forEach(f => {
            [this.html_div[f], this.renderer[f]] = [this.renderer[f], this.html_div[f]];
        });
        this.renderer.style.width = "";
        this.renderer.style.height = ""
        if(silent) this.html_div.classList.toggle('zoom', opt);
        else {
            if(opt) this.html_div.classList.add('zoom');
            this.html_div.addEventListener('animationend', () => {
                this.html_div.style.animation = "";
                if(!opt) this.html_div.classList.remove('zoom');
                this.reposition(); 
            }, {once: true});
           this.html_div.style.animation = opt ? "zoom-out 0.2s": "zoom-in 0.2s";
            GraphHistory.register('zoom', {node: this});
        }
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
        if(this.id) window.MathGraph.all_label[op](this.id, this);
    }
    reposition() {
        for(const [_, line] of this.math.to) line.reposition();
        for(const line of this.external_ref) line.reposition();
    }
    /**@param {MouseEvent} e0  */
    start_scroll(e0) {
        if(this.get_cursor(e0) === 'resize') return this.start_reshape(e0);
        let [sx0, sy0] = [this.child_div.scrollLeft, this.child_div.scrollTop];
        let [w0, h0] = [sx0 + this.child_div.offsetLeft, sy0 + this.child_div.offsetHeight];
        let move = (e) => {
            e.preventDefault();
            this.child_div.style.cursor = "grabbing";
            [this.child_div.scrollLeft, this.child_div.scrollTop] = [sx0 - e.x + e0.x, sy0 - e.y + e0.y];
            for(const edge of this.external_ref) edge.reposition();
            this.adjust_dot(w0 + e0.x - e.x, h0 + e0.y - e.y);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', (e) => {
            document.removeEventListener('mousemove', move);
            this.child_div.style.cursor = "";
            if(e.x == e0.x && e.y ==  e0.y) return;
            GraphHistory.register('grab', {node: this, 
                    dx: this.child_div.scrollLeft- sx0, dy: this.child_div.scrollTop - sy0});
        }, {once: true})
    }
    /** @param {number} x  @param {number} y   */
    adjust_dot(x, y) {
        let div = this.child_div, dot = div.querySelector('.dot');
        let dot_x = Math.max(x + 200, div.offsetWidth + div.scrollLeft + 200, dot.offsetLeft);
        let dot_y = Math.max(y + 200, div.offsetHeight + div.scrollTop + 200, dot.offsetTop);
        dot.style.left = dot_x + "px";
        dot.style.top = dot_y + "px";
    }
    remove() {
        if(this.is_pseudo) return GraphUI.signal('can not delete the pseudo node');
        if(window.MathGraph.readonly) return GraphUI.signal('can not delete node in readonly mode');
        let old = GraphHistory.active;
        let to = this.math.to, external = this.external_ref;
        GraphHistory.register('remove', {node: this, reserve_to: to, reserve_external: external});
        GraphHistory.active = true;
        this.modify_name_recursive('delete')
        this.math.to = new Map();
        this.external_ref = new Set();
        for(let [_, line] of to) line.remove();
        for(const edge of external) edge.remove();
        this.parent.child_div.removeChild(this.html_div);
        this.parent.children.delete(this);
        GraphHistory.active = old;
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
        if(!window.MathGraph.is_parsing && this.id) window.MathGraph.all_label.delete(this.id); 
        if(!window.MathGraph.is_parsing && truncate) window.MathGraph.all_label.set(truncate, this);
        this.header.textContent = name;
        this.html_div.classList.remove(this.type);
        this.html_div.classList.add(new_type);
        this.id = truncate;
        this.type = new_type;
        this.renderer.style.minWidth = Math.max(this.name_rect.width, 45) + "px";
    }
    /**@param {NodeUI} link */
    reference(link) {
        if(link.is_pseudo) link = link.ref
        if(this.math.from.has(link)) return this.math.from.get(link);
        let edge  = EdgeUI.create(link, this);
        if(typeof edge === 'string') return edge;
        edge.show('draw');
        return edge;
    }
    /**@returns {string | {to:NodeUI, from: NodeUI}} */
    check_truncate() {
        if(this.is_pseudo) return 'can not truncate pseudo nodes';
        let [_, to_edge] = this.display.to[Symbol.iterator]().next().value;
        if(this.display.to.size !== 1 || to_edge.count > 2) {
            return 'can only truncate nodes that have exactly 1 outcomming edges (including indirect ones)';
        }
        let to = to_edge.end.assoc_node;
        let unique = null;
        for(const edge of this.external_ref) if(!edge.is_hidden) {
            if(unique == null) unique = edge.alias;
            else if(unique !== edge.alias) { unique = null; break;}
        }
        if(!unique) return 'can only truncate node that reference from exactly one other node';
        let overlap_index = unique.display.to.get(to)?.count;
        if(overlap_index !== undefined && overlap_index % 2 == 1) {
            return 'fail to truncate this node because the resulting edge will be overllaped permanently';
        }
        return {to: to, from: unique};
    }
    truncate() {
        let target = this.check_truncate();
        if(typeof target === 'string') return target;
        GraphHistory.register('truncate', {node: this});
        let old = GraphHistory.active;
        GraphHistory.active = true;
        this.display.to.get(target.to).hide('none');
        for(const edge of this.external_ref) {
            edge.hide('none');
        }
        this.html_div.style.display = 'none';
        let edge = new EdgeUI(target.from, target.to);
        edge.truncate = this;
        this.ref = edge;
        edge.repr.setOptions({dash: true});
        edge.reposition();
        edge.show('draw');
        GraphHistory.active = old;
        return null;
    }
    /**@param {NodeUI} node   */
    is_ancestor(node) {
        while(node && node !== this) node = node.parent;
        return node === this;
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
    /** @returns {HTMLDivElement} */
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
        return this.math.from === null;
    }
    get is_truncated() {
        return this.ref instanceof EdgeUI;
    }
    /**@param {Element} elem @returns {NodeUI} */
    static is_node_component(elem) {
        while(elem && !elem.assoc_node) elem = elem.parentNode;
        return elem?.assoc_node;
    }
    /**@param {NodeUI} n1  @param {NodeUI} n2  @returns {NodeUI} */
    static lca(n1, n2) {
        if(n1 === n2) return n1;
        // O(N) function, but the deep of the graph is small though
        let par_1 = [], par_2 = [], i = 1;
        for(let it = n1; it; it = it.parent) par_1.push(it);
        for(let it = n2; it; it = it.parent) par_2.push(it);
        while(par_1.at(-i) === par_2.at(-i)) i++;
        return(par_1.at(-i + 1));
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
    menu[REF].onclick = (e) => GraphUI.new_edge(Menu.node.associate, e);
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
    menu[TRUNCATE].onclick = (e) => GraphUI.signal(Menu.node.associate.truncate());
});

const EDIT = 0, HIGHTLIGHT = 1, MIN = 2, MAX = 3, DETAIL = 4, REF = 5, RENAME = 6, REMOVE = 7, TRUNCATE = 8;
const hints = {
    'given': ['assume', 'given', 'in case', 'otherwise', 'assumption'],
    'result': ['QED', 'result', 'contradiction', 'conclusion'],
    'claim': ['claim', 'substitution', 'equation', 'inequality'],
    'lemma': ['lemma', 'theorem', 'proposition', 'corollary'],
    'define': ['define', 'definition', 'axiom'],
    'refer': ['refer', 'reference', 'preliminary', 'premise', 'requires']
};