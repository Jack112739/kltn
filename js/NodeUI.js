
/**
 * Represent the element of the proof, as a directed graph
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
    childs;

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
    
        window.MathGraph.all_label.add(this.id);
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
            if(!['lemma', 'referenced', ''].includes(this.math_logic)) {
                return alert(`this type of node dont have further explaination`);
            }
            if(this.detail === null) {
                if(this.math_logic === 'referenced') {
                    let ref_node = this.graph.resolve(this.id);
                    if(!ref_node) return alert(`the node named ${this.id} has been deleted`);
                    else return ref_node.html_div.ondblclick();
                }
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
        this.graph.html_div.removeChild(this.html_div);
        this.graph.internal_nodes.delete(this.id);
        GraphHistory.register('remove', {node: this});
    }
    get parent() {
        return this.graph?.summary;
    }
    /** @param {String} name @returns {String | null} */
    rename(name) {
        
    }
    /** @param {NodeUI} to */
    connect(to) {
        if(to === this) return;
        if(window.MathGraph.readonly) return alert("can not reference other node in readonly mode");
        if(this.graph !== GraphUI.current_graph) {
            GraphUI.current_graph.html_div.appendChild(to.html_div);
            GraphUI.current_graph.html_div.appendChild(this.html_div);
        }
        let line = new LeaderLine(this.html_div, to.html_div, {path: 'straight', size: 3});
        document.body.lastChild.querySelector('path').onclick = (e) => this.edit_edge(e, line);
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
        
    }
    get renderer() {
        return this.html_div.querySelector('.tex_render');
    }
    get root() {
        if(!this.parent) return this;
        return this.parent.root;
    }
}