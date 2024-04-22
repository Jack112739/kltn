const GRAPH_HISTORY_MAX = 65536;

const GraphHistory = {
    stack : [],
    position : 0,
    active : false,
    register: function(command, data) {
        if(this.active) return;
        while(this.stack.length > this.position) this.stack.pop();
        if(this.stack.length === GRAPH_HISTORY_MAX) {
            for(let i = 0; i < GRAPH_HISTORY_MAX / 2; i++ ) {
                this.stack[i] = this.stack[i + GRAPH_HISTORY_MAX/2];
            }
            for(let i = 0; i < GRAPH_HISTORY_MAX / 2; i++) this.stack.pop();
        }
        data.type = command;
        this.stack.push(data);
        this.position = this.stack.length;
        return;
    },
    undo: function() {
        this.active = true;
        if(this.position === 0) return;
        let command = this.stack[this.position - 1];
        switch(command.type) {
        case 'create':
            command.node.remove();
            break;
        case 'move':
            let div = command.node.html_div;
            let x_diff = command.from.x - command.to.x;
            let y_diff = command.from.y - command.to.y;
            div.style.top = div.offsetTop + y_diff + "px";
            div.style.left = div.offsetLeft + x_diff + "px";
            for(const [_, line] of command.node.from) line.position();
            for(const [_, line] of command.node.to) line.position();
            break;
        case 'remove':
            let graph = command.node.graph;
            graph.html_div.appendChild(command.node.html_div);
            for(const [id, _] of command.node.to) command.node.connect(id);
            for(const [id, _] of command.node.from) id.connect(command.node);
            graph.internal_nodes.set(command.node.id, command.node);
            command.node.modify_name_recursive('add');
            break;
        case 'jump':
            GraphUI.current_graph.switch_to(command.from);
            break;
        case 'connect':
            GraphUI.delete_edge(command.from.to.get(command.to));
            break;
        case 'rmedge':
            command.from.connect(command.to);
            break;
        case 'rename':
            command.node.rename(command.old_name);
            break;
        case 'edit':
            command.node.raw_text = command.old_data;
            command.node.renderer.innerHTML = command.old_html;
            break;
        case 'compose_end':
            this.position--;
            while(this.stack[this.position - 1].type !== 'compose_start') this.undo();
        }
        this.active = false;
        this.position--;
    },
    redo: function() {
        this.active = true;
        if(this.position === this.stack.length) return;
        let command = this.stack[this.position];
        switch(command.type) {
        case 'create':
            let graph = command.node.graph;
            graph.html_div.appendChild(command.node.html_div);
            graph.internal_nodes.set(command.node.id, command.node);
            break;
        case 'move':
            let div = command.node.html_div;
            let x_diff = command.to.x - command.from.x;
            let y_diff = command.to.y - command.from.y;
            div.style.top = div.offsetTop + y_diff + "px";
            div.style.left = div.offsetLeft + x_diff + "px";
            for(const [_, line] of command.node.from) line.position();
            for(const [_, line] of command.node.to) line.position();
            break;
        case 'remove':
            command.node.remove();
            break;
        case 'jump':
            GraphUI.current_graph.switch_to(command.to);
            break;
        case 'connect':
            command.from.connect(command.to);
            break;
        case 'rmedge':
            GraphUI.delete_edge(command.from.to.get(command.to));
        case 'rename':
            command.node.rename(command.name);
            break;
        case 'edit':
            command.node.renderer.innerHTML = command.html;
            command.node.raw_text = command.data;
            break;
        case 'compose_start':
            this.position++;
            while(this.stack[this.position].type !== 'compose_end') this.redo();
        }
        this.position++;
        this.active = false;
    }
}
document.addEventListener('keydown', (e) => {
    if(editor.div.style.display !== "none" || !e.ctrlKey) return;
    if(e.key === 'z') { e.preventDefault(); GraphHistory.undo(); }
    if(e.key === 'y') { e.preventDefault(); GraphHistory.redo(); }
})
/** Edit types
 * create {node}
 * move {node: NodeUI, from: DOMRect, to: DOMRect}
 * remove {node: NodeUI}
 * connect {from: NodeUI, to: NodeUI}
 * jump {from: GraphUI, to: GraphUI} 
 * edit {node: NodeUI, name: str, old_name: str, data: str, old_data: str, compose: int}
 * compose_start {count:int, data...}
 * compose_end {reason: str, data...}
 */
//TODO: rewrite resize function for Node, complete compose action