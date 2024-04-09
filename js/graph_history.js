const GRAPH_HISTORY_MAX = 1024;

const GraphHistory = {
    stack : [],
    position : 0,
    active : false,
    register: function(command, data) {
        if(this.active) return;
        while(this.stack.length > this.position) this.stack.pop();
        if(this.stack.length === GRAPH_HISTORY_MAX) this.stack.shift();
        data.type = command;
        this.stack.push(data);
        this.position = this.stack.length;
        return;
    },
    undo: function() {
        this.active = true;
        if(this.position === 0) return;
        let command = this.stack[this.position];
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
            break;
        case 'remove':
            let graph = command.node.graph;
            graph.html_div.appendChild(command.node.html_div);
            for(const [id, _] of command.node.to) command.node.connect(id);
            for(const [id, _] of command.node.from) id.connect(command.node);
            graph.internal_nodes.set(command.node.id, command.node);
            break;
        case 'connect':
            command.from.to.delete(command.to);
            command.to.from.delete(command.from);
            break;
        case 'edit':
            command.node.rename(command.old_name);
            command.node.renderer.innerHTML = command.old_data;
            break;
        case 'jump':
            GraphUI.current_graph.switch_to(command.from);
            break;
        case 'ref':
            throw new Error('bug');
            let node = command.node;
            while(true) {
                let ref_node = node.graph.internal_nodes.get(command.link);
                if(node !== command.reach) ref_node.remove();
                else {
                    if(command.reconnect) {
                        ref_node.to.delete(node);
                        node.from.delete(ref_node);
                    }
                    break;
                }
            }
            break;
        }
        this.active = false;
        this.position--;
    },
    redo: function() {
        this.active = true;
        if(this.position === this.active.length) return;
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
            break;
        case 'remove':
            command.node.remove();
            break;
        case 'edit':
            command.node.rename(command.name);
            command.node.renderer.innerHTML = command.data;
            //compose action
            break;
        case 'connect':
            command.from.connect(command.to);
            break;
        case 'ref':
            throw new Error('bug');
        case 'jump':
            GraphUI.current_graph.switch_to(command.to);
            break;
        }
        this.position++;
        this.active = false;
    }
}
document.addEventListener('keydown', (e) => {
    if(e.ctrlKey && e.key === 'z') { e.preventDefault(); GraphHistory.undo(); }
    if(e.ctrlKey && e.key === 'y') { e.preventDefault(); GraphHistory.redo(); }
})
/** Edit types
 * create {node}
 * move {node: NodeUI, from: DOMRect, to: DOMRect}
 * remove {node: NodeUI}
 * edit {node: NodeUI, name: str, old_name: str, data: str, old_data: str, compose: int} compose action
 * connect {from: NodeUI, to: NodeUI}
 * ref {node: NodeUI, link: str, reach: NodeUI, reconnect: bool, compose: int} composed action
 * jump {from: GraphUI, to: GraphUI} 
 */
//TODO: rewrite resize function for Node, complete compose action