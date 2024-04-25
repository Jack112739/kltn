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
            this.move_node(command.to, command.from, command.node);
            break;
        case 'remove':
            command.node.parent.child_div.appendChild(command.node.html_div);
            for(const [id, _] of command.node.to) command.node.connect(id);
            for(const [id, _] of command.node.from) id.connect(command.node);
            for(const line of command.node.external_ref) {
                line.start.assoc_node.to.set(line.end.assoc_node, line);
                line.show("none");
            }
            command.node.modify_name_recursive('set');
            break;
        case 'jump':
            UI.switch_to(command.from);
            break;
        case 'edge':
            UI.edge_option(command.edge, command.old_option, command.old_data);
            break;
        case 'mkede':
            UI.remove_edge(command.from, command.to);
            break;
        case 'rmedge':
            UI.make_edge(command.from, command.to);
            break;
        case 'rename':
            command.node.rename(command.old_name);
            break;
        case 'zoom':
            command.node.toggle_detail();
            break;
        case 'edit':
            command.node.raw_text = command.old_data;
            command.node.renderer.innerHTML = command.old_html;
            command.node.rename(command.old_name);
            break;
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
            command.node.parent.child_div.appendChild(command.node.html_div);
            break;
        case 'move':
            this.move_node(command.from, command.to, command.node);
            break;
        case 'remove':
            command.node.remove();
            break;
        case 'jump':
            UI.switch_to(command.to);
            break;
        case 'connect':
            command.from.connect(command.to);
            break;
        case 'edge':
            UI.edge_option(command.edge, command.option);
            break;
        case 'rmedge':
            UI.remove_edge(command.from, command.to);
            break;
        case 'mkedge':
            UI.make_edge(command.from, command.to);
            break;
        case 'rename':
            command.node.rename(command.name);
            break;
        case 'zoom':
            command.node.toggle_detail();
            break;
        case 'edit':
            command.node.renderer.innerHTML = command.html;
            command.node.raw_text = command.data;
            command.node.rename(command.name);
            break;
        }
        this.position++;
        this.active = false;
    },
    move_node: function(from, to, node) {
        let div_xy = node.html_div;
        let div_wh = node.is_maximize ? node.child_div : node.renderer;
        div_xy.style.top = div_xy.offsetTop + to.top - from.top + "px";
        div_xy.style.left = div_xy.offsetLeft + to.left - from.left + "px";
        div_wh.style.width = div_wh.offsetWidth + to.width - from.width - 10 + "px";
        div_wh.style.height = div_wh.offsetHeight + to.height - from.height - 10 + "px";
    }
}
document.addEventListener('keydown', (e) => {
    if(document.querySelector('.overlay').style.display === "block" || !e.ctrlKey) return;
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
 * edge {edge: LeaderLine, option: str, old_option: str, data, old_data}
 * mkedge {from: node, to: node}
 * rmedge {from: node, to: node}
 */
//TODO: rewrite resize function for Node, complete compose action