
/**
 * Represent the element of the proof, as a directed graph
 * 
 */
class NodeUI {

    /**@type{string} name of the node */
    id;

    // @type{String}, The raw latex string
    raw_text;
    //TODO represent the logic behind the latex string, currently undefined
    /**@type {'input' | 'output' | 'referenced'} */
    math_logic = '';

    // @type{Map<NodeUI, LeaderLine>} the in-edges and out-edges of this node
    from; to;

    // @type{bool}, true if the node is highlight
    highlighted;

    /** @type{GraphUI} the detail of the proof presented in this node if needed */
    detail;

    /** @type{GraphUI}, the graph contain this node */ 
    graph;

    // @type{HTMLDivElement} the HTML element respected to this node
    html_div;

    constructor(id, graph) {
        this.id = id;
        this.raw_text = "";
        this.from = new Map();
        this.to = new Map();
        this.highlighted = false;
        this.detail = null;
        this.graph = graph;
        
        this.html_div = document.createElement('div');
        this.html_div.className = "node";
        this.html_div.insertAdjacentHTML('beforeend', `
            <div class="header">${id}</div>
            <div class="tex_render"></div>
        `);
    
        graph?.internal_nodes.set(this.id, this);
        graph?.html_div.appendChild(this.html_div);

        this.html_div.onmousedown = (e) => {
            //check for resize event
            let rect = this.html_div.getBoundingClientRect();
            if(rect.bottom < e.clientY + 8 && rect.left < e.clientX + 8) return;
            e.preventDefault();
            let relative_x = this.html_div.offsetLeft - e.clientX;
            let relative_y = this.html_div.offsetTop - e.clientY;
            document.body.style.cursor = "grab";

            document.onmousemove = (e) => {
                this.html_div.style.left = e.clientX + relative_x + "px";
                this.html_div.style.top = e.clientY + relative_y + "px";
                for(let [_, in_edges] of this.from) in_edges.position();
                for(let [_, out_edges] of this.to) out_edges.position();
            }
            document.onmouseup = (e) => {
                document.body.style.cursor = "";
                document.onmousemove = null;
                document.onmouseup = null;
            }
        }
        this.html_div.ondblclick = (e) => {
            if(this.math_logic === 'input' || this.math_logic === 'output') {
                return alert(`${this.math_logic} node don't have further explaination`);
            }
            if(this.detail === null) {
                //TODO: not allow if the math inside this is a simple substitution or using other lemma
                this.detail = new GraphUI(this);
            }
            GraphUI.current_graph.switch_to(this.detail);
        }
        this.html_div.oncontextmenu = (e) => {
            e.preventDefault();
            Menu.ref_node = this;
            let menu = Menu.rightclicked.items.childNodes;
            if(this.renderer.style.display === "none") {
                menu[MIN].style.display = "none";
                menu[MAX].style.display = "";
            }
            else {
                menu[MAX].style.display = "none";
                menu[MIN].style.display = "";
            }
            Menu.rightclicked.popup(e.clientX, e.clientY);
        }
        this.html_div.assoc_node = this;
    }
    highlight() {
        this.html_div.style.zIndex = 20;
        this.html_div.classList.add('highlighted');
        this.highlighted = true;
    }
    fade() {
        this.highlighted = false;
        let assoc_node = this.html_div;
        assoc_node.style.zIndex = 9;
        assoc_node.classList.remove('highlighted');
    }
    remove() {
        if(this.math_logic === 'input' || this.math_logic === 'output') {
            return alert(`can not delete ${this.math_logic} node`);
        }
        this.detail?.remove_childs();
        for(let[id, line] of this.from) {
            id.to.delete(this);
            line.remove();
        }
        for(let [id, line] of this.to) {
            id.from.delete(this);
            line.remove();
        }
        this.graph.html_div.removeChild(this.html_div);
        this.graph.internal_nodes.delete(this.id);
    }
    get parent() {
        return this.graph?.summary;
    }
    rename(name) {
        if(name === this.id) return;
        if(this.math_logic === 'referenced') {
            return alert('can not rename referenced node');
        }
        if(this.graph.resolve(name)) {
            return alert(`there already is another node with name ${name}`);
        }
        this.graph?.internal_nodes.delete(this.id);
        this.graph?.internal_nodes.set(name, this);
        this.id = name;
        this.html_div.querySelector('.header').firstChild.data = name;
    }
    /** @param {NodeUI} to */
    connect(to) {
        if(this.graph !== GraphUI.current_graph) {
            GraphUI.current_graph.html_div.appendChild(to.html_div);
            GraphUI.current_graph.html_div.appendChild(this.html_div);
        }
        let line = new LeaderLine(this.html_div, to.html_div, {path: 'straight', size: 2});
        this.to.set(to, line);
        to.from.set(this, line);
        if(this.graph !== GraphUI.current_graph) {
            this.graph.html_div.appendChild(to.html_div);
            this.graph.html_div.appendChild(this.html_div);
            line.hide();
        }
    }
    /**@param {NodeUI} from */
    reference(from) {
        let ref = null;
        if(ref = this.graph.internal_nodes.get(from.id)) {
            if(!ref.to.has(this)) ref.connect(this);
            return;
        }
        this.parent.reference(from);
        ref = new NodeUI(from.id, this.graph);
        ref.math_logic = 'referenced';
        ref.detail = from.detail;
        ref.html_div.classList.add('referenced');
        ref.renderer.style.display = "none";
        ref.connect(this);
    }
    get renderer() {
        return this.html_div.querySelector('.tex_render');
    }
    get root() {
        if(!this.parent) return this;
        return this.parent.root;
    }
}

function is_node_component(elem) {
    while(elem && !elem.assoc_node) elem = elem.parentNode;
    return elem?.assoc_node;
}

class GraphUI {
    
    /** @type{Map<String, NodeUI>} ; the nodes of this graph, containing the arguement */
    internal_nodes;

    /** @type{NodeUI}, the arguement need to explain in this */
    summary;
    /** @type{bool}  currently highlighted node */
    highlighting;
    /** @type{HTMLDivElement} web representation of this graph */
    html_div;
    /** @type{String}, math mode or draw mode, auto mode. */
    mode;
    /**@type {HistoryQueue} */
    history

    static current_graph;

    constructor(summary) {
        this.summary = summary;
        if(this.summary.detail === null) this.summary.detail = this;
        this.highlighting = null;
        this.create_math_logic();
        this.create_html();
        this.mode = "math";
    }
    //TODO: add this
    create_math_logic() {
        this.internal_nodes = new Map();
    }
    create_html() {
        this.html_div = document.createElement('div');
        this.html_div.classList.add('graph');
        let recursive = (node) => {
            if(!node) return;
            recursive(node.parent);

            let traverse = document.createElement('button');
            traverse.classList.add('parent');
            traverse.onclick = () => this.switch_to(node.detail);
            traverse.assoc_node = node;
            traverse.appendChild(document.createTextNode(node.id));
            this.html_div.appendChild(traverse);
        };
        recursive(this.summary);
        this.html_div.insertAdjacentHTML('beforeend', `
            <div class="toolbar">
            </div>
        `);
    }
    //TODO: recursively remove all the child
    remove_childs() {
        for(let [id, node] of this.internal_nodes) {
            node.remove();
        }
    }
    //pop up the edit window for that specific node
    switch_to(graph) {
        for(let button of graph.html_div.querySelectorAll('.parent')) {
            if(button.assoc_node) button.firstChild.data = button.assoc_node.id;
        }
        GraphUI.current_graph = graph;
        this.hide_edges();
        graph.show_edges();
        document.body.replaceChild(graph.html_div, this.html_div);
    }
    show_edges() {
        for(let [_, node] of this.internal_nodes) {
            for(let [_, edges]  of node.from) edges.show('none'); 
        }
    }
    hide_edges() {
        for(let [_, node] of this.internal_nodes) {
            for(let [_, edges]  of node.from) edges.hide('none'); 
        }
    }
    static highlight_unique(e) {
        let node = is_node_component(e.target);
        GraphUI.current_graph.highlighting?.fade();
        if(!node || node.highlighted) return;
        GraphUI.current_graph.highlighting = node;
        node.highlight();
    };
    static new_edge(start, e) {
        if(!e) return;
        e.stopPropagation();
        start.highlight();
        let dot = document.getElementById("dot"), move;
        let viewpoint  = document.documentElement.getBoundingClientRect();
        dot.style.left = `${e.clientX - viewpoint.left}px`;
        dot.style.top = `${e.clientY - viewpoint.top }px`;
        dot.style.display = "block";
        let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 2});
        document.addEventListener('mousemove', move =  e => {
            GraphUI.highlight_unique(e);
            dot.style.left = `${e.clientX - viewpoint.left}px`;
            dot.style.top = `${e.clientY - viewpoint.top }px`;
            line.position();
        });
        document.addEventListener('click', e => {
            let end = is_node_component(e.target);
            line.remove();
            if(end && end != start && !start.to.has(end)) start.connect(end);
            dot.style.display = "none";
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    static monitor_node_at_cursor(e) {
        if(!e.ctrlKey) return;

        document.removeEventListener('click', GraphUI.monitor_node_at_cursor);
        let node = is_node_component(e.target);
        if(!node) {
            window.counter++;
            node = new NodeUI('#' + window.counter, GraphUI.current_graph);
            let viewpoint = document.documentElement.getBoundingClientRect();
            node.html_div.style.top = `${e.clientY - viewpoint.top}px`;
            node.html_div.style.left = `${e.clientX - viewpoint.left}px`
        }
        editor.load(node);
    }
    /**@returns {Array<String>} */
    get_name() {
        let names = this.summary?.graph ? this.summary.graph.get_name() : [];
        for(const [key, val] of this.internal_nodes) names.push(key);
        return names;
    }
    /**@param {String} name @returns {NodeUI}  */
    resolve(name) {
        let ret = this.internal_nodes.get(name);
        return ret ?? this.parent?.resolve(name);
    }
    get parent() {
        return this.summary?.graph;
    }
}

//setup function
document.addEventListener('DOMContentLoaded', () => {
    window.counter = 0;
    GraphUI.current_graph = new GraphUI(new NodeUI('#root', null));
    document.body.appendChild(GraphUI.current_graph.html_div);
    document.onmousedown = GraphUI.highlight_unique;
    document.addEventListener('click', GraphUI.monitor_node_at_cursor);
});
