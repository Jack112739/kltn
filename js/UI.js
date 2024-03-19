
/**
 * Represent the element of the proof, as a directed graph
 * 
 */
class NodeUI {

    //String, name of the node
    id;

    //String, The raw latex string
    raw_text;
    //TODO represent the logic behind the latex string, currently undefined
    math_logic;

    // Map<NodeUI, LeaderLine> the in-edges and out-edges of this node
    from; to;

    //bool, true if the node is highlight
    highlighted;

    //GraphUI the detail of the proof presented in this node if needed
    detail;

    //GraphUI, the graph contain this node
    graph;

    //the HTML element respected to this node
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
            <div class="node_header">${id}</div>
            <div class="tex_render"></div>
        `);

        this.html_div.onmousedown = (e) => {
            e.preventDefault();
            let relative_x = this.html_div.offsetLeft - e.clientX;
            let relative_y = this.html_div.offsetTop - e.clientY;

            document.onmousemove = (e) => {
                this.html_div.style.left = e.clientX + relative_x + "px";
                this.html_div.style.top = e.clientY + relative_y + "px";
                for(let [_, in_edges] of this.from) in_edges.position();
                for(let [_, out_edges] of this.to) out_edges.position();
            }
            document.onmouseup = (e) => {
                document.onmousemove = null;
                document.onmouseup = null;
            }
        }
        this.html_div.ondblclick = (e) => {
            if(this.detail === null) {
                //TODO: not allow if the math inside this is a simple substitution or using other lemma
                this.detail = new GraphUI(this);
            }
            GraphUI.current_graph.switch_to(this.detail);
        }
        this.html_div.assoc_node = this;
    }
    highlight() {
        this.html_div.style.zIndex = 20;
        this.html_div.style.borderColor = "red";
        this.highlighted = true;
    }
    fade() {
        this.highlighted = false;
        let assoc_node = this.html_div;
        assoc_node.style.zIndex = 9;
        assoc_node.style.borderColor = "aqua";
    }
    remove() {
        //TODO: some node can not be deleted, implement this
        if(this.graph.input === this || this.graph.output == this) {
            alert('can not delete the input and output node');
            return;
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
        this.graph?.internal_nodes.delete(this.id);
        this.graph?.internal_nodes.set(name, this);
        this.id = name;
        this.html_div.querySelector('.node_header').firstChild.data = name;
    }
}

function is_node_component(elem) {
    while(elem && !elem.assoc_node) elem = elem.parentNode;
    return elem?.assoc_node;
}

function user_mode(click, move) {
    return e => {
        e?.stopPropagation();
        let p_click = document.onclick, p_move = document.onmousemove;
        document.onmousemove = (e) => {
            GraphUI.highlight_unique(e);
            if(move) move(e);
        }
        document.onclick = (e) => {
            document.onclick = p_click;
            document.onmousemove = p_move;
            if(click) click(is_node_component(e.target), e);
        }
    }
}

class GraphUI {
    
    //Map; the nodes of this graph, containing the arguement
    internal_nodes;
    //Array; external nodes of the graph, which the proof of this graph depend on
    external_nodes;
    //NodeUI, what this arguement has
    input;
    //NodeUI what must be done in this arguement
    output;
    //NodeUI, the arguement need to explain in this
    summary;
    // currently highlighted node
    highlighting;
    // web representation of this graph
    html_div;
    //String, math mode or draw mode, auto mode.
    mode;

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
        this.external_nodes = new Array();
        this.input = this.output = null;
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
            traverse.insertAdjacentHTML('beforeend', node.id);
            this.html_div.appendChild(traverse);
        };
        recursive(this.summary);
        this.html_div.insertAdjacentHTML('beforeend', `
            <div class="toolbar">
                <button onclick="GraphUI.new_node('#'+ (++window.counter))">create</button>
                <button onclick="GraphUI.new_edge(event)">edge</button>
                <button onclick="user_mode(elem => elem.remove())()">delete</button>
                <button onclick="user_mode(elem => Editor.load(elem))()">edit</button>
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
    static new_node(id) {
        //TODO: this should popup a window for how should user create a node
        let new_node = new NodeUI(id, GraphUI.current_graph);
        GraphUI.current_graph.internal_nodes.set(id, new_node);
        GraphUI.current_graph.html_div.appendChild(new_node.html_div);
    }
    static new_edge(e) {
        user_mode((start,e) => {
            if(!start) return;
            let dot = document.getElementById("dot");
            dot.style.left = e.clientX + "px";
            dot.style.top = e.clientY + "px";
            dot.style.display = "block";
            let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 2});
            user_mode(end => {
                if(end && end != start && !start.to.has(end)) {
                    line.setOptions({end: end.html_div, dash: false});
                    end.from.set(start, line);
                    start.to.set(end, line);
                }
                else line.remove();
                dot.style.display = "none";
            }, e => {
                dot.style.left = e.clientX + "px";
                dot.style.top = e.clientY + "px";
                line.position();
            })(null);
        }, null)(e);
    }
}

//setup function for this page
(function setup() {
    window.counter = 0;
    GraphUI.current_graph = new GraphUI(new NodeUI('#root', null));
    document.body.appendChild(GraphUI.current_graph.html_div);
    document.onmousedown = GraphUI.highlight_unique;
})()