
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
    /**@type {'input' | 'output' | 'referenced'| 'lemma' | 'definition' |''} */
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
        if(id.includes('definition:')) this.math_logic = 'definition';
        else if(id.includes('lemma:') || id.includes('theorem')) this.math_logic = 'lemma';
        this.raw_text = "";
        this.from = new Map();
        this.to = new Map();
        this.highlighted = false;
        //TODO: initialize the detail of this node
        this.detail = null;
        this.graph = graph;
        
        this.html_div = document.createElement('div');
        this.html_div.className = "node";
        this.html_div.insertAdjacentHTML('beforeend', `
            <div class="header">${map_to_html(id)}</div>
            <div class="tex_render"></div>
        `);
    
        graph?.internal_nodes.set(this.id, this);
        graph?.html_div.appendChild(this.html_div);

        this.html_div.onmousedown = (e) => {
            //check for resize event
            let rect = this.html_div.getBoundingClientRect(), click = true;
            if(rect.bottom < e.clientY + 8 && rect.right < e.clientX + 8) return;
            e.preventDefault();
            let relative_x = this.html_div.offsetLeft - e.clientX;
            let relative_y = this.html_div.offsetTop - e.clientY;
            document.body.style.cursor = "grab";

            document.onmousemove = (e) => {
                document.body.style.cursor = "grabbing";
                click = false;
                this.html_div.style.left = e.clientX + relative_x + "px";
                this.html_div.style.top = e.clientY + relative_y + "px";
                for(let [_, in_edges] of this.from) in_edges.position();
                for(let [_, out_edges] of this.to) out_edges.position();
            }
        
            document.onmouseup = (e) => {
                let new_rect = this.html_div.getBoundingClientRect();
                if(!click) GraphHistory.register('move', {node: this, from: rect, to: new_rect});
                document.body.style.cursor = "";
                document.onmousemove = null;
                document.onmouseup = null;
            }
        }
        this.html_div.ondblclick = (e) => {
            if(this.math_logic !== 'lemma' && this.math_logic !== '') {
                return alert(`only sublemma node can have further explaination`);
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
            Menu.rightclicked.popup(e);
        }
        this.html_div.assoc_node = this;
        GraphHistory.register('create', {node: this, graph: graph});
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
    remove(recursive) {
        if(this.math_logic === 'input' || this.math_logic === 'output') {
            return alert(`can not delete ${this.math_logic} node`);
        }
        if(recursive) this.detail?.remove_childs();
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
        GraphHistory.register('remove', {node: this});
    }
    get parent() {
        return this.graph?.summary;
    }
    /** @param {String} name  */
    rename(name) {
        if(window.graph_is_readonly) return alert("can not rename node in readonly mode");
        if(name === this.id) return;
        if(this.math_logic === 'referenced') {
            return alert('can not rename referenced node');
        }
        if(this.graph?.resolve(name)) {
            return alert(`there already is another node with name ${name}`);
        }
        GraphHistory.register('rename', {node: this, name: name, old_name: this.id});
        this.graph?.internal_nodes.delete(this.id);
        this.graph?.internal_nodes.set(name, this);
        this.id = name;
        this.html_div.querySelector('.header').firstChild.data = name;
        if(name.includes('definition:')) this.math_logic = 'definition';
        else if(name.includes('lemma:') || name.includes('theorem')) this.math_logic = 'lemma';
    }
    /** @param {NodeUI} to */
    connect(to) {
        if(window.graph_is_readonly) return alert("can not reference other node in readonly mode");
        if(this.graph !== GraphUI.current_graph) {
            GraphUI.current_graph.html_div.appendChild(to.html_div);
            GraphUI.current_graph.html_div.appendChild(this.html_div);
        }
        let line = new LeaderLine(this.html_div, to.html_div, {path: 'straight', size: 3});
        document.body.lastChild.querySelector('path').addEventListener('click', (e) => {
            let mode = document.querySelector('.fa-eye-slash');
            if(!mode) return;
            let is_hidden = line.color === 'coral';
            line.setOptions({color: is_hidden ? 'rgba(255,127,80,0.5)' : 'coral'});
            this.graph.hidden_edges[is_hidden ? 'add': 'delete'](line);
        });
        this.to.set(to, line);
        to.from.set(this, line);
        if(this.graph !== GraphUI.current_graph) {
            this.graph.html_div.appendChild(to.html_div);
            this.graph.html_div.appendChild(this.html_div);
            line.hide('none');
        }
        GraphHistory.register('connect', {from: this, to: to});
    }
    /**@param {String} link */
    reference(link) {
        let from = this.graph.resolve(link);
        if(!from) return false;
        let count = 0;
        GraphHistory.register('compose_start', {reason: 'ref', count: 0, link: link});

        for(let climb = this; true; climb = climb.parent) {
            let origin_node = climb.graph.internal_nodes.get(from.id);
            if(origin_node) {
                if(!origin_node.to.has(climb)) {
                    origin_node.connect(climb);
                    count++;
                }
                break;
            }
            let ref = new NodeUI(from.id, climb.graph);
            ref.math_logic = 'referenced';
            ref.detail = from.detail;
            ref.html_div.classList.add('referenced');
            ref.renderer.style.display = "none";
            ref.connect(climb);
            count += 2;
        }
        GraphHistory.register('compose_end', {reason: 'ref', count: count + 1, link: link});
        return true;
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
    /**@type {Set<LeaderLine>}  */
    hidden_edges;

    static current_graph;

    constructor(summary) {
        this.summary = summary;
        if(this.summary.detail === null) this.summary.detail = this;
        this.highlighting = null;
        this.create_math_logic();
        this.create_html();
        this.mode = "math";
        this.hidden_edges = new Set();
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
    }
    //TODO: recursively remove all the child
    remove_childs() {
        for(let [id, node] of this.internal_nodes) {
            node.remove(true);
        }
    }
    //pop up the edit window for that specific node
    switch_to(graph) {
        let hide_button = document.querySelector('.hide');
        if(hide_button.querySelector('.fa-eye-slash')) hide_button.click();
        for(let button of graph.html_div.querySelectorAll('.parent')) {
            if(button.assoc_node) button.firstChild.data = button.assoc_node.id;
        }
        GraphUI.current_graph = graph;
        this.hide_edges();
        graph.show_edges();
        document.body.replaceChild(graph.html_div, this.html_div);
        GraphHistory.register('jump', {from: this, to: graph});
    }
    show_edges() {
        for(let [_, node] of this.internal_nodes) {
            for(let [_, edge]  of node.from) if(edge.color === 'coral') edge.show('none'); 
        }
    }
    hide_edges() {
        for(let [_, node] of this.internal_nodes) {
            for(let [_, edges]  of node.from) edges.hide('none'); 
        }
    }
    static delete_edge(edge) {
        let from = edge.start.assoc_node;
        let to = edge.end.assoc_node;
        GraphHistory.register('rmedge', {from: from, to: to});
        edge.remove();
        from.to.delete(to);
        to.from.delete(from);
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
        let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 3});
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
        if(window.graph_is_readonly) return alert("can create or edit node in readonly mode");
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
    /**@param {String} name @returns {NodeUI?}  */
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
    GraphHistory.active = true;
    GraphUI.current_graph = new GraphUI(new NodeUI('playground', null));
    GraphHistory.active = false;
    document.body.appendChild(GraphUI.current_graph.html_div);
    document.onmousedown = GraphUI.highlight_unique;
    document.addEventListener('click', GraphUI.monitor_node_at_cursor);
    document.querySelector('.undo').onclick = () => GraphHistory.undo();
    document.querySelector('.redo').onclick = () => GraphHistory.redo();
    document.querySelector('.hide').onclick = (e) => {
        let button = document.querySelector('.hide');
        let on = button.querySelector('.fa-eye'), effect = e.isTrusted ? undefined : 'none';
        button.firstChild.className = on ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        button.setAttribute('title', on ? 'hide all selected edges': 'show hidden edges');
        for(const line of GraphUI.current_graph.hidden_edges) {
            on ? line.show(effect) : line.hide(effect);
        }
    };
});
