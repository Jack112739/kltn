
/**
 * Represent the element of the proof, as a directed graph
 */
class NodeUI {

    // @type{string}
    id;
    // @type{String}
    raw_text;
    /**@type {'claim' | 'definition' | 'given'| 'result' | 'lemma'} */
    type
    // @type{Map<NodeUI, LeaderLine>}
    from;
    // @type{Map<NodeUI, LeaderLine>}
    to;
    // @type{bool}, true if the node is highlight
    highlighted;
    /** @type{Set<NodeUI>} the detail of the proof presented in this node if needed */
    childs;
    /**@type NodeUI */
    parent;
    // @type{HTMLDivElement} the HTML element respected to this node
    html_div;

    /**@param {NodeUI} parent  */
    constructor(parent) {
        this.id = null;
        this.raw_text = "";
        this.type = 'claim';
        this.from = new Map();
        this.to = new Map();
        this.highlighted = false;
        this.childs = new Set();
        this.parent = parent;
        this.html_div = document.createElement('div');
        this.html_div.className = "node claim";
        this.html_div.innerHTML = `
            <h3 class="header"></h3>
            <div class="tex_render"></div>
            <div class="children"></div>
        `

        this.html_div.onmousedown = (e) => this.start_dragging(e);
        this.html_div.ondblclick = (e) => {
            let err = this.maximize();
            if(err) alert('can not maximize node of type ' + this.type);
        }
        this.html_div.oncontextmenu = (e) => this.open_context_menu(e);
        this.html_div.assoc_node = this;
        GraphHistory.register('create', {node: this});
    }
    open_context_menu(e) {
        e.preventDefault();
        let menu = Menu.node.items.childNodes;
        if(this.renderer.style.display === "none") {
            menu[MIN].style.display = "none";
            menu[MAX].style.display = "";
        }
        else {
            menu[MAX].style.display = "none";
            menu[MIN].style.display = "";
        }
        Menu.rightclicked.popup(e, this);
    }
    start_dragging(e) {
        let reposition, dragging, rect = this.html_div.getBoundingClientRect();;
        document.addEventListener('mousemove', reposition = (e) => {
            for(let [_, in_edges] of this.from) in_edges.position();
            for(let [_, out_edges] of this.to) out_edges.position();
        });
        document.addEventListener('mouseup', (e) => {
            document.removeEventListener('mousemove', reposition);
        }, {once: true});

        //check for resize event and if the clicked place is dragable
        if(rect.bottom < e.clientY + 8 && rect.right < e.clientX + 8) return;
        e.preventDefault();
        let relative_x = this.html_div.offsetLeft - e.clientX;
        let relative_y = this.html_div.offsetTop - e.clientY;
        document.body.style.cursor = "grab";

        document.addEventListener('mousemove', dragging = (e) => {
            document.body.style.cursor = "grabbing";
            this.html_div.style.left = e.clientX + relative_x + "px";
            this.html_div.style.top = e.clientY + relative_y + "px";
        });
        document.addEventListener('mouseup', (e) => {
            let new_rect = this.html_div.getBoundingClientRect();
            document.removeEventListener('mousemove', dragging);
            if(document.body.style.cursor !== "grab") GraphHistory.register('move', {from:rect, to:new_rect});
            document.body.style.cursor = "";
        }, {once: true});
    }
    minimize() {

    }
    maximize() {

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
        if(name === this.id) return;
        if(name && window.MathGraph.all_label.get(name)) return `label ${name} has already exist`;
        GraphHistory.register('rename', {name: name, old_name: this.id});
        if(this.id) window.MathGraph.all_label.delete(this.id); 
        if(name) window.MathGraph.all_label.set(name, this);
        this.id = name;
        this.html_div.querySelector('.header').textContent = name;
    }
    /**@param {String} link */
    reference(link) {
        throw new Error('this feature has not been implemented');
    }
    get renderer() {
        return this.html_div.querySelector('.tex_render');
    }
    get root() {
        if(!this.parent) return this;
        return this.parent.root;
    }
    get child_div() {
        if(!this.parent) return document.querySelector('.graph');
        return this.html_div.querySelector('.children');
    }
    get is_maximize() {
        return this.html_div.classList.contains('maximized');
    }
}
function is_node_component(elem) {
    while(elem && !elem.assoc_node) elem = elem.parentNode;
    return elem?.assoc_node;
}
document.addEventListener('DOMContentLoaded', (e) => {
    const EDIT = 0, MIN = 1, MAX = 2, DETAIL = 3, REF = 4, RENAME = 5, REMOVE = 6;
    Menu.node = new Menu(document.getElementById('rightclick'));
    let menu = Menu.node.items.childNodes;
    menu[EDIT].onclick = (e) => editor.load(Menu.node.associate);
    menu[MAX].onclick = (e) => UI.signal(Menu.node.associate.maximize());
    menu[MIN].onclick = (e) => Menu.node.associate.minimize();
    menu[DETAIL].onclick = (e) => UI.focus(Menu.node.associate)
    menu[REF].onclick = (e) => UI.new_edge(Menu.node.associate, e);
    menu[RENAME].onclick = (e) => {
        let input = document.createElement('input');
        let viewpoint  = document.documentElement.getBoundingClientRect();
        let position = Menu.node.highlighted.getBoundingClientRect();
        input.className = "rename";
        input.value = Menu.node.associate.id;
        input.style.left = `${position.left - viewpoint.left}px`;
        input.style.top = `${position.top - viewpoint.top }px`;
        document.body.appendChild(input);
        input.focus();
        input.addEventListener('focusout', () => document.body.removeChild(input));
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') UI.signal(Menu.ref_node.rename(input.value)), input.style.display = "none";
        });
        Menu.node.hide();
    };
    menu[REMOVE].onclick = (e) => {
        if(window.confirm(`Do you want to delete this node?`)) Menu.node.associate.remove();
    }
});