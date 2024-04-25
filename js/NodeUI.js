
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
    // @type{Map<NodeUI, LeaderLine>}
    from;
    // @type{Map<NodeUI, LeaderLine>}
    to;
    /** @type{Set<NodeUI>} the detail of the proof presented in this node if needed */
    children;
    /**@type NodeUI */
    parent;
    // @type { Set<LeaderLine> }
    external_ref;
    // @type{HTMLDivElement} the HTML element respected to this node
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
        this.external_ref = new Set();
        this.html_div = document.createElement('div');
        this.html_div.className = "node claim";
        this.html_div.innerHTML = `
            <h3 class="header"></h3>
            <div class="tex_render"></div>
            <div class="children"></div>
        `;
        this.html_div.onmousedown = (e) => {e.stopPropagation(); this.start_reshape(e)};
        this.html_div.ondblclick = (e) => {e.stopPropagation(); this.toggle_detail()};
        this.html_div.oncontextmenu = (e) => {e.stopPropagation(); this.open_context_menu(e)};
        this.html_div.assoc_node = this;
        GraphHistory.register('create', {node: this});
    }
    open_context_menu(e) {
        e.preventDefault();
        let menu = Menu.node.items.childNodes;
        let can_max = !this.is_maximize && !this.is_ref && ['lemma', 'claim'].includes(this.type);
        menu[MIN].style.display = this.is_maximize ? "" : "none";
        menu[MAX].style.display = can_max ? "" : "none";
        menu[REF].style.display = this.type === 'result' ? "none" : ""; 
        Menu.node.popup(e, this);
    }
    start_reshape(e) {
        let cursor = this.get_cursor(e);
        if(cursor === 'text') return;
        this.toggle_highlight();

        let rect = this.html_div.getBoundingClientRect(), new_rect = null;
        let rel_x =  rect.x -  e.clientX;
        let rel_y =  rect.y - e.clientY;
        let reshape = (e) => {
            new_rect = this.html_div.getBoundingClientRect();
            for(const [_, line] of this.from) line.position();
            for(const [_, line] of this.to) line.position();
            if(cursor != 'resize') {
                this.html_div.style.left = (this.html_div.offsetLeft - new_rect.x + e.clientX + rel_x) + "px";
                this.html_div.style.top = (this.html_div.offsetTop - new_rect.y + e.clientY + rel_y) + "px";
            }
        };
        document.addEventListener('mousemove',reshape);
        document.addEventListener('mouseup', (e) => {
            this.toggle_highlight();
            document.removeEventListener('mousemove', reshape);
            if(new_rect) GraphHistory.register('move', {from:rect, to:new_rect});
        }, {once: true});
    }
    get_cursor(e) {
        let name = this.name_rect;
        let render = this.renderer.getBoundingClientRect();
        let in_range = (x, y, z) => x <= y && y <= z;
        if(in_range(name.left, e.clientX, name.right) && in_range(name.top, e.clientY, name.bottom)) {
            return 'text';
        }
        if(in_range(-8, e.clientX - render.right, 0) && in_range(- 8, e.clientY - render.bottom, 0)) {
            return 'resize';
        }
        return 'grab';
    }
    toggle_detail(opt) {
        if(typeof opt === 'undefined') opt = !this.is_maximize;
        if(opt && (this.is_ref || !['lemma', 'claim'].includes(this.type))) {
            return `${this.is_ref ? 'referenced' : this.type} node can not be expanded`;
        }
        if(opt === this.is_maximize) return;
        ['onmousedown', 'oncontextmenu', 'ondblclick'].forEach(f => {
            [this.html_div[f], this.renderer[f]] = [this.renderer[f], this.html_div[f]];
        });
        this.renderer.style.width = "";
        this.renderer.style.height = ""
        if(opt) this.html_div.classList.add('zoom');
        this.html_div.style.animation = opt ? "zoom-out 0.5s": "zoom-in 0.2s";
        if(!opt) setTimeout(() => this.html_div.classList.remove('zoom'), 202);
    }
    toggle_highlight(opt, manual) {
        if(this.html_div.classList.contains('manual')) return;
        this.html_div.classList.toggle('highlighted', opt);
        if(manual) this.html_div.classList.toggle('manual', opt);
    }
    modify_name_recursive(op) {
        for(const child of this.children) {
            child.modify_name_recursive(op);
        }
        if(!this.is_ref) window.MathGraph.all_label[op](this.id, this);
    }
    remove() {
        this.modify_name_recursive('delete')
        for(let[id, line] of this.from) {
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
        if(truncate.startsWith('\\')) return `a label can not start with a '\\'`;
        if(truncate && window.MathGraph.all_label.get(truncate) && truncate !== this.id) {
            return `label ${truncate} has already exist`;
        }
        GraphHistory.register('rename', {name: name, old_name: this.header.textContent});
        if(this.id) window.MathGraph.all_label.delete(this.id); 
        if(truncate) window.MathGraph.all_label.set(truncate, this);
        this.header.textContent = name;
        this.html_div.classList.remove(this.type);
        this.html_div.classList.add(new_type);
        this.id = truncate;
        this.type = new_type;
        this.renderer.style.minWidth = (this.name_rect.width + 10) + "px";
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
}
/**@param {Element} elem @returns {NodeUI} */
function is_node_component(elem) {
    while(elem && !elem.assoc_node) elem = elem.parentNode;
    return elem?.assoc_node;
}
document.addEventListener('DOMContentLoaded', (e) => {
    Menu.node = new Menu(document.getElementById('rightclick'));
    let menu = Menu.node.items.childNodes;
    menu[EDIT].onclick = (e) => editor.load(Menu.node.associate);
    menu[HIGHTLIGHT].onclick = (e) => Menu.node.associate.toggle_highlight(undefined, true);
    menu[MAX].onclick = (e) => UI.signal(Menu.node.associate.toggle_detail(true));
    menu[MIN].onclick = (e) => Menu.node.associate.toggle_detail(false);
    menu[DETAIL].onclick = (e) => UI.focus(Menu.node.associate)
    menu[REF].onclick = (e) => UI.new_edge(Menu.node.associate, e);
    menu[RENAME].onclick = (e) => {
        let header = Menu.node.associate.header, old_name = header.textContent;
        header.innerHTML = `<input class="rename" value="${old_name}">`;
        let input = header.firstElementChild;
        input.focus();
        input.addEventListener('focusout', () => document.body.removeChild(input));
        input.addEventListener('keydown', (e) => {
            if(e.key !== 'Enter') return;
            header.replaceChild(document.createTextNode(old_name), input);
            header.rename(input.value);
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
    'define': ['define', 'definition', 'variable'],
    'refer': ['refer', 'reference', 'preliminary', 'premise', '#']
};