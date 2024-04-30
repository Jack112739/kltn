"use strict";




const GRAPH_HISTORY_MAX = 65536;

class GraphHistory {
    static stack = [];
    static position = 0;
    static active = false;
    static register(command, data) {
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
    }
    static undo() {
        this.active = true;
        if(this.position === 0) return;
        let command = this.stack[this.position - 1];
        switch(command.type) {
        case 'make_edge':
            command.from.math.to.get(command.to).remove();
            break;
        case 'remove_edge':
            EdgeUI.create(command.ref ? command.from.ref: command.from, command.to);
            break;
        case 'release_truncate':
            command.node.truncate();
            break;
        case 'gravity':
            command.from.display.to.get(command.to).repr.setOptions({
                startSocketGravity: command.old_start, 
                endSocketGravity: command.old_end
            });
            break;
        case 'create':
            command.node.remove();
            break;
        case 'move':
            this.move_node(command.to, command.from, command.node);
            break;
        case 'zoom':
            command.node.toggle_detail();
            break;
        case 'grab':
            this.grab_node(command.node, -command.dx, -command.dy);
            break;
        case 'remove':
            command.node.parent.children.add(command.node);
            command.node.parent.child_div.appendChild(command.node.html_div);
            for(const edge of command.reserve_external) EdgeUI.create(edge.alias, edge.to);
            for(const [_, edge] of command.reserve_to) EdgeUI.create(edge.alias, edge.to);
            command.node.modify_name_recursive('set');
            break;
        case 'rename':
            command.node.rename(command.old_name);
            break;
        case 'truncate':
            command.node.ref.release_truncate();
            break;
        case 'jump':
            GraphUI.focus(command.from);
            break;
        case 'edit':
            command.node.rename(command.old_name);
            command.node.raw_text = command.old_data;
            command.node.renderer.innerHTML = command.old_html;
            for(const edge of command.new_edge) command.node.math.from.get(edge).remove();
            break;
        default:
            GraphUI.signal('unknow undo option');
            break;
        }
        this.active = false;
        this.position--;
    }
    static redo() {
        this.active = true;
        if(this.position === this.stack.length) return;
        let command = this.stack[this.position];
        switch(command.type) {
        case 'make_edge':
            EdgeUI.create(command.ref ? command.from.ref: command.from, command.to);
            break;
        case 'remove_edge':
            command.from.math.to.get(command.to).remove()
            break;
        case 'release_truncate':
            command.node.ref.release_truncate();
            break;
        case 'gravity':
            command.from.display.to.get(command.to).repr.setOptions({
                startSocketGravity: command.start,
                endSocketGravity: command.end
            })
            break;
        case 'create':
            command.node.parent.children.add(command.node);
            command.node.parent.child_div.appendChild(command.node.html_div);
            break;
        case 'move':
            this.move_node(command.from, command.to, command.node);
            break;
        case 'zoom':
            command.node.toggle_detail();
            break;
        case 'grab':
            this.grab_node(command.node, command.dx, command.dy);
            break;
        case 'rename':
            command.node.rename(command.name);
            break;
        case 'truncate':
            command.node.truncate();
            break;
        case 'jump':
            GraphUI.focus(command.to);
            break;
        case 'edit':
            command.node.rename(command.name);
            command.node.raw_text = command.data;
            command.node.renderer.innerHTML = command.html;
            link_all_references(command.node, command.node.renderer);
            break;
        default:
            GraphUI.signal('unknow redo command');
            break;
        }
        this.position++;
        this.active = false;
    }
    /**@param {DOMRect} from @param {DOMRect} to  @param {NodeUI} node  */
    static move_node(from, to, node) {
        let div_xy = node.html_div;
        let div_wh = node.is_maximize ? node.child_div : node.renderer;
        div_xy.style.top = div_xy.offsetTop + to.top - from.top + "px";
        div_xy.style.left = div_xy.offsetLeft + to.left - from.left + "px";
        div_wh.style.width = div_wh.offsetWidth + to.width - from.width - 15  + "px";
        div_wh.style.height = div_wh.offsetHeight + to.height - from.height - 15 + "px";
        node.reposition();
    }
    /**@param {NodeUI} node, @param {number} dx @param {number} dy  */
    static grab_node(node, dx, dy) {
        node.child_div.scrollTop  += dy;
        node.child_div.scrollLeft += dx;
        for(const edge of node.external_ref) edge.reposition();
    }
}
document.addEventListener('keydown', (e) => {
    if(document.querySelector('.overlay').style.display === "block" || !e.ctrlKey) return;
    if(e.key === 'z') { e.preventDefault(); GraphHistory.undo(); }
    if(e.key === 'y') { e.preventDefault(); GraphHistory.redo(); }
    if(e.key === '=') { e.preventDefault(); GraphUI.rescale('relative', 1/0.9); }
    if(e.key === '-') { e.preventDefault(); GraphUI.rescale('relative', 0.9); }
})
/** Edit types
 * make_edge {from, to}
 * remove_edge {from, to}
 * release_truncate {node}
 * gravity {start, end, old_start, old_end, start, end}
 * 
 * create {node}
 * move {node, from, to}
 * zoom {node}
 * grab {node, dx, dy}
 * remove {node, reserve_to, reserve_external}
 * rename {name, old_name}
 * truncate {node}
 * 
 * jump {from, to}
 * 
 * edit {node, data, html, name}
 */
//TODO: rewrite resize function for Node, complete compose action