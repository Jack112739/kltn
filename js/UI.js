

//setup function for this page
(function setup() {
    document.onmousedown = highlight_unique;
})()


/**
 * Represent the element of the proof, as a directed graph
 * 
 */
class NodeUI {

    //String, name of the node
    id;
    
    // <div>, mathjax will render math here
    display_math;

    // The raw latex string
    raw_math;
    
    // <div>, the header of the node, will contain delete button, id
    header;
    
    // editor_ui, user double click this to edit the math content
    editor;
    
    // TODO: add this properties
    // //Math structure of this node
    // math
    //list of {LeaderLines, Node}, the in edges
    from; 
    //list of {LeaderLines, Node}, the out edges
    to;
    //
    constructor(id) {
        this.id = id;
        this.raw_math = "";
        this.from = [];
        this.to = [];
        
        let html_div = document.createElement('div');
        html_div.classList.add("node");
        
        this.create_header();
        this.create_math();
        this.create_editor();

        this.header.onmousedown = (e) => {
            e.preventDefault();
            let relative_x = html_div.offsetLeft - e.clientX;
            let relative_y = html_div.offsetTop - e.clientY;

            document.onmousemove = (e) => {
                html_div.style.left = e.clientX + relative_x + "px";
                html_div.style.top = e.clientY + relative_y + "px";
                // fuck javascript for in syntax
                for(let in_edges of this.from) in_edges.display.position();
                for(let out_edges of this.to) out_edges.display.position();
            }
            document.onmouseup = (e) => {
                document.onmousemove = null;
                document.onmouseup = null;
            }
        }

        html_div.appendChild(this.header);
        html_div.appendChild(this.display_math);
        html_div.appendChild(this.editor);
        html_div.assoc_node = this;
        
        document.body.appendChild(html_div);
    }
    create_header() {
        this.header = document.createElement('div');
        this.header.classList.add("node_header");
        this.header.innerHTML += this.id;

        let close_button = document.createElement('button');
        close_button.onclick = () => {
            for(let in_edges of this.from) in_edges.display.remove()
            for(let out_edges of this.to) out_edges.display.remove();
            document.body.removeChild(this.header.parentNode);
        }
        close_button.classList.add("close_button");
        close_button.innerHTML += `<i class="fa fa-close"></i>`

        this.header.appendChild(close_button);
    }
    //will be added laters
    create_editor() {
        this.editor = document.createElement('textarea');
        this.editor.classList.add("tex");
        this.editor.style.display = "none";
    }
    create_math() {
        this.display_math = document.createElement('div');
        this.display_math.classList.add("tex_render");

        let show_raw_math = (e) => {
            this.display_math.ondblclick = null;
            this.display_math.style.display = "none";

            this.editor.onblur = () => {
                this.raw_math = this.editor.value;
                this.display_math.ondblclick = show_raw_math;
                this.display_math.style.display = "block";
                this.display_math.innerHTML = '';
                this.display_math.appendChild(document.createTextNode(this.raw_math));
                         
                this.editor.value = "";
                this.editor.style.display = "none";
                this.editor.onblur = null;
                this.display_math.style.width = this.editor.style.width;
                this.display_math.style.height = this.editor.style.height;

                MathJax.typeset();
            };

            this.editor.style.width = this.display_math.style.width;
            this.editor.style.height = this.display_math.style.height;
            this.editor.value = this.raw_math;
            this.editor.style.display = "block";
            this.editor.focus();
        }
        this.display_math.ondblclick = show_raw_math;
    }
    highlight(notdisturb) {
        let assoc_node = this.header.parentNode;
        assoc_node.style.zIndex = 20;
        assoc_node.style.borderColor = "yellow";
        if(notdisturb) this.notdisturb = notdisturb;
    }
    fade() {
        if(this.notdisturb) return;
        let assoc_node = this.header.parentNode;
        assoc_node.style.zIndex = 9;
        assoc_node.style.borderColor = "aqua";
    }
}

//TODO: fix this function properly! the latex component will not render when mouse over it,
//might rewrite later
function is_node_component(elem) {
    return elem?.parentNode?.assoc_node;
}

let counter = 0, highlighting = null;

function highlight_unique(e) {
    let node = is_node_component(e.target);
    highlighting?.fade();
    if(!node || node.notdisturb) return;
    highlighting = node;
    node.highlight();
};

function new_node() {
    counter++;
    new NodeUI(`${counter}`);
}

function new_edge(e) {
    e.stopPropagation();
    highlighting?.fade();
    document.body.style.cursor = "pointer"
    
    document.onclick = (e) => {
        e.stopPropagation();
        start = is_node_component(e.target);
        if(!start) {
            document.body.style.cursor = "";
            document.onmousedown = highlight_unique;
            document.onclick = null;
            document.onmousemove = null;
            return;
        }
        
        let dot = document.getElementById("dot");
        dot.style.top = e.clientY + "px";
        dot.style.left = e.clientX + "px";
        dot.style.display = "block";
        
        start.highlight(true);
        let line = new LeaderLine(e.target.parentNode, dot, {dash: true});

        document.onmousemove = (e) => {
            dot.style.left = e.clientX + "px";
            dot.style.top = e.clientY + "px";
            line.position();

            highlight_unique(e);
        };
        document.onclick = (e) => {
            if(e.target == dot) return;
            let end = is_node_component(e.target);
            if(end && end != start) {
                line.setOptions({end: e.target.parentNode, dash: false});
                end.from.push({display: line, v: start});
                start.to.push({display: line, v: end});

            }
            else line.remove();

            end?.fade();
            start.notdisturb = undefined, start.fade();

            document.onmousemove = null;
            document.onclick = null;
            document.onmousedown = highlight_unique;
            document.body.style.cursor = "";
        };
    }
    document.onmousemove = highlight_unique;
}