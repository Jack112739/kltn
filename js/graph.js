
/**
 * Represent the element of the proof, as a directed graph
 * 
 */
class Node {

    //String, name of the node
    id;
    
    // <div>, mathjax will render math here
    display_math;

    // The raw latex string
    raw_math;
    
    // <div>, the header of the node, will contain delete button, id
    header;
    
    // <textarea>, user double click this to edit the math content
    editor;
    
    //<div> the associated element of this node
    assoc_elem;
    
    // TODO: add this properties
    // //String, type of the node
    // type;
    // //Node[], in edges
    // from; 
    // //Node[], out edges
    // to;
    constructor(id) {
        this.id = id;
        this.raw_math = "";
        
        let html_node = document.createElement('div');
        html_node.classList.add("node");
        
        html_node.onmousedown = (e) => {
            let relative_x = html_node.offsetLeft - e.clientX;
            let relative_y = html_node.offsetTop - e.clientY;

            document.onmousemove = (e) => {
                html_node.style.left = e.clientX + relative_x + "px";
                html_node.style.top = e.clientY + relative_y + "px";
            }
            document.onmouseup = (e) => {
                document.onmousemove = null;
                document.onmouseup = null;
            }

            if(window.previous_node !== undefined) previous_node.style.zIndex = 9;
            html_node.style.zIndex = 20;
            window.previous_node = html_node;
        }

        this.create_header();
        this.create_math();
        this.create_editor();

        html_node.appendChild(this.header);
        html_node.appendChild(this.display_math);
        html_node.appendChild(this.editor);
        
        this.assoc_elem = html_node;
        document.body.appendChild(html_node);
    }
    create_header() {
        console.log(this);
        this.header = document.createElement('div');
        this.header.classList.add("node_header");
        this.header.innerHTML += this.id;

        let close_button = document.createElement('button');
        close_button.onmousedown = () => {
            document.body.removeChild(this.assoc_elem);
        }
        close_button.classList.add("close_button");
        close_button.innerHTML+= "x";

        this.header.appendChild(close_button);
    }
    create_editor() {
        this.editor = document.createElement('textarea');
        this.editor.classList.add("tex");
        this.editor.style.display = "none";
    }
    create_math() {
        this.display_math = document.createElement('div');
        this.display_math.classList.add("tex_render");

        let show_math = (e) => {

            this.display_math.ondblclick = null;
            this.display_math.style.display = "none";

            this.editor.onblur = () => {
                this.editor.value = "";
                this.editor.style.display = "none";
                this.editor.onblur = null;

                this.raw_math = this.editor.value;
                this.display_math.ondblclick = show_math;
                this.display_math.style.display = "block";

                MathJax.Hub.Queue(["Typeset", MathJax.Hub, this.display_math]);
            };

            this.editor.value = this.raw_math;
            this.editor.style.display = "block";
            this.editor.focus();
        }
        this.display_math.ondblclick = show_math;
    }
}


let counter = 0;

function test() {
    counter++;
    new Node(`#${counter}`)
}